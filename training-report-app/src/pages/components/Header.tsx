export default function Header() {
  return (
    <div className="max-w-md w-full mb-6 text-center">
      <div className="flex justify-center mb-4">
        <img
          src="https://via.placeholder.com/80"
          alt="Logo Placeholder"
          className="w-20 h-20 rounded-full shadow-lg"
        />
      </div>
      <h2 className="text-xl font-bold text-teal-700 leading-snug">Jo i 健康隊</h2>
      <h3 className="text-lg font-semibold text-gray-700 leading-snug">身體控制挑戰營(上) 第一期</h3>
      <p className="text-sm text-gray-500">2025/02/17 ~ 2025/04/13</p>
      <div className="mt-4 flex justify-center space-x-6 text-sm">
        <a href="/report" className="text-teal-600 font-semibold hover:underline">每日回報</a>
        <a href="/progress" className="text-teal-600 font-semibold hover:underline">進度總表</a>
        <a href="/movement" className="text-teal-600 font-semibold hover:underline">動作圖庫</a>
      </div>
    </div>
  );
}
