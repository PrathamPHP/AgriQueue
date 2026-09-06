import React from 'react';
import { Booking } from '@/types';
import { Button } from '@/components/common/Button';
import { X } from 'lucide-react';

interface BookingDetailModalProps {
  booking: Booking | null;
  onClose: () => void;
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  onClose,
}) => {
  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="w-full max-w-md bg-white h-full shadow-elevated flex flex-col justify-between overflow-y-auto">
        <div>
          {/* Drawer Header */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#166534]">
                Booking & Audit Dossier
              </span>
              <h3 className="text-base font-extrabold text-slate-900">
                Token #{booking.tokenNumber} — {booking.farmerName}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="p-5 space-y-4 text-xs">
            {/* Farmer identity info */}
            <div className="p-3.5 bg-slate-50 rounded-input border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Mobile Number:</span>
                <span className="font-mono font-bold">{booking.farmerMobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Booking ID:</span>
                <span className="font-mono text-slate-700">{booking.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Scheduled Slot:</span>
                <span className="font-bold text-slate-800">{booking.timeWindow}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Commodity:</span>
                <span className="font-bold">{booking.cropName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Declared Quantity:</span>
                <span className="font-bold">{booking.quantityKg.toLocaleString()} kg</span>
              </div>
              {booking.acceptedQuantityKg && (
                <div className="flex justify-between text-[#166534]">
                  <span className="font-medium">Accepted Quantity:</span>
                  <span className="font-extrabold">{booking.acceptedQuantityKg} kg</span>
                </div>
              )}
              {booking.qualityGrade && (
                <div className="flex justify-between text-[#166534]">
                  <span className="font-medium">Quality Grade:</span>
                  <span className="font-extrabold">{booking.qualityGrade}</span>
                </div>
              )}
            </div>

            {/* Stage Timestamps Timeline */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Audit Log & Stage Timestamps:
              </h4>
              <div className="space-y-2 border-l-2 border-slate-200 pl-3 ml-1">
                {Object.entries(booking.stageTimestamps || {}).map(([stage, time]) => (
                  <div key={stage} className="relative">
                    <span className="w-2 h-2 rounded-full bg-[#166534] absolute -left-[17px] top-1" />
                    <div className="font-bold text-slate-800">{stage}</div>
                    <div className="text-[11px] text-slate-500">{time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close Dossier
          </Button>
        </div>
      </div>
    </div>
  );
};
export default BookingDetailModal;
