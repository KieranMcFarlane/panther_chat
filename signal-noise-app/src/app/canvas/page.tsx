"use client";

import { useCoAgent, useCopilotAction, useCoAgentStateRender, useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotChat, CopilotPopup } from "@copilotkit/react-ui";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type React from "react";
import ThinkingDisplay from "@/components/ThinkingDisplay";

// Simple types for testing
interface AgentState {
  cards: any[];
  planStatus?: string;
  thinking?: any[];
}

const initialState: AgentState = {
  cards: [],
  planStatus: "",
  thinking: []
};

export default function CopilotKitPage() {
  // Use a completely static conversation ID to prevent resets
  const conversationId = "sports-intelligence-stable-v2";
  
  // Temporarily disable agent state to prevent conversation resets
  // const { state, setState } = useCoAgent<AgentState>({
  //   name: "sample_agent",
  //   initialState,
  // });
  const state = initialState;
  const setState = () => {};

  // Debug logging disabled to prevent unnecessary re-renders

  // Memoize suggestions to prevent unnecessary re-renders
  const suggestions = useMemo(() => [
    { title: "Analyze a Club", message: "Analyze Manchester United's digital maturity and business opportunities" },
    { title: "Find Decision Makers", message: "Find key decision makers at Premier League clubs with high opportunity scores" },
    { title: "Market Research", message: "Research La Liga clubs for partnership development opportunities" },
    { title: "Technology Gaps", message: "Assess technology gaps in Championship clubs for digital transformation" },
    { title: "Transfer Intelligence", message: "Monitor transfer news and identify clubs with changing leadership" },
    { title: "Opportunity Scoring", message: "Score business opportunities for targeting specific sports clubs" },
  ], []);

  return (
    <div
      style={{ "--copilot-kit-primary-color": "#2563eb" } as CopilotKitCSSProperties}
      className="h-screen flex flex-col"
    >
      <div className="flex flex-1 overflow-hidden">
        <aside className="-order-1 max-md:hidden flex flex-col min-w-80 w-[30vw] max-w-120 p-4 pr-0">
          <div className="h-full flex flex-col align-start w-full shadow-lg rounded-2xl border border-sidebar-border overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">AI Canvas</h2>
              <p className="text-sm text-gray-600">Sports Intelligence Agent</p>
                            </div>
                    <CopilotChat
                      key="sports-chat-stable" // Prevent remounting
                      conversationId={conversationId}
                      className="flex-1 overflow-auto w-full"
                      labels={{
                        title: "Sports Intelligence Agent",
                        initial: "🏆 Welcome to the Sports Intelligence Platform! I can help you analyze sports clubs, identify business opportunities, assess digital maturity, and find key decision makers. What would you like to explore?",
                      }}
                      showToolCalls={true}
                      showThinking={true}
                      suggestions={suggestions}
                      // Callbacks removed to prevent conversation resets
                    />
          </div>
        </aside>
        <main className="flex-1 overflow-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white mb-2">🏆 Sports Intelligence Platform</h1>
              <p className="text-gray-400 text-lg mb-4">
                Analyze sports clubs, identify business opportunities, and discover key decision makers with AI-powered intelligence.
              </p>
              
              {/* Thinking Display */}
              <ThinkingDisplay 
                thinking={state?.thinking || []} 
                isVisible={true} 
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">🎯 Opportunity Analysis</h3>
                  <p className="text-gray-400 text-sm">Score clubs on business potential and digital maturity</p>
        </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">👥 Decision Makers</h3>
                  <p className="text-gray-400 text-sm">Find and prioritize key contacts at sports organizations</p>
      </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">📊 Market Intelligence</h3>
                  <p className="text-gray-400 text-sm">Real-time data and insights from multiple sources</p>
          </div>
        </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {state?.cards?.map((card, index) => (
                <div key={index} className="p-4 border rounded-lg bg-white shadow-sm">
                  <h3 className="font-semibold">{card.title || `Card ${index + 1}`}</h3>
                  <p className="text-sm text-gray-600">{card.description || "No description"}</p>
                </div>
              )) || (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-500">No cards yet. Start a conversation with the AI agent!</p>
            </div>
              )}
            </div>
          </div>
        </main>
        </div>
    </div>
  );
}