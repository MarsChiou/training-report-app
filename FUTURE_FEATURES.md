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

### 回報提醒推播通知
- 目的：每天固定時間（例如晚上 9 點）提醒尚未回報的隊員
- 純前端無法做到「App 關閉時定時推播」，需要推播伺服器
- 建議架構：
  1. **推播伺服器**：使用 Firebase Cloud Messaging (FCM)，免費且與現有 Firebase 專案整合
  2. **排程觸發**：Cloud Scheduler 或 Cloud Functions 排程，每天固定時間執行
  3. **判斷未回報**：排程執行時查 AWS 後端當天回報紀錄，篩出未回報的人
  4. **發送推播**：透過 FCM 將通知推送到使用者裝置
  5. **前端配合**：PWA 需註冊 Service Worker 並取得使用者的推播授權（Notification.requestPermission）
- 注意事項：
  - Notification 權限只能問一次，使用者拒絕後無法再詢問，需設計好觸發時機（例如在設定頁讓使用者主動開啟）
  - iOS Safari PWA 從 16.4 起支援推播，但體驗不如 Android Chrome
  - 需要有後端存放每位使用者的推播 token（FCM registration token）
