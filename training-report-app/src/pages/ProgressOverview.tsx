// pages/ProgressOverview.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import Select from 'react-select';
import Header from './components/Header';
import { getLevelBackgroundStyle } from '../pages/utils/levelStyle.ts';
import { progressMovementMap } from '../pages/utils/progressMovementMap';

/** ====================== 既有型別（UI 內部用） ====================== */
interface UserProgress {
  nickname: string; // 顯示名（= AWS 的 name）
  point?: number;
  rotation: string; // 身體旋轉習慣（AWS: body_rotation；暫無則 '-'）
  progress: {
    [theme: string]: {
      [action: string]: string; // '動作1'|'動作2'|'動作3' → 'Lv0'..'Lv5'|'-'
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

/** ====================== AWS 回應型別（轉換用） ====================== */
type AwsUser = {
  id: string;
  name: string;
  point?: number;
  body_rotation?: string;
  training_progress: Array<{
    movement_id: string;   // e.g. "P01".."P24"
    week_number: number;   // 1..8
    body_part: string;     // e.g. "胸椎"
    level: string;         // "Lv0".."Lv5"
  }>;
};

type AwsListResponse = {
  code: number;
  message: string;
  data: AwsUser[];
};

type AwsOneResponse = {
  code: number;
  message: string;
  data: AwsUser;
};

/** ====================== 營期設定 + 本地時間工具 ======================
 * 若營期時間有變，請同步更新這兩個常數。
 */
const CAMP_START = '2025-08-25';
const CAMP_END   = '2025-10-19';
const WEEK_MOVEMENT_MAPPING = {
  1: ['P01', 'P02', 'P03'],
  2: ['P13', 'P14', 'P15'], // 現在 P13-P15 在第2週
  3: ['P07', 'P08', 'P09'],
  4: ['P10', 'P11', 'P12'],
  5: ['P04', 'P05', 'P06'], // 現在 P04-P06 在第5週
  6: ['P16', 'P17', 'P18'],
  7: ['P19', 'P20', 'P21'],
  8: ['P22', 'P23', 'P24'],
};
function toDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m as number) - 1, d as number);
}
function todayYMD() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
/** 回傳 1..8 的週次；若今日不在營期內，回傳 null（不預設篩選）。 */
function currentWeekNumberWithinCamp(): number | null {
  const start = toDate(CAMP_START).getTime();
  const end = toDate(CAMP_END).getTime();
  const today = toDate(todayYMD()).getTime();
  if (today < start || today > end) return null;
  const diffDays = Math.floor((today - start) / 86400000);
  return Math.min(8, Math.floor(diffDays / 7) + 1);
}

/** ====================== 工具：將 AWS 轉我方結構 ====================== */
function weekTitleByWeekNo(weekNo: number) {
  // 用你現成的 progressMovementMap（每週以「動作1」代表該週主題）
  const item = progressMovementMap.find(it => it.week === weekNo && it.action === '動作1');
  return item?.title ?? `Week${weekNo}`;
}

function movementIdToActionKey(movementId: string) {
  // P01~P03=週1動作1~3，P04~P06=週2… 以此類推
  const n = Number(String(movementId).replace(/^P/i, ''));
  const idx = ((n - 1) % 3) + 1; // 1..3
  return `動作${idx}` as const;
}

function awsUserToUserProgressWithMapping(u: AwsUser): UserProgress {
  const progressByWeek: UserProgress['progress'] = {};
  
  // 建立 movement_id 到資料的映射
  const movementData = new Map<string, string>();
  u.training_progress.forEach(tp => {
    movementData.set(tp.movement_id, tp.level || '-');
  });
  
  // 按固定映射表組織資料
  Object.entries(WEEK_MOVEMENT_MAPPING).forEach(([weekStr, movements]) => {
    const week = parseInt(weekStr);
    const themeTitle = weekTitleByWeekNo(week);
    if (!progressByWeek[themeTitle]) progressByWeek[themeTitle] = {};
    
    movements.forEach((movementId, index) => {
      const actionKey = `動作${index + 1}`;
      progressByWeek[themeTitle][actionKey] = movementData.get(movementId) || '-';
    });
  });

  return {
    nickname: u.name,
    point: u.point ?? undefined,
    rotation: u.body_rotation ?? '-',
    progress: progressByWeek
  };
}

function awsListToUserProgressList(list: AwsUser[]): UserProgress[] {
  return list.map(awsUserToUserProgress);
}

/** 由 AWS 列表推算每週的 body_part（以第一位的資料為準，因同週三動作一致） */
function deriveBodyPartByWeek(list: AwsUser[]): Record<number, string> {
  const map: Record<number, string> = {};
  const first = list[0];
  if (!first) return map;
  for (const tp of first.training_progress) {
    if (tp?.week_number && tp?.body_part && !map[tp.week_number]) {
      map[tp.week_number] = tp.body_part;
    }
  }
  return map;
}

