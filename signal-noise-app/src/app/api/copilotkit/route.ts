import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest } from "next/server";
import { canvasAgent } from "@/mastra/agents";

// 1. You can use any service adapter here for multi-agent support.
const serviceAdapter = new ExperimentalEmptyAdapter();

// 2. Build a Next.js API route that handles the CopilotKit runtime requests.
export const POST = async (req: NextRequest) => {
  try {
    // 3. Create the CopilotRuntime instance with the canvas agent directly
    const agents = {
      "sample_agent": canvasAgent,
    };
    
    console.log("[CopilotKit] Available agents:", Object.keys(agents));
    
    const runtime = new CopilotRuntime({ agents });

    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      serviceAdapter,
      endpoint: "/api/copilotkit",
    });
   
    return handleRequest(req);
  } catch (error) {
    console.error("[CopilotKit] Error in API route:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};