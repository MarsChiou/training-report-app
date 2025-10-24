export type CampPhase = 'active' | 'offseason';
export const CAMP_PHASE: CampPhase = 'offseason';

export function isOffSeason() {
  return CAMP_PHASE === 'offseason';
}

/** 統一管理本期營隊設定（靜態） */
export const CAMP_START = '2025-08-25'; // YYYY-MM-DD
export const CAMP_END   = '2025-10-19'; // YYYY-MM-DD
export const CAMP_NAME  = '身體控制挑戰營(下) 第一期';

/** ---- 本地時區安全：YYYY-MM-DD <-> Date ---- */
export function formatDateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
export function parseLocalYMD(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m as number) - 1, d as number);
}

/** ---- 顯示格式工具 ---- */
export function toSlash(ymd: string) {
  // '2025-08-25' -> '2025/08/25'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-');
  return `${y}/${m}/${d}`;
}
export function toDash(ymd: string) {
  // '2025/08/25' -> '2025-08-25'
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('/');
  return `${y}-${m}-${d}`;
}

/** ---- 營期相關計算 ---- */
export const CAMP_START_DATE = parseLocalYMD(CAMP_START);
export const CAMP_END_DATE   = parseLocalYMD(CAMP_END);

export function isWithinCamp(ymd: string) {
  return ymd >= CAMP_START && ymd <= CAMP_END;
}
export function clampToCamp(ymd: string) {
  if (ymd < CAMP_START) return CAMP_START;
  if (ymd > CAMP_END) return CAMP_END;
  return ymd;
}
export function totalCampDays() {
  const ms = parseLocalYMD(CAMP_END).getTime() - parseLocalYMD(CAMP_START).getTime();
  return Math.floor(ms / 86400000) + 1;
}
/** 第幾天（含起訖），超出範圍會 clamp 回營期內 */
export function campDayNumber(ymd: string) {
  const clamped = clampToCamp(ymd);
  const a = parseLocalYMD(clamped).getTime();
  const b = CAMP_START_DATE.getTime();
  return Math.floor((a - b) / 86400000) + 1;
}
/** 第幾週：以週一為週起點，Day1 所在週視為第 1 週 */
export function campWeekNumber(ymd: string) {
  const day1 = campDayNumber(ymd); // 1..N
  // 以 Day1 為當週起點：每 7 天一週
  return Math.floor((day1 - 1) / 7) + 1;
}

/** 今天（本地） */
export function todayYMD() {
  return formatDateLocal(new Date());
}

/** Header/文字顯示用的統一字串（可選 dash/slash） */
export function campLabel(format: 'dash'|'slash' = 'slash') {
  const s = format === 'slash' ? toSlash(CAMP_START) : CAMP_START;
  const e = format === 'slash' ? toSlash(CAMP_END)   : CAMP_END;
  return `${s} ~ ${e}`;
}
