'use client';

import EnhancedSimpleChatSidebar from './chat/EnhancedSimpleChatSidebar';

interface SimpleChatSidebarProps {
  userId?: string;
  context?: any;
  className?: string;
}

export function SimpleChatSidebar({
  userId,
  context = {},
  className
}: SimpleChatSidebarProps) {
  return (
    <EnhancedSimpleChatSidebar
      userId={userId}
      context={context}
      className={className}
    />
  );
}

export default SimpleChatSidebar;