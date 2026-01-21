'use client';

import React, { useState } from 'react';
import ClaudeChatCopilotKit from '../ClaudeChatCopilotKit';
import VoiceChatRoom from './VoiceChatRoom';
import { useUser } from '@/contexts/UserContext';

interface VoiceEnabledChatProps {
  className?: string;
  suggestions?: { title: string; message: string }[];
  onThinkingChange?: (thinking: string[]) => void;
}

export default function VoiceEnabledChat({
  className = '',
  suggestions = [],
  onThinkingChange,
}: VoiceEnabledChatProps) {
  const { userId, ensureUserId } = useUser();
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const handleSessionStart = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setIsVoiceSessionActive(true);
  };

  const handleSessionEnd = (sessionId: string) => {
    setIsVoiceSessionActive(false);
    setCurrentSessionId(null);
  };

  const ensureUser = () => {
    return ensureUserId() || 'default_user';
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Mode Toggle */}
      <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700">
            Sports Intelligence Assistant
          </span>
          {isVoiceSessionActive && (
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full animate-pulse">
              🎤 Voice Session Active
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 bg-white rounded-lg p-1 border border-gray-200">
          <button
            onClick={() => setMode('text')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'text'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            💬 Text
          </button>
          <button
            onClick={() => setMode('voice')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'voice'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            🎙️ Voice
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'text' ? (
          <ClaudeChatCopilotKit
            suggestions={suggestions}
            onThinkingChange={onThinkingChange}
          />
        ) : (
          <VoiceChatRoom
            userId={ensureUser()}
            roomId={`voice_${currentSessionId || 'default'}`}
            onSessionStart={handleSessionStart}
            onSessionEnd={handleSessionEnd}
          />
        )}
      </div>

      {/* Mode Information */}
      <div className="border-t bg-gray-50 p-3">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              {mode === 'text' ? (
                <>
                  <span>💬</span>
                  <span>Text Chat</span>
                </>
              ) : (
                <>
                  <span>🎙️</span>
                  <span>Voice Chat</span>
                </>
              )}
            </span>
            
            <span className="flex items-center space-x-1">
              <span>🧠</span>
              <span>Claude Agent + MCP Tools</span>
            </span>

            <span className="flex items-center space-x-1">
              <span>📊</span>
              <span>{mode === 'voice' ? 'GPT-4o Voice' : 'Text'} Processing</span>
            </span>
          </div>

          {currentSessionId && (
            <span className="text-gray-500">
              Session: {currentSessionId.substr(-8)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}