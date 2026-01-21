'use client';

import React, { useState, useEffect } from 'react';

interface LiveKitAgent {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  roomName?: string;
  createdAt: string;
  lastActive?: string;
}

export default function AgentManager({ className = '' }: { className?: string }) {
  const [agents, setAgents] = useState<LiveKitAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);

  // Load agents on component mount
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/livekit/agents');
      const data = await response.json();
      
      if (data.success) {
        setAgents(data.agents || []);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const deployAgent = async (agentName: string, roomName?: string) => {
    try {
      setDeploying(true);
      
      const response = await fetch('/api/livekit/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName,
          roomName,
          autoJoin: true,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Agent deployed:', data.agent);
        await loadAgents(); // Refresh agent list
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error deploying agent:', error);
      alert(`Failed to deploy agent: ${error.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const stopAgent = async (agentId: string) => {
    try {
      setDeploying(true);
      
      const response = await fetch('/api/livekit/agents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Agent stopped');
        await loadAgents(); // Refresh agent list
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error stopping agent:', error);
      alert(`Failed to stop agent: ${error.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'stopped': return 'bg-gray-400';
      case 'error': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">🤖 LiveKit Agents</h3>
        <button
          onClick={() => deployAgent('yellow-panther-voice-agent')}
          disabled={deploying}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {deploying ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Deploying...</span>
            </div>
          ) : (
            '🚀 Deploy Agent'
          )}
        </button>
      </div>

      {/* Agent List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-600">Loading agents...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-4xl mb-2">🤖</div>
            <p className="text-gray-600 font-medium">No agents deployed</p>
            <p className="text-sm text-gray-500 mb-4">Deploy your first Yellow Panther Voice Agent</p>
            <button
              onClick={() => deployAgent('yellow-panther-voice-agent')}
              disabled={deploying}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              Deploy Voice Agent
            </button>
          </div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)}`}></div>
                  <div>
                    <div className="font-medium text-gray-900">{agent.name}</div>
                    <div className="text-xs text-gray-500">
                      ID: {agent.id} • Status: {agent.status}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {agent.status === 'running' && (
                    <button
                      onClick={() => stopAgent(agent.id)}
                      disabled={deploying}
                      className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      Stop
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-600 space-y-1">
                <div>Created: {formatDate(agent.createdAt)}</div>
                {agent.lastActive && (
                  <div>Last Active: {formatDate(agent.lastActive)}</div>
                )}
                {agent.roomName && (
                  <div>Room: {agent.roomName}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">📋 Agent Information</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div>• <strong>Cloud URL:</strong> wss://yellow-panther-8i644ma6.livekit.cloud</div>
          <div>• <strong>Agent Type:</strong> Voice AI with Claude Agent integration</div>
          <div>• <strong>Capabilities:</strong> Sports intelligence, RFP analysis, MCP tools</div>
          <div>• <strong>Status:</strong> {agents.filter(a => a.status === 'running').length} active, {agents.filter(a => a.status === 'stopped').length} stopped</div>
        </div>
      </div>
    </div>
  );
}