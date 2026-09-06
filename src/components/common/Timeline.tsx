import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Clock } from 'lucide-react';
import { ProcurementStage } from '@/types';

export interface TimelineStep {
  stage: ProcurementStage;
  title: string;
  description: string;
  timestamp?: string;
  status: 'completed' | 'current' | 'upcoming';
  detail?: React.ReactNode;
}

export interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ steps, className }) => {
  return (
    <div className={cn('relative flex flex-col gap-0', className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCompleted = step.status === 'completed';
        const isCurrent = step.status === 'current';
        const isUpcoming = step.status === 'upcoming';

        return (
          <div key={step.stage} className="relative flex items-start gap-4 pb-7 last:pb-1">
            {/* Vertical connector line */}
            {!isLast && (
              <div
                className={cn(
                  'absolute left-[17px] top-[34px] bottom-0 w-[2px] -translate-x-1/2 transition-colors duration-300',
                  isCompleted ? 'bg-[#166534]' : 'bg-slate-200'
                )}
              />
            )}

            {/* Step Icon Indicator */}
            <div className="relative z-10 shrink-0 mt-0.5">
              {isCompleted ? (
                <div className="w-[34px] h-[34px] rounded-full bg-[#166534] text-white flex items-center justify-center shadow-subtle transition-transform duration-200">
                  <Check className="w-4 h-4 stroke-[2.5]" />
                </div>
              ) : isCurrent ? (
                <div className="w-[34px] h-[34px] rounded-full bg-[#DCFCE7] border-2 border-[#166534] text-[#166534] flex items-center justify-center shadow-subtle animate-pulse-subtle">
                  <Clock className="w-4 h-4 stroke-[2.5]" />
                </div>
              ) : (
                <div className="w-[34px] h-[34px] rounded-full bg-white border-2 border-slate-300 text-slate-400 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                </div>
              )}
            </div>

            {/* Content Details */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <h4
                  className={cn(
                    'text-sm font-bold',
                    isCompleted ? 'text-[#166534]' : isCurrent ? 'text-[#111827]' : 'text-[#6B7280]'
                  )}
                >
                  {step.title}
                </h4>

                {step.timestamp && (
                  <span className="text-[11px] font-medium text-[#6B7280] bg-slate-100 px-2 py-0.5 rounded-full">
                    {step.timestamp}
                  </span>
                )}
              </div>

              <p className={cn('text-xs mt-0.5 leading-relaxed', isCurrent ? 'text-slate-700' : 'text-[#6B7280]')}>
                {step.description}
              </p>

              {step.detail && (
                <div className="mt-2.5 p-3 bg-slate-50 border border-slate-100 rounded-input text-xs">
                  {step.detail}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
