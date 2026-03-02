'use client';

import { useEffect, useState, memo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

function HistoryNav() {
  const router = useRouter();
  const pathname = usePathname();
  const isDossierRoute = pathname?.includes('/dossier') ?? false;
  const isEntityBrowserRoute = pathname?.startsWith('/entity-browser') ?? false;
  const [canGoBack, setCanGoBack] = useState(true);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    if (isEntityBrowserRoute) {
      const rawStack = sessionStorage.getItem('entityBrowserHistoryStack');
      const rawIndex = sessionStorage.getItem('entityBrowserHistoryIndex');
      const historyStack = rawStack ? JSON.parse(rawStack) as string[] : [];
      const currentIndex = rawIndex ? Number.parseInt(rawIndex, 10) : -1;

      setCanGoBack(currentIndex > 0);
      setCanGoForward(currentIndex >= 0 && currentIndex < historyStack.length - 1);
      return;
    }

    setCanGoBack(window.history.length > 1 || isDossierRoute);
    setCanGoForward(false);
  }, [isDossierRoute, isEntityBrowserRoute, pathname]);

  const handleBack = () => {
    if (!canGoBack) return;

    if (isDossierRoute) {
      const storedEntityBrowserUrl = sessionStorage.getItem('lastEntityBrowserUrl');
      const fallbackPage = new URLSearchParams(window.location.search).get('from') || '1';
      router.push(storedEntityBrowserUrl || `/entity-browser?page=${fallbackPage}`);
      return;
    }

    if (isEntityBrowserRoute) {
      const rawStack = sessionStorage.getItem('entityBrowserHistoryStack');
      const rawIndex = sessionStorage.getItem('entityBrowserHistoryIndex');
      const historyStack = rawStack ? JSON.parse(rawStack) as string[] : [];
      const currentIndex = rawIndex ? Number.parseInt(rawIndex, 10) : -1;
      const previousBrowserUrl = currentIndex > 0 ? historyStack[currentIndex - 1] : null;

      if (previousBrowserUrl) {
        sessionStorage.setItem('entityBrowserHistoryIndex', String(currentIndex - 1));
        router.push(previousBrowserUrl);
      }
      return;
    }

    if (canGoBack) {
      window.history.back();
    }
  };

  const handleForward = () => {
    if (isEntityBrowserRoute) {
      const rawStack = sessionStorage.getItem('entityBrowserHistoryStack');
      const rawIndex = sessionStorage.getItem('entityBrowserHistoryIndex');
      const historyStack = rawStack ? JSON.parse(rawStack) as string[] : [];
      const currentIndex = rawIndex ? Number.parseInt(rawIndex, 10) : -1;
      const nextBrowserUrl = currentIndex >= 0 && currentIndex < historyStack.length - 1
        ? historyStack[currentIndex + 1]
        : null;

      if (nextBrowserUrl) {
        sessionStorage.setItem('entityBrowserHistoryIndex', String(currentIndex + 1));
        router.push(nextBrowserUrl);
      }
      return;
    }

    if (canGoForward) {
      window.history.forward();
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        disabled={!canGoBack}
        className="text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent"
        aria-label="Go back"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleForward}
        disabled={!canGoForward}
        className="text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent"
        aria-label="Go forward"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Button>
    </div>
  );
}

export default memo(HistoryNav);
