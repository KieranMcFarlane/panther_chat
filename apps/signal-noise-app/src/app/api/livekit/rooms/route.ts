import { NextRequest, NextResponse } from 'next/server';
import { createVoiceRoom, listVoiceRooms, deleteVoiceRoom } from '@/lib/livekit-server';

// Create a new voice room
export async function POST(request: NextRequest) {
  try {
    const { roomName, userId, sessionId } = await request.json();

    if (!roomName || !userId) {
      return NextResponse.json(
        { error: 'Room name and user ID are required' },
        { status: 400 }
      );
    }

    const voiceRoom = await createVoiceRoom(roomName, userId, sessionId);

    return NextResponse.json({
      success: true,
      room: voiceRoom,
    });
  } catch (error) {
    console.error('Error creating voice room:', error);
    return NextResponse.json(
      { error: 'Failed to create voice room', details: error.message },
      { status: 500 }
    );
  }
}

// List active voice rooms
export async function GET() {
  try {
    const rooms = await listVoiceRooms();

    return NextResponse.json({
      success: true,
      rooms,
    });
  } catch (error) {
    console.error('Error listing voice rooms:', error);
    return NextResponse.json(
      { error: 'Failed to list voice rooms', details: error.message },
      { status: 500 }
    );
  }
}

// Delete a voice room
export async function DELETE(request: NextRequest) {
  try {
    const { roomName } = await request.json();

    if (!roomName) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    await deleteVoiceRoom(roomName);

    return NextResponse.json({
      success: true,
      message: `Room ${roomName} deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting voice room:', error);
    return NextResponse.json(
      { error: 'Failed to delete voice room', details: error.message },
      { status: 500 }
    );
  }
}