import React from 'react';
import { Button } from '@/components/common/Button';
import { UserCheck, FastForward } from 'lucide-react';

interface OfficerTopBarProps {
  title: string;
  subtitleCategory: string;
  subtitleLocation: string;
  currentDelayMinutes: number;
  onSetDelay: (delayMins: number) => void;
  onOpenCheckIn: () => void;
  onServeNext: () => void;
  isAdvancingQueue?: boolean;
}

export const OfficerTopBar: React.FC<OfficerTopBarProps> = ({
  title,
  subtitleCategory,
  subtitleLocation,
  currentDelayMinutes,
  onSetDelay,
  onOpenCheckIn,
  onServeNext,
  isAdvancingQueue = false,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
            {subtitleCategory}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
          <span className="text-xs text-slate-500">
            {subtitleLocation}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
          {title}
        </h1>
      </div>

      {/* Action Hub */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-button text-xs">
          <span className="text-slate-500 font-medium px-1.5">Delay:</span>
          <button
            onClick={() => onSetDelay(0)}
            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
              currentDelayMinutes === 0
                ? 'bg-emerald-100 text-[#166534]'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            0m
          </button>
          <button
            onClick={() => onSetDelay(15)}
            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
              currentDelayMinutes === 15
                ? 'bg-amber-100 text-amber-900'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            +15m
          </button>
          <button
            onClick={() => onSetDelay(30)}
            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
              currentDelayMinutes === 30
                ? 'bg-red-100 text-red-900'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            +30m
          </button>
        </div>

        <Button
          size="md"
          variant="outline"
          onClick={onOpenCheckIn}
          icon={<UserCheck className="w-4 h-4" />}
        >
          Check-In Farmer
        </Button>

        <Button
          size="md"
          variant="primary"
          onClick={onServeNext}
          icon={<FastForward className="w-4 h-4" />}
          className="shadow-subtle"
          disabled={isAdvancingQueue}
        >
          Serve Next Farmer
        </Button>
      </div>
    </div>
  );
};
export default OfficerTopBar;
