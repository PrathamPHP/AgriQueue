import React from 'react';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, AlertCircle, CheckCircle2, Clock, X } from 'lucide-react';

export type BannerVariant = 'info' | 'warning' | 'danger' | 'success' | 'delay';

export interface NotificationBannerProps {
  variant?: BannerVariant;
  title: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  variant = 'info',
  title,
  message,
  actionText,
  onAction,
  onDismiss,
  className,
}) => {
  const getStyles = () => {
    switch (variant) {
      case 'delay':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-300',
          text: 'text-amber-900',
          icon: <Clock className="w-5 h-5 text-[#F59E0B] shrink-0" />,
          button: 'text-[#92400E] bg-amber-100 hover:bg-amber-200 border-amber-300',
        };
      case 'danger':
        return {
          bg: 'bg-red-50',
          border: 'border-red-300',
          text: 'text-red-900',
          icon: <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0" />,
          button: 'text-red-900 bg-red-100 hover:bg-red-200 border-red-300',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-300',
          text: 'text-amber-900',
          icon: <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0" />,
          button: 'text-amber-900 bg-amber-100 hover:bg-amber-200 border-amber-300',
        };
      case 'success':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-300',
          text: 'text-emerald-900',
          icon: <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />,
          button: 'text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border-emerald-300',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-900',
          icon: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
          button: 'text-blue-900 bg-blue-100 hover:bg-blue-200 border-blue-200',
        };
    }
  };

  const config = getStyles();

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3.5 p-4 rounded-card border shadow-subtle animate-fade-in transition-all duration-200',
        config.bg,
        config.border,
        className
      )}
    >
      <div className="mt-0.5">{config.icon}</div>

      <div className="flex-1 min-w-0">
        <h4 className={cn('text-sm sm:text-base font-bold leading-tight', config.text)}>
          {title}
        </h4>
        {message && (
          <p className={cn('text-xs sm:text-sm mt-1 leading-relaxed opacity-90', config.text)}>
            {message}
          </p>
        )}
        {actionText && onAction && (
          <button
            type="button"
            onClick={onAction}
            className={cn(
              'mt-2.5 text-xs font-semibold px-3 py-1.5 rounded-button border transition-colors',
              config.button
            )}
          >
            {actionText}
          </button>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss banner"
          className="p-1 -mr-1 text-slate-400 hover:text-slate-600 rounded-button transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
