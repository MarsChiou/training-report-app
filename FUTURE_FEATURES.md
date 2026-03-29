# Future Features & Improvements

紀錄未來可以考慮增加或優化的項目。

---

## 前端優化

### 移除未使用的 Firebase 前端 SDK
- `training-report-app/src/firebase.ts` 目前沒有任何元件 import，可刪除
- `training-report-app/package.json` 中的 `firebase` 套件也可一併移除（減少 install 時間）
- 前提：確認部署到 Vercel 後全部功能正常

### 大型元件拆分
- `DailyReportForm.tsx`（565 行）：Toast 元件、疲勞度滑桿可抽為獨立 component
- `ProgressOverview.tsx`（508 行）：AWS 資料轉換邏輯可抽到 `utils/` 或 `hooks/`
- `MovementLibrary.tsx`（552 行）：`LazyImage` 元件和 AWS 型別定義可獨立出去

### OffSeasonPage 硬編碼日期
- 目前「下一期營隊將於 2025/11/03 開始」是寫死的
- 可改為從 `campConfig.ts` 讀取，新增一個 `NEXT_CAMP_START` 設定項

### campConfig.ts 的 isOffSeason() 邏輯
- 目前 `CAMP_PHASE = 'offseason'` 時 `isOffSeason()` 回傳 `false`（邏輯反轉）
- 語義上令人困惑，未來切換休營模式時建議修正為 `return CAMP_PHASE === 'offseason'`

---

## Firebase Cloud Functions 優化

### 移除多餘套件
- `firebase/functions/package.json` 中的 `axios` 僅在 `lineWebhook` 的 `reply()` 使用，可改用原生 `fetch`
- `node-fetch` 也可移除，Node 22 已原生支援 `fetch`
- 兩者都移除後 Functions 的冷啟動時間會稍微改善

### firebase/package.json 命名
- `name: "0_joi"` 和 `main: "0_joi.js"` 命名不夠語義化，可改為有意義的名稱

---

## 新功能

### 輕量事件追蹤（使用行為分析）
- 目的：了解哪些功能有人用、哪些沒人點
- 建議做法：前端加一個 `trackEvent()` 工具函式，將事件 POST 到 AWS 或 Firestore
- 追蹤目標範例：
  - 進度總覽的表格是否有人滾到
  - 日記頁面的排序按鈕、「只看有日記」checkbox 點擊率
  - 動作圖庫的運動類型切換使用頻率
  - 各頁面的造訪次數
- 替代方案：Plausible / Umami（輕量分析）、PostHog（含 Session Replay）
