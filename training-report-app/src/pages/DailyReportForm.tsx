import { useEffect, useState } from 'react';
import { FaDumbbell, FaBookOpen, FaCheckCircle } from 'react-icons/fa';
import Select from 'react-select';
import Header from './components/Header';

function getTaiwanTodayDateString() {
  const now = new Date();
  const taiwanOffset = 8 * 60;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const taiwanTime = new Date(utc + taiwanOffset * 60000);
  return taiwanTime.toISOString().split("T")[0];
}

export default function DailyReportForm() {
  const [userId, setUserId] = useState("");
  const [trainingDone, setTrainingDone] = useState(false);
  const [diaryDone, setDiaryDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [nameOptions, setNameOptions] = useState<{ label: string; value: string }[]>([]);

  const [selectedDate, setSelectedDate] = useState(getTaiwanTodayDateString);
  const CAMP_START_DATE = new Date("2025-02-17");
  const calculateDayNumber = (dateStr: string) => {
    const date = new Date(dateStr);
    return Math.floor((date.getTime() - CAMP_START_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };
  const dayNumber = calculateDayNumber(selectedDate);

  const NAME_API_URL = `${import.meta.env.VITE_GAS_URL}?action=names`;
  const POST_API_URL = import.meta.env.VITE_REPORT_API_URL;

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

  const handleSubmit = async () => {
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

      const result = await response.text();
      setSubmitted(true);
      alert(result);
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

      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-6 space-y-6">
        <h1 className="text-2xl font-bold text-center text-teal-600">每日訓練回報表</h1>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">選擇您的名字</label>
          <Select
            options={nameOptions}
            onChange={(selected) => setUserId(selected ? selected.value : "")}
            placeholder="請輸入或選擇姓名"
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">選擇回報日期</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">營隊第 {dayNumber} 天</p>
        </div>

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

        <button
          onClick={handleSubmit}
          disabled={submitting || !userId}
          className="w-full flex justify-center items-center bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-xl transition duration-150 disabled:opacity-50"
        >
          <FaCheckCircle className="mr-2" />
          {submitting ? '提交中...' : '提交回報'}
        </button>

        {submitted && (
          <p className="text-green-600 text-center font-semibold mt-4">回報成功，感謝你！💪</p>
        )}
      </div>
    </div>
  );
}
