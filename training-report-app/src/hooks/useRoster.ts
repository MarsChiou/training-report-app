// src/hooks/useRoster.ts
import { useEffect, useState, useCallback } from 'react';

export type Option = { label: string; value: string };

type RosterResponse = {
  ok: boolean;
  campId: string;
  version: string;
  roster: Option[];
  lastUpdate?: string;
  source?: 'cache'|'fresh';
};

const SNAPSHOT_KEY = 'roster:last';

export default function useRoster(initialFresh = false) {
  // 1) 先讀本地快照，讓第一個 render 就有名單（避免閃白）
  const initialSnapshot = (() => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return null;
      const j = JSON.parse(raw) as RosterResponse;
      if (!j || !Array.isArray(j.roster)) return null;
      return j;
    } catch { return null; }
  })();

  const [options, setOptions] = useState<Option[]>(initialSnapshot?.roster || []);
  const [campId, setCampId]   = useState<string>(initialSnapshot?.campId || '');
  const [version, setVersion] = useState<string>(initialSnapshot?.version || '');
  // 有本地快照時，不要顯示全頁 loading；沒有才顯示
  const [loading, setLoading] = useState<boolean>(!initialSnapshot);
  const [error, setError]     = useState<string>('');

  const FN_URL = import.meta.env.VITE_FN_ROSTER as string | undefined;

  const fetchRoster = useCallback(async (forceFresh = false) => {
    setError('');
    if (!FN_URL) {
      // 沒有雲端 API 也先不擋畫面，盡量用本地快照頂著
      setLoading(false);
      setError('VITE_FN_ROSTER 未設定');
      return;
    }

    // 若目前已經有名單在畫面上，就不要啟用全頁 loading（避免閃爍）
    const useSpinner = options.length === 0;
    if (useSpinner) setLoading(true);

    try {
      const url = new URL(FN_URL);
      if (forceFresh || initialFresh) url.searchParams.set('fresh', '1');

      const res = await fetch(url.toString());
      const json = (await res.json()) as RosterResponse;
      if (!json?.ok || !Array.isArray(json.roster)) {
        throw new Error('roster API 回傳失敗');
      }

      setOptions(json.roster || []);
      setCampId(json.campId || '');
      setVersion(json.version || '');

      // 更新本地快照
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(json));
    } catch (e: any) {
      // 出錯時維持當前畫面，不閃爍；僅回報錯誤
      setError(e?.message || '載入名單失敗');
    } finally {
      if (useSpinner) setLoading(false);
    }
  }, [FN_URL, initialFresh, options.length]);

  // 掛載後背景刷新（若有快照則不擋畫面）
  useEffect(() => {
    fetchRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { options, campId, version, loading, error, refresh: fetchRoster };
}
