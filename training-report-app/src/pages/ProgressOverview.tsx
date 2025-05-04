import { useEffect, useState } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { Link } from 'react-router-dom'; 
import Select from 'react-select';
import Header from './components/Header';
import { getLevelBackgroundStyle } from '../pages/utils/levelStyle.ts';
import { progressMovementMap } from '../pages/utils/progressMovementMap';

interface UserProgress {
  nickname: string;
  point?: number; 
  rotation: string;
  progress: {
    [theme: string]: {
      [action: string]: string;
    };
  };
}

interface WeekTheme {
  title: string;
  week: number;
}

/*const getLevelStyle = (level: string) => {
  switch (level) {
    case 'Lv0':
    case 'LV0':
      return 'bg-gray-200 text-gray-700';
    case 'Lv1':
      return 'bg-blue-100 text-blue-800';
    case 'Lv2':
      return 'bg-green-100 text-green-800';
    case 'Lv3':
      return 'bg-yellow-100 text-yellow-800';
    case 'Lv4':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-purple-100 text-gray-500';
  }
};*/

export default function ProgressOverview() {
  const [data, setData] = useState<UserProgress[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await fetch(import.meta.env.VITE_PROGRESS_API_URL);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("載入進度資料失敗：", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, []);

  const allThemes = Object.keys(data[0]?.progress || {});
  const weekThemes: WeekTheme[] = allThemes.map((title, i) => ({ title, week: i + 1 }));

  const nameOptions = data.map((user) => ({
    label: user.nickname,
    value: user.nickname,
  }));

  const weekOptions = weekThemes.map((theme) => ({
    label: `第${theme.week}週：${theme.title.replace(/-\d$/, '')}`,
    value: theme.title,
  }));

  const filteredUser = data.find((u) => u.nickname === selectedUser);
  const visibleThemes = selectedWeek ? weekThemes.filter((t) => t.title === selectedWeek) : weekThemes;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start">
      <Header />

      {loading ? (
        <p className="text-center text-gray-500 mt-4">載入中...</p>
      ) : (
        <>
          {/* 查詢個人進度 */}
          <div className="bg-white w-full max-w-md rounded-xl shadow-md p-4 mb-6">
            <label className="block text-sm text-gray-600 mb-2">查詢個人進度</label>
            <Select
              options={nameOptions}
              value={selectedUser ? { label: selectedUser, value: selectedUser } : null}
              onChange={(e) => setSelectedUser(e?.value || null)}
              placeholder="請選擇隊員"
              isClearable
            />
            {filteredUser && (
              <div className="mt-4 text-sm text-gray-700">
                {filteredUser.point !== undefined && (
                  <p className="mb-2 font-semibold">訓練點數：{filteredUser.point} 點</p>
                )}
                <p className="mb-2 font-semibold">身體旋轉習慣：{filteredUser.rotation}</p>
                {Object.entries(filteredUser.progress).map(([theme, actions], idx) => (
                  <div key={idx} className="mb-2">
                    <p className="font-medium text-teal-600">第{idx+1}週:{theme.replace(/-\d$/, '')}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(actions).map(([action, lv], i) => {
                        const mapped = progressMovementMap.find(
                          (item) => item.week === (idx + 1) && item.action === action
                        );
                        const movementTitle = mapped?.title || '';

                        return (
                          <Link
                            to={`/movement?search=${encodeURIComponent(movementTitle)}`}
                            key={i}
                            className={`px-2 py-1 rounded-full text-xs ${getLevelBackgroundStyle(lv)} hover:underline hover:text-blue-600 transition min-w-[72px] text-center font-mono`}
                          >
                            {action}: {lv}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 進度總覽 */}
          <div className="bg-white w-full max-w-5xl rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-teal-600">進度總覽</h2>
              <div className="w-60">
                <Select
                  options={weekOptions}
                  onChange={(e) => setSelectedWeek(e?.value || null)}
                  value={selectedWeek ? { label: weekOptions.find(w => w.value === selectedWeek)?.label || '', value: selectedWeek } : null}
                  placeholder="選擇週次"
                  isClearable
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm font-mono">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-2 py-1 border w-24 text-center">綽號</th>
                    <th className="px-2 py-1 border w-20 text-center">點數</th>
                    {visibleThemes.map((t, i) => (
                      <th key={i} colSpan={3} className="px-2 py-1 border text-center">
                        第{i+1}週:{t.title.replace(/-\d$/, '')}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="border px-2 py-1"></th>
                    <th className="border px-2 py-1"></th>
                    {visibleThemes.map((_, i) => [1, 2, 3].map(j => (
                      <th key={`${i}-${j}`} className="border px-2 py-1 text-center w-24 whitespace-normal">動作<br />{j}</th>
                    )))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((user, i) => (
                    <tr key={i}>
                      <td className="border px-2 py-1 font-semibold whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <FaUserCircle className="text-gray-400" />
                          <span>{user.nickname}</span>
                        </div>
                      </td>
                      <td className="border px-2 py-1 text-center">{user.point ?? '-'}</td>
                      {visibleThemes.map((theme, j) => {
                        const actions = user.progress[theme.title] || {};
                        return ['動作1', '動作2', '動作3'].map((action, k) => (
                          <td
                            key={`${j}-${k}`}
                            className={`border px-2 py-1 text-center min-h-[48px] align-middle whitespace-normal ${getLevelBackgroundStyle(actions[action] || '-')}`}
                          >
                            {actions[action] || '-'}
                          </td>
                        ));
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
