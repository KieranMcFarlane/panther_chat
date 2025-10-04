'use client';

import React from 'react';
import { CopilotSidebar } from '@copilotkit/react-ui';
import { useCopilotChat } from '@copilotkit/react-core';
import { useUser } from '@/contexts/UserContext';

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
  const { userId: contextUserId } = useUser();
  const { 
    visibleMessages, 
    isLoading,
    appendMessage,
    setMessages,
    deleteMessage,
    reloadMessages,
    stopGeneration,
    regenerateResponse
  } = useCopilotChat();

  return (
    <CopilotSidebar
      labels={{
        title: "Sports Intelligence Assistant",
        initial: "Hi! 👋 I'm your Sports Intelligence AI. I can help you analyze sports entities, find business opportunities, and identify key decision makers. How can I assist you today?",
        placeholder: "Ask about sports clubs, business opportunities, or decision makers..."
      }}
      instructions="You are a Sports Intelligence AI assistant powered by Claude Agent SDK with access to powerful MCP tools:

🔍 **Database Tools:**
- Neo4j database with 3,325+ sports entities (clubs, players, competitions, relationships)
- Execute Cypher queries for complex sports data analysis

🌐 **Real-time Intelligence:**
- BrightData web scraping for current sports news and market information
- Perplexity AI search for up-to-date insights and analysis

📊 **Capabilities:**
- Search and analyze sports clubs, players, competitions
- Identify business opportunities and decision makers
- Provide comprehensive market intelligence using both database knowledge and real-time research

I can automatically use these tools when you ask questions about sports entities, need current information, or want detailed analysis. Just ask naturally!"
      context={{
        ...context,
        userId: userId || contextUserId,
        projectType: 'sports intelligence',
        userRole: 'analyst'
      }}
      className={className}
      defaultOpen={false}
      suggestions="auto"
      onInProgress={(inProgress) => {
        console.log('CopilotKit chat in progress:', inProgress);
      }}
      onSubmitMessage={async (message) => {
        console.log('CopilotKit submitting message:', message);
      }}
      onThumbsUp={(message) => {
        console.log('CopilotKit thumbs up:', message);
      }}
      onThumbsDown={(message) => {
        console.log('CopilotKit thumbs down:', message);
      }}
      icons={{
        open: (
          <button className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transform hover:scale-105 transition-all duration-200 z-30">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        )
      }}
    />
  );
}

export default SimpleChatSidebar;