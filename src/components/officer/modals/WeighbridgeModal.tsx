import React, { useState, useEffect } from 'react';
import { Booking } from '@/types';
import { transitionBookingStatus } from '@/services/officerService';
import { dataStore } from '@/services/dataStore';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { InputField } from '@/components/forms/InputField';
import { formatCurrency } from '@/lib/utils';
import { Scale, X } from 'lucide-react';

interface WeighbridgeModalProps {
  booking: Booking | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const WeighbridgeModal: React.FC<WeighbridgeModalProps> = ({
  booking,
  onClose,
  onSuccess,
}) => {
  const [actualWeightKg, setActualWeightKg] = useState<string>('');
  const [acceptedQuantityKg, setAcceptedQuantityKg] = useState<string>('');
  const [weighingErrorMessage, setWeighingErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (booking) {
      const estActual = booking.actualWeightKg ? booking.actualWeightKg.toString() : booking.quantityKg.toString();
      const estAccepted = booking.acceptedQuantityKg ? booking.acceptedQuantityKg.toString() : estActual;
      setActualWeightKg(estActual);
      setAcceptedQuantityKg(estAccepted);
      setWeighingErrorMessage('');
    }
  }, [booking]);

  if (!booking) return null;

  const crop = dataStore.getCropById(booking.cropId);
  const msp = crop?.mspPerQuintal || 2275;
  const parsedAccepted = parseFloat(acceptedQuantityKg) || 0;
  const totalPayable = Math.round((parsedAccepted / 100) * msp);

  const handleSubmitWeighing = async () => {
    if (isSubmitting) return;
    const actual = parseFloat(actualWeightKg);
    const accepted = parseFloat(acceptedQuantityKg);

    if (isNaN(actual) || actual <= 0) {
      setWeighingErrorMessage('Please enter a valid positive actual measured weight.');
      return;
    }
    if (isNaN(accepted) || accepted <= 0) {
      setWeighingErrorMessage('Please enter a valid positive accepted quantity.');
      return;
    }
    if (accepted > actual) {
      setWeighingErrorMessage('Accepted quantity cannot exceed actual measured weight.');
      return;
    }

    setIsSubmitting(true);
    try {
      await transitionBookingStatus(booking.id, 'COMPLETED', {
        actualWeightKg: actual,
        acceptedQuantityKg: accepted,
        totalGrossAmount: totalPayable,
        netPayableAmount: totalPayable,
      });
      onClose();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setWeighingErrorMessage(err.message || 'Failed to complete weighing and procurement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-md shadow-elevated border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-slate-100">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#166534]" />
            Digital Weighbridge Entry (Token #{booking.tokenNumber})
          </CardTitle>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          <div className="p-3 bg-slate-50 rounded-input text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Farmer:</span>
              <span className="font-bold text-slate-900">{booking.farmerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Declared Quantity (Booked):</span>
              <span className="font-bold text-slate-900 font-mono">
                {booking.quantityKg.toLocaleString()} kg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Approved Quality:</span>
              <span className="font-bold text-[#166534]">
                {booking.qualityGrade || 'Grade A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">MSP Benchmark Rate:</span>
              <span className="font-bold text-slate-900 font-mono">
                ₹{msp.toLocaleString()} / Quintal
              </span>
            </div>
          </div>

          <InputField
            label="Actual Measured Gross/Net Weight (kg)"
            type="number"
            value={actualWeightKg}
            onChange={(e) => {
              setActualWeightKg(e.target.value);
              setWeighingErrorMessage('');
            }}
            trailingIcon={<span className="text-xs font-bold text-slate-500">KG</span>}
            required
            helperText="Digital weighbridge reading (numbers only, non-negative)."
          />

          <InputField
            label="Final Accepted Quantity (kg)"
            type="number"
            value={acceptedQuantityKg}
            onChange={(e) => {
              setAcceptedQuantityKg(e.target.value);
              setWeighingErrorMessage('');
            }}
            trailingIcon={<span className="text-xs font-bold text-slate-500">KG</span>}
            required
            helperText="Certified lot quantity (cannot exceed actual measured weight)."
          />

          {weighingErrorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
              {weighingErrorMessage}
            </div>
          )}

          {/* Live MSP Calculation */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-input flex items-center justify-between text-xs">
            <div>
              <span className="text-[#166534] font-medium block">Total Procurement DBT Payout:</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {parsedAccepted} kg × ₹{msp}/q
              </span>
            </div>
            <span className="text-lg font-extrabold text-[#166534]">
              {formatCurrency(totalPayable)}
            </span>
          </div>
        </CardContent>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmitWeighing} disabled={isSubmitting}>
            Complete Procurement & Generate Payment
          </Button>
        </div>
      </Card>
    </div>
  );
};
export default WeighbridgeModal;
