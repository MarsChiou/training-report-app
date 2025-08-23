// pages/MovementLibrary.tsx
import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import MovementCard from './components/MovementCard';
import Select from 'react-select';
import { useSearchParams, useNavigate } from 'react-router-dom';

/** ========= 小工具 ========= */
function isHttpUrl(s?: string) {
  if (!s) return false;
  return /^https?:\/\//i.test(s);
}
function splitContentToSteps(content?: string): string[] {
  if (!content) return [];
  // 嘗試把「1. 2. 3.」或「(1)(2)(3)」之類的段落切開；若切不到就整段回傳
  const parts = content
    .split(/\s*(?:^\d+[.)]|(?<=\s)\d+[.)]|\(\d+\))\s*/gm)
    .map(t => t.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [content.trim()];
  return parts;
}

/** ========= 圖片 Lazy 組件（含預設圖 & 錯誤 fallback） ========= */
function LazyImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [errorFallback, setErrorFallback] = useState(false);

    // ✅ src 有變就重置狀態
    useEffect(() => {
      setLoaded(false);
      setErrorFallback(false);
    }, [src]);

  const effectiveSrc =
    src && src.trim().length > 0 ? src : '/theme-images/default.png';
  return (
    <div className="relative w-full max-w-md">
      {!loaded && !errorFallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg animate-pulse">
          <span className="text-xs text-gray-400">圖片載入中...</span>
        </div>
      )}
      <img
        src={errorFallback ? '/theme-images/default.png' : effectiveSrc}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => { setErrorFallback(true); setLoaded(true); }}
        loading="lazy"
        className={`rounded-lg shadow-md transition-opacity duration-700 ease-in ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}

/** ========= 既有前端使用的型別（保持不變） ========= */
interface MovementData {
  topic: string;
  type: string;
  level: string;          // "Lv2" | "Lv3" | "Lv4" | "Lv5"
  description: string[];
  locked: boolean;
  imageFile?: string;
}

/** ========= AWS 回傳型別 ========= */
type AwsListItem = { id: string; name: string };
type AwsListResp = { code: number; message: string; data: AwsListItem[] };

type AwsLevelItem = {
  level: number;          // 2/3/4/5
  content?: string;       // 可能缺（未解鎖）
  is_unlocked?: boolean;  // 可能缺
};
type AwsDetail = {
  id: string;
  name: string;
  week_number?: number;
  body_part?: string;
  image_file?: string;    // 可能是 "movements/xxx.jpg" 或完整 URL
  sport_types: Record<string, AwsLevelItem[]>;
};
type AwsDetailResp = { code: number; message: string; data: AwsDetail };

/** ========= 類型顯示名稱 fallback（AWS 若沒提供對照時用） ========= */
const FALLBACK_TYPE_LABELS: Record<string, string> = {
  rock_climb: '攀岩',
  run: '跑步',
  mt_climb: '登山',
};

export default function MovementLibrary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || ''; // 可能是 name 或 id（維持相容）

  const AWS_BASE = import.meta.env.VITE_AWS_BASE_URL as string | undefined;
  if (!AWS_BASE) {
    // 若沒設環境變數就直接在頁面上提示，避免白頁
    console.warn('VITE_AWS_BASE_URL 未設定，請於 .env 或 Vercel 環境變數中加入。');
  }

  /** ====== 狀態 ====== */
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [topicImageSrc, setTopicImageSrc] = useState('/theme-images/default.png');

  // 列表資料（主題清單）
  const [topics, setTopics] = useState<AwsListItem[]>([]);

  // 映射：id ↔ name，便於用 name/id 任一選擇
  const idByName = useMemo(() => {
    const m = new Map<string, string>();
    topics.forEach(t => m.set(t.name, t.id));
    return m;
  }, [topics]);
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    topics.forEach(t => m.set(t.id, t.name));
    return m;
  }, [topics]);

  // 選擇的主題 id 與顯示名稱
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const selectedTopicName = useMemo(() => {
    if (!selectedTopicId) return '';
    return nameById.get(selectedTopicId) || selectedTopicId;
  }, [selectedTopicId, nameById]);

  // 類型切換（依選擇的主題詳情動態決定）
  const [selectedType, setSelectedType] = useState<string>('All');
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>(FALLBACK_TYPE_LABELS);

  // 單一主題詳情轉成前端可用的 MovementData[]
  const [movements, setMovements] = useState<MovementData[]>([]);

  // 詳情快取，避免重複打
  const [detailCache, setDetailCache] = useState<Map<string, AwsDetail>>(new Map());

  // 當 selectedTopicId 或快取變化時，決定要不要更新主題圖
  useEffect(() => {
    if (!selectedTopicId) {
      setTopicImageSrc('/theme-images/default.png');
      return;
    }
    const detail = detailCache.get(selectedTopicId);

    if (detail === undefined) {
      // 還沒抓到新主題詳情 → 保持上一張圖，不做任何事
      return;
    }

    const raw = detail.image_file;
    const next = raw
      ? (isHttpUrl(raw) ? raw : `/theme-images/${raw}`)
      : '/theme-images/default.png';

    setTopicImageSrc(next);
  }, [selectedTopicId, detailCache]);

  /** ====== 初次載入：抓主題列表 ====== */
  useEffect(() => {
    let canceled = false;
    async function loadList() {
      setLoadingList(true);
      setError('');
      try {
        if (!AWS_BASE) throw new Error('未設定 VITE_AWS_BASE_URL');
        // 若你朋友實際路徑是 /Movement（大寫單數），把下面改成 `${AWS_BASE}/Movement`
        const res = await fetch(`${AWS_BASE}/movements`);
        const ctype = res.headers.get('content-type') || '';
        if (!ctype.includes('application/json')) throw new Error('列表 API 回傳非 JSON');
        const json = (await res.json()) as AwsListResp;
        if (json.code !== 200 || !Array.isArray(json.data)) throw new Error(json.message || '列表 API 失敗');
        if (!canceled) {
          setTopics(json.data);
        }
      } catch (e: any) {
        if (!canceled) setError(e?.message || '列表載入失敗');
      } finally {
        if (!canceled) setLoadingList(false);
      }
    }
    loadList();
    return () => { canceled = true; };
  }, [AWS_BASE]);

  /** ====== 初次載入完列表後，根據 URL 預選 ====== */
  useEffect(() => {
    if (loadingList || topics.length === 0) return;
    if (!initialSearch) return; // 沒帶 search 參數就不處理
    // search 可能是 name 或 id
    const byId = nameById.get(initialSearch) ? initialSearch : '';
    const byName = idByName.get(initialSearch) || '';
    const id = byId || byName || '';
    if (id) {
      setSelectedTopicId(id);
    }
    // 若沒匹配到就維持空白
  }, [loadingList, topics, initialSearch, idByName, nameById]);

  /** ====== 轉換：AwsDetail -> MovementData[] ====== */
  function adaptDetail(detail: AwsDetail): MovementData[] {
    const out: MovementData[] = [];
    const topic = detail.name;
    const imageFile = detail.image_file
      ? (isHttpUrl(detail.image_file) ? detail.image_file : `/theme-images/${detail.image_file}`)
      : undefined;

    // 一併更新 typeLabels（保留 fallback）
    const newLabels: Record<string, string> = { ...FALLBACK_TYPE_LABELS };
    Object.keys(detail.sport_types || {}).forEach(typeKey => {
      if (!(typeKey in newLabels)) newLabels[typeKey] = typeKey;
    });
    setTypeLabels(newLabels);

    // 預設 lv2~lv5，沒出現就補 locked
    const LEVELS = [2, 3, 4, 5];

    Object.entries(detail.sport_types || {}).forEach(([typeKey, arr]) => {
      const byLevel = new Map<number, AwsLevelItem>();
      (arr || []).forEach(item => byLevel.set(item.level, item));

      LEVELS.forEach(lvNum => {
        const slot = byLevel.get(lvNum);
        const locked = !(slot?.is_unlocked) || !slot?.content;
        const description = splitContentToSteps(slot?.content);
        out.push({
          topic,
          type: typeKey,
          level: `Lv${lvNum}`,
          description,
          locked,
          imageFile,
        });
      });
    });

    return out;
  }

  /** ====== 抓單一主題詳情 ====== */
  useEffect(() => {
    let canceled = false;
    async function loadDetail(id: string) {
      if (!id) {
        setMovements([]);
        return;
      }
      setLoadingDetail(true);
      setError('');

      try {
        // 先看有沒有快取
        const cached = detailCache.get(id);
        if (cached) {
          if (!canceled) {
            setMovements(adaptDetail(cached));
            setLoadingDetail(false);
          }
          return;
        }

        if (!AWS_BASE) throw new Error('未設定 VITE_AWS_BASE_URL');
        const res = await fetch(`${AWS_BASE}/movements/${encodeURIComponent(id)}`);
        const ctype = res.headers.get('content-type') || '';
        if (!ctype.includes('application/json')) throw new Error('詳情 API 回傳非 JSON');
        const json = (await res.json()) as AwsDetailResp;
        if (json.code !== 200 || !json.data) throw new Error(json.message || '詳情 API 失敗');

        if (!canceled) {
          setDetailCache(prev => {
            const next = new Map(prev);
            next.set(id, json.data);
            return next;
          });
          setMovements(adaptDetail(json.data));
        }
      } catch (e: any) {
        if (!canceled) {
          setMovements([]);
          setError(e?.message || '詳情載入失敗');
        }
      } finally {
        if (!canceled) setLoadingDetail(false);
      }
    }
    loadDetail(selectedTopicId);
    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopicId, AWS_BASE]); // adaptDetail/ detailCache 由於是 setState 內部使用，這裡不把它們當依賴

  /** ====== 依目前 movements 算出所有類型與顯示用結構 ====== */
  const allTypes = useMemo(() => {
    return Array.from(new Set(movements.map(m => m.type)));
  }, [movements]);

  const displayTypes = useMemo(() => ['All', ...allTypes], [allTypes]);

  const levelOrder = ['Lv2', 'Lv3', 'Lv4', 'Lv5'];

  const groupedByType = useMemo(() => {
    return allTypes.map(type => {
      const forType = movements.filter(m => m.type === type);
      const map = new Map(forType.map(m => [m.level, m]));
      return {
        type,
        levels: levelOrder.map(level => {
          return map.get(level) || {
            topic: selectedTopicName,
            type,
            level,
            description: [],
            locked: true,
            imageFile: topicImageSrc || undefined,
          } as MovementData;
        }),
      };
    });
  }, [movements, allTypes, levelOrder, selectedTopicName, topicImageSrc]);

  /** ✅ 沒有任何 type 時，提供空態（All + Lv2~Lv5 鎖定卡） */
  const groupedSections = useMemo(() => {
    if (allTypes.length === 0) {
      return [
        {
          type: 'All',
          levels: levelOrder.map(level => ({
            topic: selectedTopicName,
            type: 'All',
            level,
            description: [],
            locked: true,
            imageFile: topicImageSrc || undefined,
          } as MovementData)),
        },
      ];
    }
    return groupedByType;
  }, [allTypes.length, levelOrder, selectedTopicName, topicImageSrc, groupedByType]);

  /** ====== 主題下拉選單 options ====== */
  const topicOptions = useMemo(
    () => topics.map(t => ({ label: t.name, value: t.id })),
    [topics]
  );

  /** ====== UI ====== */
  return (
    <div className="min-h-screen bg-gray-50 pt-8 pb-12 px-4 flex flex-col items-center">
      <Header />
      <div className="max-w-4xl w-full">
        {/* 列表載入階段 */}
        {loadingList ? (
          <p className="text-center text-gray-500">資料載入中...</p>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : (
          <>
            {/* Sticky 區：主題與運動類型選擇 */}
            <div className="sticky top-0 z-10 bg-gray-50 pb-4 pt-2 border-b border-gray-300 transition-shadow">
              <label className="block text-sm font-medium text-gray-700 mb-1">選擇主題</label>
              <Select
                options={topicOptions}
                value={
                  selectedTopicId
                    ? { label: selectedTopicName, value: selectedTopicId }
                    : null
                }
                onChange={(opt) => {
                  const id = opt?.value || '';
                  setSelectedTopicId(id);
                  setSelectedType('All'); // 切換主題後回到 All
                  // URL 用 name（維持和舊版一致的使用者體驗）
                  const name = id ? (nameById.get(id) || '') : '';
                  const url = name ? `/movement?search=${encodeURIComponent(name)}` : '/movement';
                  navigate(url, { replace: true });
                }}
                placeholder="請輸入或選擇主題"
                isSearchable
                isClearable
                className="mb-4 text-sm sm:text-base"
                classNamePrefix="react-select"
              />

              {/* 只有選擇了主題時才出現運動類型選單 */}
              {selectedTopicId && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {displayTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`px-4 py-1 rounded-full text-sm font-medium border transition ${
                        selectedType === type
                          ? 'bg-teal-500 text-white border-teal-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                      disabled={type !== 'All' && !allTypes.includes(type)}
                    >
                      {type === 'All' ? '全部' : (typeLabels[type] || type)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Sticky 區結束 */}

            {/* 沒選主題時的歡迎語 */}
            {!selectedTopicId && (
              <div className="text-center text-gray-600 mt-10 text-base leading-relaxed">
                歡迎來到動作升級中心!<br />
                今天想訓練什麼主題呢？<br />
                我們一起用腦練控制，用心玩運動!
              </div>
            )}

            {/* 主題已選：詳情載入 or 顯示卡片 */}
            {selectedTopicId && (
              <div className="flex flex-col gap-8 mt-6 w-full max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* 主題圖片 */}
                  <div className="md:w-2/5 w-full flex flex-col items-center md:sticky md:top-36 self-start">
                    <LazyImage src={topicImageSrc} alt={selectedTopicName || '主題圖片'} />
                    <p className="mt-2 text-sm text-gray-500 text-center">
                      {selectedTopicName}
                    </p>

                    {/* 額外資訊（可選）：週次/部位 */}
                    {detailCache.get(selectedTopicId) && (
                      <div className="mt-3 text-xs text-gray-500 text-center">
                        {detailCache.get(selectedTopicId)?.week_number
                          ? <>第 {detailCache.get(selectedTopicId)!.week_number} 週</>
                          : null}
                        {detailCache.get(selectedTopicId)?.body_part
                          ? <>　|　{detailCache.get(selectedTopicId)!.body_part}</>
                          : null}
                      </div>
                    )}
                  </div>

                  {/* 動作卡片列表 */}
                  <div className="md:w-3/5 w-full">
                    {loadingDetail ? (
                      <p className="text-center text-gray-500">內容載入中...</p>
                    ) : (
                      groupedSections
                        .filter(group => selectedType === 'All' || group.type === selectedType)
                        .map(group => (
                          <div key={group.type} className="mb-8">
                            <h2 className="text-lg font-semibold text-gray-700 mb-2">
                              {typeLabels[group.type] }進階課表
                            </h2>

                            {/* 若為空態（只有 All 且原始 types 為 0），加一句提示 */}
                            
                            

                            <div className="grid grid-cols-1 gap-4">
                              {group.levels.map(m => (
                                <MovementCard key={`${group.type}-${m.level}`} data={m} />
                              ))}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
