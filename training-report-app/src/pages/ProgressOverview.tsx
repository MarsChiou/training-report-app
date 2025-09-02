// 修正後的關鍵函數和部分

// 1. 修正 awsListToUserProgressList
function awsListToUserProgressList(list: AwsUser[]): UserProgress[] {
  return list.map(awsUserToUserProgressWithMapping); // ← 改用新函數
}

// 2. 在個人進度 API 回調中
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

      const converted = awsUserToUserProgressWithMapping(json.data); // ← 改用新函數
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

// 3. 修正個人進度區塊
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
                const mv = movementMapWithMapping.get(`${weekNo}-${action}`); // ← 改用新 map
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

// 4. 修正表頭渲染
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
          const mv = movementMapWithMapping.get(`${t.week}-${action}`); // ← 改用新 map
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
