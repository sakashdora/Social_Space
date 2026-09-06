import React from "react";
import { useTheme } from "@/lib/theme";

export function CosmicAtmosphere() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none transition-colors duration-500">
      {/* Dynamic Cosmos / Luminous Sky Gradient */}
      <div
        className={
          isLight
            ? "absolute inset-0 bg-[#faf9f5] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.07),rgba(255,255,255,0))]"
            : "absolute inset-0 bg-[#06070a] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.06),rgba(255,255,255,0))]"
        }
      />

      {/* Warm Ambient Glow Center-Right */}
      <div
        className={
          isLight
            ? "absolute top-[20%] right-[10%] h-[500px] w-[500px] rounded-full bg-amber-500/[0.06] blur-[120px]"
            : "absolute top-[20%] right-[10%] h-[500px] w-[500px] rounded-full bg-amber-500/[0.04] blur-[120px]"
        }
      />
      <div
        className={
          isLight
            ? "absolute bottom-[10%] left-[25%] h-[400px] w-[600px] rounded-full bg-amber-500/[0.05] blur-[100px]"
            : "absolute bottom-[10%] left-[25%] h-[400px] w-[600px] rounded-full bg-amber-500/[0.05] blur-[100px]"
        }
      />

      {/* SVG Celestial Landscape & Planetary Rings */}
      <svg
        className="absolute inset-0 h-full w-full opacity-90 transition-opacity duration-500"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1440 900"
      >
        <defs>
          {/* Horizon Rim Light Gradient */}
          <linearGradient id="horizonGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d97706" stopOpacity="0.1" />
            <stop offset="35%" stopColor="#f59e0b" stopOpacity={isLight ? "0.6" : "0.4"} />
            <stop offset="50%" stopColor="#fef08a" stopOpacity={isLight ? "0.95" : "0.8"} />
            <stop offset="65%" stopColor="#f59e0b" stopOpacity={isLight ? "0.7" : "0.5"} />
            <stop offset="100%" stopColor="#b45309" stopOpacity="0.15" />
          </linearGradient>

          {/* Golden Orbit Ring Stroke Gradient */}
          <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={isLight ? "0.7" : "0.6"} />
            <stop offset="50%" stopColor="#d97706" stopOpacity={isLight ? "0.35" : "0.25"} />
            <stop offset="100%" stopColor="#78350f" stopOpacity="0.05" />
          </linearGradient>

          {/* Celestial Sphere Lighting */}
          <radialGradient id="celestialSphere" cx="35%" cy="35%" r="65%">
            {isLight ? (
              <>
                <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.95" />
                <stop offset="30%" stopColor="#fde68a" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0.3" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
                <stop offset="30%" stopColor="#d97706" stopOpacity="0.6" />
                <stop offset="60%" stopColor="#451a03" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0a0d14" stopOpacity="0.95" />
              </>
            )}
          </radialGradient>

          {/* Mountain Fill Gradient */}
          <linearGradient id="mountainFill" x1="50%" y1="0%" x2="50%" y2="100%">
            {isLight ? (
              <>
                <stop offset="0%" stopColor="#ede8df" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#dfd9cd" stopOpacity="0.95" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#0c111a" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#05070a" stopOpacity="1" />
              </>
            )}
          </linearGradient>
        </defs>

        {/* Top-Left Planetary Ring Arc */}
        <ellipse
          cx="0"
          cy="200"
          rx="520"
          ry="340"
          fill="none"
          stroke="url(#orbitGrad)"
          strokeWidth="1.2"
          transform="rotate(-25 0 200)"
          className={isLight ? "opacity-35" : "opacity-40"}
        />

        {/* Right Celestial Sphere (Sun/Moon / Exoplanet) */}
        <g transform="translate(1320, 420)">
          {/* Orbit Rings around Sphere */}
          <ellipse
            cx="0"
            cy="0"
            rx="240"
            ry="110"
            fill="none"
            stroke="url(#orbitGrad)"
            strokeWidth="1.4"
            transform="rotate(-32)"
            className={isLight ? "opacity-60" : "opacity-50"}
          />
          <ellipse
            cx="0"
            cy="0"
            rx="290"
            ry="130"
            fill="none"
            stroke="url(#orbitGrad)"
            strokeWidth="0.8"
            transform="rotate(-18)"
            className={isLight ? "opacity-40" : "opacity-30"}
          />

          {/* Glowing Celestial Planet Body */}
          <circle cx="20" cy="-10" r="58" fill="url(#celestialSphere)" />
          {/* Subtle Outer Atmosphere Rim Glow */}
          <circle
            cx="20"
            cy="-10"
            r="60"
            fill="none"
            stroke="#fef08a"
            strokeWidth="1.5"
            className="opacity-40 filter drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]"
          />
        </g>

        {/* Distant Mountain Ridge Background Layer */}
        <path
          d="M0 720 Q 220 680, 440 705 T 880 710 T 1200 675 T 1440 695 L 1440 900 L 0 900 Z"
          fill={isLight ? "#e5dfd5" : "#080c13"}
          opacity={isLight ? 0.65 : 0.8}
        />

        {/* Foreground Mountain Dunes Ridge with Golden Rim Light */}
        <path
          d="M-20 770 
             C 120 730, 240 760, 360 810 
             C 480 860, 620 780, 780 840 
             C 940 900, 1100 810, 1260 850 
             C 1360 870, 1420 840, 1460 830 
             L 1460 920 L -20 920 Z"
          fill="url(#mountainFill)"
        />

        {/* Golden Ridge Rim Highlight Path */}
        <path
          d="M-20 770 
             C 120 730, 240 760, 360 810 
             C 480 860, 620 780, 780 840 
             C 940 900, 1100 810, 1260 850 
             C 1360 870, 1420 840, 1460 830"
          fill="none"
          stroke="url(#horizonGlow)"
          strokeWidth="2.5"
          className="filter drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]"
        />

        {/* Second subtle ridge accent line */}
        <path
          d="M180 750 C 320 780, 480 820, 600 790 C 740 760, 890 820, 1020 850"
          fill="none"
          stroke="url(#horizonGlow)"
          strokeWidth="1.2"
          opacity="0.5"
        />

        {/* Fine Star Dust */}
        <circle cx="120" cy="140" r="1" fill={isLight ? "#d97706" : "#ffffff"} opacity={isLight ? 0.5 : 0.6} />
        <circle cx="280" cy="80" r="1.2" fill="#fde68a" opacity={isLight ? 0.8 : 0.7} />
        <circle cx="410" cy="190" r="0.8" fill={isLight ? "#d97706" : "#ffffff"} opacity={isLight ? 0.4 : 0.4} />
        <circle cx="680" cy="110" r="1" fill="#fde68a" opacity={isLight ? 0.7 : 0.5} />
        <circle cx="890" cy="70" r="1.4" fill={isLight ? "#d97706" : "#ffffff"} opacity={isLight ? 0.6 : 0.8} />
        <circle cx="1040" cy="160" r="0.8" fill="#fef08a" opacity={isLight ? 0.8 : 0.6} />
        <circle cx="1250" cy="90" r="1.1" fill={isLight ? "#d97706" : "#ffffff"} opacity={isLight ? 0.5 : 0.5} />
        <circle cx="1380" cy="240" r="0.9" fill="#fde68a" opacity={isLight ? 0.8 : 0.7} />
      </svg>
    </div>
  );
}
