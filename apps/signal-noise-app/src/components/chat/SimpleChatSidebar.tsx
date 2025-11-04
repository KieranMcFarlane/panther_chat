'use client';

import EnhancedSimpleChatSidebar from './EnhancedSimpleChatSidebar';

interface SimpleChatSidebarProps {
  userId?: string;
  context?: any;
  className?: string;
}

export function SimpleChatSidebar(props: SimpleChatSidebarProps) {
  return <EnhancedSimpleChatSidebar {...props} />;
}

export default SimpleChatSidebar;