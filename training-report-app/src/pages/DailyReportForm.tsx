import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { FaDumbbell, FaBookOpen, FaCheckCircle } from 'react-icons/fa';
import { GiSloth } from "react-icons/gi";
import Select from 'react-select';
import Header from './components/Header';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import useRoster from '../hooks/useRoster';
import {
  CAMP_START,
  todayYMD,
  parseLocalYMD,
  formatDateLocal,
  campDayNumber,
} from './utils/campConfig';
import { captureEvent, classifySubmitError } from '../lib/analytics';

// 記住上次選的人（報表頁用自己的 key，避免跟日記頁混到）
const LAST_REPORT_USER_ID_KEY = 'report:lastUserId';

// 讀網址參數（可沿用你現有的工具）
function getQueryParam(name: string) {
  const sp = new URLSearchParams(window.location.search);
  return sp.get(name) || '';
}
const QUERY_USER_ID = getQueryParam('userId');

export default function DailyReportForm() {
  const today = todayYMD();

  // 營期起始（用共用工具解析）
  const CAMP_START_DATE = parseLocalYMD(CAMP_START);

  const [userId, setUserId] = useState(() => localStorage.getItem(LAST_REPORT_USER_ID_KEY) || '');
  const [trainingDone, setTrainingDone] = useState(false);
  const [diaryDone, setDiaryDone] = useState(false);
  const [diaryText, setDiaryText] = useState('');
  const [bodyFatigue, setBodyFatigue] = useState<number | null>(null);  // 0~10；null 代表未填
  const [brainFatigue, setBrainFatigue] = useState<number | null>(null); // 0~10；null 代表未填
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successText, setSuccessText] = useState('');
  const { options: nameOptions, loading: rosterLoading } = useRoster();

  const selectedOption = useMemo(
    () => nameOptions.find((o) => o.value === userId) || null,
    [nameOptions, userId]
  );

  const AWS_BASE_URL = import.meta.env.VITE_AWS_BASE_URL as string | undefined;
  // PostAPI 是舊版 Firebase Function, 暫時保留備用
  const POST_API_URL = import.meta.env.VITE_REPORT_API_URL as string | undefined;

  /** ===== 簡易 Toast ===== */
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'err' | null }>({
    text: '',
    kind: null,
  });
  const hideTimerRef = useRef<number | null>(null);
  const triggerToast = (text: string, kind: 'ok' | 'err') => {
    setToast({ text, kind });
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setToast({ text: '', kind: null }), 2200);
  };
  const showSuccessToast = (m = '提交成功！💪') => triggerToast(m, 'ok');
  const showErrorToast = (m: string) => triggerToast(m, 'err');

  const [selectedDate, setSelectedDate] = useState(today);

  /** ===== 第幾天 / 休息日計算（改用共用工具） ===== */
  const calculateDayNumber = useCallback(
    (dateStr: string) => campDayNumber(dateStr),
    []
  );

  const dayNumber = useMemo(() => calculateDayNumber(selectedDate), [calculateDayNumber, selectedDate]);
  const isRestDay = dayNumber % 7 === 0;

  /** 防止休息日殘留訓練勾選 */
  useEffect(() => {
    if (isRestDay && trainingDone) setTrainingDone(false);
  }, [isRestDay, trainingDone]);

  /** New: 取消勾選訓練時一併清空進階欄位 */
  useEffect(() => {
    if (!trainingDone) {
      setBodyFatigue(null);
      setBrainFatigue(null);
    }
  }, [trainingDone]);

  /** 有輸入日記時，自動把日記完成設為 true（若要完全同步可改為 setDiaryDone(hasText)） */
  useEffect(() => {
    const hasText = diaryText.trim().length > 0;
    if (hasText) setDiaryDone(true);
  }, [diaryText]);

  /** 名單載入後的預選與一致性（URL > 本地記憶），並校驗名單異動 */
  useEffect(() => {
    if (nameOptions.length === 0) return;

    // 1) URL ?userId=（可為 value 或 label）→ 優先預選一次
    if (!userId && QUERY_USER_ID) {
      const found = nameOptions.find((o) => o.value === QUERY_USER_ID || o.label === QUERY_USER_ID);
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
        const found = nameOptions.find((o) => o.value === saved);
        if (found) {
          setUserId(found.value);
          return;
        }
        localStorage.removeItem(LAST_REPORT_USER_ID_KEY);
      }
    }

    // 3) 名單異動：當前 userId 不存在 → 清空並提示
    if (userId && !nameOptions.some((o) => o.value === userId)) {
      setUserId('');
      localStorage.removeItem(LAST_REPORT_USER_ID_KEY);
      showErrorToast('名單異動：原本的姓名已不在名單中，請重新選擇');
    }
  }, [nameOptions, userId]);

  /** 驗證（使用共用日期工具，避免 UTC 偏移） */
  const getValidationMessage = useCallback(() => {
    const selected = parseLocalYMD(selectedDate);
    const todayDate = parseLocalYMD(today);
    if (!userId) return '請先選擇您的名字';
    if (selected < CAMP_START_DATE) return `營隊作業從 ${CAMP_START} 才開始喔!`;
    if (selected > todayDate) return '不能選擇未來的日期喔！';
    if (!isRestDay && !trainingDone && !diaryDone) return '至少要完成訓練或日記其中一項喔!💪';
    if (isRestDay && !diaryDone) return '健心日，好好覺察自己的內心 📝';
    return '';
  }, [userId, selectedDate, today, CAMP_START_DATE, isRestDay, trainingDone, diaryDone]);

  const validationMessage = useMemo(() => getValidationMessage(), [getValidationMessage]);

  /** 成功後重置 */
  const resetAfterSuccess = () => {
    setTrainingDone(false);
    setDiaryDone(false);
    setDiaryText('');
    setSelectedDate(today);
    setBodyFatigue(null);
    setBrainFatigue(null);
  };

  /** 送出 */
  const handleSubmit = async () => {
    const errorMessage = getValidationMessage();
    if (errorMessage) {
      captureEvent('daily_report_submit_failed', {
        failure_stage: 'validation',
        error_type: 'validation',
        user_id: userId || undefined,
        user_name: selectedOption?.label || undefined,
      });
      showErrorToast('回報失敗：' + errorMessage);
      return;
    }
    // 選擇目標：優先用 AWS，否則回退 GAS
    const useAWS = !!AWS_BASE_URL;
    if (!useAWS && !POST_API_URL) {
      captureEvent('daily_report_submit_failed', {
        failure_stage: 'config',
        error_type: 'config',
        user_id: userId || undefined,
        user_name: selectedOption?.label || undefined,
      });
      showErrorToast('系統設定有誤：未設定可用的回報 API');
      return;
    }

    setSubmitting(true);

    // 這裡很關鍵：GAS 期望收到的是「顯示名稱」（label）
    const displayName = selectedOption?.label || '';
    const valueId = userId; // 給 AWS 用
    if (useAWS && !valueId) {
      showErrorToast('請先選擇您的名字');
      setSubmitting(false);
      return;
    }

    // AWS payload
    const awsPayload = {
      date: selectedDate,
      movement_completed: trainingDone,
      diary_completed: diaryDone,
      diary_content: (diaryText || '').slice(0, 150).trim(),
      body_rpe: bodyFatigue,      // 新增：身體疲勞度（null 或 0~10）
      brain_rpe: brainFatigue,    // 新增：大腦疲勞度（null 或 0~10）
    };

    // GAS payload
    const dayNumber = campDayNumber(selectedDate);
    const data = {
      userId: displayName,
      trainingDone,
      diaryDone,
      date: selectedDate,
      dayNumber,
      diaryText: (diaryText || '').slice(0, 150).trim(),
    };

    // 超時保護
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000); // 10s

    try {
      const url = useAWS
        ? `${AWS_BASE_URL!.replace(/\/+$/, '')}/users/${encodeURIComponent(valueId)}/check-in`
        : POST_API_URL!;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(useAWS ? awsPayload : data),
        signal: controller.signal,
      });

      // 嘗試解析回應（文字或 JSON 都能顯示）
      let msg = '';
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await res.json().catch(() => ({}));
        msg = (j?.message || j?.msg || '') as string;
      } else {
        msg = (await res.text()).trim();
      }

      if (!res.ok) {
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const successTextList = [
        '回報完成！🎉🎉',
        '回報完成！今天的你很棒👏',
        '回報完成！給自己一個大大的讚👍',
        '回報完成！太強了！🔥',
      ];
      const randomSuccess = successTextList[Math.floor(Math.random() * successTextList.length)];

      setSuccessText(randomSuccess);
      setSubmitted(true);
      captureEvent('daily_report_submitted', {
        user_id: valueId,
        user_name: displayName,
        date: selectedDate,
        day_number: dayNumber,
        is_rest_day: isRestDay,
        training_done: trainingDone,
        diary_done: diaryDone,
        has_diary_text: diaryText.trim().length > 0,
        diary_text_length: diaryText.trim().length,
        body_rpe: bodyFatigue,
        brain_rpe: brainFatigue,
        backend: useAWS ? 'aws' : 'legacy',
      });
      if (msg && msg !== 'OK') {
        showSuccessToast(msg);
      } else {
        showSuccessToast('回報成功！💪');
      }
      resetAfterSuccess();
    } catch (err: unknown) {
      console.error('送出錯誤', err);
      captureEvent('daily_report_submit_failed', {
        failure_stage: 'submit',
        error_type: classifySubmitError(err),
        user_id: userId || undefined,
        user_name: selectedOption?.label || undefined,
      });
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        showErrorToast('送出逾時，請稍後再試');
      } else {
        const message = err instanceof Error ? err.message : '未知錯誤';
        showErrorToast('送出失敗：' + message);
      }
    } finally {
      window.clearTimeout(timer);
      setSubmitting(false);
    }
  };

  /** 年份下拉（依營期起始到今天年份） */
  const yearsOptions = useMemo(() => {
    const startYear = CAMP_START_DATE.getFullYear();
    const endYear = parseLocalYMD(today).getFullYear();
    const arr: number[] = [];
    for (let y = startYear; y <= endYear; y++) arr.push(y);
    return arr;
  }, [CAMP_START_DATE, today]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start">
      <Header />
      {toast.kind && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 text-white transition-opacity duration-300 ${
            toast.kind === 'ok' ? 'bg-teal-500' : 'bg-rose-500'
          }`}
        >
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
            onChange={(selected) => {
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
            renderCustomHeader={({
              date,
              changeYear,
              changeMonth,
              decreaseMonth,
              increaseMonth,
              prevMonthButtonDisabled,
              nextMonthButtonDisabled,
            }) => (
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg text-gray-700">
                <button
                  onClick={decreaseMonth}
                  disabled={prevMonthButtonDisabled}
                  className="px-2 py-1 text-sm hover:bg-gray-200 rounded disabled:opacity-30"
                >
                  ‹
                </button>
                <div className="flex items-center space-x-2">
                  <select
                    value={date.getFullYear()}
                    onChange={({ target: { value } }) => changeYear(Number(value))}
                    className="bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    {yearsOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <select
                    value={date.getMonth()}
                    onChange={({ target: { value } }) => changeMonth(Number(value))}
                    className="bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    {['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'].map(
                      (m, i) => (
                        <option key={i} value={i}>
                          {m}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <button
                  onClick={increaseMonth}
                  disabled={nextMonthButtonDisabled}
                  className="px-2 py-1 text-sm hover:bg-gray-200 rounded disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            )}
            selected={parseLocalYMD(selectedDate)}
            onChange={(date: Date | null) => {
              if (date) setSelectedDate(formatDateLocal(date));
            }}
            minDate={parseLocalYMD(CAMP_START)}
            maxDate={parseLocalYMD(today)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            calendarClassName="bg-white rounded-lg shadow-xl border border-gray-200 p-2"
            dateFormat="yyyy-MM-dd"
            placeholderText="請選擇回報日期"
          />
          <p className="text-xs text-gray-500 mt-1">
            {parseLocalYMD(selectedDate) < CAMP_START_DATE
              ? `營隊從 ${formatDateLocal(CAMP_START_DATE)} 開始喔！`
              : `營隊第 ${dayNumber} 天`}
          </p>
        </div>

        {/* 今天有完成訓練 */}
        {!isRestDay ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <FaDumbbell className="text-teal-600 text-xl" />
              <label htmlFor="trainingDone" className="flex items-center text-gray-700 cursor-pointer">
                <input
                  id="trainingDone"
                  type="checkbox"
                  className="mr-2"
                  checked={trainingDone}
                  onChange={(e) => setTrainingDone(e.target.checked)}
                />
                今天有完成訓練
              </label>
            </div>

            {/* New: 進階欄位（滑桿版本） */}
            {trainingDone && (
              <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl space-y-6">
                {/* 身體疲勞度滑桿 */}
                <div>
                  <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    身體疲勞度（選填）
                    {bodyFatigue !== null ? (
                      // 已選狀態：顯示實際分數
                      <span className="ml-2 text-teal-600 font-bold text-lg">{bodyFatigue}</span>
                    ) : (
                      // 未選狀態：顯示提示，不顯示分數
                      <span className="ml-2 text-gray-400 font-normal">待評分</span> // <--- 關鍵提示
                    )}
                  </label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      10 分 = 累到身體出不了力
                    </p>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={bodyFatigue ?? 0}
                      onChange={(e) => setBodyFatigue(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: bodyFatigue !== null 
                          ? `linear-gradient(to right, #0d9488 0%, #0d9488 ${(bodyFatigue / 10) * 100}%, #e5e7eb ${(bodyFatigue / 10) * 100}%, #e5e7eb 100%)`
                          : '#e5e7eb'
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1 px-0.5">
                      <span>0</span>
                      <span>5</span>
                      <span>10</span>
                    </div>
                  </div>
                  
                  {bodyFatigue !== null && (
                    <button
                      type="button"
                      onClick={() => setBodyFatigue(null)}
                      className="mt-2 text-xs text-gray-500 hover:text-teal-600 underline"
                    >
                      清除選擇
                    </button>
                  )}
                </div>

                {/* 大腦疲勞度滑桿 */}
                <div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      大腦疲勞度（選填）
                      {brainFatigue !== null ? (
                      // 已選狀態：顯示實際分數
                      <span className="ml-2 text-teal-600 font-bold text-lg">{brainFatigue}</span>
                    ) : (
                      // 未選狀態：顯示提示，不顯示分數
                      <span className="ml-2 text-gray-400 font-normal">待評分</span> // <--- 關鍵提示
                    )}
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      10 分 = 累到大腦想關機
                    </p>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={brainFatigue ?? 0}
                      onChange={(e) => setBrainFatigue(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: brainFatigue !== null 
                          ? `linear-gradient(to right, #0d9488 0%, #0d9488 ${(brainFatigue / 10) * 100}%, #e5e7eb ${(brainFatigue / 10) * 100}%, #e5e7eb 100%)`
                          : '#e5e7eb'
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1 px-0.5">
                      <span>0</span>
                      <span>5</span>
                      <span>10</span>
                    </div>
                  </div>
                  
                  {brainFatigue !== null && (
                    <button
                      type="button"
                      onClick={() => setBrainFatigue(null)}
                      className="mt-2 text-xs text-gray-500 hover:text-teal-600 underline"
                    >
                      清除選擇
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-3 text-gray-500">
            <GiSloth className="text-teal-400 text-xl" />
            <span className="italic">今天是健心休息日，請好好休息 💤</span>
          </div>
        )}

        {/* 今天有寫日記 */}
        <div className="flex items-center space-x-3">
          <FaBookOpen className="text-teal-600 text-xl" />
          <label htmlFor="diaryDone" className="flex items-center text-gray-700 cursor-pointer">
            <input
              id="diaryDone"
              type="checkbox"
              className="mr-2"
              checked={diaryDone}
              onChange={(e) => setDiaryDone(e.target.checked)}
            />
            今天有寫覺察日記
          </label>
        </div>

        {/* 覺察日記區塊 */}
        <div className="space-y-2">
          <label htmlFor="diaryText" className="block text-sm font-medium text-gray-700 mb-1">
            今日覺察日記
          </label>
          <textarea
            id="diaryText"
            rows={6}
            value={diaryText}
            maxLength={150}
            onChange={(e) => setDiaryText(e.target.value)}
            placeholder="記錄您今天的感受、訓練中的困惑、身體的不適感、或者任何訓練心得"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent text-sm transition duration-150 resize-none"
          />
          <p className={`text-xs text-right mt-1 ${diaryText.length > 120 ? 'text-red-500' : 'text-gray-500'}`}>
            {diaryText.length}/150
          </p>
        </div>

        {/* 提交按鈕（disabled 僅依必填條件 userId；其他交由 handleSubmit 統一提示） */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !userId || parseLocalYMD(selectedDate) < CAMP_START_DATE}
          className="w-full flex justify-center items-center bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-xl transition duration-150 disabled:opacity-50"
        >
          <FaCheckCircle className="mr-2" />
          {submitting ? '奔跑提交中...' : '提交回報'}
        </button>

        {/* 驗證提示 */}
        {validationMessage && <p className="text-sm text-teal-500 mt-2 text-center">{validationMessage}</p>}

        {/* 成功提示 */}
        {submitted && (
          <div className="flex flex-col items-center justify-center mt-6">
            <FaCheckCircle className="text-green-500 text-4xl animate-bounce" />
            <p className="text-green-600 text-center font-semibold mt-2">{successText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
