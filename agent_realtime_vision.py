"""
Realtime Vision Agent - Python Implementation using Gemini Live with EXA Search

This agent uses Google's Gemini Live API with live video input AND web search capabilities.
The video_input=True option enables automatic frame sampling from the user's camera.
EXA integration adds web search functionality for real-time information retrieval.

NOTE: OpenAI Realtime does NOT support image/video input.
      Gemini Live is the only realtime model that supports video_input=True.

Features:
- Gemini Live API for low-latency speech-to-speech with VISION
- Live video input with automatic frame sampling
- True vision capabilities to see and describe what the user shows
- EXA web search integration for real-time information retrieval

Run with: uv run agent_realtime_vision.py dev

Required: Set GOOGLE_API_KEY and EXA_API_KEY in your .env.local file
"""

import os
from dotenv import load_dotenv

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, mcp, function_tool, RunContext
from livekit.plugins import google, noise_cancellation

# Import EXA
from exa_py import Exa

load_dotenv(".env.local")

# =============================================================================
# MCP SERVER CONFIGURATION
# Set MCP_SERVER_URL in .env.local to enable tools from that server
# Example: MCP_SERVER_URL=https://your-mcp-server.com/mcp
# =============================================================================
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "")  # Load from environment

# =============================================================================
# EXA SEARCH CONFIGURATION
# =============================================================================
EXA_API_KEY = os.getenv("EXA_API_KEY", "")
print(f"EXA API Key loaded: {'Yes' if EXA_API_KEY else 'No'}")  # Debug logging

# Test EXA connection if key is available
if EXA_API_KEY:
    try:
        test_exa = Exa(api_key=EXA_API_KEY)
        # Simple test search to verify API works
        test_response = test_exa.search("test", num_results=1)
        print(f"✅ EXA API test successful - found {len(test_response.results)} test results")
    except Exception as e:
        error_str = str(e)
        if "402" in error_str or "credits" in error_str.lower():
            print(f"⚠️  EXA API has insufficient credits. Visit dashboard.exa.ai to add credits.")
        elif "401" in error_str or "unauthorized" in error_str.lower():
            print(f"❌ EXA API key is invalid. Check your EXA_API_KEY in .env.local")
        else:
            print(f"❌ EXA API test failed: {error_str}")
else:
    print("⚠️  No EXA API key - search functionality disabled")


class RealtimeVisionAssistant(Agent):
    """A realtime voice and vision AI assistant using Google's Gemini Live API with EXA search."""

    def __init__(self) -> None:
        print(f"🤖 Initializing RealtimeVisionAssistant with EXA search: {'enabled' if EXA_API_KEY else 'disabled'}")

        super().__init__(
            instructions="""You are a helpful voice and vision AI assistant with realtime capabilities and web search.
            IMPORTANT: Always respond in English.

            You can see what the user is showing you through their camera in real-time.
            When the user asks about what you see, describe the visual content in detail.
            Be proactive about mentioning interesting things you notice in your view.

            You have access to web search via EXA. Use the exa_web_search tool when:
            - Users ask for current information, news, or recent events
            - Users need factual data that might have changed recently
            - Users ask about topics you don't have built-in knowledge about
            - Users request research or detailed explanations

            When using search, be concise but informative. Summarize key findings and provide sources when relevant.

            Your responses are concise, natural, and conversational.
            You are curious, friendly, and observant.
            Always speak in English regardless of what language the user uses.""",
            # Use Gemini Live model - the ONLY realtime model that supports video input
            llm=google.realtime.RealtimeModel(
                voice="Puck",
                temperature=0.8,
                # Enable transcription of agent's audio output for live captions
                output_audio_transcription={},
                # Enable transcription of user's audio input (may have slight delay)
                input_audio_transcription={},
            ),
        )

        print("✅ Agent initialized successfully")

    @function_tool()
    async def exa_web_search(self, context: RunContext, query: str):
        """Search the web using EXA for real-time information and current events."""
        print(f"🔍 EXA Search called with query: '{query}'")  # Debug logging

        try:
            if not EXA_API_KEY:
                print("❌ No EXA API key found")
                return {
                    "error": "EXA API key not configured",
                    "query": query
                }

            exa = Exa(api_key=EXA_API_KEY)
            print(f"🔗 Calling EXA API for: '{query}'")

            # Use search_and_contents for comprehensive results
            response = exa.search_and_contents(
                query=query,
                num_results=5,  # Limit results for voice responses
                type="auto",    # Let EXA determine search type
                text={"max_characters": 1500}  # Reasonable limit for voice
            )

            print(f"✅ EXA returned {len(response.results)} results")

            # Format results for voice response
            results = []
            for i, result in enumerate(response.results):
                try:
                    # EXA results have these attributes: url, title, text
                    # Access them directly as attributes
                    title = result.title if hasattr(result, 'title') else 'Untitled'
                    url = result.url if hasattr(result, 'url') else ''
                    text = result.text if hasattr(result, 'text') else ''

                    # Clean up the text
                    if text and len(text) > 300:
                        text = text[:300] + "..."

                    results.append({
                        "title": title,
                        "url": url,
                        "snippet": text
                    })
                except Exception as parse_error:
                    print(f"❌ Error parsing result {i+1}: {str(parse_error)}")
                    # Add a fallback result
                    results.append({
                        "title": f"Search Result {i+1}",
                        "url": "",
                        "snippet": "Found relevant information but unable to parse details"
                    })

            print(f"📝 Formatted {len(results)} results for response")
            return {
                "query": query,
                "results": results,
                "summary": f"Found {len(results)} relevant results for '{query}'"
            }

        except Exception as e:
            error_msg = str(e)
            print(f"❌ EXA Search error: {error_msg}")

            # Check for common error types
            if "402" in error_msg or "credits" in error_msg.lower():
                return {
                    "error": "EXA search is temporarily unavailable due to account credits. Please check your EXA dashboard at dashboard.exa.ai",
                    "query": query
                }
            elif "401" in error_msg or "unauthorized" in error_msg.lower():
                return {
                    "error": "EXA API key is invalid. Please check your EXA_API_KEY in .env.local",
                    "query": query
                }
            else:
                return {
                    "error": f"Search failed: {error_msg}",
                    "query": query
                }


server = AgentServer()


@server.rtc_session(agent_name="realtime-vision-agent")
async def realtime_vision_agent(ctx: agents.JobContext):
    """Entry point for the realtime vision agent session."""
    print("🚀 Starting realtime vision agent session")

    # Configure MCP servers if URL is provided
    mcp_servers = []
    if MCP_SERVER_URL:
        mcp_servers.append(mcp.MCPServerHTTP(MCP_SERVER_URL))

    session = AgentSession(
        mcp_servers=mcp_servers if mcp_servers else None,
    )

    print("📝 Agent session created, starting...")

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

    # Generate initial greeting mentioning vision and search capabilities
    search_capability = " and I can search the web for current information" if EXA_API_KEY else ""
    await session.generate_reply(
        instructions=f"""Greet the user warmly IN ENGLISH.
        Mention that you can see them through their camera{search_capability} and are ready to help with anything they want to show you or discuss.
        Ask how you can assist them today. Speak only in English."""
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
