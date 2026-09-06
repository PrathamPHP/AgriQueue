import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'left',
  className,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-button transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100 select-none';

  const variants = {
    primary:
      'bg-[#166534] text-white hover:bg-[#14532d] shadow-subtle hover:shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]',
    secondary:
      'bg-[#DCFCE7] text-[#166534] hover:bg-[#bbf7d0] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]',
    outline:
      'bg-white border border-slate-200 text-[#111827] hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]',
    danger:
      'bg-[#DC2626] text-white hover:bg-red-700 shadow-subtle focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-600',
    ghost:
      'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 h-9 gap-1.5',
    md: 'text-sm px-4 py-2.5 h-11 gap-2',
    lg: 'text-base px-6 py-3.5 h-13 tap-target gap-2.5', // Large touch target for farmers
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          <span>{children}</span>
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};
