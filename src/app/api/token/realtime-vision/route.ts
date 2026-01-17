import { AccessToken, RoomServiceClient, AgentDispatchClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Token endpoint for Python Realtime Vision Agent
 * This dispatches to the Python agent with video_input=True capability
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const roomName = body.room_name ?? `vision-${Math.random().toString(36).substring(7)}`;
    const participantIdentity = body.participant_identity ?? `user-${Math.random().toString(36).substring(7)}`;
    const participantName = body.participant_name ?? 'User';

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: 'LiveKit credentials not configured' },
        { status: 500 }
      );
    }

    // Convert wss:// to https:// for API calls
    const httpUrl = wsUrl.replace('wss://', 'https://');

    // Create room first
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    try {
      await roomService.createRoom({ name: roomName });
      console.log('Realtime vision room created:', roomName);
    } catch (err: unknown) {
      console.log('Room creation note:', err instanceof Error ? err.message : 'Room may already exist');
    }

    // Dispatch the Python realtime vision agent
    const agentDispatch = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
    try {
      await agentDispatch.createDispatch(roomName, 'realtime-vision-agent');
      console.log('Python realtime vision agent dispatched to room:', roomName);
    } catch (err: unknown) {
      console.error('Agent dispatch error:', err instanceof Error ? err.message : err);
    }

    // Create token for the user with video permissions
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl: '10m',
    });

    at.addGrant({
      roomJoin: true,
      roomCreate: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json(
      {
        server_url: wsUrl,
        participant_token: token,
        room_name: roomName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error generating realtime vision token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
