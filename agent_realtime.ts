import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  voice,
  llm,
  getJobContext,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import type { Track, VideoFrame, VideoFrameEvent } from '@livekit/rtc-node';
import { RoomEvent, TrackKind, VideoStream } from '@livekit/rtc-node';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables for main process (LIVEKIT_API_KEY, etc.)
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Function to read API key directly from .env.local file
function getOpenAIApiKey(): string | undefined {
  // First check if it's already in environment
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  // Read directly from file
  const envPath = path.resolve(__dirname, '.env.local');
  console.log('Reading API key from:', envPath);
  
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Handle both "KEY=value" and "export KEY=value" formats
      const normalized = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed;
      
      if (normalized.startsWith('OPENAI_API_KEY=')) {
        let value = normalized.slice('OPENAI_API_KEY='.length).trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        console.log('Found OPENAI_API_KEY in file, length:', value.length);
        return value;
      }
    }
  } catch (err) {
    console.error('Failed to read .env.local:', err);
  }

  return undefined;
}

class RealtimeAssistant extends voice.Agent {
  private latestFrame: VideoFrame | null = null;
  private videoStream: VideoStream | null = null;
  private streamReader: ReadableStreamDefaultReader<VideoFrameEvent> | null = null;
  private isReading = false;

  constructor() {
    super({
      instructions: `You are a helpful voice and vision AI assistant with realtime capabilities.
        IMPORTANT: Always respond in English, regardless of what language the user speaks.
        You can see what the user is showing you through their camera.
        The user is interacting with you via voice and video.
        When the user asks about what you see, describe the visual content in detail.
        Proactively mention interesting things you notice in your view.
        Your responses are concise, natural, and conversational.
        You are curious, friendly, and observant.
        Always speak in English.`,
    });
  }

  async onEnter(): Promise<void> {
    const room = getJobContext().room;

    // Find the first video track (if any) from remote participants
    const remoteParticipants = Array.from(room.remoteParticipants.values());

    if (remoteParticipants.length > 0) {
      const remoteParticipant = remoteParticipants[0]!;
      const videoTracks = Array.from(remoteParticipant.trackPublications.values())
        .filter((pub) => pub.track?.kind === TrackKind.KIND_VIDEO)
        .map((pub) => pub.track!)
        .filter((track) => track !== undefined);

      if (videoTracks.length > 0) {
        console.log('Found existing video track, creating stream');
        this.createVideoStream(videoTracks[0]!);
      }
    }

    // Watch for new video tracks
    room.on(RoomEvent.TrackSubscribed, (track: Track) => {
      if (track.kind === TrackKind.KIND_VIDEO) {
        console.log('New video track subscribed, creating stream');
        this.createVideoStream(track);
      }
    });
  }

  async onUserTurnCompleted(chatCtx: llm.ChatContext, newMessage: llm.ChatMessage): Promise<void> {
    // Add the latest video frame to provide visual context
    if (this.latestFrame !== null) {
      console.log('Adding video frame to conversation context');
      newMessage.content.push(
        llm.createImageContent({
          image: this.latestFrame,
          inferenceDetail: 'auto',
        }),
      );
      this.latestFrame = null;
    }
  }

  private createVideoStream(track: Track): void {
    // Close any existing stream
    if (this.streamReader !== null) {
      this.streamReader.cancel();
      this.streamReader = null;
    }

    this.videoStream = new VideoStream(track);
    this.streamReader = this.videoStream.getReader();
    this.isReading = true;

    // Start reading frames in the background
    this.readFrames();
  }

  private async readFrames(): Promise<void> {
    if (!this.streamReader) return;

    try {
      while (this.isReading) {
        const { done, value } = await this.streamReader.read();
        if (done) break;
        if (value) {
          this.latestFrame = value.frame;
        }
      }
    } catch (err) {
      console.error('Error reading video frames:', err);
    }
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    // Load and cache the API key during prewarm
    const apiKey = getOpenAIApiKey();
    proc.userData.openaiApiKey = apiKey;
    console.log('Prewarm: OPENAI_API_KEY loaded:', !!apiKey);
  },
  entry: async (ctx: JobContext) => {
    console.log('Realtime agent entry called, room:', ctx.room.name);
    
    try {
      // Connect to the room first
      console.log('Connecting to room...');
      await ctx.connect();
      console.log('Connected to room successfully');

      // Get API key from prewarm cache or read it directly
      console.log('Creating AgentSession with OpenAI Realtime model...');
      const apiKey = (ctx.proc.userData.openaiApiKey as string) || getOpenAIApiKey();
      
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set - please add it to .env.local');
      }
      console.log('API key found, length:', apiKey.length);
      
      const session = new voice.AgentSession({
        llm: new openai.realtime.RealtimeModel({
          voice: 'coral',
          model: 'gpt-4o-realtime-preview',
          apiKey: apiKey,
        }),
      });

      console.log('Starting session...');
      await session.start({
        agent: new RealtimeAssistant(),
        room: ctx.room,
        inputOptions: {
          noiseCancellation: BackgroundVoiceCancellation(),
        },
      });
      console.log('Session started successfully');

      console.log('Generating initial greeting...');
      const handle = session.generateReply({
        instructions: 'Greet the user warmly IN ENGLISH. Mention that you can see them through their camera and are ready to help. Ask how you can assist them today. Speak only in English.',
      });
      await handle.waitForPlayout();
      console.log('Initial greeting completed');
    } catch (error) {
      console.error('Error in realtime agent entry:', error);
      throw error;
    }
  },
});

cli.runApp(new ServerOptions({ 
  agent: fileURLToPath(import.meta.url),
  agentName: 'realtime-agent',
}));
