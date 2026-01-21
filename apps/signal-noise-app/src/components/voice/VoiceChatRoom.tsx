'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  LiveKitRoom,
  ConnectButton,
  AudioVisualizer,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

interface VoiceChatRoomProps {
  className?: string;
  userId: string;
  roomId?: string;
  onSessionStart?: (sessionId: string) => void;
  onSessionEnd?: (sessionId: string) => void;
}

export default function VoiceChatRoom({
  className = '',
  userId,
  roomId,
  onSessionStart,
  onSessionEnd,
}: VoiceChatRoomProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<Array<{speaker: string, text: string, timestamp: Date}>>([]);
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);
  
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Generate session ID and initialize room
  useEffect(() => {
    const newSessionId = `voice_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newRoomName = `voice_${newSessionId}`;
    
    setSessionId(newSessionId);
    setRoomName(newRoomName);
    
    onSessionStart?.(newSessionId);
  }, [onSessionStart]);

  // Auto-scroll conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Get user token for LiveKit room
  useEffect(() => {
    if (!roomName || !userId) return;

    const getToken = async () => {
      try {
        const response = await fetch('/api/livekit/tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            userId,
            sessionId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setUserToken(data.room.userToken);
        }
      } catch (error) {
        console.error('Error getting room token:', error);
      }
    };

    getToken();
  }, [roomName, userId, sessionId]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsVoiceSessionActive(true);
      console.log('🎤 Recording started');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check your permissions.');
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    setIsVoiceSessionActive(false);
    console.log('🛑 Recording stopped');
  }, []);

  // Process audio through voice conversation pipeline
  const processAudio = useCallback(async (audioBlob: Blob) => {
    try {
      console.log('⚡ Processing audio...');
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      formData.append('sessionId', sessionId!);
      formData.append('userId', userId);
      formData.append('roomName', roomName!);

      const response = await fetch('/api/livekit/voice-conversation', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process audio');
      }

      // Get transcript and response from headers
      const transcript = decodeURIComponent(response.headers.get('X-Transcript') || '');
      const aiResponse = decodeURIComponent(response.headers.get('X-Response') || '');

      // Play audio response
      const audioBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBufferSource = audioContext.createBufferSource();
      const decodedAudio = await audioContext.decodeAudioData(audioBuffer);
      audioBufferSource.buffer = decodedAudio;
      audioBufferSource.connect(audioContext.destination);
      audioBufferSource.start();

      // Update conversation
      setConversation(prev => [
        ...prev,
        { speaker: 'You', text: transcript, timestamp: new Date() },
        { speaker: 'Claude AI', text: aiResponse, timestamp: new Date() },
      ]);

      setTranscript(aiResponse);
      console.log('✅ Audio processed successfully');

    } catch (error) {
      console.error('Error processing audio:', error);
      alert('Failed to process audio. Please try again.');
    }
  }, [sessionId, userId, roomName]);

  if (!userToken || !roomName) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing voice room...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${userToken ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium text-gray-700">
            Voice Intelligence Room
          </span>
          {sessionId && (
            <span className="text-xs text-gray-500">
              Session: {sessionId.substr(-8)}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`text-xs px-2 py-1 rounded-full ${
            isVoiceSessionActive 
              ? 'bg-red-100 text-red-700 animate-pulse' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            {isVoiceSessionActive ? '🎤 Recording...' : '🔊 Ready'}
          </span>
        </div>
      </div>

      {/* LiveKit Room */}
      <LiveKitRoom
        token={userToken}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_HOST || 'wss://yellow-panther-8i644ma6.livekit.cloud'}
        connect={true}
        audio={true}
        video={false}
      >
        <RoomContent 
          conversation={conversation}
          transcript={transcript}
          isVoiceSessionActive={isVoiceSessionActive}
          startRecording={startRecording}
          stopRecording={stopRecording}
          conversationEndRef={conversationEndRef}
        />
      </LiveKitRoom>
    </div>
  );
}

// Room content component
function RoomContent({
  conversation,
  transcript,
  isVoiceSessionActive,
  startRecording,
  stopRecording,
  conversationEndRef,
}: {
  conversation: Array<{speaker: string, text: string, timestamp: Date}>;
  transcript: string;
  isVoiceSessionActive: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  conversationEndRef: React.RefObject<HTMLDivElement>;
}) {
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks();

  return (
    <>
      {/* Conversation Display */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {conversation.length === 0 ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold mb-2">🎙️ Voice-Enabled Sports Intelligence</h3>
              <p className="text-gray-600 mb-4">
                Talk directly with Claude AI about sports entities, RFP opportunities, and market intelligence.
              </p>
              <div className="text-xs text-gray-500 max-w-md mx-auto space-y-2">
                <div>🎤 <strong>Voice Commands</strong> - "Tell me about Arsenal FC"</div>
                <div>🧠 <strong>Claude Reasoning</strong> - Powered by your knowledge graph</div>
                <div>📊 <strong>Real-time Analysis</strong> - MCP tools integrated</div>
              </div>
            </div>
          ) : (
            conversation.map((turn, index) => (
              <div
                key={index}
                className={`flex ${turn.speaker === 'You' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    turn.speaker === 'You'
                      ? 'bg-blue-500 text-white'
                      : turn.speaker === 'Claude AI'
                      ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-800 border border-purple-200'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="text-xs font-medium mb-1 opacity-75">
                    {turn.speaker} • {turn.timestamp.toLocaleTimeString()}
                  </div>
                  <div className="whitespace-pre-wrap">{turn.text}</div>
                </div>
              </div>
            ))
          )}
          <div ref={conversationEndRef} />
        </div>

        {/* Current Response */}
        {transcript && isVoiceSessionActive && (
          <div className="flex justify-start mt-4">
            <div className="max-w-[80%] rounded-lg p-3 bg-yellow-50 text-yellow-800 border border-yellow-200">
              <div className="text-xs font-medium mb-1">🤖 Claude is responding...</div>
              <div className="text-sm">{transcript}</div>
            </div>
          </div>
        )}
      </div>

      {/* Voice Controls */}
      <div className="border-t p-4 bg-gray-50">
        <div className="flex items-center justify-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-600">
              Status: {localParticipant ? 'Connected' : 'Connecting...'}
            </span>
            {localParticipant && (
              <span className="text-xs text-green-600">
                🟢 {localParticipant.identity}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center space-x-4 mt-3">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={!localParticipant}
            className={`px-8 py-4 rounded-full transition-all transform ${
              isVoiceSessionActive
                ? 'bg-red-500 text-white scale-110 animate-pulse'
                : !localParticipant
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600 hover:scale-105'
            } flex items-center space-x-3 shadow-lg`}
          >
            {isVoiceSessionActive ? (
              <>
                <div className="w-4 h-4 bg-white rounded-full animate-ping"></div>
                <span>Release to Stop</span>
              </>
            ) : !localParticipant ? (
              <>
                <div className="w-6 h-6 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>Hold to Talk</span>
              </>
            )}
          </button>

          <div className="text-xs text-gray-500">
            Hold the button to speak with Claude AI
          </div>
        </div>
      </div>
    </>
  );
}