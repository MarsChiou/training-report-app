import { useEffect, useState, useCallback } from 'react';
import { CAMP_START } from '../pages/utils/campConfig';

export type Option = { label: string; value: string };

type AwsUsersResponse = {
  code: number;
  message: string;
  data: { id: string; name: string }[];
};

type RosterSnapshotPayload = { campStart: string; roster: Option[] };

const SNAPSHOT_KEY = 'roster:last';

function isValidOptionList(roster: unknown): roster is Option[] {
  if (!Array.isArray(roster)) return false;
  return roster.every(
    (o) =>
      o &&
      typeof o === 'object' &&
      typeof (o as Option).label === 'string' &&
      typeof (o as Option).value === 'string'
  );
}

/** 只接受與目前 campStart 相符的快取；舊版純陣列或營期不符則清除 */
function readRosterSnapshot(campStart: string): Option[] | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as RosterSnapshotPayload).campStart === 'string' &&
      Array.isArray((parsed as RosterSnapshotPayload).roster)
    ) {
      const p = parsed as RosterSnapshotPayload;
      if (p.campStart !== campStart) {
        localStorage.removeItem(SNAPSHOT_KEY);
        return null;
      }
      if (!isValidOptionList(p.roster)) {
        localStorage.removeItem(SNAPSHOT_KEY);
        return null;
      }
      return p.roster;
    }
    localStorage.removeItem(SNAPSHOT_KEY);
    return null;
  } catch {
    localStorage.removeItem(SNAPSHOT_KEY);
    return null;
  }
}

function writeRosterSnapshot(roster: Option[], campStart: string) {
  localStorage.setItem(
    SNAPSHOT_KEY,
    JSON.stringify({ campStart, roster } satisfies RosterSnapshotPayload)
  );
}

export default function useRoster() {
  const initialSnapshot = readRosterSnapshot(CAMP_START);

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
      writeRosterSnapshot(roster, CAMP_START);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '載入名單失敗');
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
