"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ShaderBlurOverlayProps {
  isActive: boolean;
  className?: string;
}

/**
 * Replicating the UShape logic from the Swift implementation as an SVG path.
 * This path creates a large outer rectangle and subtracts a U-shaped inner area.
 */
function getUShapePath(thickness: number, radius: number) {
  const h = 1000;
  const w = 1000;
  const t = thickness;
  const r = radius;

  // Outer rect (clockwise) - extended to prevent blur edges from showing
  const outer = `M -500 -500 L 1500 -500 L 1500 1500 L -500 1500 Z`;
  
  // Inner U cutout (counter-clockwise for even-odd fill)
  // We start from top-left (0,0), go down, curve, go right, curve, then back up.
  const inner = `M 0 0 
                 L 0 ${h - t - r} 
                 Q 0 ${h - t} ${r} ${h - t} 
                 L ${w - r} ${h - t} 
                 Q ${w} ${h - t} ${w} ${h - t - r} 
                 L ${w} 0 Z`;
  
  return `${outer} ${inner}`;
}

export function ShaderBlurOverlay({ isActive, className }: ShaderBlurOverlayProps) {
  return (
    <div className={cn("fixed inset-0 pointer-events-none z-40 overflow-hidden", className)}>
      <AnimatePresence>
        {isActive && (
          <>
            {/* Layer 1: Blue Diffuse Glow (Outer) */}
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
              style={{ filter: "blur(180px)" }}
            >
              <svg
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                className="w-full h-full"
              >
                <defs>
                  <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3333B3" stopOpacity="0.4" />
                    <stop offset="30%" stopColor="#404CD9" stopOpacity="0.6" />
                    <stop offset="50%" stopColor="#5966F2" stopOpacity="0.8" />
                    <stop offset="70%" stopColor="#404CD9" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#3333B3" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                <path
                  d={getUShapePath(400, 150)}
                  fill="url(#blueGrad)"
                  fillRule="evenodd"
                />
              </svg>
            </motion.div>

            {/* Layer 2: Medium Purple Glow (Middle) */}
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="absolute inset-0"
              style={{ filter: "blur(100px)" }}
            >
              <svg
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                className="w-full h-full"
              >
                <defs>
                  <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#663BB3" stopOpacity="0.4" />
                    <stop offset="30%" stopColor="#8C59D9" stopOpacity="0.6" />
                    <stop offset="50%" stopColor="#A673F2" stopOpacity="0.8" />
                    <stop offset="70%" stopColor="#8C59D9" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#663BB3" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                <path
                  d={getUShapePath(250, 150)}
                  fill="url(#purpleGrad)"
                  fillRule="evenodd"
                />
              </svg>
            </motion.div>

            {/* Layer 3: Bright Glow (Inner) */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className="absolute inset-0"
              style={{ filter: "blur(50px)" }}
            >
              <svg
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                className="w-full h-full"
              >
                <path
                  d={getUShapePath(100, 150)}
                  fill="#F8E4FD"
                  fillRule="evenodd"
                />
              </svg>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
