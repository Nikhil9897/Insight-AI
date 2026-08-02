import React from 'react';

interface InsightLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  textColor?: string;
  animated?: boolean;
  variant?: 'light' | 'dark' | 'auto';
}

export const InsightLogo: React.FC<InsightLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  textColor,
  animated = true,
  variant = 'auto',
}) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-sm font-black',
    md: 'text-lg font-black',
    lg: 'text-xl font-black',
    xl: 'text-2xl font-black',
  };

  const isDarkText = variant === 'dark';
  const defaultTextColor = isDarkText
    ? 'text-white'
    : textColor || 'text-slate-900';

  const animBar1 = animated ? 'animate-logo-bar-1' : '';
  const animBar2 = animated ? 'animate-logo-bar-2' : '';
  const animBar3 = animated ? 'animate-logo-bar-3' : '';
  const animTrend = animated ? 'animate-logo-trend' : '';
  const animDot = animated ? 'animate-logo-dot' : '';

  return (
    <div className={`inline-flex items-center space-x-2.5 select-none ${className}`}>
      {/* Brand Icon SVG matching user bar chart layout with iconic Lime Green -> Emerald -> Cyan -> Royal Blue palette */}
      <svg
        className={`${iconSizes[size]} shrink-0 overflow-visible`}
        viewBox="0 0 50 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Bar 1 Gradient (Lime Green to Emerald) */}
          <linearGradient id="logo-bar-grad-1" x1="4" y1="44" x2="13" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#84CC16" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>

          {/* Bar 2 Gradient (Emerald to Cyan) */}
          <linearGradient id="logo-bar-grad-2" x1="16" y1="44" x2="25" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>

          {/* Bar 3 Gradient (Cyan to Royal Blue) */}
          <linearGradient id="logo-bar-grad-3" x1="28" y1="44" x2="37" y2="6" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>

          {/* Trend Line Gradient */}
          <linearGradient id="logo-line-grad" x1="4" y1="26" x2="44" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="1" />
          </linearGradient>

          {/* Floating Dot Gradient (Cyan/Blue Glow) */}
          <linearGradient id="logo-dot-grad" x1="40" y1="0" x2="48" y2="6" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="logo-dot-glow" x="35" y="-5" width="18" height="18" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Bar 1 (Shortest, Left - Lime/Emerald) */}
        <rect
          className={animBar1}
          x="4"
          y="26"
          width="9"
          height="18"
          rx="4"
          fill="url(#logo-bar-grad-1)"
        />

        {/* 2. Bar 2 (Medium, Center - Emerald/Cyan) */}
        <rect
          className={animBar2}
          x="16"
          y="16"
          width="9"
          height="28"
          rx="4"
          fill="url(#logo-bar-grad-2)"
        />

        {/* 3. Bar 3 (Tallest, Right - Cyan/Royal Blue) */}
        <rect
          className={animBar3}
          x="28"
          y="6"
          width="9"
          height="38"
          rx="4"
          fill="url(#logo-bar-grad-3)"
        />

        {/* 4. Connected Trend Line */}
        <path
          className={animTrend}
          d="M 5 26 L 17 16 L 29 6 L 43 1"
          stroke="url(#logo-line-grad)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* 5. Glowing Floating Node/Dot */}
        <circle
          className={animDot}
          cx="44"
          cy="1"
          r="4.2"
          fill="url(#logo-dot-grad)"
          filter="url(#logo-dot-glow)"
        />
      </svg>

      {/* Brand Text: Insight (dark/light) + AI (emerald->cyan->blue gradient) */}
      {showText && (
        <span className={`${textSizes[size]} tracking-tight leading-none ${defaultTextColor}`}>
          Insight
          <span className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 bg-clip-text text-transparent ml-0.5">
            AI
          </span>
        </span>
      )}
    </div>
  );
};
