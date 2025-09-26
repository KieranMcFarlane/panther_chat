import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import { NextRequest } from "next/server";
import { mastra } from "@/mastra";

// 1. Use OpenAI adapter to support both agents and direct chat components
const serviceAdapter = new OpenAIAdapter({
  model: "gpt-4.1-mini-2025-04-14",
  apiKey: process.env.OPENAI_API_KEY!,
  // Remove any token limitations - use model defaults
});

// 2. Build a Next.js API route that handles the CopilotKit runtime requests.
export const POST = async (req: NextRequest) => {

  // 3. Create the CopilotRuntime instance and utilize the Mastra AG-UI
  //    integration to get the remote agents. Cache this for performance.
  const agents = MastraAgent.getLocalAgents({ mastra });
  try {
    // Debug: list available agents at runtime startup
    // This helps diagnose "agent not found" issues due to stale server or import failures
    // Will print, for example: [ 'sample_agent' ]
    // Remove if too chatty once confirmed working
    console.log("[CopilotKit] Available agents:", Object.keys(agents || {}));
  } catch {}
  const runtime = new CopilotRuntime({ 
    agents,
    // Use default streaming for better Claude compatibility
    // Remove v2 streaming mode that may conflict with Anthropic
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
 
  return handleRequest(req);
};