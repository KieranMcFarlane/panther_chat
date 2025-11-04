'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MCPTestPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [claudeAgentResults, setClaudeAgentResults] = useState<any>(null);
  const [claudeAgentLoading, setClaudeAgentLoading] = useState(false);

  const testMCPIntegration = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/rfp-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      setTestResults(result);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testClaudeAgentIntegration = async () => {
    setClaudeAgentLoading(true);
    try {
      const response = await fetch('/api/run-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      setClaudeAgentResults(result);
    } catch (error) {
      console.error('Claude Agent test failed:', error);
      setClaudeAgentResults({ error: error.message });
    } finally {
      setClaudeAgentLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">🔧 MCP Integration Test</h1>
          <p className="text-gray-400">
            Test Claude Agent SDK with MCP server configuration
          </p>
        </div>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">🔧 Direct API Test (Fixed Phantom Execution)</CardTitle>
            <CardDescription className="text-gray-300">
              Direct API calls bypassing Claude Agent abstraction layer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-gray-300 space-y-1">
              <li>✅ Direct Neo4j queries to get real sports entities</li>
              <li>✅ Direct BrightData searches for RFP opportunities</li>
              <li>✅ Direct Perplexity analysis for intelligence</li>
              <li>✅ No abstraction layers - actual API execution</li>
              <li>✅ Honest reporting of results and errors</li>
            </ul>

            <Button 
              onClick={testMCPIntegration}
              disabled={loading}
              className="w-full"
              size="lg"
              variant="outline"
            >
              {loading ? '🔄 Testing Direct APIs...' : '🔧 Test Direct API Execution'}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">🤖 Claude Agent SDK Test (NEW)</CardTitle>
            <CardDescription className="text-gray-300">
              Claude Agent SDK with real MCP tool registration and execution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-gray-300 space-y-1">
              <li>🧠 Register MCP tools with Claude Agent SDK</li>
              <li>📋 Load system instructions from markdown file</li>
              <li>🔍 Claude reasoning with real MCP tool calls</li>
              <li>📝 Full execution logging to Markdown</li>
              <li>⚡ Streaming tool execution and responses</li>
            </ul>

            <Button 
              onClick={testClaudeAgentIntegration}
              disabled={claudeAgentLoading}
              className="w-full"
              size="lg"
            >
              {claudeAgentLoading ? '🤖 Running Claude Agent...' : '🚀 Run Claude Agent with MCP'}
            </Button>
          </CardContent>
        </Card>

        {testResults && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">📊 Direct API Results</CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-lg font-bold text-green-400">
                        {testResults.results?.entitiesProcessed || 0}
                      </div>
                      <div className="text-sm text-gray-400">Entities Processed</div>
                    </div>
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-lg font-bold text-blue-400">
                        {testResults.results?.searchesPerformed || 0}
                      </div>
                      <div className="text-sm text-gray-400">Searches Performed</div>
                    </div>
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-lg font-bold text-purple-400">
                        {testResults.results?.neo4jQueries || 0}
                      </div>
                      <div className="text-sm text-gray-400">Neo4j Queries</div>
                    </div>
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-lg font-bold text-yellow-400">
                        {testResults.results?.executionTime || 0}s
                      </div>
                      <div className="text-sm text-gray-400">Duration</div>
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded p-4">
                    <h3 className="font-semibold mb-2">Log File:</h3>
                    <code className="text-green-300 text-sm">{testResults.results?.logFile}</code>
                  </div>

                  <div className="bg-gray-900 rounded p-4">
                    <h3 className="font-semibold mb-2">Status:</h3>
                    <p className="text-green-300">{testResults.message}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-red-900/20 border border-red-700 rounded p-4">
                  <p className="text-red-300">❌ Direct API Test Failed: {testResults.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {claudeAgentResults && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">🤖 Claude Agent SDK Results</CardTitle>
            </CardHeader>
            <CardContent>
              {claudeAgentResults.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-lg font-bold text-green-400">
                        {claudeAgentResults.stats?.toolCalls || 0}
                      </div>
                      <div className="text-sm text-gray-400">Tool Calls</div>
                    </div>
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-lg font-bold text-blue-400">
                        {claudeAgentResults.stats?.messages || 0}
                      </div>
                      <div className="text-sm text-gray-400">Messages</div>
                    </div>
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-lg font-bold text-purple-400">
                        {claudeAgentResults.stats?.entitiesProcessed || 0}
                      </div>
                      <div className="text-sm text-gray-400">Entities Processed</div>
                    </div>
                    <div className="bg-gray-900 rounded p-3">
                      <div className="text-lg font-bold text-yellow-400">
                        {claudeAgentResults.stats?.runtime || 0}s
                      </div>
                      <div className="text-sm text-gray-400">Runtime</div>
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded p-4">
                    <h3 className="font-semibold mb-2">Tools Used:</h3>
                    <p className="text-cyan-300">{claudeAgentResults.stats?.toolsUsed?.join(', ') || 'None'}</p>
                  </div>

                  <div className="bg-gray-900 rounded p-4">
                    <h3 className="font-semibold mb-2">Log File:</h3>
                    <code className="text-green-300 text-sm">{claudeAgentResults.logFile}</code>
                  </div>

                  <div className="bg-gray-900 rounded p-4">
                    <h3 className="font-semibold mb-2">Searches/Opportunities:</h3>
                    <p className="text-blue-300">
                      Searches: {claudeAgentResults.stats?.searchesPerformed || 0} | 
                      Opportunities: {claudeAgentResults.stats?.opportunitiesFound || 0}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-red-900/20 border border-red-700 rounded p-4">
                  <p className="text-red-300">❌ Claude Agent Test Failed: {claudeAgentResults.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">📋 MCP Server Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 rounded p-4 font-mono text-xs">
              <div className="mb-2">📁 mcp-config.json</div>
              <pre className="text-gray-300">
{`{
  "mcpServers": {
    "neo4j-mcp": {
      "command": "npx",
      "args": ["-y", "@alanse/mcp-neo4j-server"],
      "env": {
        "NEO4J_URI": "neo4j+s://cce1f84b.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_DATABASE": "neo4j"
      }
    },
    "brightData": {
      "command": "npx",
      "args": ["-y", "@brightdata/mcp"],
      "env": {
        "API_TOKEN": "•••••••••••••••••••••••••••••••••",
        "PRO_MODE": "true"
      }
    },
    "perplexity-mcp": {
      "command": "npx",
      "args": ["-y", "mcp-perplexity-search"],
      "env": {
        "PERPLEXITY_API_KEY": "•••••••••••••••••••••••••••••••••"
      }
    }
  }
}`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}