import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Initialize OpenAI for voice processing
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase for conversation storage
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export interface VoiceConversationTurn {
  id: string;
  sessionId: string;
  userId: string;
  roomName: string;
  audioUrl?: string;
  transcript: string;
  speaker: 'user' | 'assistant';
  timestamp: Date;
  claudeResponse?: string;
  metadata?: any;
}

export interface VoiceSession {
  id: string;
  userId: string;
  roomName: string;
  startTime: Date;
  endTime?: Date;
  turns: VoiceConversationTurn[];
  status: 'active' | 'ended' | 'paused';
}

/**
 * Convert speech to text using OpenAI Whisper
 */
export async function speechToText(audioBuffer: Buffer): Promise<string> {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.webm', { type: 'audio/webm' }),
      model: 'whisper-1',
      language: 'en',
      response_format: 'text',
    });

    return transcription;
  } catch (error) {
    console.error('Error in speech-to-text:', error);
    throw new Error('Failed to transcribe audio');
  }
}

/**
 * Convert text to speech using OpenAI TTS
 */
export async function textToSpeech(text: string): Promise<Buffer> {
  try {
    const mp3Buffer = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'alloy',
      input: text,
      response_format: 'mp3',
    });

    return Buffer.from(await mp3Buffer.arrayBuffer());
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    throw new Error('Failed to generate speech');
  }
}

/**
 * Process voice conversation through Claude Agent
 */
export async function processVoiceConversation(
  transcript: string,
  sessionId: string,
  userId: string
): Promise<string> {
  try {
    // Send to Claude Agent for processing
    const response = await fetch('/api/claude-agent/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: transcript,
        sessionId,
        context: 'voice_conversation',
        userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude Agent error: ${response.statusText}`);
    }

    const claudeResponse = await response.text();
    return claudeResponse;
  } catch (error) {
    console.error('Error processing voice conversation:', error);
    
    // Fallback to OpenAI GPT-4o for quick responses
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a sports intelligence assistant helping with RFP analysis and sports entity research. 
            Be concise and helpful. Focus on sports business intelligence, club information, and opportunity analysis.`
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || 'I apologize, but I could not process your request.';
    } catch (fallbackError) {
      console.error('Error with fallback GPT-4o:', fallbackError);
      return 'I apologize, but I encountered an error processing your request. Please try again.';
    }
  }
}

/**
 * Store conversation turn in Supabase
 */
export async function storeConversationTurn(
  turn: Omit<VoiceConversationTurn, 'id'>
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('voice_conversations')
      .insert([{
        ...turn,
        timestamp: new Date().toISOString(),
      }])
      .select('id')
      .single();

    if (error) {
      console.error('Error storing conversation turn:', error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Error storing conversation turn:', error);
    throw error;
  }
}

/**
 * Create or update voice session
 */
export async function upsertVoiceSession(
  session: Partial<VoiceSession>
): Promise<VoiceSession> {
  try {
    const { data, error } = await supabase
      .from('voice_sessions')
      .upsert([{
        ...session,
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error upserting voice session:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error upserting voice session:', error);
    throw error;
  }
}

/**
 * Get voice session with conversation history
 */
export async function getVoiceSession(sessionId: string): Promise<VoiceSession | null> {
  try {
    const { data: session, error: sessionError } = await supabase
      .from('voice_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Error fetching voice session:', sessionError);
      return null;
    }

    const { data: turns, error: turnsError } = await supabase
      .from('voice_conversations')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (turnsError) {
      console.error('Error fetching conversation turns:', turnsError);
      return null;
    }

    return {
      ...session,
      turns,
    };
  } catch (error) {
    console.error('Error getting voice session:', error);
    return null;
  }
}

/**
 * End voice session
 */
export async function endVoiceSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('voice_sessions')
      .update({
        status: 'ended',
        end_time: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error ending voice session:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error ending voice session:', error);
    return false;
  }
}

/**
 * Get user's voice session history
 */
export async function getUserVoiceSessions(
  userId: string,
  limit: number = 10
): Promise<VoiceSession[]> {
  try {
    const { data, error } = await supabase
      .from('voice_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user voice sessions:', error);
      return [];
    }

    return data;
  } catch (error) {
    console.error('Error getting user voice sessions:', error);
    return [];
  }
}

export default {
  speechToText,
  textToSpeech,
  processVoiceConversation,
  storeConversationTurn,
  upsertVoiceSession,
  getVoiceSession,
  endVoiceSession,
  getUserVoiceSessions,
};