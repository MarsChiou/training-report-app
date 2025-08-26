import {useEffect,useMemo,useState} from 'react';
import Header from './components/Header';
import Select from 'react-select';
import {FaBookOpen,FaSearch,FaCalendarAlt} from 'react-icons/fa';
import useRoster from '../hooks/useRoster';
// 讀取網址參數：?userId=...&fresh=1
function getQueryParam(name: string) {
    const sp = new URLSearchParams(window.location.search);
    return sp.get(name) || '';
  }
const QUERY_USER_ID = getQueryParam('userId');  // 預選的 userId（或綽號，視你的 names API 而定）
const QUERY_FRESH = getQueryParam('fresh') === '1'; // 是否繞過快取
  

/** ===== 時區安全日期工具（本地、不經 UTC） ===== */
function formatDateLocal(date: Date) {
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function parseLocalDateString(ymd: string) {
  const [y,m,d]=ymd.split('-').map(Number);
  return new Date(y,(m as number)-1,d as number);
}
function daysDiff(a:string,b:string){
  const A=parseLocalDateString(a).getTime();
  const B=parseLocalDateString(b).getTime();
  return Math.floor((A-B)/86400000);
}

/** ===== 型別 ===== */
type DiaryEntry={date:string;dayNumber:number;diaryText:string};
//type DiaryApiResponse={ok:boolean;entries:DiaryEntry[];error?:string};

/** ===== AWS Diary Response Types ===== */
type AwsDiaryItem = { date: string; content?: string };
type AwsDiaryData = { id: string; name?: string; diary?: AwsDiaryItem[] };
type AwsDiaryResponse = { code: number; message?: string; data?: AwsDiaryData };


/** ===== 營期設定（與 Header 顯示一致） ===== */
const CAMP_START='2025-08-25';
const CAMP_END='2025-10-19';
const LAST_USER_ID_KEY = 'diary:lastUserId';


/** ===== 主頁面 ===== */
export default function DiaryOverview(){
  //const [nameOptions,setNameOptions]=useState<Option[]>([]);
  const { options: nameOptions, loading: rosterLoading } = useRoster();
  const [userId,setUserId]=useState<string>('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [entries,setEntries]=useState<DiaryEntry[]>([]);
  // UI 控制
  const [keyword,setKeyword]=useState('');
  const [onlyHasDiary,setOnlyHasDiary]=useState(true);
  const [sortDesc,setSortDesc]=useState(true);

  // 環境變數
  //const NAME_API_URL=`${import.meta.env.VITE_GAS_URL||''}?action=names&format=object`;
  //const DIARY_API_URL = import.meta.env.VITE_Diary_API as string; 

  /** 名單載入後的預選與一致性處理（交給 useRoster 取資料，不再自行 fetch） */
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
            // 舊的 userId 已不在名單中就清掉
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
  
  
  
  /** 依使用者載入日記（改接 AWS） */
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

      // 組 URL：{BASE}/users/{id}/diary[?fresh=1&_ts=...]
      const base = AWS_BASE.replace(/\/+$/,''); // 去尾巴斜線
      const path = `/users/${encodeURIComponent(userId)}/diary`;
      const sp = new URLSearchParams();
      if (QUERY_FRESH) {
        // 讓「繞過快取」有實際效果：加時間戳避免中間層快取
        sp.set('fresh', '1');
        sp.set('_ts', String(Date.now()));
      }
      const url = `${base}${path}${sp.toString() ? `?${sp.toString()}` : ''}`;

      // 可選：如果你朋友的 API 有金鑰，打開這段並在 .env 設定 VITE_AWS_API_KEY
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

      if (json.code !== 200) {
        throw new Error(json?.message || 'AWS 回傳非 200');
      }

      const diary = json?.data?.diary || [];

      // 轉成頁面現有結構：{date, dayNumber, diaryText}
      const mapped: DiaryEntry[] = diary.map((d) => ({
        date: d.date,
        dayNumber: daysDiff(d.date, CAMP_START) + 1,
        diaryText: (d.content || '').trim(),
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
  return () => { canceled = true; };
}, [userId]);


  /** 產出營期間所有日期（for 顯示所有天） */
  const allCampDates=useMemo(()=>{
    const start=parseLocalDateString(CAMP_START);
    const end=parseLocalDateString(CAMP_END);
    const days:string[]=[];
    for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
      days.push(formatDateLocal(d));
    }
    return days;
  },[]);

  // 營期總天數（含起訖日）
  const totalDays = allCampDates.length;

  // 營期已經進行了幾天（含當天；未開跑=0，結束後=totalDays）
  const todayStr = formatDateLocal(new Date());
  let daysElapsed = 0;
  if (todayStr >= CAMP_START) {
    const cap = todayStr > CAMP_END ? CAMP_END : todayStr;
    daysElapsed = Math.min(daysDiff(cap, CAMP_START) + 1, totalDays);
  }

  /** 合併空白日（onlyHasDiary=false 時顯示） */
  const mergedByDate=useMemo(()=>{
    if(onlyHasDiary) return entries;
    const map=new Map(entries.map(e=>[e.date,e]));
    return allCampDates.map(date=>{
      const existed=map.get(date);
      if(existed) return existed;
      const dayNumber=daysDiff(date,CAMP_START)+1;
      return {date,dayNumber,diaryText:''} as DiaryEntry;
    });
  },[entries,onlyHasDiary,allCampDates]);

  /** 關鍵字過濾 + 排序 */
  const visibleEntries=useMemo(()=>{
    const kw=keyword.trim();
    let list=mergedByDate.filter(e=>kw?e.diaryText.includes(kw):true);
    list=list.sort((a,b)=>{
      const cmp=a.date.localeCompare(b.date);
      return sortDesc? -cmp : cmp;
    });
    return list;
  },[mergedByDate,keyword,sortDesc]);

  const selectedOption=nameOptions.find(o=>o.value===userId)||null;
  const diaryCount=entries.filter(e=>e.diaryText.trim().length>0).length;

  return(
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <Header/>

      <div className="w-full max-w-3xl">

        {/* 控制列 */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">選擇隊員</label>
              <Select
                options={nameOptions}
                value={selectedOption}
                onChange={opt=>{
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
                <FaSearch className="text-gray-400 mr-2"/>
                <input
                  value={keyword}
                  onChange={e=>setKeyword(e.target.value)}
                  className="w-full py-2 text-sm focus:outline-none"
                  placeholder="輸入關鍵字（例如：肩胛、核心）"
                />
              </div>
            </div>

            <div className="flex items-end justify-between md:justify-end gap-4">
              <label className="inline-flex items-center text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={onlyHasDiary}
                  onChange={e=>setOnlyHasDiary(e.target.checked)}
                />
                只看有日記
              </label>
              <button
                onClick={()=>setSortDesc(v=>!v)}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100"
                title="切換日期排序"
              >
                {sortDesc?'日期：新→舊':'日期：舊→新'}
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
        {!userId?(
          <p className="text-center text-gray-500">請先選擇隊員以查看日記。</p>
        ):loading?(
          <p className="text-center text-gray-500">資料載入中...</p>
        ):error?(
          <p className="text-center text-rose-500">載入失敗：{error}</p>
        ):visibleEntries.length===0?(
          <div className="text-center text-gray-500">
            這位隊員在本期沒有任何日記。
          </div>
        ):(
          <div className="space-y-3">
            {visibleEntries.map((e,i)=>(
              <div
                key={`${e.date}-${i}`}
                className={`bg-white rounded-xl border ${e.diaryText? 'border-teal-200' : 'border-gray-200'} shadow-sm p-4`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600">
                    第 {e.dayNumber} 天　|　{e.date}
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded-full ${e.diaryText? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                    {e.diaryText? '已寫日記' : '未填寫'}
                  </div>
                </div>

                {e.diaryText?(
                  <div className="flex items-start space-x-2">
                    <FaBookOpen className="mt-0.5 text-teal-500"/>
                    <p className="whitespace-pre-wrap break-words text-gray-800 text-sm leading-relaxed">
                      {e.diaryText}
                    </p>
                  </div>
                ):(
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