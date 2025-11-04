'use client';

import { useState, memo } from 'react';
import { Button } from '@/components/ui/button';

function HistoryNav() {
  const [canGoBack, setCanGoBack] = useState(true);
  const [canGoForward, setCanGoForward] = useState(false);

  const handleBack = () => {
    if (canGoBack) {
      window.history.back();
    }
  };

  const handleForward = () => {
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