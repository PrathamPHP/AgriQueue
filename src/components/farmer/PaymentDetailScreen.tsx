import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Payment, Booking, LanguageCode } from '@/types';
import { paymentService } from '@/services/paymentService';
import { bookingService } from '@/services/bookingService';
import { dataStore } from '@/services/dataStore';
import { useTranslation } from '@/i18n/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import { formatCurrency } from '@/lib/utils';
import {
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  DollarSign,
  Download,
} from 'lucide-react';

interface PaymentDetailScreenProps {
  currentLanguage: LanguageCode;
}

export const PaymentDetailScreen: React.FC<PaymentDetailScreenProps> = ({ currentLanguage }) => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [payment, setPayment] = useState<Payment | null>(() => {
    if (!id) return null;
    const payments = dataStore.getPayments();
    return payments[id] || Object.values(payments).find((item) => item.id === id || item.procurementId === id || `pay-${item.bookingId}` === id) || null;
  });
  const [booking, setBooking] = useState<Booking | null>(() => {
    if (!id) return null;
    const payments = dataStore.getPayments();
    const p = payments[id] || Object.values(payments).find((item) => item.id === id || item.procurementId === id || `pay-${item.bookingId}` === id);
    if (p) {
      return dataStore.getBookingById(p.bookingId) || null;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!id) return false;
    const payments = dataStore.getPayments();
    const hasP = !!(payments[id] || Object.values(payments).find((item) => item.id === id || item.procurementId === id || `pay-${item.bookingId}` === id));
    return !hasP;
  });

  const isFetchingRef = useRef<boolean>(false);

  const load = useCallback(async (showLoader = false) => {
    if (!id || isFetchingRef.current) return;
    isFetchingRef.current = true;

    const payments = dataStore.getPayments();
    const hasCached = !!(payments[id] || Object.values(payments).find((item) => item.id === id || item.procurementId === id || `pay-${item.bookingId}` === id));

    if (showLoader && !hasCached) {
      setIsLoading(true);
    }

    try {
      let p = await paymentService.getPaymentByProcurementId(id);
      if (!p) {
        const all = await paymentService.getAllPayments();
        p = all.find((item) => item.id === id || item.procurementId === id || `pay-${item.bookingId}` === id) || null;
      }

      if (p) {
        setPayment((prev) => (prev && prev.id === p.id && prev.status === p.status && prev.amount === p.amount ? prev : p));
        const b = await bookingService.getBookingById(p.bookingId);
        if (b) {
          setBooking((prev) => (prev && prev.id === b.id && prev.currentStage === b.currentStage ? prev : b));
        }
      }
    } catch (err) {
      console.error('Failed to load payment details:', err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [id]);

  useEffect(() => {
    const payments = dataStore.getPayments();
    const hasInitial = !!(payments[id || ''] || Object.values(payments).find((item) => item.id === id || item.procurementId === id || `pay-${item.bookingId}` === id));
    load(!hasInitial);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = dataStore.subscribe(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        load(false);
      }, 200);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [id, load]);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <p className="text-sm text-slate-500 font-medium">Loading DBT payment records...</p>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-slate-900">Payment Record Pending or Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">
          Payment will be initiated automatically once grain weighment and digital certification are completed at the centre.
        </p>
        <Button variant="primary" className="mt-4" onClick={() => navigate('/farmer/dashboard')}>
          {t('dashboard', 'Return to Dashboard')}
        </Button>
      </div>
    );
  }

  const isPaid = payment.status === 'PAID';

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in pb-12">
      {/* Header breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => navigate('/farmer/dashboard')}
              className="font-bold text-[#166534] hover:underline"
            >
              ← {t('dashboard', 'Dashboard')}
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={() => navigate('/farmer/bookings')}
              className="font-bold text-[#166534] hover:underline"
            >
              My Bookings
            </button>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-mono">DBT Payout</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827] mt-1">
            PFMS Direct Benefit Transfer (DBT) Status
          </h1>
        </div>

        {booking && (
          <Button
            variant="outline"
            size="sm"
            icon={<FileText className="w-4 h-4" />}
            onClick={() => navigate(`/farmer/procurement/${booking.id}`)}
          >
            View Procurement Receipt
          </Button>
        )}
      </div>

      {/* Main Settlement Hero Card */}
      <Card className="p-6 bg-white border border-slate-200 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Total MSP Settlement Amount
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#111827] mt-1">
              {formatCurrency(payment.amount)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Government of India MSP Guaranteed Direct Bank Transfer
            </p>
          </div>

          <div className="sm:text-right space-y-1">
            <StatusBadge status={payment.status as any} size="md" />
            <div className="text-xs text-slate-500 font-mono">
              {payment.referenceId || 'PFMS-BATCH-PENDING'}
            </div>
          </div>
        </div>

        {/* Bank & Beneficiary Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 text-xs">
          <div className="p-3 bg-slate-50 rounded-card border border-slate-200">
            <span className="text-slate-500 block">Beneficiary Account</span>
            <span className="font-bold text-slate-900 text-sm mt-1 block">
              {payment.bankAccountMasked || 'Aadhaar-Linked Primary Account'}
            </span>
            <span className="text-[11px] text-slate-500">Aadhaar Payment Bridge (APB)</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-card border border-slate-200">
            <span className="text-slate-500 block">Settlement Channel</span>
            <span className="font-bold text-slate-900 text-sm mt-1 block">
              {payment.paymentMode || 'PFMS / DBT'}
            </span>
            <span className="text-[11px] text-slate-500">Central Food Procurement Pool</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-card border border-slate-200">
            <span className="text-slate-500 block">
              {isPaid ? 'Credited Timestamp' : 'Dispatched Timestamp'}
            </span>
            <span className="font-bold text-slate-900 text-sm mt-1 block">
              {payment.paidAt || payment.initiatedAt || 'Today'}
            </span>
            <span className="text-[11px] text-slate-500">
              {isPaid ? 'PFMS UTR Verified' : 'SLA Target: < 48 Hours'}
            </span>
          </div>
        </div>
      </Card>

      {/* DBT Timeline Progression */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#166534]" />
          DBT Clearance Milestones
        </h3>

        <div className="space-y-4 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#166534] flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900">Procurement Certified & Weighment Accepted</div>
              <div className="text-slate-500">Officer verified quality and net grain weight at weighbridge.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#166534] flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900">PFMS Batch Generated & Treasury Signed</div>
              <div className="text-slate-500">Digital signature applied by Mandi Senior Procurement Inspector.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              isPaid ? 'bg-emerald-100 text-[#166534]' : 'bg-amber-100 text-amber-700 animate-pulse'
            }`}>
              {isPaid ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
            <div>
              <div className="font-bold text-slate-900">
                {isPaid ? 'Bank Credit Complete (Funds Settled)' : 'Bank Treasury Clearing in Progress'}
              </div>
              <div className="text-slate-500">
                {isPaid
                  ? `Amount successfully credited to linked bank account. UTR: ${payment.referenceId}`
                  : 'File dispatched to beneficiary bank for RTGS/NEFT settlement.'}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
