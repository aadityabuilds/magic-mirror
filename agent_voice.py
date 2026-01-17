"""
Voice Agent (STT-LLM-TTS Pipeline) - Python Implementation

This agent uses a traditional voice pipeline with:
- Speech-to-Text (AssemblyAI)
- LLM (OpenAI GPT-4.1-mini)
- Text-to-Speech (Cartesia)

Run with: uv run agent_voice.py dev
"""

import os
from dotenv import load_dotenv

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, mcp
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv(".env.local")

# =============================================================================
# MCP SERVER CONFIGURATION
# Set MCP_SERVER_URL in .env.local to enable tools from that server
# Example: MCP_SERVER_URL=https://your-mcp-server.com/mcp
# =============================================================================
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "")  # Load from environment


class VoiceAssistant(Agent):
    """A helpful voice AI assistant using the STT-LLM-TTS pipeline."""
    
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice AI assistant.
            IMPORTANT: Always respond in English.
            You eagerly assist users with their questions by providing information from your extensive knowledge.
            Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asterisks, or other symbols.
            You are curious, friendly, and have a sense of humor.
            Always speak in English regardless of what language the user uses.""",
        )


server = AgentServer()


@server.rtc_session(agent_name="voice-agent-py")
async def voice_agent(ctx: agents.JobContext):
    """Entry point for the voice agent session."""
    
    # Configure MCP servers if URL is provided
    mcp_servers = []
    if MCP_SERVER_URL:
        mcp_servers.append(mcp.MCPServerHTTP(MCP_SERVER_URL))
    
    session = AgentSession(
        mcp_servers=mcp_servers if mcp_servers else None,
        # Speech-to-Text: AssemblyAI Universal Streaming
        stt="assemblyai/universal-streaming:en",
        # LLM: OpenAI GPT-4.1-mini via LiveKit Inference
        llm="openai/gpt-4.1-mini",
        # Text-to-Speech: Cartesia Sonic-3
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        # Voice Activity Detection: Silero
        vad=silero.VAD.load(),
        # Turn Detection: Multilingual model for natural conversation flow
        turn_detection=MultilingualModel(),
        # Enable TTS-aligned transcription for word-level sync (Cartesia supports this)
        use_tts_aligned_transcript=True,
    )

    await session.start(
        room=ctx.room,
        agent=VoiceAssistant(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                # Enhanced noise cancellation
                # Use BVCTelephony for telephony applications
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony() 
                    if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP 
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    # Generate initial greeting
    await session.generate_reply(
        instructions="Greet the user warmly in English and offer your assistance."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
