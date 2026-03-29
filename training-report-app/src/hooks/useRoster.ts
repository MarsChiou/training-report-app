import { useEffect, useState, useCallback } from 'react';

export type Option = { label: string; value: string };

type AwsUsersResponse = {
  code: number;
  message: string;
  data: { id: string; name: string }[];
};

const SNAPSHOT_KEY = 'roster:last';

export default function useRoster() {
  const initialSnapshot = (() => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return null;
      const j = JSON.parse(raw) as Option[];
      if (!Array.isArray(j)) return null;
      return j;
    } catch { return null; }
  })();

  const [options, setOptions] = useState<Option[]>(initialSnapshot || []);
  const [loading, setLoading] = useState<boolean>(!initialSnapshot);
  const [error, setError]     = useState<string>('');

  const AWS_BASE = (import.meta.env.VITE_AWS_BASE_URL as string | undefined)?.replace(/\/+$/, '');

  const fetchRoster = useCallback(async () => {
    setError('');
    if (!AWS_BASE) {
      setLoading(false);
      setError('VITE_AWS_BASE_URL 未設定');
      return;
    }

    const useSpinner = options.length === 0;
    if (useSpinner) setLoading(true);

    try {
      const res = await fetch(`${AWS_BASE}/users`);
      const json = (await res.json()) as AwsUsersResponse;
      if (json.code !== 200 || !Array.isArray(json.data)) {
        throw new Error(json.message || '名單 API 回傳失敗');
      }

      const roster = json.data.map(u => ({ label: u.name, value: u.id }));
      setOptions(roster);
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(roster));
    } catch (e: any) {
      setError(e?.message || '載入名單失敗');
    } finally {
      if (useSpinner) setLoading(false);
    }
  }, [AWS_BASE, options.length]);

  useEffect(() => {
    fetchRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { options, loading, error, refresh: fetchRoster };
}
