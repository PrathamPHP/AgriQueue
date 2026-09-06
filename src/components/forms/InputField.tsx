import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  containerClassName?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      label,
      helperText,
      error,
      leadingIcon,
      trailingIcon,
      className,
      containerClassName,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={cn('flex flex-col gap-1.5 w-full', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs sm:text-sm font-semibold text-[#111827] flex items-center justify-between"
          >
            <span>{label}</span>
            {props.required && <span className="text-[#DC2626] font-normal text-xs">*Required</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leadingIcon && (
            <div className="absolute left-3.5 text-[#6B7280] pointer-events-none flex items-center shrink-0">
              {leadingIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full min-h-[48px] px-3.5 text-sm sm:text-base text-[#111827] bg-white border rounded-input shadow-subtle',
              'transition-all duration-200 placeholder:text-slate-400',
              'focus:outline-none focus:border-[#166534] focus:ring-1 focus:ring-[#166534]',
              leadingIcon ? 'pl-11' : 'pl-3.5',
              trailingIcon ? 'pr-11' : 'pr-3.5',
              error
                ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                : 'border-slate-300 hover:border-slate-400',
              'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
              className
            )}
            {...props}
          />

          {trailingIcon && (
            <div className="absolute right-3.5 text-[#6B7280] flex items-center shrink-0">
              {trailingIcon}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-xs text-[#DC2626] flex items-center gap-1 font-medium mt-0.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-[#6B7280] mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

InputField.displayName = 'InputField';
