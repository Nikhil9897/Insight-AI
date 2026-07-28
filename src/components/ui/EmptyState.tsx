import React from 'react';
import { Card } from './Card';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaText?: string;
  onCtaClick?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  ctaText,
  onCtaClick,
  className = '',
}) => {
  return (
    <Card className={`text-center max-w-xl mx-auto my-8 p-10 border-dashed ${className}`}>
      <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-soft-xs">
        {icon}
      </div>

      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">{description}</p>

      {ctaText && onCtaClick && (
        <div className="mt-6">
          <Button variant="primary" onClick={onCtaClick}>
            {ctaText}
          </Button>
        </div>
      )}
    </Card>
  );
};
