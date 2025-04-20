// components/MovementCard.tsx
import { FaLock } from 'react-icons/fa';

interface MovementData {
  topic: string;
  type: string;
  level: string;
  description: string[];
  locked: boolean;
}

const levelColors: Record<string, string> = {
  Lv2: 'border-green-400',
  Lv3: 'border-blue-400',
  Lv4: 'border-purple-400',
  Lv5: 'border-yellow-400'
};

export default function MovementCard({ data }: { data: MovementData }) {
  const borderColor = data.locked ? 'border-gray-300' : levelColors[data.level] || 'border-teal-400';
  const cardBaseStyle = `rounded-xl p-4 border-l-4 ${borderColor} bg-white shadow transition duration-200`;

  return (
    <div
      className={`${cardBaseStyle} ${
        data.locked ? 'opacity-50 bg-gray-100' : 'hover:shadow-md'
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-bold text-lg">
          {data.level}（{data.type === 'Climb' ? '攀岩' : '跑步'}）
        </h2>
        {data.locked && (
          <div className="text-gray-500 text-sm flex items-center">
            <FaLock className="mr-1" /> 等待學員解鎖
          </div>
        )}
      </div>

      {!data.locked ? (
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          {data.description.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      ) : (
        <div className="bg-gray-200 text-sm text-gray-500 px-3 py-2 rounded-md">
          此等級尚未解鎖，請稍候更新。
        </div>
      )}
    </div>
  );
}
