import React from 'react';
import { cn, formatMinutes } from '@/lib/utils';
import { Users, Clock, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';

export interface QueueCardProps {
  userToken: number;
  currentToken: number;
  farmersAhead: number;
  estimatedWaitMinutes: number;
  centreName: string;
  slotWindow?: string;
  delayMinutes?: number;
  priorityFlag?: boolean;
  recommendedArrivalTime?: string;
  onViewDetails?: () => void;
  className?: string;
}

export const QueueCard: React.FC<QueueCardProps> = ({
  userToken,
  currentToken,
  farmersAhead,
  estimatedWaitMinutes,
  centreName,
  slotWindow = '11:00 AM – 11:30 AM',
  delayMinutes = 0,
  priorityFlag = false,
  recommendedArrivalTime,
  onViewDetails,
  className,
}) => {
  const isServingNow = userToken === currentToken;
  const isTurnApproaching = farmersAhead > 0 && farmersAhead <= 3;

  return (
    <div
      className={cn(
        'bg-white border rounded-card shadow-card overflow-hidden transition-all duration-200',
        isServingNow
          ? 'border-[#166534] ring-2 ring-[#166534]'
          : isTurnApproaching
          ? 'border-amber-300 ring-1 ring-amber-300'
          : 'border-slate-200',
        className
      )}
    >
      {/* Header with Centre & Priority */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full bg-[#166534] animate-pulse-subtle shrink-0" />
          <span className="text-xs font-bold text-[#111827] truncate">
            {centreName}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {priorityFlag && <StatusBadge status="priority" size="sm" />}
          <span className="text-[11px] text-[#6B7280] font-medium">Slot: {slotWindow}</span>
        </div>
      </div>

      {/* Main Token Comparison Area */}
      <div className="p-5">
        <div className="grid grid-cols-2 gap-4 divide-x divide-slate-100">
          {/* Farmer's Token */}
          <div className="flex flex-col items-center justify-center p-2 text-center">
            <span className="text-xs font-bold tracking-wider text-[#6B7280] uppercase">
              Your Token
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#166534] mt-1 tracking-tight">
              #{userToken}
            </div>
            <span className="text-[11px] text-[#6B7280] mt-0.5">Assigned to you</span>
          </div>

          {/* Current Serving Token */}
          <div className="flex flex-col items-center justify-center p-2 text-center">
            <span className="text-xs font-bold tracking-wider text-[#6B7280] uppercase">
              Now Serving
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#111827] mt-1 tracking-tight">
              #{currentToken}
            </div>
            <span className="text-[11px] text-[#16A34A] font-semibold mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-ping inline-block" />
              Inside Centre
            </span>
          </div>
        </div>

        {/* Live Metrics Grid: Farmers Ahead & Waiting Time */}
        <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-input p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-[#6B7280] font-medium">Farmers Ahead</div>
              <div className="text-base sm:text-lg font-bold text-[#111827]">
                {isServingNow ? '0 (Your Turn)' : `${farmersAhead} farmers`}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-input p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#166534] flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-[#6B7280] font-medium">Dynamic ETA</div>
              <div className="text-base sm:text-lg font-bold text-[#111827]">
                {isServingNow ? 'Immediate' : formatMinutes(estimatedWaitMinutes)}
              </div>
            </div>
          </div>
        </div>

        {/* Delay Notice / Turn approaching announcement */}
        {delayMinutes > 0 && (
          <div className="mt-3.5 p-3 rounded-input bg-amber-50 border border-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong>Centre running {delayMinutes}m late.</strong>{' '}
              {recommendedArrivalTime
                ? `Recommended arrival time: ${recommendedArrivalTime}`
                : 'ETA has been automatically adjusted.'}
            </div>
          </div>
        )}

        {isTurnApproaching && !isServingNow && delayMinutes === 0 && (
          <div className="mt-3.5 p-3 rounded-input bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed font-medium">
              <strong>Your turn is approaching!</strong> Please proceed to the procurement entry gate.
            </div>
          </div>
        )}
      </div>

      {onViewDetails && (
        <div
          onClick={onViewDetails}
          className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 text-xs font-bold text-[#166534] hover:bg-emerald-50 flex items-center justify-between cursor-pointer transition-colors"
        >
          <span>View Live Virtual Queue Breakdown</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
