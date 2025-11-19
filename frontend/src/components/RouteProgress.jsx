import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import NProgress from 'nprogress';

export function RouteProgress() {
  const location = useLocation();

  useEffect(() => {
    NProgress.start();
    // Artificial delay helps the visual feel "complete"
    const timer = setTimeout(() => NProgress.done(), 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return null;
}

