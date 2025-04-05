import { useEffect, useState } from 'react';
import { FaDumbbell, FaBookOpen, FaCheckCircle } from 'react-icons/fa';
import Select from 'react-select';

export default function DailyReportForm() {
  const [userId, setUserId] = useState("");
  const [trainingDone, setTrainingDone] = useState(false);
  const [diaryDone, setDiaryDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [nameOptions, setNameOptions] = useState<{ label: string; value: string }[]>([]);

  const NAME_API_URL = "https://script.google.com/macros/s/AKfycbzP-zr90lA0HPqUQiemnZ7DvbBohCuJah8XPTjC6LJJgBvWQvvCTHKkTMrxQ6wPdGd2GA/exec?action=names";

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
    const payload = {
      userId,
      trainingDone,
      diaryDone,
    };

    try {
      const response = await fetch('https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        alert('提交失敗，請稍後再試');
      }
    } catch (error) {
      alert('發生錯誤，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start">
      <div className="max-w-md w-full mb-6 text-center">
        <div className="flex justify-center mb-4">
          <img
            src="https://via.placeholder.com/80"
            alt="Logo Placeholder"
            className="w-20 h-20 rounded-full shadow-lg"
          />
        </div>
        <h2 className="text-xl font-bold text-teal-700 leading-snug">
          Jo i 健康隊
        </h2>
        <h3 className="text-lg font-semibold text-gray-700 leading-snug">
          身體控制挑戰營(上) 第一期
        </h3>
        <p className="text-sm text-gray-500">
          2025/02/17 ~ 2025/04/13
        </p>
      </div>

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
