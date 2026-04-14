"use client";


import { motion } from "framer-motion";

interface Beam {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  duration: number;
  delay: number;
  opacity: number;
  width: number;
  gradientId: string;
}

// Pre-computed beams to avoid Math.random() SSR/client hydration mismatch
const BEAMS: Beam[] = [
  { id: 0,  x1: 12,  y1: -10, x2: 8,   y2: 110, duration: 7,  delay: 0.5, opacity: 0.15, width: 1.2, gradientId: "beam-gradient-0" },
  { id: 1,  x1: 28,  y1: -10, x2: 32,  y2: 110, duration: 9,  delay: 2.0, opacity: 0.12, width: 0.8, gradientId: "beam-gradient-1" },
  { id: 2,  x1: -10, y1: 25,  x2: 110, y2: 22,  duration: 11, delay: 1.0, opacity: 0.08, width: 0.6, gradientId: "beam-gradient-2" },
  { id: 3,  x1: 45,  y1: -10, x2: 40,  y2: 110, duration: 6,  delay: 3.5, opacity: 0.20, width: 1.5, gradientId: "beam-gradient-3" },
  { id: 4,  x1: 62,  y1: -10, x2: 68,  y2: 110, duration: 10, delay: 0.0, opacity: 0.10, width: 1.0, gradientId: "beam-gradient-4" },
  { id: 5,  x1: -10, y1: 55,  x2: 110, y2: 58,  duration: 13, delay: 4.0, opacity: 0.07, width: 0.5, gradientId: "beam-gradient-5" },
  { id: 6,  x1: 78,  y1: -10, x2: 74,  y2: 110, duration: 8,  delay: 1.5, opacity: 0.18, width: 1.3, gradientId: "beam-gradient-6" },
  { id: 7,  x1: 90,  y1: -10, x2: 85,  y2: 110, duration: 5,  delay: 5.0, opacity: 0.14, width: 0.9, gradientId: "beam-gradient-7" },
  { id: 8,  x1: -10, y1: 78,  x2: 110, y2: 75,  duration: 12, delay: 2.5, opacity: 0.06, width: 0.7, gradientId: "beam-gradient-8" },
  { id: 9,  x1: 5,   y1: -10, x2: 10,  y2: 110, duration: 11, delay: 3.0, opacity: 0.09, width: 0.6, gradientId: "beam-gradient-9" },
  { id: 10, x1: 35,  y1: -10, x2: 30,  y2: 110, duration: 7,  delay: 4.5, opacity: 0.16, width: 1.1, gradientId: "beam-gradient-10" },
  { id: 11, x1: -10, y1: 40,  x2: 110, y2: 44,  duration: 14, delay: 0.8, opacity: 0.05, width: 0.4, gradientId: "beam-gradient-11" },
  { id: 12, x1: 55,  y1: -10, x2: 52,  y2: 110, duration: 8,  delay: 5.5, opacity: 0.13, width: 1.4, gradientId: "beam-gradient-12" },
  { id: 13, x1: 72,  y1: -10, x2: 76,  y2: 110, duration: 6,  delay: 1.2, opacity: 0.11, width: 0.7, gradientId: "beam-gradient-13" },
  { id: 14, x1: -10, y1: 90,  x2: 110, y2: 85,  duration: 10, delay: 3.8, opacity: 0.08, width: 0.5, gradientId: "beam-gradient-14" },
  { id: 15, x1: 18,  y1: -10, x2: 22,  y2: 110, duration: 9,  delay: 2.2, opacity: 0.17, width: 1.0, gradientId: "beam-gradient-15" },
  { id: 16, x1: 85,  y1: -10, x2: 80,  y2: 110, duration: 12, delay: 0.3, opacity: 0.10, width: 0.8, gradientId: "beam-gradient-16" },
  { id: 17, x1: -10, y1: 12,  x2: 110, y2: 15,  duration: 15, delay: 6.0, opacity: 0.06, width: 0.4, gradientId: "beam-gradient-17" },
];

function AnimatedBeam({ beam }: { beam: Beam }) {
  const isVertical = Math.abs(beam.y2 - beam.y1) > Math.abs(beam.x2 - beam.x1);

  return (
    <>
      <defs>
        <linearGradient
          id={beam.gradientId}
          x1={isVertical ? "0%" : "0%"}
          y1={isVertical ? "0%" : "0%"}
          x2={isVertical ? "0%" : "100%"}
          y2={isVertical ? "100%" : "0%"}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="30%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="70%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.line
        x1={`${beam.x1}%`}
        y1={`${beam.y1}%`}
        x2={`${beam.x2}%`}
        y2={`${beam.y2}%`}
        stroke={`url(#${beam.gradientId})`}
        strokeWidth={beam.width}
        strokeOpacity={beam.opacity}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: [0, 1, 1, 0],
          opacity: [0, beam.opacity, beam.opacity, 0],
        }}
        transition={{
          duration: beam.duration,
          delay: beam.delay,
          repeat: Infinity,
          ease: "linear",
          times: [0, 0.2, 0.8, 1],
        }}
        style={{ willChange: "opacity" }}
      />
    </>
  );
}

export function BackgroundBeams({ className }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
      aria-hidden="true"
    >
      <svg
        className="h-full w-full text-primary"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {BEAMS.map((beam) => (
          <AnimatedBeam key={beam.id} beam={beam} />
        ))}
      </svg>

      {/* Radial vignette to keep centre clean */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, var(--background) 100%)",
        }}
      />
    </div>
  );
}
