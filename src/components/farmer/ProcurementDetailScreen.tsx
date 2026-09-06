import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Booking, Procurement, LanguageCode } from '@/types';
import { bookingService } from '@/services/bookingService';
import { procurementService } from '@/services/procurementService';
import { dataStore } from '@/services/dataStore';
import { useTranslation } from '@/i18n/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Timeline, TimelineStep } from '@/components/common/Timeline';
import { Button } from '@/components/common/Button';
import { formatCurrency } from '@/lib/utils';
import {
  QrCode,
  MapPin,
  Calendar,
  Clock,
  Scale,
  ShieldCheck,
  CreditCard,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Wheat,
} from 'lucide-react';

interface ProcurementDetailScreenProps {
  currentLanguage: LanguageCode;
}

export const ProcurementDetailScreen: React.FC<ProcurementDetailScreenProps> = ({ currentLanguage }) => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(() => {
    if (!id) return null;
    return dataStore.getBookingById(id) || null;
  });
  const [procurement, setProcurement] = useState<Procurement | null>(() => {
    if (!id) return null;
    return dataStore.getProcurement(id) || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!id) return false;
    return !dataStore.getBookingById(id);
  });
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const isFetchingRef = useRef<boolean>(false);

  const load = useCallback(async (showLoader = false) => {
    if (!id || isFetchingRef.current) return;
    isFetchingRef.current = true;

    // Only display full-screen loader if we have zero cached data to render
    if (showLoader && !dataStore.getBookingById(id)) {
      setIsLoading(true);
    }

    try {
      // 1. Immediately hydrate from local store if available so user sees content instantly
      const cachedBooking = dataStore.getBookingById(id);
      if (cachedBooking) {
        setBooking((prev) => {
          if (
            prev &&
            prev.id === cachedBooking.id &&
            prev.currentStage === cachedBooking.currentStage &&
            prev.status === cachedBooking.status &&
            prev.acceptedQuantityKg === cachedBooking.acceptedQuantityKg &&
            prev.qualityGrade === cachedBooking.qualityGrade
          ) {
            return prev;
          }
          return cachedBooking;
        });
      }

      const cachedProc = dataStore.getProcurement(id);
      if (cachedProc) {
        setProcurement((prev) => {
          if (
            prev &&
            prev.id === cachedProc.id &&
            prev.netPayableAmount === cachedProc.netPayableAmount &&
            prev.qualityGrade === cachedProc.qualityGrade
          ) {
            return prev;
          }
          return cachedProc;
        });
      }

      // 2. Fetch authoritative data from backend
      const b = await bookingService.getBookingById(id);
      if (b) {
        setBooking((prev) => {
          if (
            prev &&
            prev.id === b.id &&
            prev.currentStage === b.currentStage &&
            prev.status === b.status &&
            prev.acceptedQuantityKg === b.acceptedQuantityKg &&
            prev.qualityGrade === b.qualityGrade
          ) {
            return prev;
          }
          return b;
        });

        const p = await procurementService.getProcurementByBookingId(b.id);
        if (p) {
          setProcurement((prev) => {
            if (
              prev &&
              prev.id === p.id &&
              prev.netPayableAmount === p.netPayableAmount &&
              prev.qualityGrade === p.qualityGrade
            ) {
              return prev;
            }
            return p;
          });
        }
      }
    } catch (err) {
      console.error('Failed to load procurement details:', err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [id]);

  useEffect(() => {
    const hasInitial = !!dataStore.getBookingById(id || '');
    load(!hasInitial);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = dataStore.subscribe(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        load(false); // Never show loader on background subscription update
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
        <p className="text-sm text-slate-500 font-medium">Loading procurement dossier...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-slate-900">Procurement Record Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">The requested booking ID could not be located.</p>
        <Button variant="primary" className="mt-4" onClick={() => navigate('/farmer/dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  // Build Procurement Timeline Steps
  const stagesOrder = ['BOOKED', 'ARRIVED', 'VERIFICATION', 'QUALITY_CHECK', 'WEIGHING', 'COMPLETED'];
  const currentIndex = stagesOrder.indexOf(booking.currentStage);

  const stepDefinitions: Record<string, { title: string; desc: string }> = {
    BOOKED: { title: 'Slot Booked & Token Issued', desc: `Token #${booking.tokenNumber} issued for ${booking.timeWindow}.` },
    ARRIVED: { title: 'Mandi Gate Entry', desc: 'Arrived and verified at procurement gate.' },
    VERIFICATION: { title: 'Identity & Land Record Verified', desc: 'Aadhaar, farmer ID, and crop quota authenticated.' },
    QUALITY_CHECK: { title: 'Grain Quality Inspection', desc: booking.qualityGrade ? `Graded as ${booking.qualityGrade} (FAQ compliant).` : 'Quality testing in progress.' },
    WEIGHING: { title: 'Digital Weighbridge Measurement', desc: booking.acceptedQuantityKg ? `Net weight: ${booking.acceptedQuantityKg} kg.` : 'Gross and tare weighment.' },
    COMPLETED: { title: 'Procurement Complete & Certified', desc: 'Digital receipt generated. Ready for PFMS DBT transfer.' },
  };

  const timelineSteps: TimelineStep[] = stagesOrder.map((stageKey, idx) => {
    const isCompleted = idx < currentIndex || (booking.currentStage === 'COMPLETED' && idx <= currentIndex);
    const isCurrent = idx === currentIndex && booking.currentStage !== 'COMPLETED';
    const def = stepDefinitions[stageKey];

    return {
      stage: stageKey as any,
      title: def.title,
      description: def.desc,
      timestamp: (booking.stageTimestamps as any)[stageKey],
      status: isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming',
    };
  });

  const cropMsp = procurement?.mspRatePerQuintal || 2275;
  const netKg = booking.acceptedQuantityKg || booking.quantityKg;
  const totalAmount = Math.round((netKg / 100) * cropMsp);

  const handlePrintDownload = () => {
    setDownloadSuccess(true);
    window.print();
    setTimeout(() => setDownloadSuccess(false), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in pb-12">
      {/* Header breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => navigate('/farmer/dashboard')}
              className="font-bold text-[#166534] hover:underline"
            >
              ← Dashboard
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={() => navigate('/farmer/bookings')}
              className="font-bold text-[#166534] hover:underline"
            >
              My Bookings
            </button>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-mono">Token #{booking.tokenNumber}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827] mt-1">
            Procurement Gate Pass & Audit Dossier
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePrintDownload}
          >
            Download e-Pass
          </Button>

          {booking.currentStage !== 'COMPLETED' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Clock className="w-4 h-4" />}
              onClick={() => navigate('/farmer/queue')}
            >
              Live Queue
            </Button>
          )}
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-input text-xs font-semibold text-[#166534] flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          e-Pass & Receipt PDF generated successfully and ready for offline gate presentation.
        </div>
      )}

      {/* Main Grid: Pass on Left, Workflow on Right */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left Column: Digital Token Gate Pass Card */}
        <div className="space-y-4">
          <Card className="border-2 border-[#166534] bg-white overflow-hidden shadow-card">
            <div className="bg-[#166534] text-white p-3 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-100">
                Department of Consumer Affairs • Mandi Gate Pass
              </span>
            </div>

            <CardContent className="p-5 text-center space-y-4">
              <div className="inline-block px-4 py-2 bg-emerald-50 rounded-card border border-emerald-200">
                <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider block">
                  Official Token Number
                </span>
                <span className="text-3xl font-extrabold text-[#166534] font-mono">
                  #{booking.tokenNumber}
                </span>
              </div>

              {/* QR Mock */}
              <div className="w-36 h-36 mx-auto bg-slate-50 border-2 border-slate-300 rounded-card p-2 flex flex-col items-center justify-center shadow-inner">
                <QrCode className="w-24 h-24 text-slate-800" />
                <span className="text-[9px] font-mono text-slate-500 mt-1 uppercase">
                  {booking.id.slice(0, 16)}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-left border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Farmer:</span>
                  <span className="font-bold text-slate-900">{booking.farmerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Crop:</span>
                  <span className="font-bold text-slate-900">{booking.cropName} ({booking.cropNameHindi || 'गेहूं'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Batch Load:</span>
                  <span className="font-bold text-slate-900">{booking.quantityKg} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-bold text-slate-900">{booking.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Slot Window:</span>
                  <span className="font-bold text-slate-900">{booking.timeWindow}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Centre:</span>
                  <span className="font-bold text-slate-900 text-right">{booking.centreName}</span>
                </div>
              </div>

              <div className="pt-2">
                <StatusBadge status={booking.currentStage as any} />
              </div>
            </CardContent>
          </Card>

          {/* MSP Payout Summary Card */}
          <Card className="p-4 bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2 text-xs font-bold text-[#166534] uppercase tracking-wider mb-2">
              <Scale className="w-4 h-4" />
              MSP Guaranteed Valuation
            </div>
            <div className="text-2xl font-extrabold text-[#111827]">
              {formatCurrency(totalAmount)}
            </div>
            <div className="text-xs text-slate-600 mt-1 space-y-0.5">
              <div>Rate: ₹{cropMsp} / quintal (MSP)</div>
              <div>Net Weight: {netKg} kg ({((netKg) / 100).toFixed(2)} quintals)</div>
            </div>

            <Button
              variant="primary"
              size="sm"
              className="w-full mt-3"
              icon={<CreditCard className="w-3.5 h-3.5" />}
              onClick={() => navigate(`/farmer/payment/pay-${booking.id}`)}
            >
              Track DBT Payment Status
            </Button>
          </Card>
        </div>

        {/* Right Column: Verified Stage Timeline & Lab Inspection */}
        <div className="md:col-span-2 space-y-5">
          {/* Stage Timeline */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#166534]" />
                Official Procurement Workflow Progression
              </h3>
              <span className="text-xs text-slate-500 font-mono">Stage: {booking.currentStage}</span>
            </div>

            <Timeline steps={timelineSteps} />
          </Card>

          {/* Quality & Weighbridge Inspection Cert */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText className="w-4 h-4 text-[#166534]" />
              Inspection & Weighment Certificate
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-card border border-slate-200">
                <span className="text-slate-500 block">Quality Grade</span>
                <span className="text-base font-bold text-emerald-800 mt-1 block">
                  {booking.qualityGrade || 'Grade A (FAQ)'}
                </span>
                <span className="text-[11px] text-slate-500">FCI FAQ Certified</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-card border border-slate-200">
                <span className="text-slate-500 block">Digital Weighment</span>
                <span className="text-base font-bold text-slate-900 mt-1 block">
                  {booking.acceptedQuantityKg || booking.quantityKg} kg
                </span>
                <span className="text-[11px] text-slate-500">
                  Actual: {booking.actualWeightKg || booking.quantityKg} kg (Net Accepted)
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-card border border-slate-200">
                <span className="text-slate-500 block">Procurement Officer</span>
                <span className="text-base font-bold text-slate-900 mt-1 block truncate">
                  {(dataStore.getOfficers().find((o) => o.centreId === booking.centreId) || dataStore.getCurrentOfficer()).name}
                </span>
                <span className="text-[11px] text-slate-500 truncate block">
                  {booking.centreName}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-card border border-slate-100 text-xs text-slate-600">
              <span className="font-semibold text-slate-700 block mb-1">Standard Remarks:</span>
              {booking.remarks || 'Grain meets all Fair Average Quality (FAQ) parameters. No excessive moisture or foreign matter detected. Accepted for Central Pool storage.'}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProcurementDetailScreen;
