"use client";

import React from 'react';

interface ThinkingStep {
  step: number;
  action: string;
  reasoning: string;
  tool?: string;
  result?: string;
  confidence?: number;
}

interface ThinkingDisplayProps {
  thinking: ThinkingStep[] | string[];
  isVisible: boolean;
}

const parseThinkingContent = (thinking: ThinkingStep[] | string[]): ThinkingStep[] => {
  if (!thinking || !Array.isArray(thinking)) return [];
  
  // If already structured, return as is
  if (thinking.length > 0 && typeof thinking[0] === 'object' && 'step' in thinking[0]) {
    return thinking as ThinkingStep[];
  }
  
  // Convert string-based thinking to structured steps
  const structuredSteps: ThinkingStep[] = [];
  let stepNumber = 1;
  
  (thinking as string[]).forEach((content, index) => {
    if (!content || typeof content !== 'string') return;
    
    let step: ThinkingStep = {
      step: stepNumber++,
      action: 'Processing',
      reasoning: content,
    };
    
    // Parse specific patterns from the backend
    if (content.includes('Processing request with MCP tools')) {
      step = {
        step: step.step,
        action: '🚀 Initializing Analysis',
        reasoning: 'Setting up MCP tools and preparing sports intelligence analysis',
      };
    } else if (content.includes('Available MCP servers')) {
      step = {
        step: step.step,
        action: '🔗 Connecting to Database',
        reasoning: 'Establishing connection to Neo4j graph database via MCP',
      };
    } else if (content.includes('Allowed tools')) {
      step = {
        step: step.step,
        action: '🛠️ Loading Intelligence Tools',
        reasoning: 'Preparing Cypher query execution and entity search capabilities',
      };
    } else if (content.includes('TOOL DETECTED')) {
      const toolName = content.match(/TOOL DETECTED: (.+)/)?.[1] || 'Unknown Tool';
      step = {
        step: step.step,
        action: `🎯 Using Tool: ${toolName}`,
        reasoning: 'Executing database query to retrieve sports intelligence',
        tool: toolName,
      };
    } else if (content.includes('Query:')) {
      try {
        const queryMatch = content.match(/Query: (.+)/);
        if (queryMatch) {
          const queryData = JSON.parse(queryMatch[1]);
          step = {
            step: step.step,
            action: '📝 Executing Cypher Query',
            reasoning: `Running query: ${queryData.query || 'Unknown query'}`,
            tool: 'Neo4j Database',
          };
        }
      } catch (e) {
        step = {
          step: step.step,
          action: '📝 Executing Query',
          reasoning: 'Running Cypher query on sports database',
          tool: 'Neo4j Database',
        };
      }
    } else if (content.includes('QUERY EXECUTED SUCCESSFULLY')) {
      step = {
        step: step.step,
        action: '✅ Query Successful',
        reasoning: 'Database query completed successfully, processing results',
        tool: 'Neo4j Database',
      };
    } else if (content.includes('Results:')) {
      step = {
        step: step.step,
        action: '📊 Analyzing Results',
        reasoning: 'Processing retrieved data and generating insights',
        tool: 'Analysis Engine',
      };
    } else if (content.includes('Connected to') && content.includes('MCP servers')) {
      step = {
        step: step.step,
        action: '🔗 Systems Online',
        reasoning: 'All MCP servers connected and ready for analysis',
      };
    } else if (content.includes('Available tools:')) {
      step = {
        step: step.step,
        action: '🛠️ Tools Ready',
        reasoning: 'Neo4j database tools are available for intelligence gathering',
      };
    } else if (content.includes('AI Response:')) {
      step = {
        step: step.step,
        action: '🤖 Generating Intelligence',
        reasoning: 'AI analyzing results and preparing comprehensive insights',
      };
    } else if (content.includes('CRITICAL ISSUE')) {
      step = {
        step: step.step,
        action: '⚠️ System Issue Detected',
        reasoning: 'Identified a problem with tool integration',
        tool: 'System Monitor',
      };
    } else {
      // Generic processing step
      step = {
        step: step.step,
        action: '🔄 Processing',
        reasoning: content.length > 100 ? content.substring(0, 100) + '...' : content,
      };
    }
    
    structuredSteps.push(step);
  });
  
  return structuredSteps;
};

export const ThinkingDisplay: React.FC<ThinkingDisplayProps> = ({ thinking, isVisible }) => {
  if (!isVisible || !thinking.length) return null;

  const structuredSteps = parseThinkingContent(thinking);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center mb-3">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
        <h3 className="text-sm font-semibold text-blue-800">🧠 Agent Thinking Process</h3>
      </div>
      
      <div className="space-y-3">
        {structuredSteps.map((step, index) => (
          <div key={index} className="bg-white rounded-md p-3 border border-blue-100">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    Step {step.step}
                  </span>
                  {step.tool && (
                    <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded ml-2">
                      🔧 {step.tool}
                    </span>
                  )}
                  {step.confidence && (
                    <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded ml-2">
                      📊 {step.confidence}% confidence
                    </span>
                  )}
                </div>
                
                <p className="text-sm font-medium text-gray-800 mb-1">
                  {step.action}
                </p>
                
                <p className="text-xs text-gray-600 mb-2">
                  {step.reasoning}
                </p>
                
                {step.result && (
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-700">
                      <strong>Result:</strong> {step.result}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThinkingDisplay;


