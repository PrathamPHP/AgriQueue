import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressIndicatorProps {
  value: number; // 0 to 100
  max?: number;
  label?: string;
  sublabel?: string;
  showPercentage?: boolean;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  value,
  max = 100,
  label,
  sublabel,
  showPercentage = true,
  variant = 'primary',
  size = 'md',
  className,
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const variantBarColors = {
    primary: 'bg-[#166534]',
    success: 'bg-[#16A34A]',
    warning: 'bg-[#F59E0B]',
    danger: 'bg-[#DC2626]',
  };

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={cn('w-full flex flex-col gap-1.5', className)}>
      {(label || showPercentage || sublabel) && (
        <div className="flex items-center justify-between text-xs sm:text-sm">
          {label && <span className="font-semibold text-[#111827]">{label}</span>}
          {sublabel && <span className="text-[#6B7280]">{sublabel}</span>}
          {showPercentage && (
            <span className="font-bold text-[#166534] ml-auto">
              {percentage}%
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          'w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60',
          heightClasses[size]
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            variantBarColors[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
