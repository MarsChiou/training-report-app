import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { capturePageView } from '../lib/analytics';

const PAGE_NAMES: Record<string, string> = {
  '/': 'progress_overview',
  '/progress': 'progress_overview',
  '/report': 'daily_report',
  '/movement': 'movement_library',
  '/diary': 'diary_overview',
  '/offseason': 'off_season',
};

type LocationState = {
  movement_source?: string;
} | null;

function getPageName(pathname: string): string {
  return PAGE_NAMES[pathname] || 'unknown';
}

function getMovementSource(pathname: string, state: LocationState): string | undefined {
  if (pathname !== '/movement') return undefined;
  return state?.movement_source === 'progress_link' ? 'progress_link' : 'direct';
}

export default function AnalyticsRouteTracker() {
  const location = useLocation();
  const lastPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const pathname = location.pathname;
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;

    const hasSearchParams = location.search.length > 0;
    const movementSource = getMovementSource(
      pathname,
      location.state as LocationState
    );

    capturePageView({
      path: pathname,
      page_name: getPageName(pathname),
      has_search_params: hasSearchParams,
      ...(movementSource ? { movement_source: movementSource } : {}),
    });
  }, [location.pathname, location.search, location.state]);

  return null;
}
