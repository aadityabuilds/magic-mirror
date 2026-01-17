"use client";

import React, { useState, useCallback } from "react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { ShaderBlurOverlay } from "./shader-blur-overlay";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";

interface TokenResponse {
  server_url: string;
  participant_token: string;
  room_name: string;
}

export function HomeClient() {
  const [isBlurActive, setIsBlurActive] = useQueryState(
    "blur",
    parseAsBoolean.withDefault(false)
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectToAgent = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get token");
      }

      const data: TokenResponse = await response.json();
      setServerUrl(data.server_url);
      setToken(data.participant_token);
      setIsConnected(true);
      setIsBlurActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
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
        ease: [0.22, 1, 0.36, 1]
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
          video={false}
          onDisconnected={handleDisconnect}
          className="absolute inset-0 z-40 pointer-events-none"
        >
          <RoomAudioRenderer />
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
              ? "Speak to interact with your voice assistant" 
              : "Replicating advanced SwiftUI shader effects in Next.js using SVG filters and Framer Motion."}
          </motion.p>
        </motion.div>

        {!isConnected && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={connectToAgent}
            disabled={isConnecting}
            className="group relative px-8 py-4 bg-white text-black rounded-full font-medium transition-all hover:bg-zinc-200 flex items-center gap-2 overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.3)] pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="relative z-10 flex items-center gap-2">
              {isConnecting ? (
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
                  Call Voice Agent
                  <Sparkles className="text-zinc-500" size={18} />
                </>
              )}
            </span>
          </motion.button>
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
      </main>

      {/* Decorative background grid */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
    </div>
  );
}
