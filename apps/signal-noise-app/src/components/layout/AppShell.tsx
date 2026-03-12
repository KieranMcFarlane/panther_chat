"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { CopilotKit } from "@copilotkit/react-core";
import AppNavigation from "@/components/layout/AppNavigation";
import SWRProvider from "@/components/providers/SWRProvider";
import { UserProvider } from "@/contexts/UserContext";
import { TabProvider } from "@/contexts/TabContext";
import { ThreadProvider } from "@/contexts/ThreadContext";
import { SharedCopilotProvider } from "@/contexts/SharedCopilotContext";
import { TemporalIntelligenceTools } from "@/components/temporal/TemporalIntelligenceTools";
import { BetterAuthProvider } from "@/components/providers/BetterAuthProvider";

const SimpleStreamingChat = dynamic(
  () => import("@/components/chat/SimpleStreamingChat"),
  { ssr: false, loading: () => null }
);

const SPORTS_AGENT_CONFIG = {
  name: "Sports Intelligence Agent",
  description:
    "AI agent specializing in sports entity analysis, RFP intelligence, and graph analysis",
  capabilities: ["graph-analysis", "web-research", "data-analysis", "entity-enrichment"],
  tools: ["graph-mcp", "brightdata", "file-operations", "web-search"],
};

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <BetterAuthProvider>
      <UserProvider>
        <TabProvider>
          <ThreadProvider>
            <SWRProvider>
              <CopilotKit
                runtimeUrl="/api/copilotkit"
                publicApiKey={process.env.NEXT_PUBLIC_COPILOTKIT_API_KEY}
                properties={{ agentConfig: SPORTS_AGENT_CONFIG }}
                enableAGUI={true}
                showInspector={process.env.NODE_ENV === "development"}
              >
                <TemporalIntelligenceTools />
                <SharedCopilotProvider>
                  <AppNavigation>{children}</AppNavigation>
                  <SimpleStreamingChat />
                </SharedCopilotProvider>
              </CopilotKit>
            </SWRProvider>
          </ThreadProvider>
        </TabProvider>
      </UserProvider>
    </BetterAuthProvider>
  );
}
