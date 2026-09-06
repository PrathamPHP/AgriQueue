import React from 'react';
import { Booking, ProcurementCentre } from '@/types';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { formatCurrency } from '@/lib/utils';
import { X, Printer } from 'lucide-react';

interface ProcurementReceiptModalProps {
  booking: Booking | null;
  centre: ProcurementCentre;
  officerName: string;
  onClose: () => void;
}

export const ProcurementReceiptModal: React.FC<ProcurementReceiptModalProps> = ({
  booking,
  centre,
  officerName,
  onClose,
}) => {
  if (!booking) return null;

  const netWeight = booking.acceptedQuantityKg || booking.quantityKg;
  const dbtPayable = Math.round((netWeight / 100) * 2275);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-lg shadow-elevated border-slate-200 bg-white">
        <CardHeader className="py-4 border-b border-slate-200 flex flex-row items-center justify-between bg-slate-50">
          <div>
            <span className="text-[10px] font-bold text-[#166534] uppercase tracking-wider block">
              Government of India • Ministry of Agriculture
            </span>
            <CardTitle className="text-base font-extrabold text-slate-900">
              Form J — Mandi Sale & Procurement Receipt
            </CardTitle>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>

        <CardContent className="p-6 space-y-4 text-xs">
          <div className="flex justify-between items-start border-b border-slate-200 pb-3">
            <div>
              <span className="text-slate-500 block text-[11px]">Depot / Mandi:</span>
              <span className="font-bold text-slate-900">{centre.name}</span>
              <span className="text-slate-500 block">{centre.district}, {centre.state}</span>
            </div>
            <div className="text-right font-mono">
              <span className="text-slate-500 block text-[11px]">Receipt No:</span>
              <span className="font-bold text-slate-900">
                RCP-{booking.id.slice(-6).toUpperCase()}
              </span>
              <span className="text-slate-400 block text-[10px]">
                Token #{booking.tokenNumber}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 py-1">
            <div>
              <span className="text-slate-500 block">Farmer Name:</span>
              <span className="font-bold text-slate-900">{booking.farmerName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Registered Mobile:</span>
              <span className="font-mono font-bold text-slate-900">
                {booking.farmerMobile}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Commodity:</span>
              <span className="font-bold text-slate-900">{booking.cropName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Quality Grade:</span>
              <span className="font-bold text-[#166534]">
                {booking.qualityGrade || 'Grade A'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-input border border-slate-200 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-600">Accepted Net Weight:</span>
              <span className="font-bold text-slate-900">
                {netWeight} KG
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">MSP Rate (Govt Benchmark):</span>
              <span className="font-bold text-slate-900">₹2,275 / Quintal</span>
            </div>
            <div className="flex justify-between text-[#166534] pt-1 border-t border-slate-200 text-sm">
              <span className="font-bold">Total DBT Payable:</span>
              <span className="font-extrabold">
                {formatCurrency(dbtPayable)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-input border border-emerald-200 flex items-center justify-between text-[11px] text-[#166534]">
            <span>Status: <strong>Weighbridge Certified & Dispatched to PFMS</strong></span>
            <span className="font-bold">Verified by {officerName}</span>
          </div>
        </CardContent>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-mono">AgriQueue Digital J-Form Engine</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={() => window.print()}
            >
              Print
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
export default ProcurementReceiptModal;
