import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, AlertCircle } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface SelectDropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
  containerClassName?: string;
}

export const SelectDropdown = forwardRef<HTMLSelectElement, SelectDropdownProps>(
  (
    {
      label,
      options,
      helperText,
      error,
      className,
      containerClassName,
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={cn('flex flex-col gap-1.5 w-full', containerClassName)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs sm:text-sm font-semibold text-[#111827] flex items-center justify-between"
          >
            <span>{label}</span>
            {props.required && <span className="text-[#DC2626] font-normal text-xs">*Required</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'w-full min-h-[48px] pl-3.5 pr-10 text-sm sm:text-base text-[#111827] bg-white border rounded-input shadow-subtle',
              'transition-all duration-200 appearance-none cursor-pointer',
              'focus:outline-none focus:border-[#166534] focus:ring-1 focus:ring-[#166534]',
              error
                ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                : 'border-slate-300 hover:border-slate-400',
              'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label} {opt.sublabel ? `(${opt.sublabel})` : ''}
              </option>
            ))}
          </select>

          <div className="absolute right-3.5 text-[#6B7280] pointer-events-none flex items-center shrink-0">
            <ChevronDown className="w-5 h-5" />
          </div>
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

SelectDropdown.displayName = 'SelectDropdown';
