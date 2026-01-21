import { NextRequest, NextResponse } from 'next/server';
import {
  speechToText,
  textToSpeech,
  processVoiceConversation,
  storeConversationTurn,
  upsertVoiceSession,
} from '@/lib/voice-conversation-pipeline';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const sessionId = formData.get('sessionId') as string;
    const userId = formData.get('userId') as string;
    const roomName = formData.get('roomName') as string;

    if (!audioFile || !sessionId || !userId || !roomName) {
      return NextResponse.json(
        { error: 'Audio file, session ID, user ID, and room name are required' },
        { status: 400 }
      );
    }

    // Convert audio to buffer
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    // 1. Convert speech to text
    const transcript = await speechToText(audioBuffer);

    // 2. Process conversation through Claude Agent
    const claudeResponse = await processVoiceConversation(transcript, sessionId, userId);

    // 3. Convert Claude response to speech
    const responseAudioBuffer = await textToSpeech(claudeResponse);

    // 4. Store user's conversation turn
    await storeConversationTurn({
      sessionId,
      userId,
      roomName,
      transcript,
      speaker: 'user',
      timestamp: new Date(),
    });

    // 5. Store assistant's conversation turn
    await storeConversationTurn({
      sessionId,
      userId,
      roomName,
      transcript: claudeResponse,
      speaker: 'assistant',
      timestamp: new Date(),
      claudeResponse,
    });

    // 6. Update session activity
    await upsertVoiceSession({
      id: sessionId,
      status: 'active',
    });

    // 7. Return audio response
    return new NextResponse(responseAudioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': responseAudioBuffer.length.toString(),
        'X-Transcript': encodeURIComponent(transcript),
        'X-Response': encodeURIComponent(claudeResponse),
      },
    });
  } catch (error) {
    console.error('Error processing voice conversation:', error);
    return NextResponse.json(
      { error: 'Failed to process voice conversation', details: error.message },
      { status: 500 }
    );
  }
}

// Get conversation history for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const { getVoiceSession } = await import('@/lib/voice-conversation-pipeline');
    const session = await getVoiceSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return NextResponse.json(
      { error: 'Failed to get conversation history', details: error.message },
      { status: 500 }
    );
  }
}