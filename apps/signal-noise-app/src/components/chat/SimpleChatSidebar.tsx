'use client';

import SimpleStreamingChat from './SimpleStreamingChat';

interface SimpleChatSidebarProps {
  userId?: string;
  context?: any;
  className?: string;
}

export function SimpleChatSidebar(props: SimpleChatSidebarProps) {
  return <SimpleStreamingChat {...props} />;
}

export default SimpleChatSidebar;