'use client';

import React from 'react';

interface ClaudeSidebarProps {
  labels?: any;
  icons?: any;
  observabilityHooks?: CopilotObservabilityHooks;
  defaultOpen?: boolean;
  userId?: string;
  context?: any;
  className?: string;
}

export function ClaudeSidebar({
  labels = {
    title: "Sports Intelligence Assistant",
    initial: "Hi! 👋 I'm your Sports Intelligence AI. I can help you analyze sports entities, find business opportunities, and identify key decision makers. How can I assist you today?",
  },
  icons,
  observabilityHooks,
  defaultOpen = false,
  userId,
  context = {},
  className
}: ClaudeSidebarProps) {
  // This component is deprecated and no longer used
  // Replaced by SimpleChatSidebar
  return null;
}