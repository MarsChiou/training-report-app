import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

let initialized = false;

export function initAnalytics(): boolean {
  if (initialized || !POSTHOG_KEY?.trim()) {
    return false;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
  });

  initialized = true;
  return true;
}

export function isAnalyticsEnabled(): boolean {
  return initialized;
}

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

function sanitizeProperties(props?: AnalyticsProperties): Record<string, string | number | boolean> {
  if (!props) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
}

export function captureEvent(eventName: string, properties?: AnalyticsProperties): void {
  if (!initialized) return;
  posthog.capture(eventName, sanitizeProperties(properties));
}

export function capturePageView(properties?: AnalyticsProperties): void {
  if (!initialized) return;
  posthog.capture('$pageview', sanitizeProperties(properties));
}

/** Session-scoped counter for unique user selections (browser tab session). */
export function trackUniqueUserSelection(
  storageKey: string,
  userId: string
): number {
  if (!userId) return 0;
  try {
    const raw = sessionStorage.getItem(storageKey);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(userId);
    sessionStorage.setItem(storageKey, JSON.stringify([...set]));
    return set.size;
  } catch {
    return 1;
  }
}

export function classifySubmitError(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
    return 'timeout';
  }
  return 'api_error';
}
