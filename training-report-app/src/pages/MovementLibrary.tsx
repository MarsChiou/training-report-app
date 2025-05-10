// pages/MovementLibrary.tsx
import { useEffect, useState } from 'react';
import Header from './components/Header';
import MovementCard from './components/MovementCard';
import Select from 'react-select';
import { useSearchParams, useNavigate } from 'react-router-dom';

function LazyImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [errorFallback, setErrorFallback] = useState(false);

  return (
    <div className="relative w-full max-w-md">
      {!loaded && !errorFallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg animate-pulse">
          <span className="text-xs text-gray-400">圖片載入中...</span>
        </div>
      )}
      <img
        src={errorFallback ? '/theme-images/default.png' : src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setErrorFallback(true)}
        loading="lazy"
        className={`rounded-lg shadow-md transition-opacity duration-700 ease-in ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}


interface MovementData {
  topic: string;
  type: string;
  level: string;
  description: string[];
  locked: boolean;
  imageFile?: string;
}

export default function MovementLibrary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';// 讀取 URL 上的 ?search=xxx
  const [selectedTopic, setSelectedTopic] = useState<string>(initialSearch);
  const [selectedType, setSelectedType] = useState<string>('All');
  const [movements, setMovements] = useState<MovementData[]>([]);
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(import.meta.env.VITE_MOVEMENT_LIB_API);
        const json = await response.json();
        setMovements(json.movements);
        setTypeLabels(json.typeLabels);
      } catch (err) {
        console.error(err);
        setError('資料載入失敗，請稍後再試。');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const topics = Array.from(new Set(movements.map((m) => m.topic)));
  const filteredMovements = movements.filter((m) => m.topic === selectedTopic);
  const levelOrder = ['Lv2', 'Lv3', 'Lv4', 'Lv5'];
  const allTypes = Array.from(new Set(filteredMovements.map((m) => m.type)));
  const displayTypes = ['All', ...allTypes];

  const groupedByType = allTypes.map((type) => {
    return {
      type,
      levels: levelOrder.map((level) => {
        const match = filteredMovements.find(
          (m) => m.type === type && m.level === level
        );
        return match || {
          topic: selectedTopic,
          type,
          level,
          description: [],
          locked: true
        };
      })
    };
  });

  const topicImage = movements.find(m => m.topic === selectedTopic)?.imageFile || '';

  return (
    <div className="min-h-screen bg-gray-50 pt-8 pb-12 px-4 flex flex-col items-center">
      <Header />
      <div className="max-w-4xl w-full">
        {loading ? (
          <p className="text-center text-gray-500">資料載入中...</p>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : (
          <>
            {/* Sticky 區：主題與運動類型選擇 */}
            <div className="sticky top-0 z-10 bg-gray-50 pb-4 pt-2 border-b border-gray-300 transition-shadow">
              <label className="block text-sm font-medium text-gray-700 mb-1">選擇主題</label>
              <Select
                options={topics.map((t) => ({ label: t, value: t }))}
                value={selectedTopic ? { label: selectedTopic, value: selectedTopic } : null}
                onChange={(option) => {
                  const value = option?.value || '';
                  setSelectedTopic(value);
                  // 🔥 更新 URL
                  navigate(value ? `/movement?search=${encodeURIComponent(value)}` : '/movement', { replace: true });
                }}
                placeholder="請輸入或選擇主題"
                isSearchable
                isClearable
                className="mb-4 text-sm sm:text-base"
                classNamePrefix="react-select"
              />
              {/* 只有選擇了主題時才出現運動類型選單 */}
              {selectedTopic && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {displayTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`px-4 py-1 rounded-full text-sm font-medium border transition ${
                        selectedType === type
                          ? 'bg-teal-500 text-white border-teal-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {type === 'All' ? '全部' : typeLabels[type] || type}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Sticky 區結束 */}
            {/* 沒選主題時的歡迎語 */}
            {!selectedTopic && (
              <div className="text-center text-gray-600 mt-10 text-base leading-relaxed">
                歡迎來到動作圖庫!<br />
                今天想訓練什麼主題呢？<br />
                我們一起用腦練控制，用心玩運動!
              </div>
            )}

            {/* 主題圖片 + 動作列表（左右排） */}
            {selectedTopic && (
              <div className="flex flex-col gap-8 mt-6 w-full max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* 主題圖片 */}
                  <div className="md:w-2/5 w-full flex flex-col items-center md:sticky md:top-36 self-start">
                  <LazyImage src={`/theme-images/${topicImage}`} alt={selectedTopic} />
                    <p className="mt-2 text-sm text-gray-500 text-center">{selectedTopic}</p>
                  </div>

                  {/* 動作卡片列表 */}
                  <div className="md:w-3/5 w-full flex flex-col gap-8">
                    {groupedByType
                      .filter((group) => selectedType === 'All' || group.type === selectedType)
                      .map((group) => (
                        <div key={group.type}>
                          <h2 className="text-lg font-semibold text-gray-700 mb-2">
                            {typeLabels[group.type] || group.type}進階課表
                          </h2>
                          <div className="grid grid-cols-1 gap-4">
                            {group.levels.map((movement) => (
                              <MovementCard key={`${group.type}-${movement.level}`} data={movement} />
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
