import {useCallback,useMemo,useRef,useEffect,useState} from 'react';
import {FaDumbbell,FaBookOpen,FaCheckCircle} from 'react-icons/fa';
import Select from 'react-select';
import Header from './components/Header';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import useRoster from '../hooks/useRoster';

// 記住上次選的人（報表頁用自己的 key，避免跟日記頁混到）
const LAST_REPORT_USER_ID_KEY = 'report:lastUserId';

/** ===== 時區安全的日期工具（本地時區，不經 UTC） ===== */
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

/** ===== 常數／工具 ===== */
const successTextList=[
  '回報完成！🎉🎉',
  '回報完成！今天的你很棒👏',
  '回報完成！給自己一個大大的讚👍',
  '回報完成！太強了！🔥'
];

const getTaiwanTodayDateString=()=>formatDateLocal(new Date());

// 讀網址參數（可沿用你現有的工具）
function getQueryParam(name: string) {
  const sp = new URLSearchParams(window.location.search);
  return sp.get(name) || '';
}
const QUERY_USER_ID = getQueryParam('userId');  

export default function DailyReportForm() {
  const today=getTaiwanTodayDateString();

  // 營期起始（用本地解析）
  const CAMP_START_DATE=parseLocalDateString('2025-08-25');

  const [userId,setUserId]=useState(()=>localStorage.getItem(LAST_REPORT_USER_ID_KEY)||'');
  const [trainingDone,setTrainingDone]=useState(false);
  const [diaryDone,setDiaryDone]=useState(false);
  const [diaryText,setDiaryText]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [successText,setSuccessText]=useState('');
  const { options: nameOptions, loading: rosterLoading } = useRoster();

  const selectedOption=useMemo(()=>nameOptions.find(o=>o.value===userId)||null,[nameOptions,userId]);

  const POST_API_URL=import.meta.env.VITE_REPORT_API_URL as string|undefined;

  // 簡化版 Toast
  const [toast,setToast]=useState<{text:string;kind:'ok'|'err'|null}>({text:'',kind:null});
  const hideTimerRef=useRef<number|null>(null);
  const triggerToast=(text:string,kind:'ok'|'err')=>{
    setToast({text,kind});
    if(hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current=window.setTimeout(()=>setToast({text:'',kind:null}),2200);
  };
  const showSuccessToast=(m='提交成功！💪')=>triggerToast(m,'ok');
  const showErrorToast=(m:string)=>triggerToast(m,'err');

  const [selectedDate,setSelectedDate]=useState(today);

  const calculateDayNumber=useCallback((dateStr:string)=>{
    const date=parseLocalDateString(dateStr);
    const start=parseLocalDateString(formatDateLocal(CAMP_START_DATE));
    return Math.floor((date.getTime()-start.getTime())/86400000)+1;
  },[CAMP_START_DATE]);

  const dayNumber=useMemo(()=>calculateDayNumber(selectedDate),[calculateDayNumber,selectedDate]);
  const isRestDay=dayNumber%7===0;

  // 防止休息日殘留訓練勾選
  useEffect(()=>{
    if(isRestDay&&trainingDone) setTrainingDone(false);
  },[isRestDay,trainingDone]);

  // 有輸入日記時，自動把日記完成設為 true（若要完全同步可改為 setDiaryDone(hasText)）
  useEffect(()=>{
    const hasText=diaryText.trim().length>0;
    if(hasText) setDiaryDone(true);
  },[diaryText]);


  // 名單載入後的預選與一致性（URL > 本地記憶），並校驗名單異動
  useEffect(() => {
    if (nameOptions.length === 0) return;

    // 1) URL ?userId=（可為 value 或 label）→ 優先預選一次
    if (!userId && QUERY_USER_ID) {
      const found = nameOptions.find(o => o.value === QUERY_USER_ID || o.label === QUERY_USER_ID);
      if (found) {
        setUserId(found.value);
        localStorage.setItem(LAST_REPORT_USER_ID_KEY, found.value);
        return;
      }
    }

    // 2) 沒有 URL → 用上次記住的 userId（value）
    if (!userId && !QUERY_USER_ID) {
      const saved = localStorage.getItem(LAST_REPORT_USER_ID_KEY) || '';
      if (saved) {
        const found = nameOptions.find(o => o.value === saved);
        if (found) { setUserId(found.value); return; }
        localStorage.removeItem(LAST_REPORT_USER_ID_KEY);
      }
    }

    // 3) 名單異動：當前 userId 不存在 → 清空並提示
    if (userId && !nameOptions.some(o => o.value === userId)) {
      setUserId('');
      localStorage.removeItem(LAST_REPORT_USER_ID_KEY);
      showErrorToast('名單異動：原本的姓名已不在名單中，請重新選擇');
    }
  }, [nameOptions, userId]);


  const getValidationMessage=useCallback(()=>{
    const selected=parseLocalDateString(selectedDate);
    const todayDate=parseLocalDateString(today);
    if(!userId) return '請先選擇您的名字';
    if(selected<CAMP_START_DATE) return '營隊作業從 08/25 才開始喔!';
    if(selected>todayDate) return '不能選擇未來的日期喔！';
    if(!isRestDay&&!trainingDone&&!diaryDone) return '至少要完成訓練或日記其中一項喔!💪';
    if(isRestDay&&!diaryDone) return '健心日，好好覺察自己的內心 📝';
    return '';
  },[userId,selectedDate,today,CAMP_START_DATE,isRestDay,trainingDone,diaryDone]);

  const validationMessage=useMemo(()=>getValidationMessage(),[getValidationMessage]);

  const resetAfterSuccess=()=>{
    setTrainingDone(false);
    setDiaryDone(false);
    setDiaryText('');
    setSelectedDate(today);
  };

  const handleSubmit=async()=>{
    const errorMessage=getValidationMessage();
    if(errorMessage){
      showErrorToast('⚠️ 回報失敗：'+errorMessage);
      return;
    }
    if(!POST_API_URL){
      showErrorToast('系統設定有誤：POST_API_URL 未設定');
      return;
    }
  
    setSubmitting(true);
  
    // 這裡很關鍵：GAS 期望收到的是「顯示名稱」（label）
    const displayName = selectedOption?.label || '';
  
    const data={
      userId: displayName,        // ← 原本是 userId（value），改成 label
      trainingDone,
      diaryDone,
      date:selectedDate,
      dayNumber,
      diaryText
    };
  
    try{
      const response=await fetch(POST_API_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data)
      });
      const text=await response.text();
      const result=(text||'').trim();
  
      const randomSuccess=successTextList[Math.floor(Math.random()*successTextList.length)];
      setSuccessText(randomSuccess);
      setSubmitted(true);
  
      showSuccessToast(result.length>0?result:'回報成功！💪');
      resetAfterSuccess();
    }catch(err:any){
      console.error('送出錯誤',err);
      showErrorToast('送出失敗：'+(err?.message||'未知錯誤'));
    }finally{
      setSubmitting(false);
    }
  };
  

  const yearsOptions=useMemo(()=>{
    const startYear=CAMP_START_DATE.getFullYear();
    const endYear=parseLocalDateString(today).getFullYear();
    const arr:number[]=[];
    for(let y=startYear;y<=endYear;y++) arr.push(y);
    return arr;
  },[CAMP_START_DATE,today]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start">
      <Header/>
      {toast.kind&&(
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 text-white transition-opacity duration-300 ${toast.kind==='ok'?'bg-teal-500':'bg-rose-500'}`}>
          {toast.text}
        </div>
      )}

      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-6 space-y-6">
        {/* 選擇姓名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">選擇您的名字</label>
          <Select
            options={nameOptions}
            value={selectedOption}
            onChange={selected=>{
              const id = selected ? selected.value : '';
              setUserId(id);
              if (id) localStorage.setItem(LAST_REPORT_USER_ID_KEY, id);
              else localStorage.removeItem(LAST_REPORT_USER_ID_KEY);
            }}
            
            placeholder="請輸入或選擇姓名"
            className="text-sm"
            isLoading={rosterLoading}
          />
        </div>

        {/* 選擇日期 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">選擇回報日期</label>
          <DatePicker
            renderCustomHeader={({date,changeYear,changeMonth,decreaseMonth,increaseMonth,prevMonthButtonDisabled,nextMonthButtonDisabled})=>(
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg text-gray-700">
                <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} className="px-2 py-1 text-sm hover:bg-gray-200 rounded disabled:opacity-30">‹</button>
                <div className="flex items-center space-x-2">
                  <select value={date.getFullYear()} onChange={({target:{value}})=>changeYear(Number(value))} className="bg-white border border-gray-300 rounded px-2 py-1 text-sm">
                    {yearsOptions.map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={date.getMonth()} onChange={({target:{value}})=>changeMonth(Number(value))} className="bg-white border border-gray-300 rounded px-2 py-1 text-sm">
                    {['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'].map((m,i)=><option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} className="px-2 py-1 text-sm hover:bg-gray-200 rounded disabled:opacity-30">›</button>
              </div>
            )}
            selected={parseLocalDateString(selectedDate)}
            onChange={(date:Date|null)=>{if(date) setSelectedDate(formatDateLocal(date));}}
            minDate={CAMP_START_DATE}
            maxDate={parseLocalDateString(today)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            calendarClassName="bg-white rounded-lg shadow-xl border border-gray-200 p-2"
            dateFormat="yyyy-MM-dd"
            placeholderText="請選擇回報日期"
          />
          <p className="text-xs text-gray-500 mt-1">營隊第 {dayNumber} 天</p>
        </div>

        {/* 今天有完成訓練 */}
        {!isRestDay?(
          <div className="flex items-center space-x-3">
            <FaDumbbell className="text-teal-600 text-xl"/>
            <label htmlFor="trainingDone" className="flex items-center text-gray-700 cursor-pointer">
              <input id="trainingDone" type="checkbox" className="mr-2" checked={trainingDone} onChange={e=>setTrainingDone(e.target.checked)}/>
              今天有完成訓練
            </label>
          </div>
        ):(
          <div className="flex items-center space-x-3 text-gray-500">
            <FaDumbbell className="text-teal-400 text-xl"/>
            <span className="italic">今天是健心休息日，請好好休息 💤</span>
          </div>
        )}

        {/* 今天有寫日記 */}
        <div className="flex items-center space-x-3">
          <FaBookOpen className="text-teal-600 text-xl"/>
          <label htmlFor="diaryDone" className="flex items-center text-gray-700 cursor-pointer">
            <input id="diaryDone" type="checkbox" className="mr-2" checked={diaryDone} onChange={e=>setDiaryDone(e.target.checked)}/>
            今天有寫覺察日記
          </label>
        </div>

        {/* 覺察日記區塊 */}
        <div className="space-y-2">
          <label htmlFor="diaryText" className="block text-sm font-medium text-gray-700 mb-1">今日覺察日記</label>
          <textarea
            id="diaryText"
            rows={6}
            value={diaryText}
            maxLength={150}
            onChange={e=>setDiaryText(e.target.value)}
            placeholder="在這裡記錄您今天的感受、覺察和反思..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent text-sm transition duration-150 resize-none"
          />
          <p className={`text-xs text-right mt-1 ${diaryText.length>120?'text-red-500':'text-gray-500'}`}>{diaryText.length}/150</p>
        </div>

        {/* 提交按鈕（disabled 僅依必填條件 userId；其他交由 handleSubmit 統一提示） */}
        <button
          onClick={handleSubmit}
          disabled={submitting||!userId}
          className="w-full flex justify-center items-center bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-xl transition duration-150 disabled:opacity-50"
        >
          <FaCheckCircle className="mr-2"/>
          {submitting?'奔跑提交中...':'提交回報'}
        </button>

        {/* 驗證提示 */}
        {validationMessage&&(
          <p className="text-sm text-teal-500 mt-2 text-center">{validationMessage}</p>
        )}

        {/* 成功提示 */}
        {submitted&&(
          <div className="flex flex-col items-center justify-center mt-6">
            <FaCheckCircle className="text-green-500 text-4xl animate-bounce"/>
            <p className="text-green-600 text-center font-semibold mt-2">{successText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
