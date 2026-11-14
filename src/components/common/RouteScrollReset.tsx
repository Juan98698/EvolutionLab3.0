import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** A new page starts at its heading, even after leaving a long editor. */
export function RouteScrollReset() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}
