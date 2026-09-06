import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
    isPositive?: boolean; // e.g., down is positive for wait time
  };
  icon: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  iconBgColor = 'bg-emerald-50',
  iconColor = 'text-[#166534]',
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-card p-5 shadow-card transition-all duration-200 hover:shadow-card-hover flex flex-col justify-between gap-3',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs sm:text-sm font-semibold text-[#6B7280] tracking-wide block truncate">
            {title}
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#111827] mt-1 tracking-tight">
            {value}
          </div>
        </div>

        <div
          className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center shrink-0',
            iconBgColor,
            iconColor
          )}
        >
          {icon}
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          {trend ? (
            <div
              className={cn(
                'flex items-center gap-1 font-semibold',
                trend.isPositive ? 'text-[#16A34A]' : 'text-[#DC2626]'
              )}
            >
              {trend.direction === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
              {trend.direction === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
              {trend.direction === 'neutral' && <Minus className="w-3.5 h-3.5" />}
              <span>{trend.value}</span>
            </div>
          ) : (
            <span className="text-[#6B7280]">{subtitle}</span>
          )}

          {trend && subtitle && (
            <span className="text-[#6B7280] truncate ml-2">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
};
