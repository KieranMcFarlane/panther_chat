'use client';

import React from 'react';
import { CopilotSidebar } from '@copilotkit/react-ui';
import { useCopilotChat } from '@copilotkit/react-core';
import { useUser } from '@/contexts/UserContext';

interface CopilotSidebarProps {
  userId?: string;
  context?: any;
  className?: string;
}

export function ClaudeCopilotSidebar({
  userId,
  context = {},
  className
}: CopilotSidebarProps) {
  const { userId: contextUserId } = useUser();

  return (
    <CopilotSidebar
      labels={{
        title: "Sports Intelligence Assistant",
        initial: "Hi! 👋 I'm your Sports Intelligence AI. I can help you analyze sports entities, find business opportunities, and identify key decision makers. How can I assist you today?",
        placeholder: "Ask about sports clubs, business opportunities, or decision makers..."
      }}
      instructions="You are a Sports Intelligence AI assistant with access to Neo4j database containing 3,325+ sports entities. Help analyze sports clubs, identify business opportunities, and find decision makers."
      context={{
        ...context,
        userId: userId || contextUserId,
        projectType: 'sports intelligence',
        userRole: 'analyst'
      }}
      className={className}
      defaultOpen={false}
    />
  );
}

export default ClaudeCopilotSidebar;