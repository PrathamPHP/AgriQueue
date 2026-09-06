import React, { useState, useEffect } from 'react';
import { Booking } from '@/types';
import { transitionBookingStatus } from '@/services/officerService';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { InputField } from '@/components/forms/InputField';
import { ShieldCheck, X, Check } from 'lucide-react';

interface QCModalProps {
  booking: Booking | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const QCModal: React.FC<QCModalProps> = ({
  booking,
  onClose,
  onSuccess,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<'Grade A' | 'Grade B' | 'Grade C'>('Grade A');
  const [isQcAccepted, setIsQcAccepted] = useState<boolean>(true);
  const [qcRemarks, setQcRemarks] = useState<string>('Standard moisture (11.2%), zero foreign debris');
  const [qcErrorMessage, setQcErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (booking) {
      setSelectedGrade(booking.qualityGrade || 'Grade A');
      setIsQcAccepted(true);
      setQcRemarks(booking.remarks || 'Standard moisture (11.2%), zero foreign debris, meets FCI specs');
      setQcErrorMessage('');
    }
  }, [booking]);

  if (!booking) return null;

  const handleSubmitQualityCheck = async () => {
    if (isSubmitting) return;
    if (!isQcAccepted && !qcRemarks.trim()) {
      setQcErrorMessage('Please specify the reason for quality rejection in remarks.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isQcAccepted) {
        await transitionBookingStatus(booking.id, 'WEIGHING', {
          qualityGrade: selectedGrade,
          remarks: qcRemarks,
        });
      } else {
        await transitionBookingStatus(booking.id, 'CANCELLED', {
          qualityGrade: selectedGrade,
          remarks: qcRemarks,
        });
      }
      onClose();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setQcErrorMessage(err.message || 'Failed to submit quality check.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-md shadow-elevated border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-slate-100">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#166534]" />
            Produce Quality Inspection (Token #{booking.tokenNumber})
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
              <span className="text-slate-500">Produce:</span>
              <span className="font-bold text-slate-900">
                {booking.quantityKg.toLocaleString()} kg {booking.cropName}
              </span>
            </div>
          </div>

          {/* Acceptance Decision */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-900 block">
              Quality Assessment Decision:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsQcAccepted(true)}
                className={`p-2.5 rounded-input border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  isQcAccepted
                    ? 'bg-[#DCFCE7] text-[#166534] border-[#166534] ring-1 ring-[#166534]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Check className="w-4 h-4 text-[#166534]" />
                Accept Lot
              </button>
              <button
                type="button"
                onClick={() => setIsQcAccepted(false)}
                className={`p-2.5 rounded-input border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  !isQcAccepted
                    ? 'bg-red-50 text-red-700 border-red-500 ring-1 ring-red-500'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <X className="w-4 h-4 text-red-600" />
                Reject Lot
              </button>
            </div>
          </div>

          {/* Quality Grade Radios (if Accepted) */}
          {isQcAccepted && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-900 block">
                Certified Quality Grade:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Grade A', 'Grade B', 'Grade C'] as const).map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setSelectedGrade(grade)}
                    className={`p-2.5 rounded-input border text-xs font-bold transition-all ${
                      selectedGrade === grade
                        ? 'bg-[#DCFCE7] text-[#166534] border-[#166534] ring-1 ring-[#166534]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isQcAccepted && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-input text-xs text-red-800">
              <strong>Notice:</strong> Rejecting this produce lot will halt procurement. The farmer will be notified with the reason recorded below.
            </div>
          )}

          <InputField
            label="Quality Remarks (Moisture %, Foreign Matter, Condition)"
            value={qcRemarks}
            onChange={(e) => {
              setQcRemarks(e.target.value);
              setQcErrorMessage('');
            }}
            placeholder={isQcAccepted ? "e.g. Moisture 11.2%, Foreign matter: 0.8%" : "e.g. High moisture 18.5%, excessive foreign debris exceeding FAQ limit"}
            required={!isQcAccepted}
          />

          {qcErrorMessage && (
            <p className="text-xs text-red-600 font-medium">{qcErrorMessage}</p>
          )}
        </CardContent>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={isQcAccepted ? "primary" : "danger"}
            onClick={handleSubmitQualityCheck}
            disabled={isSubmitting}
          >
            {isQcAccepted ? "Pass & Move to Weighbridge" : "Confirm Rejection"}
          </Button>
        </div>
      </Card>
    </div>
  );
};
export default QCModal;
