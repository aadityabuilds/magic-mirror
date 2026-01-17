"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { ShaderBlurOverlay } from "@/components/shader-blur-overlay";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Mic, Eye, AudioLines } from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  VideoTrack,
  useTracks,
} from "@livekit/components-react";
import { Track, RoomEvent, TranscriptionSegment, Participant } from "livekit-client";
import "@livekit/components-styles";
import { usePorcupine } from "@picovoice/porcupine-react";
import SiriOrb from "@/components/smoothui/siri-orb";

// Porcupine Access Key - set in .env.local as NEXT_PUBLIC_PICOVOICE_ACCESS_KEY
const PICOVOICE_ACCESS_KEY = process.env.NEXT_PUBLIC_PICOVOICE_ACCESS_KEY || "";

// Custom wake word - "Hey Mirror"
const WAKE_WORD = {
  publicPath: "/Hey-mirror_en_wasm_v4_0_0.ppn",
  label: "Hey Mirror"
};

function MediaPublisher({
  enableVideo
}: {
  enableVideo?: boolean;
}) {
  const room = useRoomContext();

  useEffect(() => {
    console.log("MediaPublisher mounted, room state:", room.state, "enableVideo:", enableVideo);

    const enableMedia = async () => {
      try {
        console.log("Requesting microphone access...");
        await room.localParticipant.setMicrophoneEnabled(true);
        console.log("Microphone enabled successfully");

        if (enableVideo) {
          console.log("Requesting camera access...");
          await room.localParticipant.setCameraEnabled(true);
          console.log("Camera enabled successfully");
        }
      } catch (err) {
        console.error("Failed to enable media:", err);
      }
    };

    if (room.state === "connected") {
      enableMedia();
    }

    const handleConnected = () => {
      console.log("Room connected!");
      enableMedia();
    };

    const handleDisconnected = () => {
      console.log("Room disconnected");
    };

    const handleParticipantConnected = (participant: unknown) => {
      const p = participant as { identity: string };
      console.log("Participant connected:", p.identity);
    };

    room.on("connected", handleConnected);
    room.on("disconnected", handleDisconnected);
    room.on("participantConnected", handleParticipantConnected);

    return () => {
      room.off("connected", handleConnected);
      room.off("disconnected", handleDisconnected);
      room.off("participantConnected", handleParticipantConnected);
    };
  }, [room, enableVideo]);

  return null;
}

function LocalVideoPreview() {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const localVideoTrack = tracks.find(
    (track) => track.participant.isLocal && track.source === Track.Source.Camera
  );

  if (!localVideoTrack) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed bottom-6 right-6 w-48 h-36 md:w-64 md:h-48 rounded-2xl overflow-hidden shadow-2xl border border-white/20 z-50"
    >
      <VideoTrack
        trackRef={localVideoTrack}
        className="w-full h-full object-cover mirror"
      />
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded-full text-xs text-white/80">
        You
      </div>
    </motion.div>
  );
}

interface TranscriptEntry {
  id: string;
  text: string;
  isFinal: boolean;
  isAgent: boolean;
  timestamp: number;
}

function TranscriptDisplay() {
  const room = useRoomContext();
  const [currentText, setCurrentText] = useState<string>("");
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(false);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant
    ) => {
      for (const segment of segments) {
        const identity = participant?.identity || "unknown";
        const isAgent = identity.includes("agent") || !participant?.isLocal;
        
        // Only show agent transcripts
        if (!isAgent) continue;
        
        // Update the current text
        setCurrentText(segment.text);
        setIsActive(true);
        
        // Clear any existing fade timeout
        if (fadeTimeoutRef.current) {
          clearTimeout(fadeTimeoutRef.current);
        }
        
        // If this is a final segment, start fade out after a delay
        if (segment.final) {
          fadeTimeoutRef.current = setTimeout(() => {
            setIsActive(false);
            // Clear text after fade animation
            setTimeout(() => {
              setCurrentText("");
              setDisplayedWords([]);
            }, 500);
          }, 2000);
        }
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);

    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [room]);

  // Update displayed words when current text changes
  useEffect(() => {
    if (currentText) {
      const words = currentText.split(/\s+/).filter(w => w.length > 0);
      setDisplayedWords(words);
    }
  }, [currentText]);

  if (!currentText || displayedWords.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed top-[58%] left-1/2 -translate-x-1/2 w-full max-w-2xl mx-auto text-center px-6 z-50 pointer-events-none"
    >
      <p className="text-xl md:text-2xl font-light leading-relaxed tracking-wide">
        {displayedWords.map((word, index) => {
          const isLastWord = index === displayedWords.length - 1;
          const opacity = isLastWord ? 1 : 0.5;

          return (
            <motion.span
              key={`${index}-${word}`}
              initial={{ opacity: 0 }}
              animate={{ opacity }}
              transition={{
                duration: 0.15,
                ease: "easeOut"
              }}
              className="inline-block mr-[0.3em]"
              style={{
                color: isLastWord ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
              }}
            >
              {word}
            </motion.span>
          );
        })}
      </p>
    </motion.div>
  );
}

