'use client';

import { useState, useEffect } from 'react';

// Hook for handling time display that avoids hydration mismatches
export function useTimeDisplay(timestamp?: Date | string | number) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    // Return a placeholder during SSR
    return {
      timeString: '--:--',
      dateString: 'Loading...',
      isoString: '',
      formatted: 'Loading...'
    };
  }
  
  const date = timestamp ? new Date(timestamp) : new Date();
  
  return {
    timeString: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dateString: date.toLocaleDateString(),
    isoString: date.toISOString(),
    formatted: date.toLocaleString()
  };
}

// Utility function for consistent time formatting
export function formatTime(timestamp: Date | string | number, options?: {
  dateOnly?: boolean;
  timeOnly?: boolean;
  short?: boolean;
}) {
  const date = new Date(timestamp);
  
  if (options?.dateOnly) {
    return date.toLocaleDateString();
  }
  
  if (options?.timeOnly) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  if (options?.short) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  
  return date.toLocaleString();
}

// Server-safe time display component
export function TimeDisplay({ 
  timestamp, 
  format = 'time' 
}: { 
  timestamp?: Date | string | number; 
  format?: 'time' | 'date' | 'datetime' | 'short';
}) {
  const timeData = useTimeDisplay(timestamp);
  
  switch (format) {
    case 'time':
      return <>{timeData.timeString}</>;
    case 'date':
      return <>{timeData.dateString}</>;
    case 'datetime':
      return <>{timeData.formatted}</>;
    case 'short':
      return <>{formatTime(timestamp || new Date(), { short: true })}</>;
    default:
      return <>{timeData.timeString}</>;
  }
}