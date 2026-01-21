import { RoomServiceClient, EgressClient } from 'livekit-server-sdk';

const LIVEKIT_HOST = process.env.LIVEKIT_HTTP_URL || 'https://yellow-panther-8i644ma6.livekit.cloud';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'APIioqpEJhEjDsE';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'fVwfolJI9WfAfgDjEJ1MFz5Uh31yyNvK465kfWaPtl3D';

// Initialize LiveKit clients
export const roomService = new RoomServiceClient(
  LIVEKIT_HOST,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

export const egressClient = new EgressClient(
  LIVEKIT_HOST,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

// Room configuration for Sports Intelligence
export const VOICE_ROOM_CONFIG = {
  name: 'sports-intelligence-voice',
  emptyTimeout: 10 * 60, // 10 minutes
  maxParticipants: 50,
  recordPath: '/tmp/recordings',
  enableTranscription: true,
};

// Generate room access token
export function generateAccessToken(
  roomName: string,
  participantName: string,
  isAgent: boolean = false
) {
  const AccessToken = require('livekit-server-sdk').AccessToken;
  
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantName,
    name: participantName,
    metadata: JSON.stringify({
      isAgent,
      participantName,
      timestamp: new Date().toISOString(),
    }),
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    roomList: false,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    canUpdateOwnMetadata: true,
    // Agent gets additional permissions
    canPublishSources: isAgent,
    roomAdmin: isAgent,
  });

  return at.toJwt();
}

// Create a new voice room
export async function createVoiceRoom(
  roomName: string,
  userId: string,
  sessionId?: string
) {
  try {
    const options = {
      name: roomName,
      emptyTimeout: VOICE_ROOM_CONFIG.emptyTimeout,
      maxParticipants: VOICE_ROOM_CONFIG.maxParticipants,
      metadata: JSON.stringify({
        type: 'sports-intelligence-voice',
        userId,
        sessionId: sessionId || `session_${Date.now()}`,
        createdAt: new Date().toISOString(),
      }),
    };

    const room = await roomService.createRoom(options);
    
    // Generate token for the user
    const userToken = generateAccessToken(roomName, `user_${userId}`);
    
    // Generate token for the AI agent
    const agentToken = generateAccessToken(roomName, 'claude-agent', true);

    return {
      room,
      userToken,
      agentToken,
      roomUrl: LIVEKIT_HOST.replace('http', 'ws'),
    };
  } catch (error) {
    console.error('Error creating voice room:', error);
    throw error;
  }
}

// List active voice rooms
export async function listVoiceRooms() {
  try {
    const rooms = await roomService.listRooms();
    return rooms.filter(room => {
      const metadata = JSON.parse(room.metadata || '{}');
      return metadata.type === 'sports-intelligence-voice';
    });
  } catch (error) {
    console.error('Error listing voice rooms:', error);
    throw error;
  }
}

// Delete a voice room
export async function deleteVoiceRoom(roomName: string) {
  try {
    await roomService.deleteRoom(roomName);
    return true;
  } catch (error) {
    console.error('Error deleting voice room:', error);
    throw error;
  }
}

// Start recording a room
export async function startRoomRecording(roomName: string, outputPath?: string) {
  try {
    const recordRequest = {
      roomName,
      outputPath: outputPath || `/tmp/recordings/${roomName}_${Date.now()}.mp4`,
      layout: 'speaker-light',
      customBaseUrl: LIVEKIT_HOST,
    };

    const egressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      recordRequest
    );

    return egressInfo;
  } catch (error) {
    console.error('Error starting room recording:', error);
    throw error;
  }
}

export default {
  roomService,
  egressClient,
  createVoiceRoom,
  listVoiceRooms,
  deleteVoiceRoom,
  startRoomRecording,
  generateAccessToken,
  VOICE_ROOM_CONFIG,
};