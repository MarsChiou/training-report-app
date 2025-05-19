import { useEffect, useState } from 'react';
import { FaDumbbell, FaBookOpen, FaCheckCircle } from 'react-icons/fa';
import Select from 'react-select';
import Header from './components/Header';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";


function getTaiwanTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function DailyReportForm() {
  const today = getTaiwanTodayDateString();

  const [userId, setUserId] = useState("");
  const [trainingDone, setTrainingDone] = useState(false);
  const [diaryDone, setDiaryDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [nameOptions, setNameOptions] = useState<{ label: string; value: string }[]>([]);

  const [selectedDate, setSelectedDate] = useState(today);
  const CAMP_START_DATE = new Date("2025-05-05");
  const calculateDayNumber = (dateStr: string) => {
    const date = new Date(dateStr);
    return Math.floor((date.getTime() - CAMP_START_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };
  const dayNumber = calculateDayNumber(selectedDate);
  const isRestDay = dayNumber % 7 === 0;

  const NAME_API_URL = `${import.meta.env.VITE_GAS_URL}?action=names`;
  const POST_API_URL = import.meta.env.VITE_REPORT_API_URL;
  const [showToast, setShowToast] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  
  const getValidationMessage = () => {
    const selected = new Date(selectedDate);
    const todayDate = new Date(today);  
    if (!userId) return "請先選擇您的名字";
    if (selected < CAMP_START_DATE) return "營隊作業從 5/5 才開始喔!";
    if (selected > todayDate) return "不能選擇未來的日期喔！";
    if (!isRestDay && !trainingDone && !diaryDone) return "至少要完成訓練或日記其中一項喔!💪";
    if (isRestDay && !diaryDone) return "健心日，好好覺察自己的內心 📝";

    return "";
  };
  const validationMessage = getValidationMessage();

  const successTextList = [
    "回報完成！🎉🎉",
    "回報完成！今天的你還是這麼棒👏",
    "回報完成！給自己一個大大的讚👍",
    "回報完成！太強了！🔥"
  ];
  const [successText, setSuccessText] = useState("");
  

  useEffect(() => {
    fetch(NAME_API_URL)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const options = data.map((name) => ({ label: name, value: name }));
          setNameOptions(options);
        }
      })
      .catch((err) => console.error("名單載入失敗：", err));
  }, []);

  const showSuccessToast = (message: string = "提交成功！💪") => {
    setToastMessage(message);
    setSubmitted(true);
    setShowToast(true);
    setTimeout(() => setToastVisible(true), 50);
    setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setShowToast(false), 300);
    }, 2000);
  };
  
  const showErrorToast = (message: string) => {
    setToastMessage(message);
    setSubmitted(false);
    setShowToast(true);
    setTimeout(() => setToastVisible(true), 50);
    setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setShowToast(false), 300);
    }, 2000);
  };
  
  
  const handleSubmit = async () => {
    const errorMessage = getValidationMessage();
    if (errorMessage) {
      showErrorToast("⚠️ 回報失敗：" + errorMessage);
      return;
    }
    
    setSubmitting(true);

    const data = {
      userId,
      trainingDone,
      diaryDone,
      date: selectedDate,
      dayNumber: dayNumber,
    };

    try {
      const response = await fetch(POST_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = (await response.text()).trim();
      
      const randomSuccess = successTextList[Math.floor(Math.random() * successTextList.length)];
      setSuccessText(randomSuccess);
      setSubmitted(true);
  
      showSuccessToast(result.length > 0 ? result : "回報成功！💪");  
    } catch (err: any) {
      console.error("送出錯誤", err);
      alert("送出失敗：" + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start">
      <Header />
      {showToast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50
          bg-teal-500 text-white transition-all duration-300 ease-out
          ${toastVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}
                      `}>
          {toastMessage}
        </div>
      )}
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-6 space-y-6">
        {/* 選擇姓名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">選擇您的名字</label>
          <Select
            options={nameOptions}
            value={nameOptions.find((option) => option.value === userId) || null}
            onChange={(selected) => {
              const id = selected ? selected.value : "";
              setUserId(id);
              if (id) {
                localStorage.setItem('userId', id);
              } else {
                localStorage.removeItem('userId');
              }
            }}
            placeholder="請輸入或選擇姓名"
            className="text-sm"
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
              nextMonthButtonDisabled
            }) => (
            <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg text-gray-700">
              {/* 上一個月按鈕 */}
              <button
                onClick={decreaseMonth}
                disabled={prevMonthButtonDisabled}
                className="px-2 py-1 text-sm hover:bg-gray-200 rounded disabled:opacity-30"
              >
                ‹
              </button>
          
              {/* 月份 + 年份下拉 */}
              <div className="flex items-center space-x-2">
                <select
                  value={date.getFullYear()}
                  onChange={({ target: { value } }) => changeYear(Number(value))}
                  className="bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  {[...Array(5)].map((_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </select>
          
                <select
                  value={date.getMonth()}
                  onChange={({ target: { value } }) => changeMonth(Number(value))}
                  className="bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  {["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"].map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </select>
              </div>
          
              {/* 下一個月按鈕 */}
              <button
                onClick={increaseMonth}
                disabled={nextMonthButtonDisabled}
                className="px-2 py-1 text-sm hover:bg-gray-200 rounded disabled:opacity-30"
              >
                ›
              </button>
            </div>
            )}
            
            /* 日期選擇邏輯 */
            selected={new Date(selectedDate)}
            onChange={(date: Date | null) => {
              if (date) {
                const formatted = date.toISOString().split("T")[0];
                setSelectedDate(formatted);
              }
            }}
            minDate={CAMP_START_DATE} // ✅ 限制不可選營隊前的日期
            maxDate={new Date(today)}// ✅ 限制不可選未來日期
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            calendarClassName="bg-white rounded-lg shadow-xl border border-gray-200 p-2"
            
            dateFormat="yyyy-MM-dd"
            placeholderText="請選擇回報日期"
          />
          <p className="text-xs text-gray-500 mt-1">營隊第 {dayNumber} 天</p>
        </div>


        {/* 今天有完成訓練 */}
        {!isRestDay ? (
          <div className="flex items-center space-x-3">
            <FaDumbbell className="text-teal-600 text-xl" />
            <label className="flex items-center text-gray-700">
              <input
                type="checkbox"
                className="mr-2"
                checked={trainingDone}
                onChange={(e) => setTrainingDone(e.target.checked)}
              />
              今天有完成訓練
            </label>
          </div>
        ) : (
          <div className="flex items-center space-x-3 text-gray-500">
            <FaDumbbell className="text-teal-400 text-xl" />
            <span className="italic">今天是健心休息日，請好好休息 💤</span>
          </div>
        )}

        {/* 今天有寫日記 */}
        <div className="flex items-center space-x-3">
          <FaBookOpen className="text-teal-600 text-xl" />
          <label className="flex items-center text-gray-700">
            <input
              type="checkbox"
              className="mr-2"
              checked={diaryDone}
              onChange={(e) => setDiaryDone(e.target.checked)}
            />
            今天有寫訓練日記
          </label>
        </div>

        {/* 提交按鈕 */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !userId || (!trainingDone && !diaryDone)}
          className="w-full flex justify-center items-center bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-xl transition duration-150 disabled:opacity-50"
        >
          <FaCheckCircle className="mr-2" />
          {submitting ? '奔跑提交中...' : '提交回報'}
        </button>
        
        {/* 錯誤提示 */}
        {validationMessage && (
          <p className="text-sm text-teal-500 mt-2 text-center">
            {validationMessage}
          </p>
        )}
        {/* 成功提示 */}
        {submitted && (
          <div className="flex flex-col items-center justify-center mt-6">
            <FaCheckCircle className="text-green-500 text-4xl animate-bounce" />
            <p className="text-green-600 text-center font-semibold mt-2">
              {successText}
            </p>
         </div>
        )}
      </div>
    </div>
  );
}
