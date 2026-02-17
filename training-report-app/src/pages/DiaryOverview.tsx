// pages/DiaryOverview.tsx (with fatigue badges)
import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import Select from 'react-select';
import { FaBookOpen, FaSearch, FaCalendarAlt, FaBrain } from 'react-icons/fa';
import { GiStrong } from "react-icons/gi";
import useRoster from '../hooks/useRoster';
import {
  CAMP_START,
  CAMP_END,
  formatDateLocal,
  parseLocalYMD,
  campDayNumber,
  totalCampDays,
  todayYMD,
} from './utils/campConfig';

// 讀取網址參數：?userId=...&fresh=1
function getQueryParam(name: string) {
  const sp = new URLSearchParams(window.location.search);
  return sp.get(name) || '';
}
const QUERY_USER_ID = getQueryParam('userId');   // 預選的 userId（或綽號，視你的 names API 而定）
const QUERY_FRESH   = getQueryParam('fresh') === '1'; // 是否繞過快取

/** ===== 型別 ===== */
export type DiaryEntry = {
  date: string;
  dayNumber: number;
  diaryText: string;
  bodyFatigue: number | null;  // 0~10 or null
  brainFatigue: number | null; // 0~10 or null
};

/** ===== AWS Diary Response Types ===== */
export type AwsDiaryItem = {
  date: string;
  content?: string;
  body_rpe?: number | string | null;
  brain_rpe?: number | string | null;
};
export type AwsDiaryData   = { id: string; name?: string; diary?: AwsDiaryItem[] };
export type AwsDiaryResponse = { code: number; message?: string; data?: AwsDiaryData };

/** ===== 本地快取 key ===== */
const LAST_USER_ID_KEY = 'diary:lastUserId';

/** ===== 小工具：轉成 0~10 or null ===== */
function parseFatigue(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'string' ? Number(raw) : (raw as number);
  if (Number.isNaN(n)) return null;
  // 四捨五入為整數，並限制在 0~10
  const v = Math.round(n);
  return Math.min(10, Math.max(0, v));
}

function pickBodyFatigue(d: AwsDiaryItem): number | null {
  return parseFatigue(d.body_rpe);
}
function pickBrainFatigue(d: AwsDiaryItem): number | null {
  return parseFatigue(d.brain_rpe);
}

/** ===== UI：疲勞度徽章 ===== */
function fatigueColor(value: number | null) {
  if (value === null) return 'bg-gray-100 text-gray-600 border-gray-200';
  if (value <= 5) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}
