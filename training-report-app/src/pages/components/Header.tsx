import { useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { name: '每日回報', path: '/report' },
    { name: '進度總表', path: '/progress' },
    { name: '覺察日記', path: '/diary' },
    { name: '動作升級中心', path: '/movement' },
  ];

  return (
    <div className="max-w-md w-full mb-6 text-center animate-fadeIn">
      {/* Logo 區域 */}
      <div className="flex justify-center mb-4">
        <div className="rounded-full p-2 bg-white shadow-xl border-4 border-teal-300">
          <img
            src="/images/logo.png"
            alt="Jo i 健康隊 Logo"
            className="w-20 h-20 rounded-full"
          />
        </div>
      </div>

      {/* 標題區域 */}
      <h2 className="text-2xl font-bold text-teal-700 leading-snug">Jo i 健康隊</h2>
      <div className="flex justify-center items-center my-2">
        <div className="w-8 h-0.5 bg-teal-400 rounded-full"></div>
      </div>
      <h3 className="text-lg font-semibold text-gray-700 leading-snug">身體控制挑戰營(下) 第一期</h3>

      {/* 時間區域 */}
      <div className="mt-2 mb-4">
        <p className="inline-block bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm">
          2025/08/25 ~ 2025/10/19
        </p>
      </div>

      {/* 導航列：手機兩行、平板以上四欄 */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm max-w-md mx-auto sm:flex sm:justify-center sm:space-x-3 sm:grid-cols-none">
        {navItems.map((item) => {
          const active = currentPath === item.path;
          return (
            <a
              key={item.path}
              href={item.path}
              aria-current={active ? 'page' : undefined}
              className={[
                // 尺寸與排版：允許換行、但設最小高度，避免高度不齊
                'px-3 py-2 rounded-full flex items-center justify-center text-center',
                'whitespace-normal leading-tight min-h-[2.5rem] w-full sm:w-auto',
                'transition transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
                // 狀態樣式
                active
                  ? 'bg-teal-500 text-white font-bold'
                  : 'bg-teal-100 text-teal-700 hover:bg-teal-200 hover:scale-105'
              ].join(' ')}
            >
              {item.name}
            </a>
          );
        })}
      </div>
    </div>
  );
}
