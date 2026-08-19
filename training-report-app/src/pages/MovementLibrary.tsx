// pages/MovementLibrary.tsx
import { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import Header from './components/Header';
import MovementCard from './components/MovementCard';
import Select from 'react-select';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { captureEvent } from '../lib/analytics';
import { SPORT_TYPE_LABELS } from './utils/sportTypeLabels';

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
  const imgRef = useRef<HTMLImageElement | null>(null);

  const effectiveSrc =
    src && src.trim().length > 0 ? src : '/theme-images/default.png';

  // src 有變更時重置狀態，並處理「已快取」的情況
  useEffect(() => {
    setLoaded(false);
    setErrorFallback(false);

    // 若圖片已在快取且瀏覽器已解碼完成，不會再觸發 onLoad
    // 這裡直接把 loaded 設為 true，避免一直顯示「載入中」
    // (等下一個 tick 拿到最新的 imgRef)
    const t = requestAnimationFrame(() => {
      const img = imgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        setLoaded(true);
      }
    });
    return () => cancelAnimationFrame(t);
  }, [effectiveSrc]);

  return (
    <div className="relative aspect-[1300/1808] w-full max-w-md overflow-hidden rounded-lg bg-white shadow-md">
      {!loaded && !errorFallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
          <span className="text-xs text-gray-400">圖片載入中...</span>
        </div>
      )}
      <img
        key={effectiveSrc}               // 確保切換同一路徑時也會重新評估
        ref={imgRef}
        src={errorFallback ? '/theme-images/default.png' : effectiveSrc}
        alt={alt}
        // 主視覺建議不要 lazy，避免事件延遲（卡片內可保留 lazy）
        // loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => { setErrorFallback(true); setLoaded(true); }}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ease-in ${
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
const FALLBACK_TYPE_LABELS = SPORT_TYPE_LABELS;

