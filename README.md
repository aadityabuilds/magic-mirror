# Magic Mirror - Voice & Vision AI Assistant

A Next.js frontend with LiveKit-powered Python AI agents for voice and vision interaction.

## Features

- **Voice Assistant**: STT-LLM-TTS pipeline using OpenAI GPT-4.1-mini
- **Vision Assistant**: Gemini Live with real-time video input and vision capabilities
- **MCP Integration**: Optional Model Context Protocol server support for additional tools

## Setup

### 1. Frontend (Next.js)

```bash
npm install
npm run dev
```

### 2. Python Agents

Install dependencies:
```bash
uv pip install -r requirements.txt
```

Download model files (first time only):
```bash
uv run agent_voice.py download-files
uv run agent_realtime_vision.py download-files
```

Run agents:
```bash
# Voice assistant (STT-LLM-TTS)
uv run agent_voice.py dev

# Vision assistant (Gemini Live with camera)
uv run agent_realtime_vision.py dev
```

### 3. Environment Variables

Create `.env.local` with:

```bash
# LiveKit Configuration
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud

# AI Model APIs
OPENAI_API_KEY=your_openai_key_here
GOOGLE_API_KEY=your_google_gemini_key_here

# MCP Server (Optional - for additional tools)
MCP_SERVER_URL=https://your-mcp-server.com/mcp
```

## Usage

1. Start the Next.js frontend
2. Choose between "Voice Only" or "Vision + Voice" modes
3. The agents will automatically connect and respond to your voice/commands

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
