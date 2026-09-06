import React, { useState } from 'react';
import { Booking } from '@/types';
import { transitionBookingStatus } from '@/services/officerService';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { InputField } from '@/components/forms/InputField';
import { UserCheck, X, QrCode } from 'lucide-react';

interface CheckInModalProps {
  isOpen: boolean;
  bookings: Booking[];
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  isOpen,
  bookings,
  onClose,
  onSuccess,
}) => {
  const [quickCheckInInput, setQuickCheckInInput] = useState<string>('');
  const [quickCheckInError, setQuickCheckInError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setQuickCheckInInput('');
    setQuickCheckInError('');
    onClose();
  };

  const handleQuickCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCheckInInput.trim() || isSubmitting) return;

    const trimmed = quickCheckInInput.trim().toLowerCase().replace('#', '');
    const found = bookings.find(
      (b) =>
        b.tokenNumber.toString() === trimmed ||
        b.farmerMobile.replace(/\s+/g, '').includes(trimmed) ||
        b.farmerName.toLowerCase().includes(trimmed)
    );

    if (!found) {
      setQuickCheckInError('No booking found matching this token, phone, or name.');
      return;
    }

    setIsSubmitting(true);
    try {
      await transitionBookingStatus(found.id, 'ARRIVED');
      setQuickCheckInInput('');
      setQuickCheckInError('');
      onClose();
      onSuccess();
    } catch (err) {
      console.error(err);
      setQuickCheckInError('Failed to check in farmer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-md shadow-elevated border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-slate-100">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#166534]" />
            Check In Farmer at Gate
          </CardTitle>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>

        <form onSubmit={handleQuickCheckInSubmit}>
          <CardContent className="p-5 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Enter the farmer's assigned Token # or registered 10-digit mobile number to confirm arrival at Gate 2.
            </p>

            <InputField
              label="Token Number or Mobile"
              placeholder="e.g. 1 or 9876543210"
              value={quickCheckInInput}
              onChange={(e) => {
                setQuickCheckInInput(e.target.value);
                setQuickCheckInError('');
              }}
              error={quickCheckInError}
              autoFocus
              required
            />

            {/* QR Code Scanner Placeholder */}
            <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-input text-center">
              <QrCode className="w-8 h-8 text-slate-400 mx-auto mb-1" />
              <span className="text-xs font-semibold text-slate-700 block">
                Optical QR Code Scanner Ready
              </span>
              <span className="text-[11px] text-slate-400">
                Handheld barcode/QR scanner auto-fills token
              </span>
            </div>
          </CardContent>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              Confirm Gate Check-In
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
export default CheckInModal;
