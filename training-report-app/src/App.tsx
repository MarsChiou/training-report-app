// src/App.tsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DailyReportForm from './pages/DailyReportForm';
import ProgressOverview from './pages/ProgressOverview';
import MovementLibrary from './pages/MovementLibrary';
import DiaryOverview from './pages/DiaryOverview';
import OffSeasonPage from './pages/OffSeasonPage'; // 休營期頁面
import { isOffSeason } from './pages/utils/campConfig'; // 從 campConfig 匯入

/** ---- 休營期門檻 ---- */
function OffSeasonGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const path = location.pathname;
  const isOnOffSeasonPage = path === '/offseason';
  const bypass = new URLSearchParams(location.search).has('preview'); // 可用 ?preview=1 暫時繞過

  // ✅ 休營期 → 導向 /offseason
  if (isOffSeason() && !isOnOffSeasonPage && !bypass) {
    return <Navigate to="/offseason" replace />;
  }

  // ✅ 營期中 → 若誤進 /offseason 則導回首頁
  if (!isOffSeason() && isOnOffSeasonPage) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/** ---- 主程式入口 ---- */
function App() {
  return (
    <OffSeasonGate>
      <Routes>
        <Route path="/" element={<ProgressOverview />} />
        <Route path="/report" element={<DailyReportForm />} />
        <Route path="/progress" element={<ProgressOverview />} />
        <Route path="/movement" element={<MovementLibrary />} />
        <Route path="/diary" element={<DiaryOverview />} />
        <Route path="/offseason" element={<OffSeasonPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OffSeasonGate>
  );
}

export default App;