function FatigueBadge({ label, value, icon }: { label: string; value: number | null; icon: 'body' | 'brain' }) {
  const cls = fatigueColor(value);
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${cls}`}>
      {icon === 'body' ? <GiStrong className="opacity-80" /> : <FaBrain className="opacity-80" />}
      <span className="opacity-80">{label}</span>
      <strong className="ml-0.5">{value === null ? '-' : value}</strong>
    </span>
  );
}

/** ===== 主頁面 ===== */
export default function DiaryOverview() {
  const { options: nameOptions, loading: rosterLoading } = useRoster();

  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);

  // UI 控制
  const [keyword, setKeyword] = useState('');
  const [onlyHasDiary, setOnlyHasDiary] = useState(true);
  const [sortDesc, setSortDesc] = useState(true);

  /** 名單載入後的預選與一致性處理 */
  useEffect(() => {
    if (!nameOptions || nameOptions.length === 0) return;

    // 1) URL 帶 userId → 優先預選一次
    if (!userId && QUERY_USER_ID) {
      const found = nameOptions.find(o => o.value === QUERY_USER_ID || o.label === QUERY_USER_ID);
      if (found) {
        setUserId(found.value);
        localStorage.setItem(LAST_USER_ID_KEY, found.value);
        return;
      }
    }

    // 2) 沒有 URL → 用上次記住的 userId（若名單中仍存在）
    if (!userId && !QUERY_USER_ID) {
      const saved = localStorage.getItem(LAST_USER_ID_KEY) || '';
      if (saved) {
        const found = nameOptions.find(o => o.value === saved);
        if (found) {
          setUserId(found.value);
          return;
        } else {
          localStorage.removeItem(LAST_USER_ID_KEY);
        }
      }
    }

    // 3) 若目前 userId 已不在名單中（名單異動），則清空
    if (userId && !nameOptions.some(o => o.value === userId)) {
      setUserId('');
      localStorage.removeItem(LAST_USER_ID_KEY);
    }
  }, [nameOptions, userId]);

  /** 依使用者載入日記（接 AWS） */
  useEffect(() => {
    let canceled = false;

    const load = async () => {
      setError('');
      if (!userId) {
        setEntries([]);
        return;
      }
      setLoading(true);
      try {
        const AWS_BASE = (import.meta.env.VITE_AWS_BASE_URL as string) || '';
        if (!AWS_BASE) throw new Error('未設定 VITE_AWS_BASE_URL');

        const base = AWS_BASE.replace(/\/+$/, '');
        const path = `/users/${encodeURIComponent(userId)}/diary`;
        const sp = new URLSearchParams();
        if (QUERY_FRESH) {
          sp.set('fresh', '1');
          sp.set('_ts', String(Date.now())); // 避免中間層快取
        }
        const url = `${base}${path}${sp.toString() ? `?${sp.toString()}` : ''}`;

        const headers: Record<string, string> = {};
        const apiKey = import.meta.env.VITE_AWS_API_KEY as string | undefined;
        if (apiKey) headers['x-api-key'] = apiKey;

        const res = await fetch(url, { headers });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`AWS 回應 ${res.status}${text ? `：${text}` : ''}`);
        }

        const ctype = res.headers.get('content-type') || '';
        if (!ctype.includes('application/json')) throw new Error('伺服器回傳非 JSON');
        const json = (await res.json()) as AwsDiaryResponse;

        if (json.code !== 200) throw new Error(json?.message || 'AWS 回傳非 200');

        const diary = json?.data?.diary || [];

        const mapped: DiaryEntry[] = diary.map((d) => ({
          date: d.date,
          dayNumber: campDayNumber(d.date),
          diaryText: (d.content || '').trim(),
          bodyFatigue: pickBodyFatigue(d),
          brainFatigue: pickBrainFatigue(d),
        }));

        if (!canceled) setEntries(mapped);

        // 抓到資料後把 fresh 拿掉，避免之後每次都繞過快取
        if (QUERY_FRESH) {
          const sp2 = new URLSearchParams(window.location.search);
          sp2.delete('fresh');
          const newUrl = `${window.location.pathname}?${sp2.toString()}`.replace(/\?$/, '');
          window.history.replaceState(null, '', newUrl);
        }
      } catch (e: any) {
        if (!canceled) {
          setError(e?.message || '載入失敗');
          setEntries([]);
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    load();
    return () => {
      canceled = true;
    };
  }, [userId]);

  /** 產出營期間所有日期（for 顯示所有天） */
  const allCampDates = useMemo(() => {
    const start = parseLocalYMD(CAMP_START);
    const end = parseLocalYMD(CAMP_END);
    const days: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(formatDateLocal(d));
    }
    return days;
  }, []);

  const totalDays = totalCampDays(); // ✅ 共用總天數
  const todayStr = todayYMD();

  // 營期已經進行了幾天（含當天；未開跑=0，結束後=totalDays）
  const daysElapsed =
    todayStr < CAMP_START ? 0 : todayStr > CAMP_END ? totalDays : campDayNumber(todayStr);

  /** 合併空白日（onlyHasDiary=false 時顯示） */
  const mergedByDate = useMemo(() => {
    if (onlyHasDiary) return entries;
    const map = new Map(entries.map(e => [e.date, e] as const));
    return allCampDates.map(date => {
      const existed = map.get(date);
      if (existed) return existed;
      return {
        date,
        dayNumber: campDayNumber(date),
        diaryText: '',
        bodyFatigue: null,
        brainFatigue: null,
      } as DiaryEntry;
    });
  }, [entries, onlyHasDiary, allCampDates]);

  /** 關鍵字過濾 + 排序 */
  const visibleEntries = useMemo(() => {
    const kw = keyword.trim();
    let list = mergedByDate.filter(e => (kw ? e.diaryText.includes(kw) : true));
    list = list.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return sortDesc ? -cmp : cmp;
    });
    return list;
  }, [mergedByDate, keyword, sortDesc]);

  const selectedOption = nameOptions.find(o => o.value === userId) || null;
  const diaryCount = entries.filter(e => e.diaryText.trim().length > 0).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <Header />

      <div className="w-full max-w-3xl">
        {/* 控制列 */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">選擇隊員</label>
              <Select
                options={nameOptions}
                value={selectedOption}
                onChange={opt => {
                  const val = opt ? opt.value : '';
                  setUserId(val);
                  if (val) localStorage.setItem(LAST_USER_ID_KEY, val);
                  else localStorage.removeItem(LAST_USER_ID_KEY);
                }}
                placeholder="請輸入或選擇姓名"
                isClearable
                className="text-sm"
                isLoading={rosterLoading}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">搜尋日記內容</label>
              <div className="flex items-center border border-gray-300 rounded-lg px-2">
                <FaSearch className="text-gray-400 mr-2" />
                <input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  className="w-full py-2 text-sm focus:outline-none"
                  placeholder="輸入關鍵字（例如：肩胛、核心）"
                />
              </div>
            </div>

            <div className="flex items-end justify-between md:justify-end gap-4">
              
              <button
                onClick={() => setSortDesc(v => !v)}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100"
                title="切換日期排序"
              >
                {sortDesc ? '日期：新→舊' : '日期：舊→新'}
              </button>
            </div>
          </div>

          {userId && (
            <div className="mt-3 text-xs text-gray-600 space-y-1">
              <div className="inline-flex items-center">
                <FaCalendarAlt className="mr-1" />
                營期：{CAMP_START} ~ {CAMP_END}
              </div>

              {diaryCount > 0 ? (
                <div>
                  營期已經開始了 {daysElapsed} 天，其中你寫下日記的日子有 {diaryCount} 天。持續紀錄很棒，給自己一個大大的讚 👍
                </div>
              ) : (
                <div>
                  營期已經開始了 {daysElapsed} 天，還沒有日記也沒關係。從今天寫一小段 2–3 句就很棒，我們一起慢慢累積 📘
                </div>
              )}
            </div>
          )}
        </div>

        {/* 內容區 */}
        {!userId ? (
          <p className="text-center text-gray-500">請先選擇隊員以查看日記。</p>
        ) : loading ? (
          <p className="text-center text-gray-500">資料載入中...</p>
        ) : error ? (
          <p className="text-center text-rose-500">載入失敗：{error}</p>
        ) : visibleEntries.length === 0 ? (
          <div className="text-center text-gray-500">這位隊員在本期沒有任何日記。</div>
        ) : (
          <div className="space-y-3">
            {visibleEntries.map((e, i) => (
              <div
                key={`${e.date}-${i}`}
                className={`bg-white rounded-xl border ${
                  e.diaryText ? 'border-teal-200' : 'border-gray-200'
                } shadow-sm p-4`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-2">
                    <div className="text-sm text-gray-600">第 {e.dayNumber} 天　|　{e.date}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <FatigueBadge label="身體疲勞" value=  {e.bodyFatigue} icon="body" />
                        <FatigueBadge label="大腦疲勞" value= {e.brainFatigue} icon="brain" />                    
                    </div>
                </div>

                {e.diaryText ? (
                  <div className="flex items-start space-x-2">
                    <FaBookOpen className="mt-0.5 text-teal-500 flex-shrink-0 w-4 h-4" />
                    <p className="whitespace-pre-wrap break-words text-gray-800 text-sm leading-relaxed">
                      {e.diaryText}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm italic">這天沒有日記內容。</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
