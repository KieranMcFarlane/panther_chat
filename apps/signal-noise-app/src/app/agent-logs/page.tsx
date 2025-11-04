'use client';

import { useEffect, useRef, useState } from 'react';
import ClaudeAgentActivityLog from '@/components/ClaudeAgentActivityLog';
import Header from '@/components/header/Header';

export default function LiveAgentLogsPage() {
  const [runId, setRunId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [isPaused, setIsPaused] = useState(false);

  // Generate runId only on client side to avoid hydration mismatch
  useEffect(() => {
    setRunId(`run_${Date.now()}`);
  }, []);

  const categories = [
    { value: 'all', label: 'All Categories', color: 'gray' },
    { value: 'system', label: 'System', color: 'blue' },
    { value: 'claude-agent', label: 'Claude Agent', color: 'purple' },
    { value: 'enrichment', label: 'Entity Enrichment', color: 'green' },
    { value: 'api', label: 'API', color: 'yellow' },
    { value: 'database', label: 'Database', color: 'cyan' },
    { value: 'notification', label: 'Notifications', color: 'orange' },
    { value: 'error', label: 'Errors', color: 'red' }
  ];

  const sources = [
    { value: 'all', label: 'All Sources' },
    { value: 'IntelligentEntityEnrichmentService', label: 'Intelligent Enrichment' },
    { value: 'IntelligentEnrichmentScheduler', label: 'Enrichment Scheduler' },
    { value: 'ClaudeAgentSDK', label: 'Claude Agent SDK' },
    { value: 'EntityDossierEnrichmentService', label: 'Entity Dossier' },
    { value: 'BrightDataMCP', label: 'BrightData MCP' },
    { value: 'PerplexityMCP', label: 'Perplexity MCP' },
    { value: 'Neo4jMCP', label: 'Neo4j MCP' }
  ];

  
  const startNewRun = (e: React.MouseEvent) => {
    e.preventDefault();
    const newRunId = `run_${Date.now()}`;
    setRunId(newRunId);
  };

  const triggerMinesAgent = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      console.log('🚨 Triggering Mines Agent...');
      
      const response = await fetch('/api/claude-agents/mines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger' })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Mines Agent triggered successfully!');
      } else {
        console.error(`❌ Failed to trigger Mines Agent: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error triggering Mines Agent: ${(error as Error).message}`);
    }
  };

  const triggerEnrichmentAgent = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      console.log('🧬 Triggering Enrichment Agent...');
      
      const response = await fetch('/api/claude-agents/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger' })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Enrichment Agent triggered successfully!');
      } else {
        console.error(`❌ Failed to trigger Enrichment Agent: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error triggering Enrichment Agent: ${(error as Error).message}`);
    }
  };

  const startBothAgents = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      console.log('🚀 Starting both specialized agents...');
      
      const response = await fetch('/api/claude-agents/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-both' })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Both agents started successfully!');
      } else {
        console.error(`❌ Failed to start both agents: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error starting both agents: ${(error as Error).message}`);
    }
  };

  const stopAllAgentsDirect = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      console.log('⏹️ Stopping all agents (direct)...');
      
      const response = await fetch('/api/claude-agents/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop-all' })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ All agents stopped successfully!');
      } else {
        console.error(`❌ Failed to stop all agents: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error stopping all agents: ${(error as Error).message}`);
    }
  };

  const triggerClaudeAgent = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      console.log('🚀 Triggering Claude Agent with real SDK processing...');
      
      const response = await fetch('/api/claude-agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'execute-both' })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Claude Agent SDK processing triggered successfully!');
      } else {
        console.error(`❌ Failed to trigger Claude Agent SDK: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error triggering Claude Agent SDK: ${(error as Error).message}`);
    }
  };

  const executeMinesAgent = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      console.log('🚨 Executing Mines Agent with Claude SDK...');
      
      const response = await fetch('/api/claude-agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'execute-mines' })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Mines Agent Claude SDK execution started!');
      } else {
        console.error(`❌ Failed to execute Mines Agent: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error executing Mines Agent: ${(error as Error).message}`);
    }
  };

  const executeEnrichmentAgent = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      console.log('🧬 Executing Enrichment Agent with Claude SDK...');
      
      const response = await fetch('/api/claude-agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'execute-enrichment' })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Enrichment Agent Claude SDK execution started!');
      } else {
        console.error(`❌ Failed to execute Enrichment Agent: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error executing Enrichment Agent: ${(error as Error).message}`);
    }
  };

  // Slash command functions
  const executeSlashCommand = async (command: string) => {
    try {
      console.log(`🔧 Executing slash command: ${command}`);
      
      const response = await fetch('/api/claude-agents/slash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, sessionId: runId })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log(`✅ Command executed: ${command}`);
        return result.data;
      } else {
        console.error(`❌ Failed to execute command: ${result.error}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error executing command: ${(error as Error).message}`);
      return null;
    }
  };

  const selectMinesAgent = async (e: React.MouseEvent) => {
    e.preventDefault();
    const result = await executeSlashCommand('/select-mines');
    console.log('Selected Mines Agent:', result);
  };

  const selectEnrichmentAgent = async (e: React.MouseEvent) => {
    e.preventDefault();
    await executeSlashCommand('/select-enrichment');
  };

  const getAgentStatus = async (e: React.MouseEvent) => {
    e.preventDefault();
    const result = await executeSlashCommand('/agent-status');
    if (result) {
      console.log('📊 Agent Status:', result);
    }
    return result;
  };

  const executeCurrentAgent = async (e: React.MouseEvent) => {
    e.preventDefault();
    console.log(`🚀 Executing current agent with session ID: ${runId}`);
    const result = await executeSlashCommand('/execute-now');
    if (result) {
      console.log('✅ Agent execution result:', result);
    } else {
      console.error('❌ Agent execution failed');
    }
  };

  const startDailySchedule = async (e: React.MouseEvent) => {
    e.preventDefault();
    await executeSlashCommand('/start-daily');
  };

  const stopAllAgents = async (e: React.MouseEvent) => {
    e.preventDefault();
    await executeSlashCommand('/stop-all');
  };

  const showHelp = async (e: React.MouseEvent) => {
    e.preventDefault();
    const result = await executeSlashCommand('/help');
    if (result) {
      console.log('📚 Available Commands:', result.commands);
    }
    return result;
  };

  return (
    <div className="min-h-screen bg-[#1c1e2d] flex flex-col">
      {/* Consistent Header */}
      <Header />

      {/* Main Content Area */}
      <div className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">🤖 Claude Agent Live Logs</h1>
                <p className="text-white/60">Monitor and control AI agent activity in real-time</p>
              </div>
              
              <div className="flex items-center space-x-3 bg-gray-800/60 px-4 py-2 rounded-lg border border-white/10">
                <span className="text-sm text-gray-400">Run ID:</span>
                <span className="text-sm font-mono text-cyan-400">{runId}</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-gray-800/60 rounded-lg border border-white/10 p-6 mb-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center space-x-3">
                <label className="text-sm text-white/80 font-medium">Category:</label>
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-gray-900/80 border border-white/20 rounded-lg px-4 py-2 text-sm text-white/90 focus:outline-none focus:border-cyan-500/60 transition-colors"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <label className="text-sm text-white/80 font-medium">Source:</label>
                <select 
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="bg-gray-900/80 border border-white/20 rounded-lg px-4 py-2 text-sm text-white/90 focus:outline-none focus:border-cyan-500/60 transition-colors"
                >
                  {sources.map(source => (
                    <option key={source.value} value={source.value}>{source.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3 ml-auto">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setIsPaused(!isPaused);
                  }}
                  className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
                    isPaused 
                      ? 'bg-amber-800/90 hover:bg-amber-700 text-white border-amber-600/30' 
                      : 'bg-emerald-800/90 hover:bg-emerald-700 text-white border-emerald-600/30'
                  }`}
                >
                  {isPaused ? '▶ Resume' : '⏸ Pause'}
                </button>

                <button
                  onClick={startNewRun}
                  className="px-6 py-2.5 bg-slate-700/90 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-slate-600/30"
                >
                  🔄 New Run
                </button>
              </div>
            </div>
          </div>

          {/* Agent Controls */}
          <div className="bg-gray-800/60 rounded-lg border border-white/10 p-6 mb-6">
            <div className="text-sm text-emerald-400 font-semibold mb-4">🤖 Specialized Agents:</div>
            
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={startBothAgents}
                className="px-5 py-2.5 bg-emerald-800/90 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-emerald-600/30"
              >
                🚀 Start Both Agents
              </button>

              <button
                onClick={stopAllAgentsDirect}
                className="px-5 py-2.5 bg-rose-800/90 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-rose-600/30"
              >
                ⏹️ Stop All
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={triggerMinesAgent}
                className="px-5 py-2.5 bg-amber-800/90 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-amber-600/30"
              >
                🚨 Trigger Mines
              </button>

              <button
                onClick={triggerEnrichmentAgent}
                className="px-5 py-2.5 bg-teal-800/90 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-teal-600/30"
              >
                🧬 Trigger Enrichment
              </button>

              <button
                onClick={triggerClaudeAgent}
                className="px-5 py-2.5 bg-violet-800/90 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-violet-600/30"
              >
                ⚡ Execute Both (SDK)
              </button>

              <button
                onClick={executeMinesAgent}
                className="px-5 py-2.5 bg-amber-800/90 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-amber-600/30"
              >
                🚨 Execute Mines (SDK)
              </button>

              <button
                onClick={executeEnrichmentAgent}
                className="px-5 py-2.5 bg-teal-800/90 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-teal-600/30"
              >
                🧬 Execute Enrichment (SDK)
              </button>
            </div>
          </div>

          {/* Slash Command Controls */}
          <div className="bg-gray-800/60 rounded-lg border border-white/10 p-6 mb-6">
            <div className="text-sm text-cyan-400 font-semibold mb-4">🔧 Slash Commands:</div>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={selectMinesAgent}
                className="px-4 py-2.5 bg-violet-800/90 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-violet-600/30"
              >
                🎯 Select Mines
              </button>

              <button
                onClick={selectEnrichmentAgent}
                className="px-4 py-2.5 bg-slate-700/90 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-slate-600/30"
              >
                🎯 Select Enrichment
              </button>

              <button
                onClick={executeCurrentAgent}
                className="px-4 py-2.5 bg-emerald-800/90 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-emerald-600/30"
              >
                ⚡ Execute Current
              </button>

              <button
                onClick={startDailySchedule}
                className="px-4 py-2.5 bg-indigo-800/90 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-indigo-600/30"
              >
                📅 Start Daily
              </button>

              <button
                onClick={getAgentStatus}
                className="px-4 py-2.5 bg-yellow-800/90 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-yellow-600/30"
              >
                📊 Status
              </button>

              <button
                onClick={showHelp}
                className="px-4 py-2.5 bg-zinc-700/90 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-zinc-600/30"
              >
                📚 Help
              </button>

              <button
                onClick={stopAllAgents}
                className="px-4 py-2.5 bg-rose-800/90 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-rose-600/30"
              >
                ⏹️ Stop All
              </button>
            </div>
          </div>

          {/* Claude Agent Activity Log */}
        <div className="bg-gray-900/60 rounded-lg border border-white/10 overflow-hidden">
          <div className="bg-gray-800/80 px-6 py-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm text-white/90 font-medium">Claude Agent SDK Activity Stream</span>
                <div className="flex items-center space-x-2">
                  {selectedCategory !== 'all' && (
                    <span className="px-2 py-1 bg-emerald-800/30 text-emerald-300 text-xs rounded-md border border-emerald-600/20">
                      {selectedCategory}
                    </span>
                  )}
                  {selectedSource !== 'all' && (
                    <span className="px-2 py-1 bg-cyan-800/30 text-cyan-300 text-xs rounded-md border border-cyan-600/20">
                      {selectedSource}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-white/50">
                {isPaused ? '⏸ Paused' : '▶ Live'}
              </div>
            </div>
          </div>
          <div className="h-[60vh] bg-gray-950/40">
            <ClaudeAgentActivityLog 
              sessionId={runId}
              maxHeight="60vh"
              showTimestamp={true}
              autoScroll={!isPaused}
            />
          </div>
        </div>
        </div>
      </div>

      {/* Legend */}
      <div className="container mx-auto px-4 pb-8">
        <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div className="bg-gray-800/60 rounded-lg p-4 border border-white/10">
            <div className="text-amber-400 mb-2 font-medium">🚨 Mines Agent</div>
            <div className="text-white/60">RFP detection, webhook monitoring, 6-month backtesting</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-white/10">
            <div className="text-teal-400 mb-2 font-medium">🧬 Enrichment Agent</div>
            <div className="text-white/60">4000+ entity enrichment, comprehensive schema processing</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-white/10">
            <div className="text-violet-400 mb-2 font-medium">🤖 Claude Agent SDK</div>
            <div className="text-white/60">Core AI processing, tool orchestration</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-white/10">
            <div className="text-emerald-400 mb-2 font-medium">🔧 Slash Commands</div>
            <div className="text-white/60">Voice-activated agent control and scheduling</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 border border-white/10">
            <div className="text-rose-400 mb-2 font-medium">⚠ System Events</div>
            <div className="text-white/60">Service status, errors, configuration</div>
          </div>
        </div>
      </div>
    </div>
  );
}