// src/levelStyle.ts

// 背景 + 文字顏色（給進度表、標籤用）
export const levelBackgroundStyle: Record<string, string> = {
  Lv0: 'bg-slate-100 text-slate-700',
  Lv1: 'bg-blue-50 text-blue-700',
  Lv2: 'bg-emerald-50 text-emerald-700',
  Lv3: 'bg-amber-50 text-amber-700',
  Lv4: 'bg-purple-50 text-purple-700',
  Lv5: 'bg-fuchsia-50 text-fuchsia-700',
};

// border 顏色（給 MovementCard 用）
export const levelBorderStyle: Record<string, string> = {
  Lv2: 'border-emerald-400',
  Lv3: 'border-amber-400',
  Lv4: 'border-purple-400',
  Lv5: 'border-fuchsia-400',
};

// 背景用的 helper function
export const getLevelBackgroundStyle = (level: string) => {
  return levelBackgroundStyle[level] || 'bg-gray-100 text-gray-500';
};

// border 用的 helper function
export const getLevelBorderStyle = (level: string) => {
  return levelBorderStyle[level] || 'border-teal-400';
};
