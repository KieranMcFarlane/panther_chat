'use client';

import EnhancedSimpleChatSidebar from './EnhancedSimpleChatSidebar';

interface SimpleStreamingChatProps {
  className?: string;
}

export function SimpleStreamingChat(props: SimpleStreamingChatProps) {
  return <EnhancedSimpleChatSidebar {...props} />;
}

export default SimpleStreamingChat;