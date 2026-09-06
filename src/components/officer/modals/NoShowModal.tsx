import React, { useState } from 'react';
import { Booking } from '@/types';
import { markNoShow } from '@/services/officerService';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { AlertTriangle } from 'lucide-react';

interface NoShowModalProps {
  booking: Booking | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const NoShowModal: React.FC<NoShowModalProps> = ({
  booking,
  onClose,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!booking) return null;

  const handleConfirmNoShow = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await markNoShow(booking.id);
      onClose();
      onSuccess();
    } catch (err) {
      console.error('Failed to mark no-show', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-sm shadow-elevated border-red-300">
        <CardHeader className="py-4 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-[#DC2626] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Confirm No-Show
          </CardTitle>
        </CardHeader>

        <CardContent className="p-5 text-xs text-slate-700 leading-relaxed">
          Are you sure you want to mark Token #{booking.tokenNumber} ({booking.farmerName}) as <strong>No-Show</strong>?
          <p className="mt-2 text-slate-500">
            This will release their scheduled slot and notify the farmer to rebook or report to the helpdesk.
          </p>
        </CardContent>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmNoShow} disabled={isSubmitting}>
            Confirm Mark No-Show
          </Button>
        </div>
      </Card>
    </div>
  );
};
export default NoShowModal;
