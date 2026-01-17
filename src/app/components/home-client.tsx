"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { ShaderBlurOverlay } from "@/components/shader-blur-overlay";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Video, Mic } from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  VideoTrack,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

function MediaPublisher({ 
  onStatusChange, 
  enableVideo 
}: { 
  onStatusChange?: (status: string) => void;
  enableVideo?: boolean;
}) {
  const room = useRoomContext();

  useEffect(() => {
    console.log("MediaPublisher mounted, room state:", room.state, "enableVideo:", enableVideo);
    onStatusChange?.(`Room state: ${room.state}`);

    const enableMedia = async () => {
      try {
        console.log("Requesting microphone access...");
        onStatusChange?.("Requesting microphone...");
        await room.localParticipant.setMicrophoneEnabled(true);
        console.log("Microphone enabled successfully");
        
        if (enableVideo) {
          console.log("Requesting camera access...");
          onStatusChange?.("Enabling camera...");
          await room.localParticipant.setCameraEnabled(true);
          console.log("Camera enabled successfully");
          onStatusChange?.("Camera & mic enabled - speak now!");
        } else {
          onStatusChange?.("Microphone enabled - speak now!");
        }
      } catch (err) {
        console.error("Failed to enable media:", err);
        onStatusChange?.(`Media error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    if (room.state === "connected") {
      enableMedia();
    }

    const handleConnected = () => {
      console.log("Room connected!");
      onStatusChange?.("Connected to room");
      enableMedia();
    };

    const handleDisconnected = () => {
      console.log("Room disconnected");
      onStatusChange?.("Disconnected");
    };

    const handleParticipantConnected = (participant: unknown) => {
      const p = participant as { identity: string };
      console.log("Participant connected:", p.identity);
      onStatusChange?.(`Agent joined: ${p.identity}`);
    };

    room.on("connected", handleConnected);
    room.on("disconnected", handleDisconnected);
    room.on("participantConnected", handleParticipantConnected);

    return () => {
      room.off("connected", handleConnected);
      room.off("disconnected", handleDisconnected);
      room.off("participantConnected", handleParticipantConnected);
    };
  }, [room, onStatusChange, enableVideo]);

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

interface TokenResponse {
  server_url: string;
  participant_token: string;
  room_name: string;
}

type ConnectionMode = "voice" | "realtime";

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
  const [status, setStatus] = useState<string | null>(null);

  const connectToAgent = useCallback(async (mode: ConnectionMode) => {
    setIsConnecting(true);
    setConnectionMode(mode);
    setError(null);
    setStatus("Fetching token...");

    const endpoint = mode === "realtime" ? "/api/token/realtime" : "/api/token";

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
      
      setStatus("Connecting to room...");
      setServerUrl(data.server_url);
      setToken(data.participant_token);
      setIsConnected(true);
      setIsBlurActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setStatus(null);
      setConnectionMode(null);
      console.error("Connection error:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [setIsBlurActive]);

  const handleDisconnect = useCallback(() => {
    setToken(null);
    setServerUrl(null);
    setIsConnected(false);
    setIsBlurActive(false);
    setConnectionMode(null);
  }, [setIsBlurActive]);

  const titleContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const wordVariants = {
    hidden: { 
      opacity: 0, 
      filter: "blur(15px)",
      y: 10,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      filter: "blur(0px)",
      y: 0,
      scale: 1,
      transition: {
        duration: 1.2,
        ease: [0.22, 1, 0.36, 1] as const
      }
    },
  };

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
          video={connectionMode === "realtime"}
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
          <MediaPublisher onStatusChange={setStatus} enableVideo={connectionMode === "realtime"} />
          <AnimatePresence>
            {connectionMode === "realtime" && <LocalVideoPreview />}
          </AnimatePresence>
        </LiveKitRoom>
      )}

      <main className="relative z-50 flex flex-col items-center gap-8 text-center pointer-events-none">
        <motion.div
          variants={titleContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <h1 className="text-5xl md:text-7xl font-light tracking-tighter mb-4 flex gap-x-4">
            <motion.span variants={wordVariants} className="inline-block">
              Computer
            </motion.span>
            <motion.span variants={wordVariants} className="inline-block italic font-serif">
              Vision
            </motion.span>
          </h1>
          <motion.p 
            variants={wordVariants}
            className="text-zinc-400 max-w-md mx-auto text-lg font-light"
          >
            {isConnected 
              ? connectionMode === "realtime"
                ? "Speak and show things to your AI assistant"
                : "Speak to interact with your voice assistant"
              : "Replicating advanced SwiftUI shader effects in Next.js using SVG filters and Framer Motion."}
          </motion.p>
        </motion.div>

        {!isConnected && (
          <div className="flex flex-col sm:flex-row gap-4 pointer-events-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => connectToAgent("voice")}
              disabled={isConnecting}
              className="group relative px-8 py-4 bg-white text-black rounded-full font-medium transition-all hover:bg-zinc-200 flex items-center gap-2 overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center gap-2">
                {isConnecting && connectionMode === "voice" ? (
                  <>
                    Connecting...
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="text-purple-600" size={18} />
                    </motion.div>
                  </>
                ) : (
                  <>
                    <Mic size={18} />
                    Voice Only
                  </>
                )}
              </span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => connectToAgent("realtime")}
              disabled={isConnecting}
              className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-medium transition-all hover:from-purple-500 hover:to-pink-500 flex items-center gap-2 overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center gap-2">
                {isConnecting && connectionMode === "realtime" ? (
                  <>
                    Connecting...
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="text-white" size={18} />
                    </motion.div>
                  </>
                ) : (
                  <>
                    <Video size={18} />
                    Talk Realtime
                  </>
                )}
              </span>
            </motion.button>
          </div>
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm pointer-events-auto"
          >
            {error}
          </motion.p>
        )}

        {status && isConnected && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-green-400 text-sm pointer-events-auto"
          >
            {status}
          </motion.p>
        )}
      </main>

      {/* Decorative background grid */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
    </div>
  );
}