export default function MovementLibrary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || ''; // 可能是 name 或 id（維持相容）
  const urlSportType = searchParams.get('sport_type') || '';

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
  const detailRequestIdRef = useRef(0);

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

  // 類型切換（依選擇的主題詳情動態決定；空字串表示尚未選擇）
  const [selectedType, setSelectedType] = useState<string>('');
  const [preferredType, setPreferredType] = useState<string>(urlSportType);
  const [cardStackExpanded, setCardStackExpanded] = useState(true);
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>(FALLBACK_TYPE_LABELS);

  // URL 是偏好類型的來源；也支援重新整理與瀏覽器上一頁/下一頁。
  useEffect(() => {
    setPreferredType(urlSportType);
  }, [urlSportType]);

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
  useLayoutEffect(() => {
    let canceled = false;
    const controller = new AbortController();
    const requestId = ++detailRequestIdRef.current;
    const isCurrentRequest = () =>
      !canceled && detailRequestIdRef.current === requestId;

    async function loadDetail(id: string) {
      if (!id) {
        setMovements([]);
        setSelectedType('');
        setLoadingDetail(false);
        return;
      }
      setLoadingDetail(true);
      setSelectedType('');
      setError('');

      try {
        // 先看有沒有快取
        const cached = detailCache.get(id);
        if (cached) {
          if (isCurrentRequest()) {
            setMovements(adaptDetail(cached));
            setLoadingDetail(false);
          }
          return;
        }

        if (!AWS_BASE) throw new Error('未設定 VITE_AWS_BASE_URL');
        const res = await fetch(
          `${AWS_BASE}/movements/${encodeURIComponent(id)}`,
          { signal: controller.signal }
        );
        const ctype = res.headers.get('content-type') || '';
        if (!ctype.includes('application/json')) throw new Error('詳情 API 回傳非 JSON');
        const json = (await res.json()) as AwsDetailResp;
        if (json.code !== 200 || !json.data) throw new Error(json.message || '詳情 API 失敗');

        if (isCurrentRequest()) {
          setDetailCache(prev => {
            const next = new Map(prev);
            next.set(id, json.data);
            return next;
          });
          setMovements(adaptDetail(json.data));
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        if (isCurrentRequest()) {
          setMovements([]);
          setSelectedType('');
          setError(e?.message || '詳情載入失敗');
        }
      } finally {
        if (isCurrentRequest()) setLoadingDetail(false);
      }
    }
    loadDetail(selectedTopicId);
    return () => {
      canceled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopicId, AWS_BASE]); // adaptDetail/ detailCache 由於是 setState 內部使用，這裡不把它們當依賴

  /** ====== 依目前 movements 算出所有類型與顯示用結構 ====== */
  const allTypes = useMemo(() => {
    return Array.from(new Set(movements.map(m => m.type)));
  }, [movements]);

  /** ====== 依 URL / 使用者偏好預選目前主題支援的運動類型 ====== */
  useLayoutEffect(() => {
    if (allTypes.length === 0) return;

    if (preferredType && allTypes.includes(preferredType)) {
      setSelectedType(preferredType);
      setCardStackExpanded(false);
      return;
    }

    setSelectedType('');
    setCardStackExpanded(true);
  }, [allTypes, preferredType]);

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

  const selectedTypeGroup = useMemo(() => {
    if (!selectedType) return null;
    return groupedByType.find(group => group.type === selectedType) || null;
  }, [groupedByType, selectedType]);

  /** ====== 主題下拉選單 options ====== */
  const topicOptions = useMemo(
    () => topics.map(t => ({ label: t.name, value: t.id })),
    [topics]
  );

  /** ====== 計算 上一個 / 下一個 邏輯 ====== */
  // 1. 找出目前選到的主題在列表中的 index
  const currentTopicIndex = useMemo(() => {
    return topics.findIndex(t => t.id === selectedTopicId);
  }, [topics, selectedTopicId]);

  // 2. 取得上一項與下一項的資料物件 (若無則為 undefined)
  const prevTopic = topics[currentTopicIndex - 1];
  const nextTopic = topics[currentTopicIndex + 1];

  const trackTopicChanged = (
    action: 'selected' | 'previous' | 'next' | 'cleared',
    targetTopicId: string
  ) => {
    captureEvent('movement_topic_changed', {
      action,
      from_topic: selectedTopicId || undefined,
      from_topic_name: selectedTopicName || undefined,
      to_topic: targetTopicId || undefined,
      to_topic_name: targetTopicId
        ? (nameById.get(targetTopicId) || targetTopicId)
        : undefined,
      sport_type: preferredType || undefined,
      sport_type_label: preferredType
        ? (typeLabels[preferredType] || preferredType)
        : undefined,
    });
  };

  const handleTopicSelect = (topicId: string) => {
    if (topicId === selectedTopicId) return;

    trackTopicChanged(topicId ? 'selected' : 'cleared', topicId);
    handleSwitchTopic(topicId);
  };

  const trackTypeSelected = (type: string) => {
    captureEvent('sport_type_selected', {
      topic_id: selectedTopicId,
      topic_name: selectedTopicName,
      sport_type: type,
      sport_type_label: typeLabels[type] || type,
    });
  };

  // 3. 統一處理切換動作的函式
  const handleSwitchTopic = (topicId: string) => {
    if (!topicId) {
      setSelectedTopicId('');
      setSelectedType('');
      setPreferredType('');
      setCardStackExpanded(true);
      navigate('/movement', { replace: true });
      return;
    }
    
    setSelectedTopicId(topicId);
    setSelectedType(''); // 切換主題時重置類型篩選
    setCardStackExpanded(true);
    
    const name = nameById.get(topicId) || '';
    const sportTypeParam = preferredType
      ? `&sport_type=${encodeURIComponent(preferredType)}`
      : '';
    const url = name
      ? `/movement?search=${encodeURIComponent(name)}${sportTypeParam}`
      : '/movement';
    navigate(url, { replace: true });
  };

  const handleTypeSelected = (nextType: string) => {
    setSelectedType(nextType);
    setPreferredType(nextType);
    if (!nextType) setCardStackExpanded(true);
    if (nextType) trackTypeSelected(nextType);

    const name = nameById.get(selectedTopicId) || '';
    const searchParam = name ? `search=${encodeURIComponent(name)}` : '';
    const sportTypeParam = nextType
      ? `sport_type=${encodeURIComponent(nextType)}`
      : '';
    const query = [searchParam, sportTypeParam].filter(Boolean).join('&');
    navigate(query ? `/movement?${query}` : '/movement', { replace: true });
  };

  const renderSportTypeCardStack = (className = '') => (
    <div className={`w-full max-w-md ${className}`}>
      <p className="mb-2 text-sm font-medium text-gray-700">選擇運動類型</p>

      <div
        aria-hidden={cardStackExpanded || !selectedType}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          !cardStackExpanded && selectedType
            ? 'grid-rows-[1fr] translate-y-0 opacity-100'
            : 'pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="relative pb-2">
            <div
              aria-hidden="true"
              className="absolute inset-x-4 bottom-0 top-2 rounded-xl border border-gray-200 bg-gray-100"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-2 bottom-1 top-1 rounded-xl border border-teal-200 bg-teal-50"
            />
            <button
              type="button"
              tabIndex={!cardStackExpanded && selectedType ? 0 : -1}
              onClick={() => setCardStackExpanded(true)}
              className="relative z-10 flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-teal-500 bg-white px-4 py-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
              aria-expanded={false}
            >
              <span>
                <span className="block text-sm font-semibold text-teal-800">
                  {typeLabels[selectedType] || selectedType}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">點擊展開其他運動類型</span>
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-5 w-5 flex-shrink-0 text-teal-600"
              >
                <path
                  d="m5 7.5 5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        aria-hidden={!cardStackExpanded && !!selectedType}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          cardStackExpanded || !selectedType
            ? 'grid-rows-[1fr] translate-y-0 opacity-100'
            : 'pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-2 gap-2 p-1" role="group" aria-label="選擇運動類型">
            {allTypes.map(type => {
              const isSelected = selectedType === type;
              return (
                <button
                  key={type}
                  type="button"
                  tabIndex={!cardStackExpanded && selectedType ? -1 : 0}
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (!isSelected) handleTypeSelected(type);
                    setCardStackExpanded(false);
                  }}
                  className={`flex min-h-16 items-center rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50 text-teal-800 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 shadow-sm hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md'
                  }`}
                >
                  <span>{typeLabels[type] || type}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
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
            {/* Sticky 區：主題選擇 */}
            <div className="sticky top-0 z-10 bg-gray-50 pb-4 pt-2 border-b border-gray-300 transition-shadow">
              <label className="block text-sm font-medium text-gray-700 mb-1">選擇主題</label>
              <div className="flex items-center gap-2 mb-4">
                {/* 上一個按鈕 */}
                <button
                  onClick={() => {
                    if (prevTopic) {
                      trackTopicChanged('previous', prevTopic.id);
                      handleSwitchTopic(prevTopic.id);
                    }
                  }}
                  disabled={!prevTopic}
                  className={`p-2 rounded-md border flex-shrink-0 transition-colors ${
                    !prevTopic
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed border-gray-200'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-teal-50 hover:text-teal-600 hover:border-teal-300'
                  }`}
                  aria-label="Previous Topic"
                >
                  {/* 使用簡單的 SVG Icon (Chevron Left) */}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>

                {/* 原本的 Select，加上 flex-1 讓它佔據中間空間 */}
                <div className="flex-1">
                  <Select
                    options={topicOptions}
                    value={
                      selectedTopicId
                        ? { label: selectedTopicName, value: selectedTopicId }
                        : null
                    }
                    onChange={(opt) => handleTopicSelect(opt?.value || '')}
                    placeholder="請輸入或選擇主題"
                    isSearchable={false} // 既然有按鈕輔助，這裡維持 false 沒問題
                    isClearable
                    className="text-sm sm:text-base"
                    classNamePrefix="react-select"
                  />
                </div>

                {/* 下一個按鈕 */}
                <button
                  onClick={() => {
                    if (nextTopic) {
                      trackTopicChanged('next', nextTopic.id);
                      handleSwitchTopic(nextTopic.id);
                    }
                  }}
                  disabled={!nextTopic}
                  className={`p-2 rounded-md border flex-shrink-0 transition-colors ${
                    !nextTopic
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed border-gray-200'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-teal-50 hover:text-teal-600 hover:border-teal-300'
                  }`}
                  aria-label="Next Topic"
                >
                  {/* 使用簡單的 SVG Icon (Chevron Right) */}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
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
                          ? <> | {detailCache.get(selectedTopicId)!.body_part}</>
                          : null}
                      </div>
                    )}

                    {!loadingDetail && allTypes.length > 0 && renderSportTypeCardStack('mt-4 md:hidden')}
                  </div>

                  {/* 動作卡片列表 */}
                  <div className="md:w-3/5 w-full">
                    {!loadingDetail && allTypes.length > 0 && renderSportTypeCardStack('hidden md:block mb-4')}
                    {loadingDetail ? (
                      <p className="text-center text-gray-500">內容載入中...</p>
                    ) : allTypes.length === 0 ? (
                      <p className="text-center text-gray-500">此主題目前沒有可用的運動類型。</p>
                    ) : !selectedType ? (
                      <p className="text-center text-gray-500 mt-4">
                        請先選擇運動類型，即可查看對應的進階課表。
                      </p>
                    ) : selectedTypeGroup ? (
                      <div className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-700 mb-2">
                          {typeLabels[selectedTypeGroup.type]}進階課表
                        </h2>
                        <div className="grid grid-cols-1 gap-4">
                          {selectedTypeGroup.levels.map(m => (
                            <MovementCard key={`${selectedTypeGroup.type}-${m.level}`} data={m} />
                          ))}
                        </div>
                      </div>
                    ) : null}
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
