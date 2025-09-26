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
  thinking: ThinkingStep[];
  isVisible: boolean;
}

export const ThinkingDisplay: React.FC<ThinkingDisplayProps> = ({ thinking, isVisible }) => {
  if (!isVisible || !thinking.length) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center mb-3">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
        <h3 className="text-sm font-semibold text-blue-800">🧠 Agent Thinking Process</h3>
      </div>
      
      <div className="space-y-3">
        {thinking.map((step, index) => (
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


