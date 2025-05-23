import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// 這個是原本的 App
// import App from './App.tsx'
// 這個是新的 DailyReportForm
//import DailyReportForm from './DailyReportForm.tsx'
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

/*
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DailyReportForm />
  </StrictMode>,
)
*/