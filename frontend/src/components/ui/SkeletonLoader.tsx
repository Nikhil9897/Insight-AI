import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'circle' | 'chart' | 'table';
}

export const SkeletonLoader: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
}) => {
  if (variant === 'circle') {
    return <div className={`rounded-full animate-shimmer ${className}`} />;
  }

  if (variant === 'card') {
    return (
      <div className={`bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-soft-xs ${className}`}>
        <div className="h-4 w-1/3 rounded-lg animate-shimmer" />
        <div className="h-8 w-1/2 rounded-lg animate-shimmer" />
        <div className="h-3 w-3/4 rounded-lg animate-shimmer" />
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className={`bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-soft-xs ${className}`}>
        <div className="flex justify-between">
          <div className="h-5 w-40 rounded-lg animate-shimmer" />
          <div className="h-5 w-24 rounded-lg animate-shimmer" />
        </div>
        <div className="h-64 w-full rounded-2xl animate-shimmer" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`bg-white border border-slate-200/80 rounded-3xl p-6 space-y-3 shadow-soft-xs ${className}`}>
        <div className="h-8 w-full rounded-xl animate-shimmer" />
        <div className="h-6 w-full rounded-lg animate-shimmer" />
        <div className="h-6 w-full rounded-lg animate-shimmer" />
        <div className="h-6 w-full rounded-lg animate-shimmer" />
      </div>
    );
  }

  return <div className={`rounded-lg animate-shimmer ${className}`} />;
};
