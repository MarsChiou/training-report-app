// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import DailyReportForm from './pages/DailyReportForm';
import ProgressOverview from './pages/ProgressOverview';
import MovementLibrary from './pages/MovementLibrary';


function App() {
  return (
    <Routes>
      <Route path="/" element={<ProgressOverview />} />
      <Route path="/report" element={<DailyReportForm />} />
      <Route path="/progress" element={<ProgressOverview />} />
      <Route path="/movement" element={<MovementLibrary />} />
    </Routes>
  );
}

export default App;
