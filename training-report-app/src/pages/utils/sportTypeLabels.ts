/** sport_type 顯示名稱（API 使用 snake_case 鍵值） */
export const SPORT_TYPE_LABELS: Record<string, string> = {
  rock_climb: '攀岩',
  run: '跑步',
  mt_climb: '登山',
  weight_training: '重訓',
  rugby: '橄欖球',
  ski: '滑雪(雙版)',
  snowboard: '滑雪(單板)',
  triathlon_cycling: '鐵人(自行車)',
  triathlon_run: '鐵人(跑步)',
  triathlon_swim: '鐵人(游泳)',
};

export function getSportTypeLabel(type: string): string {
  return SPORT_TYPE_LABELS[type] || type;
}
