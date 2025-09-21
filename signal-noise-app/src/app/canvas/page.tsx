"use client";

import { useCoAgent, useCopilotAction, useCoAgentStateRender, useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotChat, CopilotPopup } from "@copilotkit/react-ui";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

// Client-side only components to prevent hydration mismatch
const ClientOnlyCopilotChat = dynamic(() => Promise.resolve(CopilotChat), { ssr: false });
const ClientOnlyCopilotPopup = dynamic(() => Promise.resolve(CopilotPopup), { ssr: false });

// Simple types for testing
interface AgentState {
  cards: any[];
  planStatus?: string;
}

const initialState: AgentState = {
  cards: [],
  planStatus: ""
};

export default function CopilotKitPage() {
  const { state, setState } = useCoAgent<AgentState>({
    name: "sample_agent",
    initialState,
  });

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
            <ClientOnlyCopilotChat
              className="flex-1 overflow-auto w-full"
              labels={{
                title: "Agent",
                initial: "👋 Share a brief or ask to extract fields. Changes will sync with the canvas in real time.",
              }}
              suggestions={[
                { title: "Add a Project", message: "Create a new project." },
                { title: "Add an Entity", message: "Create a new entity." },
                { title: "Add a Note", message: "Create a new note." },
                { title: "Add a Chart", message: "Create a new chart." },
              ]}
            />
          </div>
        </aside>
        <main className="flex-1 overflow-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Sports Intelligence Canvas</h1>
              <p className="text-gray-600">AI-powered sports intelligence with Neo4j, BrightData, and Perplexity integration</p>
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
      <ClientOnlyCopilotPopup
        labels={{
          title: "Agent",
          initial: "👋 Share a brief or ask to extract fields. Changes will sync with the canvas in real time.",
        }}
        suggestions={[
          { title: "Add a Project", message: "Create a new project." },
          { title: "Add an Entity", message: "Create a new entity." },
          { title: "Add a Note", message: "Create a new note." },
          { title: "Add a Chart", message: "Create a new chart." },
        ]}
      />
    </div>
  );
}