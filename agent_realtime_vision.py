"""
Realtime Vision Agent - Python Implementation using Gemini Live

This agent uses Google's Gemini Live API with live video input.
The video_input=True option enables automatic frame sampling from the user's camera.

NOTE: OpenAI Realtime does NOT support image/video input.
      Gemini Live is the only realtime model that supports video_input=True.

Features:
- Gemini Live API for low-latency speech-to-speech with VISION
- Live video input with automatic frame sampling
- True vision capabilities to see and describe what the user shows

Run with: uv run agent_realtime_vision.py dev

Required: Set GOOGLE_API_KEY in your .env.local file
"""

import os
from dotenv import load_dotenv

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, mcp
from livekit.plugins import google, noise_cancellation

load_dotenv(".env.local")

# =============================================================================
# MCP SERVER CONFIGURATION
# Set MCP_SERVER_URL in .env.local to enable tools from that server
# Example: MCP_SERVER_URL=https://your-mcp-server.com/mcp
# =============================================================================
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "")  # Load from environment


class RealtimeVisionAssistant(Agent):
    """A realtime voice and vision AI assistant using Google's Gemini Live API."""
    
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice and vision AI assistant with realtime capabilities.
            IMPORTANT: Always respond in English.
            
            You can see what the user is showing you through their camera in real-time.
            When the user asks about what you see, describe the visual content in detail.
            Be proactive about mentioning interesting things you notice in your view.
            
            Your responses are concise, natural, and conversational.
            You are curious, friendly, and observant.
            Always speak in English regardless of what language the user uses.""",
            # Use Gemini Live model - the ONLY realtime model that supports video input
            llm=google.realtime.RealtimeModel(
                voice="Puck",
                temperature=0.8,
            ),
        )


server = AgentServer()


@server.rtc_session(agent_name="realtime-vision-agent")
async def realtime_vision_agent(ctx: agents.JobContext):
    """Entry point for the realtime vision agent session."""
    
    # Configure MCP servers if URL is provided
    mcp_servers = []
    if MCP_SERVER_URL:
        mcp_servers.append(mcp.MCPServerHTTP(MCP_SERVER_URL))
    
    session = AgentSession(
        mcp_servers=mcp_servers if mcp_servers else None,
    )

    await session.start(
        room=ctx.room,
        agent=RealtimeVisionAssistant(),
        room_options=room_io.RoomOptions(
            # Enable live video input - this is the key feature!
            # The agent automatically samples frames from the user's camera
            # Default: 1 frame/sec while speaking, 1 frame/3sec otherwise
            video_input=True,
            audio_input=room_io.AudioInputOptions(
                # Enhanced noise cancellation
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony() 
                    if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP 
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    # Generate initial greeting mentioning vision capabilities
    await session.generate_reply(
        instructions="""Greet the user warmly IN ENGLISH. 
        Mention that you can see them through their camera and are ready to help with anything they want to show you or discuss.
        Ask how you can assist them today. Speak only in English."""
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
