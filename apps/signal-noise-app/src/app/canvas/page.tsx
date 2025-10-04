"use client";

import { useState, useMemo } from "react";
import type React from "react";
import EmbeddedStreamingChat from "@/components/chat/EmbeddedStreamingChat";

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
  const [thinking, setThinking] = useState<any[]>([]);
  
  // Memoize suggestions to prevent unnecessary re-renders
  const suggestions = useMemo(() => [
    "Analyze Manchester United's digital maturity and business opportunities",
    "Find key decision makers at Premier League clubs with high opportunity scores", 
    "Research La Liga clubs for partnership development opportunities",
    "Assess technology gaps in Championship clubs for digital transformation",
    "Monitor transfer news and identify clubs with changing leadership",
    "Score business opportunities for targeting specific sports clubs"
  ], []);

  return (
    <div className="h-screen flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <aside className="-order-1 max-md:hidden flex flex-col min-w-80 w-[30vw] max-w-120 p-4 pr-0" style={{ background: '#1c1e2d' }}>
          <div className="h-full flex flex-col align-start w-full shadow-lg rounded-2xl border border-sidebar-border overflow-hidden">
            <div className="p-4 border-b flex-shrink-0">
              <h2 className="text-lg font-semibold">AI Canvas</h2>
              <p className="text-sm text-gray-600">Claude Agent SDK - Sports Intelligence</p>
            </div>
            <div className="flex-1 relative min-h-0">
              <EmbeddedStreamingChat 
                className="h-full"
                suggestions={suggestions}
                onThinkingChange={setThinking}
              />
            </div>
          </div>
        </aside>
        <main className="flex-1 overflow-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white mb-2">🏆 Sports Intelligence Platform</h1>
              <p className="text-gray-400 text-lg mb-4">
                Analyze sports clubs, identify business opportunities, and discover key decision makers with AI-powered intelligence.
              </p>
              
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
              {initialState.cards?.map((card, index) => (
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