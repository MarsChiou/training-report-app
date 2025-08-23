// pages/ProgressOverview.tsx
import { useEffect, useMemo, useState } from 'react';
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

interface ProcessedMovement {
  title: string;
  displayTitle: string;
  searchParam: string;
}

export default function ProgressOverview() {
  const [data, setData] = useState<UserProgress[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(import.meta.env.VITE_PROGRESS_API_URL);
        const json = await res.json();
        if (!Array.isArray(json)) throw new Error('進度 API 回傳格式有誤');
        setData(json as UserProgress[]);
      } catch (err) {
        console.error('載入進度資料失敗：', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 1) 把 progressMovementMap 預處理為 Map： (week-action) -> {title, displayTitle, searchParam}
  const movementMap = useMemo(() => {
    const map = new Map<string, ProcessedMovement>();
    progressMovementMap.forEach((item) => {
      const key = `${item.week}-${item.action}`;
      map.set(key, {
        title: item.title || '',
        displayTitle: item.title?.split(' ')[0] || item.action, // e.g. "P26"
        searchParam: encodeURIComponent(item.title || '')
      });
    });
    return map;
  }, []);

  // 2) 主題集合與週次清單
  const themeData = useMemo(() => {
    if (data.length === 0) return { allThemes: [] as string[], weekThemes: [] as WeekTheme[] };
    const allThemes = Object.keys(data[0].progress || {});
    const weekThemes = allThemes.map((title, i) => ({ title, week: i + 1 }));
    return { allThemes, weekThemes };
  }, [data]);

  // 3) 下拉選項
  const selectOptions = useMemo(() => {
    const nameOptions = data.map((u) => ({ label: u.nickname, value: u.nickname }));
    const weekOptions = themeData.weekThemes.map((t) => ({
      label: `第${t.week}週：${t.title.replace(/-\d$/, '')}`,
      value: t.title
    }));
    return { nameOptions, weekOptions };
  }, [data, themeData.weekThemes]);

  // 4) 畫面可見的 user 與週次
  const filteredData = useMemo(() => {
    const filteredUser = data.find((u) => u.nickname === selectedUser);
    const visibleThemes = selectedWeek
      ? themeData.weekThemes.filter((t) => t.title === selectedWeek)
      : themeData.weekThemes;
    return { filteredUser, visibleThemes };
  }, [data, selectedUser, selectedWeek, themeData.weekThemes]);

  // 5) 預先把表格要用到的資料扁平化
  const tableData = useMemo(() => {
    return data.map((user) => ({
      nickname: user.nickname,
      point: user.point,
      processedProgress: filteredData.visibleThemes.map((theme) => {
        const actions = user.progress[theme.title] || {};
        return ['動作1', '動作2', '動作3'].map((action) => {
          const level = actions[action] || '-';
          return { level, bgStyle: getLevelBackgroundStyle(level) };
        });
      })
    }));
  }, [data, filteredData.visibleThemes]);

  // 個人進度：週次嚴格以 weekThemes 對應（不靠 entries 的 index）
  const renderPersonalProgress = () => {
    const user = filteredData.filteredUser;
    if (!user) return null;

    return (
      <div className="mt-4 text-sm text-gray-700">
        {user.point !== undefined && (
          <p className="mb-2 font-semibold">訓練點數：{user.point} 點</p>
        )}
        <p className="mb-2 font-semibold">身體旋轉習慣：{user.rotation}</p>

        {Object.entries(user.progress).map(([themeKey, actions]) => {
          const weekObj = themeData.weekThemes.find((w) => w.title === themeKey);
          const weekNo = weekObj?.week ?? 0;

          return (
            <div key={themeKey} className="mb-2">
              <p className="font-medium text-teal-600">
                第{weekNo}週:{themeKey.replace(/-\d$/, '')}
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(actions).map(([action, lv]) => {
                  const mv = movementMap.get(`${weekNo}-${action}`);
                  const displayTitle = mv?.displayTitle || action;
                  const searchParam = mv?.searchParam || '';

                  return (
                    <Link
                      key={`${themeKey}-${action}`}
                      to={`/movement?search=${searchParam}`}
                      className={`px-2 py-1 rounded-full text-xs ${getLevelBackgroundStyle(
                        lv
                      )} hover:underline hover:text-blue-600 transition min-w-[72px] text-center font-mono`}
                    >
                      {displayTitle}: {lv}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 表頭（兩層）：週標題 + 三個動作名（用 movementMap 對應）
  const renderTableHeaders = () => (
    <>
      <tr className="bg-gray-100">
        <th className="px-2 py-1 border w-24 text-center">綽號</th>
        <th className="px-2 py-1 border w-20 text-center">點數</th>
        {filteredData.visibleThemes.map((t) => (
          <th key={`wk-${t.title}`} colSpan={3} className="px-2 py-1 border text-center">
            第{t.week}週:{t.title.replace(/-\d$/, '')}
          </th>
        ))}
      </tr>
      <tr className="bg-gray-50">
        <th className="border px-2 py-1"></th>
        <th className="border px-2 py-1"></th>
        {filteredData.visibleThemes.flatMap((t) =>
          ['動作1', '動作2', '動作3'].map((action) => {
            const mv = movementMap.get(`${t.week}-${action}`);
            const displayTitle = mv?.displayTitle || action;
            return (
              <th
                key={`h-${t.week}-${action}`}
                className="border px-2 py-1 text-center w-24 whitespace-normal"
              >
                {displayTitle}
              </th>
            );
          })
        )}
      </tr>
    </>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start">
        <Header />
        <p className="text-center text-gray-500 mt-4">載入中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start">
      <Header />

      {/* 查詢個人進度 */}
      <div className="bg-white w-full max-w-md rounded-xl shadow-md p-4 mb-6">
        <label className="block text-sm text-gray-600 mb-2">查詢個人進度</label>
        <Select
          options={selectOptions.nameOptions}
          value={selectedUser ? { label: selectedUser, value: selectedUser } : null}
          onChange={(e) => setSelectedUser(e?.value || null)}
          placeholder="請選擇隊員"
          isClearable
        />
        {renderPersonalProgress()}
      </div>

      {/* 進度總覽 */}
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-teal-600">進度總覽</h2>
          <div className="w-60">
            <Select
              options={selectOptions.weekOptions}
              onChange={(e) => setSelectedWeek(e?.value || null)}
              value={
                selectedWeek
                  ? {
                      label: selectOptions.weekOptions.find((w) => w.value === selectedWeek)?.label || '',
                      value: selectedWeek
                    }
                  : null
              }
              placeholder="選擇週次"
              isClearable
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm font-mono">
            <thead>{renderTableHeaders()}</thead>
            <tbody>
              {tableData.map((user) => (
                <tr key={user.nickname}>
                  <td className="border px-2 py-1 font-semibold whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      <FaUserCircle className="text-gray-400" />
                      <span>{user.nickname}</span>
                    </div>
                  </td>
                  <td className="border px-2 py-1 text-center">{user.point ?? '-'}</td>
                  {user.processedProgress.flatMap((themeActions, j) =>
                    themeActions.map((actionData, k) => (
                      <td
                        key={`${user.nickname}-${j}-${k}`}
                        className={`border px-2 py-1 text-center min-h-[48px] align-middle whitespace-normal ${actionData.bgStyle}`}
                      >
                        {actionData.level}
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
