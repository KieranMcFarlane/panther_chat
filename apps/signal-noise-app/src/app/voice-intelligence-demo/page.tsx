'use client';

import React, { useState } from 'react';
import VoiceEnabledChat from '@/components/voice/VoiceEnabledChat';
import VoiceAnalyticsDashboard from '@/components/voice/VoiceAnalyticsDashboard';
import AgentManager from '@/components/livekit/AgentManager';
import { useUser } from '@/contexts/UserContext';

const suggestions = [
  {
    title: '🏆 Club Intelligence',
    message: 'Tell me about Arsenal FC\'s current business opportunities'
  },
  {
    title: '💼 RFP Analysis',
    message: 'What RFP opportunities are available in the sports industry?'
  },
  {
    title: '📊 Market Trends',
    message: 'What are the latest digital transformation trends in sports?'
  },
  {
    title: '🎯 Entity Search',
    message: 'Search for football clubs in London with expansion opportunities'
  },
];

export default function VoiceIntelligenceDemo() {
  const { userId, ensureUserId } = useUser();
  const [activeView, setActiveView] = useState<'chat' | 'analytics'>('chat');

  const ensureUser = () => {
    return ensureUserId() || 'demo_user';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">
                🎙️ Voice Intelligence Demo
              </h1>
              <span className="text-sm text-gray-500">
                Powered by LiveKit + GPT-4o + Claude Agent + MCP
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveView('chat')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeView === 'chat'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                💬 Voice Chat
              </button>
              <button
                onClick={() => setActiveView('analytics')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeView === 'analytics'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                📊 Analytics
              </button>
              <button
                onClick={() => setActiveView('agents')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeView === 'agents'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                🤖 Agents
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chat/Analytics Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[600px]">
              {activeView === 'chat' ? (
                <VoiceEnabledChat
                  suggestions={suggestions}
                  className="h-full"
                />
              ) : activeView === 'analytics' ? (
                <VoiceAnalyticsDashboard
                  userId={ensureUser()}
                  className="h-full"
                />
              ) : activeView === 'agents' ? (
                <AgentManager className="h-full" />
              ) : null}
            </div>
          </div>

          {/* Info Panel */}
          <div className="space-y-6">
            {/* Architecture Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🏗️ Voice Architecture
              </h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <span className="text-blue-500 mt-1">🎤</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">LiveKit</div>
                    <div className="text-xs text-gray-600">Real-time audio streaming</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-green-500 mt-1">🧠</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">GPT-4o</div>
                    <div className="text-xs text-gray-600">Speech-to-text & text-to-speech</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-purple-500 mt-1">🤖</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Claude Agent</div>
                    <div className="text-xs text-gray-600">Reasoning & intelligence</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-orange-500 mt-1">🔧</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">MCP Tools</div>
                    <div className="text-xs text-gray-600">Neo4j, BrightData, Perplexity</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-cyan-500 mt-1">💾</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Supabase</div>
                    <div className="text-xs text-gray-600">Conversation storage</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ✨ Key Features
              </h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Real-time voice conversations</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Multi-modal AI processing</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Knowledge graph integration</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Conversation analytics</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Session persistence</span>
                </div>
              </div>
            </div>

            {/* Quick Start Guide */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🚀 Quick Start
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium text-gray-900">1. Configure Environment</div>
                  <div className="text-xs text-gray-600">Set up LiveKit and OpenAI keys in .env</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">2. Run Supabase Migration</div>
                  <div className="text-xs text-gray-600">Execute migrations/add_voice_conversations.sql</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">3. Start Voice Chat</div>
                  <div className="text-xs text-gray-600">Click "🎙️ Voice" mode and hold to talk</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">4. View Analytics</div>
                  <div className="text-xs text-gray-600">Switch to Analytics tab for insights</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}