// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DailyReportForm from './pages/DailyReportForm';
import ProgressOverview from './pages/ProgressOverview';

function App() {
  return (
      <Routes>
        <Route path="/" element={<ProgressOverview />} />
        <Route path="/report" element={<DailyReportForm />} />
        <Route path="/progress" element={<ProgressOverview />} />
      </Routes>
  );
}

export default App;
