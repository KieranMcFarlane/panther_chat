'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SystemSummary from './SystemSummary';
import RunHistory from './RunHistory';
import BlueprintIntegrity from './BlueprintIntegrity';

export default function LiveRFPScanner() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<any>(null);
  const [runHistory, setRunHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'execute' | 'integrity' | 'history'>('execute');

  const executeRFPScan = async () => {
    setIsRunning(true);
    
    try {
      const response = await fetch('/api/rfp-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setCurrentRun(result);
        setRunHistory(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 runs
        
        // Show success message
        alert(`✅ RFP Scan Complete!\n\nRun ID: ${result.runId}\nOutput File: ${result.outputFile}\n\nDuration: ${(result.duration / 1000).toFixed(1)}s\nEntities Processed: ${result.metrics.entitiesProcessed}`);
      } else {
        alert(`❌ Scan Failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Scan error:', error);
      alert('❌ Failed to execute RFP scan');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">🎯 Signal-Noise Control Panel</h1>
          <p className="text-gray-400 text-lg">
            Complete RFP Intelligence Dashboard with Claude Agent SDK
          </p>
          
          {/* Tab Navigation */}
          <div className="flex justify-center gap-2">
            <Button
              variant={activeTab === 'execute' ? 'default' : 'outline'}
              onClick={() => setActiveTab('execute')}
              className={activeTab === 'execute' ? 'bg-blue-600 hover:bg-blue-700' : 'text-gray-400'}
            >
              🚀 Execute Scan
            </Button>
            <Button
              variant={activeTab === 'integrity' ? 'default' : 'outline'}
              onClick={() => setActiveTab('integrity')}
              className={activeTab === 'integrity' ? 'bg-purple-600 hover:bg-purple-700' : 'text-gray-400'}
            >
              📋 Blueprint Integrity
            </Button>
            <Button
              variant={activeTab === 'history' ? 'default' : 'outline'}
              onClick={() => setActiveTab('history')}
              className={activeTab === 'history' ? 'bg-green-600 hover:bg-green-700' : 'text-gray-400'}
            >
              📈 Run History
            </Button>
          </div>
        </div>

        {/* Main Execution Card */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">🚀 Execute RFP Scan</CardTitle>
            <CardDescription className="text-gray-300">
              Single-click execution that generates real-time analysis and results
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
              <h3 className="text-lg font-semibold mb-2">📋 What This Does:</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>🧠 Loads <code className="bg-gray-800 px-2 py-1 rounded">COMPLETE-RFP-MONITORING-SYSTEM.md</code> blueprint</li>
                <li>🔧 Registers MCP servers (Neo4j, BrightData, Perplexity)</li>
                <li>🗃️ Queries Neo4j AuraDB for real sports entities (2,997 total)</li>
                <li>🔍 Performs live BrightData web searches for RFP opportunities</li>
                <li>📊 Cross-references with Perplexity AI-powered market intelligence</li>
                <li>📝 Generates execution log in <code className="bg-gray-800 px-2 py-1 rounded">RUN_LOGS/</code> folder</li>
                <li>⚡ Reports actual findings with URLs and confidence scores</li>
              </ul>
            </div>

            <Button 
              onClick={executeRFPScan}
              disabled={isRunning}
              className="w-full py-3 text-lg"
              size="lg"
            >
              {isRunning ? '🔄 Executing Scan...' : '🚀 Execute Live RFP Intelligence Scan'}
            </Button>

            {isRunning && (
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                <p className="text-blue-300 text-sm">
                  ⏳ Claude Agent is currently executing the RFP scan...
                  <br />
                  Check the <code className="bg-blue-800 px-2 py-1 rounded">RUN_LOGS/</code> folder for real-time output.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Run Results */}
        {currentRun && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">📊 Latest Run Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded p-3">
                  <div className="text-2xl font-bold text-green-400">{currentRun.metrics.entitiesProcessed}</div>
                  <div className="text-sm text-gray-400">Entities Processed</div>
                </div>
                <div className="bg-gray-900 rounded p-3">
                  <div className="text-2xl font-bold text-blue-400">{currentRun.metrics.searchesPerformed}</div>
                  <div className="text-sm text-gray-400">Searches Performed</div>
                </div>
                <div className="bg-gray-900 rounded p-3">
                  <div className="text-2xl font-bold text-purple-400">{currentRun.metrics.neo4jQueries}</div>
                  <div className="text-sm text-gray-400">Neo4j Queries</div>
                </div>
                <div className="bg-gray-900 rounded p-3">
                  <div className="text-2xl font-bold text-yellow-400">{(currentRun.duration / 1000).toFixed(1)}s</div>
                  <div className="text-sm text-gray-400">Duration</div>
                </div>
                <div className="bg-gray-900 rounded p-3 md:col-span-2">
                  <div className="text-sm font-mono text-green-300">{currentRun.outputFile}</div>
                  <div className="text-sm text-gray-400">Output File</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Run History */}
        {runHistory.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">📈 Recent Executions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {runHistory.map((run, index) => (
                  <div key={run.runId} className="bg-gray-900 rounded p-3 flex justify-between items-center">
                    <div>
                      <div className="font-mono text-sm text-gray-300">Run #{runHistory.length - index}</div>
                      <div className="text-xs text-gray-500">{new Date(run.runId.replace(/-/g, ':')).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-green-400">{run.metrics.entitiesProcessed} entities</div>
                      <div className="text-xs text-gray-500">{(run.duration / 1000).toFixed(1)}s</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab Content */}
        {activeTab === 'integrity' && (
          <div className="space-y-6">
            <BlueprintIntegrity />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <RunHistory />
          </div>
        )}

        {activeTab === 'execute' && (
          <div className="space-y-8">
            {/* Two Column Layout for Summary and Instructions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* System Summary */}
              <SystemSummary />
              
              {/* Instructions Card */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">📁 Output Files</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                    <div className="mb-2">📂 RUN_LOGS/</div>
                    <div className="ml-4 space-y-1 text-gray-400">
                      <div>├── RFP_RUN_2025-10-26T18-44-22-953Z.md ← Latest execution</div>
                      <div>├── [Timestamped execution logs]</div>
                      <div>└── ... (archived runs)</div>
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      Each file contains the complete execution trace: Claude's reasoning, tool calls, search results, and discovered opportunities.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Run History Quick View */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">📈 Run History</CardTitle>
                <CardDescription className="text-gray-300">
                  Click "Blueprint Integrity" tab for detailed history and statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RunHistory />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}