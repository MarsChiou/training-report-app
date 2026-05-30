import { useEffect } from 'react';
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

function getPageName(pathname: string): string {
  return PAGE_NAMES[pathname] || 'unknown';
}

function getMovementSource(pathname: string, search: string): string | undefined {
  if (pathname !== '/movement' || !search) return undefined;
  const params = new URLSearchParams(search);
  if (params.has('search')) return 'progress_link';
  return 'direct';
}

export default function AnalyticsRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    const hasSearchParams = location.search.length > 0;
    const movementSource = getMovementSource(pathname, location.search);

    capturePageView({
      path: pathname,
      page_name: getPageName(pathname),
      has_search_params: hasSearchParams,
      ...(movementSource ? { movement_source: movementSource } : {}),
    });
  }, [location.pathname, location.search]);

  return null;
}
