import React from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Clock, Star, Users, Check } from 'lucide-react';
import { Slot } from '@/types';

export interface SlotCardProps {
  slot: Slot;
  selected?: boolean;
  onSelect?: (slot: Slot) => void;
  className?: string;
}

export const SlotCard: React.FC<SlotCardProps> = ({
  slot,
  selected = false,
  onSelect,
  className,
}) => {
  const congestion = slot.congestionScore ?? 0;
  const isFull = slot.status === 'FULL' || congestion >= 0.95;
  const loadPercentage = Math.round(congestion * 100);

  return (
    <div
      onClick={() => {
        if (!isFull && onSelect) onSelect(slot);
      }}
      className={cn(
        'relative bg-white border rounded-card p-4 transition-all duration-200 select-none',
        // Selection styles
        selected
          ? 'border-[#166534] ring-2 ring-[#166534] ring-offset-1 bg-[#F0FDF4] shadow-card'
          : isFull
          ? 'border-slate-200 bg-slate-50/60 opacity-75 cursor-not-allowed'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-card cursor-pointer active:scale-[0.99]',
        className
      )}
    >
      {/* Recommended Tag */}
      {slot.isRecommended && !isFull && (
        <div className="absolute -top-3 left-4 bg-[#166534] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-subtle">
          <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
          <span>Recommended Slot</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mt-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-9 h-9 rounded-button flex items-center justify-center shrink-0',
              selected
                ? 'bg-[#166534] text-white'
                : 'bg-slate-100 text-slate-700'
            )}
          >
            <Clock className="w-5 h-5" />
          </div>

          <div>
            <div className="text-base font-extrabold text-[#111827]">
              {slot.startTime} – {slot.endTime}
            </div>
            <div className="text-xs text-[#6B7280]">
              Slot window: 30 mins
            </div>
          </div>
        </div>

        <StatusBadge status={slot.status} size="sm" />
      </div>

      {/* Congestion Load indicator */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-[#6B7280]">
          <Users className="w-3.5 h-3.5" />
          <span>Est. Congestion: <strong className="text-[#111827]">{loadPercentage}%</strong></span>
        </div>

        <div>
          {isFull ? (
            <span className="text-[#DC2626] font-semibold text-[11px]">No capacity</span>
          ) : selected ? (
            <span className="text-[#166534] font-bold text-xs flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Selected
            </span>
          ) : (
            <span className="text-[#166534] font-semibold text-xs">Tap to choose</span>
          )}
        </div>
      </div>
    </div>
  );
};
