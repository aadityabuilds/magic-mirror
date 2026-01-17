"use client";

import React from "react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { ShaderBlurOverlay } from "./shader-blur-overlay";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function HomeClient() {
  const [isBlurActive, setIsBlurActive] = useQueryState(
    "blur",
    parseAsBoolean.withDefault(false)
  );

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-black text-white p-4">
      <ShaderBlurOverlay isActive={isBlurActive} />
      
      <main className="relative z-50 flex flex-col items-center gap-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-light tracking-tighter mb-4">
            Computer <span className="italic font-serif">Vision</span>
          </h1>
          <p className="text-zinc-400 max-w-md mx-auto text-lg font-light">
            Replicating advanced SwiftUI shader effects in Next.js using SVG filters and Framer Motion.
          </p>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsBlurActive(!isBlurActive)}
          className="group relative px-8 py-4 bg-white text-black rounded-full font-medium transition-all hover:bg-zinc-200 flex items-center gap-2 overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.3)]"
        >
          <span className="relative z-10 flex items-center gap-2">
            {isBlurActive ? "Disable Effect" : "Activate Glow"}
            <Sparkles className={isBlurActive ? "text-purple-600 animate-pulse" : "text-zinc-500"} size={18} />
          </span>
          {isBlurActive && (
            <motion.div
              layoutId="glow-bg"
              className="absolute inset-0 bg-gradient-to-r from-purple-200 to-blue-200 opacity-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
            />
          )}
        </motion.button>
      </main>

      {/* Decorative background grid (optional, but adds to the aesthetic) */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      
      {/* Animated input text at the bottom, matching the Swift TextField */}
      <div className="absolute inset-x-0 bottom-[120px] flex justify-center pointer-events-none px-4">
        <motion.div
          animate={{ 
            opacity: isBlurActive ? 1 : 0,
            y: isBlurActive ? 0 : 20,
            scale: isBlurActive ? 1 : 0.95
          }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xl text-center"
        >
          <div className="text-[#F8E4FD] text-4xl md:text-6xl font-light tracking-tight pointer-events-auto">
             <input 
               type="text"
               placeholder="Type something..."
               className="bg-transparent border-none text-center outline-none w-full placeholder:text-zinc-800"
               style={{ caretColor: '#A673F2' }}
             />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
