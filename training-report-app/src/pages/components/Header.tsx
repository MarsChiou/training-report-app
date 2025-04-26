import { useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { name: '每日回報', path: '/report' },
    { name: '進度總表', path: '/progress' },
    { name: '動作圖庫', path: '/movement' },
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
      <h3 className="text-lg font-semibold text-gray-700 leading-snug">身體控制挑戰營(上) 第二期</h3>

      {/* 時間區域 */}
      <div className="mt-2 mb-4">
        <p className="inline-block bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm">
          2025/05/04 ~ 2025/06/29
        </p>
      </div>

      {/* 導航列 */}
      <div className="mt-4 flex justify-center space-x-4 text-sm">
        {navItems.map((item) => (
          <a
            key={item.path}
            href={item.path}
            className={`px-3 py-1 rounded-full transition transform duration-300
              ${
                currentPath === item.path
                  ? 'bg-teal-500 text-white font-bold scale-105'
                  : 'bg-teal-100 text-teal-700 hover:bg-teal-200 hover:scale-105'
              }`}
          >
            {item.name}
          </a>
        ))}
      </div>
    </div>
  );
}
