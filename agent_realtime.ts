import {
    type JobContext,
    WorkerOptions,
    cli,
    defineAgent,
    voice,
  } from '@livekit/agents';
  import * as openai from '@livekit/agents-plugin-openai';
  import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
  import { fileURLToPath } from 'node:url';
  import dotenv from 'dotenv';
  
  dotenv.config({ path: '.env.local' });
  
  class Assistant extends voice.Agent {
    constructor() {
      super({
        instructions: 'You are a helpful voice AI assistant.',
      });
    }
  }
  
  export default defineAgent({
    entry: async (ctx: JobContext) => {
      const session = new voice.AgentSession({
        llm: new openai.realtime.RealtimeModel({
          voice: 'coral',
        }),
      });
  
      await session.start({
        agent: new Assistant(),
        room: ctx.room,
        inputOptions: {
          // For telephony applications, use `TelephonyBackgroundVoiceCancellation` for best results
          noiseCancellation: BackgroundVoiceCancellation(),
        },
      });
  
      await ctx.connect();
  
      const handle = session.generateReply({
        instructions: 'Greet the user and offer your assistance. You should start by speaking in English.',
      });
      await handle.waitForPlayout();
    },
  });
  
  cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));