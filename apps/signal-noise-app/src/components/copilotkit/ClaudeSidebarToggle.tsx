'use client';

import React from 'react';
import { useClaudeSidebar } from '@/hooks/useClaudeSidebar';

interface ClaudeSidebarToggleProps {
  userId?: string;
  context?: any;
  buttonPosition?: 'fixed' | 'absolute';
  buttonLocation?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonClassName?: string;
  sidebarProps?: any;
}

export function ClaudeSidebarToggle({
  userId,
  context = {},
  buttonPosition = 'fixed',
  buttonLocation = 'bottom-right',
  buttonClassName,
  sidebarProps
}: ClaudeSidebarToggleProps) {
  const { isOpen: isSidebarOpen, toggle } = useClaudeSidebar();

  const getButtonPositionClasses = () => {
    const positions = {
      'fixed': {
        'top-right': 'fixed top-4 right-4',
        'top-left': 'fixed top-4 left-4',
        'bottom-right': 'fixed bottom-4 right-4',
        'bottom-left': 'fixed bottom-4 left-4',
      },
      'absolute': {
        'top-right': 'absolute top-4 right-4',
        'top-left': 'absolute top-4 left-4',
        'bottom-right': 'absolute bottom-4 right-4',
        'bottom-left': 'absolute bottom-4 left-4',
      }
    };

    return positions[buttonPosition]?.[buttonLocation] || positions.fixed['bottom-right'];
  };

  const unreadCount = 0; // Since we're not using CopilotKit chat, set to 0

  // This component is deprecated and no longer used
  // Replaced by SimpleChatSidebar
  return null;
}

// Re-export useClaudeSidebar from the hook file
export { useClaudeSidebar } from '@/hooks/useClaudeSidebar';