/** ====================== 主元件 ====================== */
export default function ProgressOverview() {
  // 列表資料（表格使用）
  const [data, setData] = useState<UserProgress[]>([]);
  // 選擇狀態
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const didAutoPickWeekRef = useRef(false);
  const didRestoreUserRef = useRef(false);

  // 載入狀態
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // 個人區塊（單筆 API 回來覆蓋顯示；表格仍用 data）
  const [personalUser, setPersonalUser] = useState<UserProgress | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);

  // 為了打單筆 API：name -> id 映射（只在 AWS 路線才會有）
  const [nameToId, setNameToId] = useState<Map<string, string>>(new Map());

  // 「每週→body_part」對照（僅 AWS 路線可用）
  const [bodyPartByWeek, setBodyPartByWeek] = useState<Record<number, string>>({});

  // 環境變數
  const AWS_BASE = (import.meta.env.VITE_AWS_BASE_URL as string | undefined)?.replace(/\/+$/, '');
  const LEGACY_PROGRESS = import.meta.env.VITE_PROGRESS_API_URL as string | undefined;

  /** ========== 初始載入：優先走 AWS（有 base 就用 /users/all），否則走舊的 Function ========== */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        if (AWS_BASE) {
          const url = `${AWS_BASE}/users/all`;
          const res = await fetch(url);
          const ctype = res.headers.get('content-type') || '';
          if (!ctype.includes('application/json')) throw new Error('AWS 回傳非 JSON');
          const json = (await res.json()) as AwsListResponse;
          if (!json || !Array.isArray(json.data)) throw new Error('AWS 回傳格式有誤（data）');

          const converted = awsListToUserProgressList(json.data);
          setData(converted);

          const map = new Map<string, string>();
          json.data.forEach(u => map.set(u.name, u.id));
          setNameToId(map);

          setBodyPartByWeek(deriveBodyPartByWeek(json.data));
        } else if (LEGACY_PROGRESS) {
          const res = await fetch(LEGACY_PROGRESS);
          const json = await res.json();
          if (!Array.isArray(json)) throw new Error('進度 API 回傳格式有誤');
          setData(json as UserProgress[]);
          setNameToId(new Map());
          setBodyPartByWeek({});
        } else {
          throw new Error('未設定任何進度 API（VITE_AWS_BASE_URL 或 VITE_PROGRESS_API_URL）');
        }
      } catch (err: any) {
        console.error('載入進度資料失敗：', err);
        setErrorMsg(err?.message || '載入失敗');
        setData([]);
        setNameToId(new Map());
        setBodyPartByWeek({});
      } finally {
        setLoading(false);
      }
    })();
  }, [AWS_BASE, LEGACY_PROGRESS]);

  /** ========== 個人區塊：選擇人員時（且有 AWS），打單筆 /users/{id}/training_progress ========== */
  useEffect(() => {
    if (!selectedUser || !AWS_BASE || !nameToId.has(selectedUser)) {
      setPersonalUser(null);
      return;
    }
    const userId = nameToId.get(selectedUser)!;

    let canceled = false;
    (async () => {
      setPersonalLoading(true);
      try {
        const url = `${AWS_BASE}/users/${encodeURIComponent(userId)}/training_progress`;
        const res = await fetch(url);
        const ctype = res.headers.get('content-type') || '';
        if (!ctype.includes('application/json')) throw new Error('AWS 單筆回傳非 JSON');
        const json = (await res.json()) as AwsOneResponse;
        if (!json || !json.data) throw new Error('AWS 單筆回傳格式有誤（data）');

        const converted = awsUserToUserProgress(json.data);
        if (!canceled) setPersonalUser(converted);
      } catch (e) {
        console.error('載入個人進度失敗：', e);
        if (!canceled) setPersonalUser(null);
      } finally {
        if (!canceled) setPersonalLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [selectedUser, AWS_BASE, nameToId]);

  /** ========== movementMap： (week-action) -> {title, displayTitle, searchParam} (可能可移除) ========== */
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

// 對應的 movementMap
const movementMapWithMapping = useMemo(() => {
  const map = new Map<string, ProcessedMovement>();
  
  Object.entries(WEEK_MOVEMENT_MAPPING).forEach(([weekStr, movements]) => {
    const week = parseInt(weekStr);
    movements.forEach((movementId, index) => {
      const actionKey = `動作${index + 1}`;
      const key = `${week}-${actionKey}`;
      map.set(key, {
        title: movementId,
        displayTitle: movementId,
        searchParam: encodeURIComponent(movementId)
      });
    });
  });
  
  return map; // ← 這裡缺少了 return 語句
}, []); 

/** ========== 主題集合與週次清單 ========== */
const themeData = useMemo(() => {
  if (data.length === 0) return { allThemes: [] as string[], weekThemes: [] as WeekTheme[] };
  const allThemes = Object.keys(data[0].progress || {});
  const weekThemes = allThemes.map((title, i) => ({ title, week: i + 1 }));
  return { allThemes, weekThemes };
}, [data]);

  /** ========== 預設當週篩選（只自動帶一次；營期外不預設） ========== */
  useEffect(() => {
    if (didAutoPickWeekRef.current) return;                 // 已自動帶過就不再帶
    if (themeData.weekThemes.length === 0) return;

    const wkNo = currentWeekNumberWithinCamp();             // 1..8 或 null
    if (wkNo) {
      const found = themeData.weekThemes.find(t => t.week === wkNo);
      if (found) setSelectedWeek(found.title);
    }
    didAutoPickWeekRef.current = true;                      // 標記已嘗試（不論是否成功）
  }, [themeData.weekThemes]);

  /** ========== 記住上次查過的人（只自動恢復一次；清除時刪記錄） ========== */
  const LAST_PROGRESS_USER_KEY = 'progress:lastUserName';
  useEffect(() => {
    if (data.length === 0) return;

    if (!selectedUser) {
      if (!didRestoreUserRef.current) {
        const saved = localStorage.getItem(LAST_PROGRESS_USER_KEY) || '';
        if (saved && data.some(u => u.nickname === saved)) {
          setSelectedUser(saved);
        }
        didRestoreUserRef.current = true;         // 之後不再自動恢復
      } else {
        // 使用者主動清除了選擇 → 把記錄清掉，保持為空
        localStorage.removeItem(LAST_PROGRESS_USER_KEY);
      }
    } else {
      // 有選到人就更新記錄
      localStorage.setItem(LAST_PROGRESS_USER_KEY, selectedUser);
    }
  }, [data, selectedUser]);

  /** ========== 下拉選項（姓名用顯示名；週次用主題字串，但 label 顯示 body_part） ========== */
  const selectOptions = useMemo(() => {
    const nameOptions = data.map((u) => ({ label: u.nickname, value: u.nickname }));
    const weekOptions = themeData.weekThemes.map((t) => {
      const labelBody = bodyPartByWeek[t.week] || t.title.replace(/-\d$/, '');
      return {
        label: `第${t.week}週：${labelBody}`,
        value: t.title
      };
    });
    return { nameOptions, weekOptions };
  }, [data, themeData.weekThemes, bodyPartByWeek]);

  /** ========== 畫面可見的 user 與週次（表格仍用列表資料） ========== */
  const filteredData = useMemo(() => {
    const filteredUser = data.find((u) => u.nickname === selectedUser);
    const visibleThemes = selectedWeek
      ? themeData.weekThemes.filter((t) => t.title === selectedWeek)
      : themeData.weekThemes;
    return { filteredUser, visibleThemes };
  }, [data, selectedUser, selectedWeek, themeData.weekThemes]);

  /** ========== 表格使用：預先扁平化（週次依 visibleThemes） ========== */
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

  /** ========== 個人進度區塊（若 personalUser 存在則優先顯示；週標題顯示 body_part） ========== */
  const renderPersonalProgress = () => {
    const user = personalUser || filteredData.filteredUser;
    if (!user) return null;

    return (
      <div className="mt-4 text-sm text-gray-700">
        {user.point !== undefined && (
          <p className="mb-2 font-semibold">訓練點數：{user.point} 點</p>
        )}

        <p className="mb-2 font-semibold">
          身體旋轉習慣：{personalLoading ? '載入中...' : (user.rotation || '-')}
        </p>

        {Object.entries(user.progress).map(([themeKey, actions]) => {
          const weekObj = themeData.weekThemes.find((w) => w.title === themeKey);
          const weekNo = weekObj?.week ?? 0;
          const bodyPart = bodyPartByWeek[weekNo] || themeKey.replace(/-\d$/, '');

          return (
            <div key={themeKey} className="mb-2">
              <p className="font-medium text-teal-600">
                第{weekNo}週：{bodyPart}
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

  /** ========== 表頭（兩層）：週標題顯示 body_part + 三個動作名（用 movementMap 對應） ========== */
  const renderTableHeaders = () => (
    <>
      <tr className="bg-gray-100">
        <th className="px-2 py-1 border w-24 text-center">綽號</th>
        <th className="px-2 py-1 border w-20 text-center">點數</th>
        {filteredData.visibleThemes.map((t) => {
          const labelBody = bodyPartByWeek[t.week] || t.title.replace(/-\d$/, '');
          return (
            <th key={`wk-${t.title}`} colSpan={3} className="px-2 py-1 border text-center">
              第{t.week}週：{labelBody}
            </th>
          );
        })}
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

  /** ========== 畫面渲染 ========== */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start">
        <Header />
        <p className="text-center text-gray-500 mt-4">載入中...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start">
        <Header />
        <p className="text-center text-rose-600 mt-4">載入失敗：{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start">
      <Header />

      {/* 查詢個人進度（選單用顯示名；單筆 API 以 name→id 對照打） */}
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

      {/* 進度總覽（使用列表資料） */}
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
              isSearchable={false} 
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
