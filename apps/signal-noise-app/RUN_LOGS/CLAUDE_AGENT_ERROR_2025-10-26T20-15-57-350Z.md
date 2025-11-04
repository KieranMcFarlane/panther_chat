# ❌ CLAUDE AGENT EXECUTION ERROR

**Timestamp:** 2025-10-26T20:15:57.350Z
**Error:** (0 , _anthropic_ai_claude_agent_sdk__WEBPACK_IMPORTED_MODULE_0__.registerMCP) is not a function
**Stack:** TypeError: (0 , _anthropic_ai_claude_agent_sdk__WEBPACK_IMPORTED_MODULE_0__.registerMCP) is not a function
    at registerAllMCPs (webpack-internal:///(rsc)/./src/lib/mcp/index.ts:175:84)
    at POST (webpack-internal:///(rsc)/./src/app/api/run-agent/route.ts:45:70)
    at async /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:57228
    at async eT.execute (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:46851)
    at async eT.handle (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:58760)
    at async doRender (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/base-server.js:1366:42)
    at async cacheEntry.responseCache.get.routeKind (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/base-server.js:1588:28)
    at async DevServer.renderToResponseWithComponentsImpl (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/base-server.js:1496:28)
    at async DevServer.renderPageComponent (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/base-server.js:1924:24)
    at async DevServer.renderToResponseImpl (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/base-server.js:1962:32)
    at async DevServer.pipeImpl (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/base-server.js:922:25)
    at async NextNodeServer.handleCatchallRenderRequest (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/next-server.js:272:17)
    at async DevServer.handleRequestImpl (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/base-server.js:818:17)
    at async /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/dev/next-dev-server.js:339:20
    at async Span.traceAsyncFn (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/trace/trace.js:154:20)
    at async DevServer.handleRequest (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/dev/next-dev-server.js:336:24)
    at async invokeRender (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/lib/router-server.js:179:21)
    at async handleRequest (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/lib/router-server.js:359:24)
    at async requestHandlerImpl (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/lib/router-server.js:383:13)
    at async Server.requestListener (/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/node_modules/next/dist/server/lib/start-server.js:141:13)

This error occurred during Claude Agent SDK execution with MCP tools.
