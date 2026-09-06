import React from "react";
import { cn } from "@/lib/utils";

interface SocialSpaceEmblemProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  glow?: boolean;
}

export function SocialSpaceEmblem({
  className,
  glow = true,
  ...props
}: SocialSpaceEmblemProps) {
  const id = React.useId();

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-7 w-7 shrink-0", glow && "drop-shadow-[0_0_12px_rgba(245,158,11,0.45)]", className)}
      {...props}
    >
      <defs>
        <linearGradient id={`gold-grad-1-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="85%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id={`gold-grad-2-${id}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#b45309" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id={`core-glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Core subtle glow */}
      <circle cx="24" cy="24" r="8" fill={`url(#core-glow-${id})`} />

      {/* Primary outer orbital loop */}
      <path
        d="M8 24C8 17.5 15.5 13 24 13C33 13 41 18 41 24C41 30.5 32.5 35 24 35C14.5 35 7 29.5 8 24Z"
        stroke={`url(#gold-grad-1-${id})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        transform="rotate(-18 24 24)"
      />

      {/* Inner elliptical swirl */}
      <path
        d="M13 25C13 19 18 16 24 16C31 16 36 20 36 24C36 28 29.5 32 23.5 32C17 32 12.5 28 13 25Z"
        stroke={`url(#gold-grad-2-${id})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        transform="rotate(22 24 24)"
      />

      {/* Central vortex cusp */}
      <path
        d="M18 24C18 21.5 20.5 20 23.5 20C27 20 29.5 22 29.5 24C29.5 26.5 26.5 28 23.5 28C20 28 18 26 18 24Z"
        stroke={`url(#gold-grad-1-${id})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="18 4"
        transform="rotate(-40 24 24)"
      />

      {/* Sparkling particle point */}
      <circle cx="33" cy="18" r="1.2" fill="#fef9c3" />
    </svg>
  );
}
