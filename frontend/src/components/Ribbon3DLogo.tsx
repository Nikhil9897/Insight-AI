import React from 'react';

interface Ribbon3DLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
}

export const Ribbon3DLogo: React.FC<Ribbon3DLogoProps> = ({ 
  className = '', 
  size = 'md',
  animated = false 
}) => {
  const sizeMap = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-32 h-32',
    xl: 'w-64 h-64 md:w-80 md:h-80',
  };

  return (
    <div className={`relative flex items-center justify-center ${sizeMap[size]} ${className} ${animated ? 'animate-bounce' : ''}`}>
      <svg 
        viewBox="0 0 200 200" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xl"
      >
        <defs>
          {/* Fold 1 Gradient - Bright Lime Yellow to Green */}
          <linearGradient id="fold1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D9F99D" />
            <stop offset="50%" stopColor="#84CC16" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>

          {/* Fold 2 Gradient - Emerald to Cyan */}
          <linearGradient id="fold2Grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="60%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>

          {/* Fold 3 Gradient - Deep Cyan Blue */}
          <linearGradient id="fold3Grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>

          {/* Inner Fold Shadow for 3D Overlap depth */}
          <linearGradient id="shadowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>

        {/* Fold 1 - Bottom Left Upward diagonal ribbon segment */}
        <path
          d="M 30 160 L 65 160 L 115 50 L 80 50 Z"
          fill="url(#fold1Grad)"
        />

        {/* Fold 2 - Middle Connecting Ribbon fold with 3D overlap angle */}
        <path
          d="M 80 50 L 115 50 L 165 160 L 130 160 Z"
          fill="url(#fold2Grad)"
        />

        {/* Fold 3 - Right Upward fold creating the iconic folded 'N' or 'I' geometry */}
        <path
          d="M 130 160 L 165 160 L 180 120 L 145 120 Z"
          fill="url(#fold3Grad)"
        />

        {/* Shadow overlays for 3D realism at the folds */}
        <path
          d="M 80 50 L 115 50 L 105 72 L 80 50 Z"
          fill="url(#shadowGrad)"
          opacity="0.6"
        />
        <path
          d="M 130 160 L 165 160 L 150 130 L 130 160 Z"
          fill="url(#shadowGrad)"
          opacity="0.5"
        />

        {/* Highlight sheen edge */}
        <path
          d="M 30 160 L 80 50"
          stroke="#ECFDF5"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      </svg>
    </div>
  );
};