// Agent Audio Orb - reacts to agent's voice
function AgentAudioOrb() {
  const room = useRoomContext();
  const [agentAudioStream, setAgentAudioStream] = useState<MediaStream | null>(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Get remote audio tracks (agent's audio)
  const audioTracks = useTracks([Track.Source.Microphone], { onlySubscribed: true });
  const remoteAudioTrack = audioTracks.find(
    (track) => !track.participant.isLocal && track.publication?.track
  );

  // Create MediaStream from agent's audio track
  useEffect(() => {
    if (remoteAudioTrack?.publication?.track) {
      const track = remoteAudioTrack.publication.track;
      const mediaStreamTrack = track.mediaStreamTrack;
      
      if (mediaStreamTrack) {
        const stream = new MediaStream([mediaStreamTrack]);
        setAgentAudioStream(stream);
        setIsAgentSpeaking(true);
        console.log("Agent audio stream created");
      }
    } else {
      setAgentAudioStream(null);
      setIsAgentSpeaking(false);
    }
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [remoteAudioTrack]);

  // Listen for track mute/unmute events to detect when agent is speaking
  useEffect(() => {
    if (!room) return;

    const handleTrackMuted = () => {
      setIsAgentSpeaking(false);
    };

    const handleTrackUnmuted = () => {
      if (remoteAudioTrack) {
        setIsAgentSpeaking(true);
      }
    };

    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);

    return () => {
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
    };
  }, [room, remoteAudioTrack]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
    >
      <SiriOrb
        size="180px"
        audioStream={agentAudioStream}
        isListening={isAgentSpeaking}
        sensitivity={0.9}
        minScale={1}
        maxScale={1.3}
        smoothing={0.92}
        colors={{
          bg: "oklch(10% 0.02 264.695)",
          c1: "oklch(70% 0.25 200)", // Cyan
          c2: "oklch(75% 0.20 280)", // Purple
          c3: "oklch(72% 0.22 180)", // Teal
        }}
      />
    </motion.div>
  );
}

interface TokenResponse {
  server_url: string;
  participant_token: string;
  room_name: string;
}

type ConnectionMode = "voice" | "vision";

export function HomeClient() {
  const [isBlurActive, setIsBlurActive] = useQueryState(
    "blur",
    parseAsBoolean.withDefault(false)
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  
  // Porcupine wake word detection
  const {
    keywordDetection,
    isLoaded: isPorcupineLoaded,
    isListening: isPorcupineListening,
    error: porcupineError,
    init: initPorcupine,
    start: startPorcupine,
    stop: stopPorcupine,
    release: releasePorcupine,
  } = usePorcupine();
  
  const porcupineInitializedRef = useRef(false);
  const connectingAfterWakeWordRef = useRef(false);

  const connectToAgent = useCallback(async (mode: ConnectionMode) => {
    setIsConnecting(true);
    setConnectionMode(mode);
    setError(null);

    const endpoints: Record<ConnectionMode, string> = {
      voice: "/api/token",
      vision: "/api/token/realtime-vision",
    };
    const endpoint = endpoints[mode];

    try {
      console.log(`Fetching token from ${endpoint}...`);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get token");
      }

      const data: TokenResponse = await response.json();
      console.log("Token received, connecting to:", data.server_url);
      console.log("Room name:", data.room_name);

      setServerUrl(data.server_url);
      setToken(data.participant_token);
      setIsConnected(true);
      setIsBlurActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnectionMode(null);
      console.error("Connection error:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [setIsBlurActive]);

  // Initialize Porcupine on mount
  useEffect(() => {
    const setupPorcupine = async () => {
      if (porcupineInitializedRef.current || !PICOVOICE_ACCESS_KEY) {
        if (!PICOVOICE_ACCESS_KEY) {
          console.warn("Porcupine: No access key provided. Set NEXT_PUBLIC_PICOVOICE_ACCESS_KEY in .env.local");
        }
        return;
      }
      
      try {
        console.log("Initializing Porcupine wake word detection...");
        // Initialize with built-in keyword and local model file
        await initPorcupine(
          PICOVOICE_ACCESS_KEY,
          [WAKE_WORD],
          { publicPath: "/porcupine_params.pv", forceWrite: true }
        );
        porcupineInitializedRef.current = true;
        console.log("Porcupine initialized successfully");
      } catch (err) {
        console.error("Failed to initialize Porcupine:", err);
        setError(`Wake word init failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    
    setupPorcupine();
    
    return () => {
      if (porcupineInitializedRef.current) {
        releasePorcupine();
        porcupineInitializedRef.current = false;
      }
    };
  }, [initPorcupine, releasePorcupine]);

  // Start listening once Porcupine is loaded
  useEffect(() => {
    if (isPorcupineLoaded && !isPorcupineListening && !isConnected && !isConnecting) {
      startPorcupine();
    }
  }, [isPorcupineLoaded, isPorcupineListening, isConnected, isConnecting, startPorcupine]);

  // Handle wake word detection
  useEffect(() => {
    if (keywordDetection !== null && !connectingAfterWakeWordRef.current) {
      console.log(`Wake word "${keywordDetection.label}" detected!`);
      setWakeWordDetected(true);
      connectingAfterWakeWordRef.current = true;

      // Stop Porcupine and wait for mic to be released before connecting
      stopPorcupine();

      // Small delay to ensure microphone is fully released before LiveKit uses it
      setTimeout(() => {
        connectToAgent("vision");
      }, 300);
    }
  }, [keywordDetection, stopPorcupine, connectToAgent]);

  // Stop Porcupine when connecting/connected
  useEffect(() => {
    if ((isConnecting || isConnected) && isPorcupineListening) {
      stopPorcupine();
    }
  }, [isConnecting, isConnected, isPorcupineListening, stopPorcupine]);

  // Log Porcupine errors
  useEffect(() => {
    if (porcupineError) {
      console.error("Porcupine error:", porcupineError);
      setError(`Wake word error: ${porcupineError.message}`);
    }
  }, [porcupineError]);

  const handleDisconnect = useCallback(() => {
    setToken(null);
    setServerUrl(null);
    setIsConnected(false);
    setIsBlurActive(false);
    setConnectionMode(null);
    setWakeWordDetected(false);
    connectingAfterWakeWordRef.current = false;

    // Resume wake word listening after disconnect with delay to ensure mic is released
    setTimeout(() => {
      if (isPorcupineLoaded && !isPorcupineListening && PICOVOICE_ACCESS_KEY) {
        console.log("Resuming wake word detection...");
        startPorcupine();
      }
    }, 1500);
  }, [setIsBlurActive, isPorcupineLoaded, isPorcupineListening, startPorcupine]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-black text-white p-4">
      <ShaderBlurOverlay isActive={isBlurActive} />
      
      {/* LiveKit Room - only render when connected */}
      {isConnected && token && serverUrl && (
        <LiveKitRoom
          serverUrl={serverUrl}
          token={token}
          connect={true}
          audio={true}
          video={connectionMode === "vision"}
          onDisconnected={handleDisconnect}
          onError={(error) => {
            console.error("LiveKit error:", error);
            setError(error.message);
          }}
          options={{
            audioCaptureDefaults: {
              autoGainControl: true,
              echoCancellation: true,
              noiseSuppression: true,
            },
            videoCaptureDefaults: {
              resolution: { width: 1280, height: 720, frameRate: 30 },
            },
          }}
          className="absolute inset-0 z-40 pointer-events-none"
        >
          <RoomAudioRenderer />
          <MediaPublisher enableVideo={connectionMode === "vision"} />
          <AgentAudioOrb />
          <TranscriptDisplay />
          <AnimatePresence>
            {connectionMode === "vision" && <LocalVideoPreview />}
          </AnimatePresence>
        </LiveKitRoom>
      )}

      <main className="relative z-50 flex flex-col items-center gap-8 text-center">
        {/* Idle Orb - shown when not connected */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 300 }}
            animate={wakeWordDetected ? { opacity: 1, scale: 1, y: 100 } : { opacity: 0, scale: 0.8, y: 300 }}
            exit={{ opacity: 0, scale: 0.8, y: 300 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-4"
          >
            <SiriOrb
              size="160px"
              isListening={isPorcupineListening}
              sensitivity={0.5}
              minScale={1}
              maxScale={1.15}
              smoothing={0.95}
              colors={{
                bg: "oklch(8% 0.01 264.695)",
                c1: "oklch(60% 0.20 200)", // Cyan (dimmer)
                c2: "oklch(65% 0.15 280)", // Purple (dimmer)
                c3: "oklch(62% 0.18 180)", // Teal (dimmer)
              }}
            />
          </motion.div>
        )}




        {error && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm"
          >
            {error}
          </motion.p>
        )}

      </main>

      {/* Decorative background grid */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
    </div>
  );
}
