### 基本說明
此 Project 包含以下內容
- 所有前端 Code
    - 使用的是 React + TypeScript + Vite
    - 部署在 Vercel
- Firebase Function
    - 目前僅使用 `proxyRosterWithCache`，其他 function 已棄用改抓 AWS Function
- 所有圖檔 (包含 Logo, 動作圖庫)
### 營期更新說明
每次新營期要做的事情
- 請隊長提供新營期的名單、每週主題、動作圖庫圖片、新營期 Sheet (目前僅用來抓名單)
- 動作圖庫更新
    - 圖片抓到 `training-report-app\public\theme-images` 並且按照頁數命名 (ex.P01.png)
    - 更新 `training-report-app/src/pages/utils/progressMovementMap.ts` 的每週動作主圖
- 營期時間和名稱更新：更新 `training-report-app/src/pages/utils/campConfig.ts` 的 Config
- 更新 vercel Project Name (主要是為了更新 Domain)
- 更新 GAS 指向的 sheet

### 每次更新前檢查
- 各頁面名單是否有資料 & 正確
- 動作圖庫是否有圖 & 正確
- PC & Mobile
- Daily Report (edge case 自己想)
- 回報後檢查進度