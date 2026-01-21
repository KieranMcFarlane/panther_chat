'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface VoiceSession {
  id: string;
  user_id: string;
  room_name: string;
  start_time: string;
  end_time?: string;
  status: 'active' | 'ended' | 'paused';
  metadata: any;
}

interface VoiceConversation {
  id: string;
  session_id: string;
  transcript: string;
  speaker: 'user' | 'assistant';
  timestamp: string;
  claude_response?: string;
}

interface VoiceAnalytics {
  session_id?: string;
  user_id: string;
  total_sessions: number;
  avg_duration_minutes: number;
  completed_sessions: number;
  active_sessions: number;
  last_session: string;
}

export default function VoiceAnalyticsDashboard({ 
  userId, 
  className = '' 
}: { 
  userId: string; 
  className?: string; 
}) {
  const [sessions, setSessions] = useState<VoiceSession[]>([]);
  const [analytics, setAnalytics] = useState<VoiceAnalytics | null>(null);
  const [selectedSession, setSelectedSession] = useState<VoiceSession | null>(null);
  const [conversations, setConversations] = useState<VoiceConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'conversations'>('overview');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  // Load voice sessions and analytics
  useEffect(() => {
    loadVoiceData();
  }, [userId]);

  const loadVoiceData = async () => {
    try {
      setLoading(true);

      // Load sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from('voice_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(20);

      if (sessionError) throw sessionError;
      setSessions(sessionData || []);

      // Load analytics from view
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('voice_session_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (analyticsError && analyticsError.code !== 'PGRST116') {
        throw analyticsError;
      }
      setAnalytics(analyticsData);

    } catch (error) {
      console.error('Error loading voice data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load conversations for selected session
  useEffect(() => {
    if (selectedSession) {
      loadConversations(selectedSession.id);
    }
  }, [selectedSession]);

  const loadConversations = async (sessionId: string) => {
    try {
      const { data: conversationData, error: conversationError } = await supabase
        .from('voice_conversations')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (conversationError) throw conversationError;
      setConversations(conversationData || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600">Loading voice analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">🎙️ Voice Intelligence Analytics</h2>
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          {analytics && (
            <>
              <span className="flex items-center space-x-1">
                <span>📊</span>
                <span>{analytics.total_sessions} sessions</span>
              </span>
              <span className="flex items-center space-x-1">
                <span>⏱️</span>
                <span>{analytics.avg_duration_minutes?.toFixed(1)} min avg</span>
              </span>
              <span className="flex items-center space-x-1">
                <span>✅</span>
                <span>{analytics.completed_sessions} completed</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b bg-gray-50">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
          }`}
        >
          📈 Overview
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'sessions'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
          }`}
        >
          📋 Sessions
        </button>
        <button
          onClick={() => setActiveTab('conversations')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'conversations'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
          }`}
        >
          💬 Conversations
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Analytics Cards */}
            {analytics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <div className="text-2xl mb-2">🎙️</div>
                  <div className="text-lg font-semibold text-gray-900">{analytics.total_sessions}</div>
                  <div className="text-sm text-gray-600">Total Voice Sessions</div>
                </div>
                
                <div className="bg-white rounded-lg border p-4">
                  <div className="text-2xl mb-2">⏱️</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {analytics.avg_duration_minutes?.toFixed(1) || 0} min
                  </div>
                  <div className="text-sm text-gray-600">Average Duration</div>
                </div>
                
                <div className="bg-white rounded-lg border p-4">
                  <div className="text-2xl mb-2">✅</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {analytics.completed_sessions}
                  </div>
                  <div className="text-sm text-gray-600">Completed Sessions</div>
                </div>
              </div>
            )}

            {/* Recent Sessions */}
            <div>
              <h3 className="text-md font-semibold text-gray-900 mb-3">📅 Recent Voice Sessions</h3>
              <div className="space-y-2">
                {sessions.slice(0, 5).map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className="bg-white rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          session.status === 'active' ? 'bg-green-500' :
                          session.status === 'ended' ? 'bg-gray-400' : 'bg-yellow-500'
                        }`}></div>
                        <span className="text-sm font-medium text-gray-900">
                          {formatDate(session.start_time)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDuration(session.start_time, session.end_time)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-3">
            <h3 className="text-md font-semibold text-gray-900 mb-3">📋 All Voice Sessions</h3>
            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🎙️</div>
                <p className="text-gray-600">No voice sessions found</p>
                <p className="text-sm text-gray-500">Start a voice conversation to see your sessions here</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedSession?.id === session.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        session.status === 'active' ? 'bg-green-500' :
                        session.status === 'ended' ? 'bg-gray-400' : 'bg-yellow-500'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(session.start_time)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {formatDuration(session.start_time, session.end_time)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Room: {session.room_name} • Status: {session.status}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'conversations' && (
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 mb-3">💬 Conversation History</h3>
            {!selectedSession ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">💬</div>
                <p className="text-gray-600">Select a session to view conversations</p>
                <p className="text-sm text-gray-500">Go to the Sessions tab and choose a voice session</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No conversations found for this session</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-900">
                    Session: {formatDate(selectedSession.start_time)}
                  </div>
                  <div className="text-xs text-blue-700">
                    Duration: {formatDuration(selectedSession.start_time, selectedSession.end_time)} • 
                    {conversations.length} conversation turns
                  </div>
                </div>
                
                <div className="space-y-3">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`flex ${
                        conversation.speaker === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          conversation.speaker === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-800 border border-purple-200'
                        }`}
                      >
                        <div className="text-xs font-medium mb-1 opacity-75">
                          {conversation.speaker === 'user' ? 'You' : 'Claude AI'} • 
                          {formatDate(conversation.timestamp)}
                        </div>
                        <div className="text-sm whitespace-pre-wrap">
                          {conversation.transcript}
                        </div>
                        {conversation.claude_response && (
                          <div className="mt-2 pt-2 border-t border-current/20 text-xs opacity-75">
                            <strong>Claude's Response:</strong> {conversation.claude_response}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}