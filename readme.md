# Jo i 健康隊回報系統

訓練營隊員的每日回報、進度追蹤、覺察日記、動作升級中心。

## 技術棧

- **前端**：React 19 + TypeScript + Vite 6 + Tailwind CSS 3
- **部署**：Vercel（前端）+ Firebase Cloud Functions
- **資料來源**：AWS 後端 API（主要）、Firebase Firestore（快取 + 日誌）

## 專案結構

```
├── training-report-app/        # React 前端應用
│   ├── src/
│   │   ├── pages/              # 頁面元件
│   │   │   ├── DailyReportForm.tsx    # 每日回報
│   │   │   ├── ProgressOverview.tsx   # 進度總表
│   │   │   ├── DiaryOverview.tsx      # 覺察日記
│   │   │   ├── MovementLibrary.tsx    # 動作升級中心
│   │   │   ├── OffSeasonPage.tsx      # 休營期頁面
│   │   │   ├── components/            # 共用元件（Header, MovementCard）
│   │   │   └── utils/                 # 設定檔（campConfig, levelStyle, progressMovementMap）
│   │   ├── hooks/              # 自訂 Hook（useRoster）
│   │   ├── firebase.ts         # Firebase 初始化
│   │   └── App.tsx             # 路由設定 + 休營守衛
│   └── public/                 # 靜態資源（Logo, 動作圖庫圖片）
├── firebase/
│   └── functions/              # Firebase Cloud Functions
└── readme.md
```

## 本地開發

```bash
cd training-report-app
npm install
npm run dev          # http://localhost:5173
```

需要在 `training-report-app/.env` 設定以下環境變數：

| 變數名 | 說明 |
|--------|------|
| `VITE_AWS_BASE_URL` | AWS 後端 API 基礎 URL |
| `VITE_FN_ROSTER` | Firebase Function 名單 API URL |
| `VITE_FIREBASE_API_KEY` | Firebase 前端 API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Measurement ID |
| `VITE_REPORT_API_URL` | （舊版備用）Firebase Function 回報 API URL |
| `VITE_PROGRESS_API_URL` | （舊版備用）Firebase Function 進度 API URL |

## 頁面說明

| 路徑 | 頁面 | 功能 |
|------|------|------|
| `/report` | 每日回報 | 隊員回報訓練完成、日記、疲勞度 |
| `/progress` | 進度總表 | 全隊訓練進度總覽 + 個人查詢 |
| `/diary` | 覺察日記 | 個人日記時間軸 |
| `/movement` | 動作升級中心 | 動作圖庫 Lv2~Lv5 進階課表 |
| `/offseason` | 休營期 | 營期結束時的導向頁 |

## 資料來源

以下資料全來自 AWS 後端：
- 日記
- 訓練進度
- 動作圖庫
  - sheet 的進階動作需要有內容，後端才會將資料吐回來給前端，因此開營時可預先填入空格或者符號確保營期一開始就看得到每個動作都有 Lv1~Lv5 以及有多種不同運動
- 隊員名單

僅 `名單版本號` 透過 Firebase Function 拉 Google Sheet，做為 local 端是否需要重新拉名單的判斷標準。

## 營期更新 Checklist

每次新營期需要做的事：

- [ ] 請隊長提供新營期的名單、每週主題、動作圖庫圖片、新營期 Sheet
- [ ] 動作圖庫更新
  - [ ] 圖片放到 `training-report-app/public/theme-images` 並按頁數命名（如 P01.png）
  - [ ] 提供圖片名稱給後端
  - [ ] 更新 `src/pages/utils/progressMovementMap.ts` 的每週動作主圖
- [ ] 營期時間和名稱更新：更新 `src/pages/utils/campConfig.ts` 的 Config
- [ ] 假如有新運動類型：更新 `MovementLibrary.tsx` 的 `FALLBACK_TYPE_LABELS`
- [ ] 更新 Vercel Project Name（主要是為了更新 Domain）
- [ ] 更新 GAS 指向的 Sheet

## 更新前檢查

- [ ] 各頁面名單是否有資料且正確
- [ ] 動作圖庫是否有圖且正確
- [ ] PC & Mobile 皆正常
- [ ] Daily Report（edge case 自己想）
- [ ] 回報後檢查進度
