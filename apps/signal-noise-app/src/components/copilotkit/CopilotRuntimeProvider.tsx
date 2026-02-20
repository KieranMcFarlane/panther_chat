"use client";

import { useEffect, useMemo, useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { createContext, useContext } from "react";

type CopilotRuntimeProviderProps = {
  children: React.ReactNode;
  agentConfig: Record<string, unknown>;
  publicApiKey?: string;
};

type RuntimeOption = {
  id: "claude" | "openai";
  label: string;
  url: string;
};

const RUNTIME_STORAGE_KEY = "copilotkit_runtime";
const runtimeOptions: RuntimeOption[] = [
  { id: "claude", label: "Claude", url: "/api/copilotkit" },
  { id: "openai", label: "OpenAI", url: "/api/copilotkit-openai" },
];

type CopilotRuntimeContextValue = {
  runtime: RuntimeOption["id"];
  setRuntime: (value: RuntimeOption["id"]) => void;
  options: RuntimeOption[];
};

const CopilotRuntimeContext = createContext<CopilotRuntimeContextValue | null>(null);

export function useCopilotRuntime() {
  const context = useContext(CopilotRuntimeContext);
  if (!context) {
    throw new Error("useCopilotRuntime must be used within CopilotRuntimeProvider");
  }
  return context;
}

export default function CopilotRuntimeProvider({
  children,
  agentConfig,
  publicApiKey,
}: CopilotRuntimeProviderProps) {
  const envDefault =
    (process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME as RuntimeOption["id"] | undefined) ??
    "claude";
  const [runtime, setRuntime] = useState<RuntimeOption["id"]>(envDefault);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(RUNTIME_STORAGE_KEY) as RuntimeOption["id"] | null;
    if (stored === "claude" || stored === "openai") {
      setRuntime(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RUNTIME_STORAGE_KEY, runtime);
  }, [runtime]);

  const selected = useMemo(
    () => runtimeOptions.find((option) => option.id === runtime) ?? runtimeOptions[0],
    [runtime]
  );

  return (
    <CopilotRuntimeContext.Provider value={{ runtime, setRuntime, options: runtimeOptions }}>
      <CopilotKit
        key={`copilotkit-${selected.id}`}
        runtimeUrl={selected.url}
        publicApiKey={publicApiKey}
        properties={{ agentConfig }}
        enableAGUI={true}
        showInspector={process.env.NODE_ENV === "development"}
      >
        {children}
      </CopilotKit>
    </CopilotRuntimeContext.Provider>
  );
}

export function CopilotRuntimeSwitch({ compact = false }: { compact?: boolean }) {
  const { runtime, setRuntime, options } = useCopilotRuntime();

  return (
    <div
      className={`flex items-center gap-2 rounded-full border border-white/10 bg-black/70 text-xs text-white shadow-lg backdrop-blur ${
        compact ? "px-2 py-1.5" : "px-3 py-2"
      }`}
    >
      {!compact && <span className="text-white/70">Runtime</span>}
      {options.map((option) => {
        const isActive = option.id === runtime;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setRuntime(option.id)}
            className={`rounded-full px-2.5 py-1 font-medium transition ${
              isActive
                ? "bg-amber-400 text-black"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {compact ? option.label.slice(0, 1) : option.label}
          </button>
        );
      })}
    </div>
  );
}
