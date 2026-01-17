import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const roomName = body.room_name ?? `room-${Math.random().toString(36).substring(7)}`;
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

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl: '10m',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Set room configuration to auto-create room and dispatch agent
    at.roomConfig = {
      agents: [
        {
          agentName: 'voice-agent',
        },
      ],
    };

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
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
