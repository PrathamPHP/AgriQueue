import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Officer,
  ProcurementCentre,
  Booking,
  Payment,
  CentreStats,
} from '@/types';
import {
  getCurrentOfficer,
  getOfficerCentre,
  getTodayBookings,
  getCentreStats,
  transitionBookingStatus,
  advanceOfficerQueue,
  setOfficerCentreDelay,
  subscribeToOfficerUpdates,
} from '@/services/officerService';
import { paymentService } from '@/services/paymentService';
import { dataStore } from '@/services/dataStore';
import { Button } from '@/components/common/Button';
import { RefreshCw, AlertTriangle } from 'lucide-react';

// Subcomponents
import { OfficerSidebar } from './OfficerSidebar';
import { OfficerOverviewTab } from './OfficerOverviewTab';
import { OfficerQueueTab } from './OfficerQueueTab';
import { OfficerBookingsTab } from './OfficerBookingsTab';
import { OfficerProcurementsTab } from './OfficerProcurementsTab';
import { OfficerPaymentsTab } from './OfficerPaymentsTab';
import { OfficerAnalyticsTab } from './OfficerAnalyticsTab';
import { OfficerSettingsTab } from './OfficerSettingsTab';

// Modals
import { CheckInModal } from './modals/CheckInModal';
import { QCModal } from './modals/QCModal';
import { WeighbridgeModal } from './modals/WeighbridgeModal';
import { NoShowModal } from './modals/NoShowModal';
import { ProcurementReceiptModal } from './modals/ProcurementReceiptModal';
import { BookingDetailModal } from './modals/BookingDetailModal';

export function OfficerDashboard() {
  const location = useLocation();

  // Core Data State
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [centre, setCentre] = useState<ProcurementCentre | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<CentreStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Concurrency and debounce guards
  const isFetchingRef = useRef<boolean>(false);
  const pendingRefreshRef = useRef<boolean>(false);

  // Workflow Modal States
  const [checkInModalOpen, setCheckInModalOpen] = useState<boolean>(false);
  const [qcBooking, setQcBooking] = useState<Booking | null>(null);
  const [weighingBooking, setWeighingBooking] = useState<Booking | null>(null);
  const [noShowBooking, setNoShowBooking] = useState<Booking | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<Booking | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);

  // Operations & Alerts
  const [batchSettlementSuccess, setBatchSettlementSuccess] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState<boolean>(false);
  const [isAdvancingQueue, setIsAdvancingQueue] = useState<boolean>(false);

  // Load Officer Dashboard Data with reentrancy protection
  const loadOfficerData = useCallback(async (showLoader = true) => {
    if (isFetchingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    isFetchingRef.current = true;

    try {
      if (showLoader) setIsLoading(true);
      setError(null);
      const [currentOff, offCentre] = await Promise.all([
        getCurrentOfficer(),
        getOfficerCentre(),
      ]);
      setOfficer(currentOff);
      setCentre(offCentre);

      const [todayBookings, centreStats, centrePayments] = await Promise.all([
        getTodayBookings(offCentre.id),
        getCentreStats(offCentre.id),
        paymentService.getCentrePayments(offCentre.id),
      ]);
      setBookings(todayBookings);
      setStats(centreStats);
      setPayments(centrePayments);
    } catch (err: any) {
      console.error('Failed to load officer dashboard data', err);
      setError("We couldn't load the operational queue data.");
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        loadOfficerData(false);
      }
    }
  }, []);

  // Real-time listener for shared data mutations with 300ms debounce
  useEffect(() => {
    loadOfficerData(true);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToOfficerUpdates(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadOfficerData(false);
      }, 300);
    });
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [loadOfficerData]);

  // Operational Actions
  const handleServeNext = async () => {
    if (!centre || isAdvancingQueue) return;
    setIsAdvancingQueue(true);
    try {
      await advanceOfficerQueue(centre.id);
    } catch (err) {
      console.error('Failed to advance queue', err);
    } finally {
      setIsAdvancingQueue(false);
    }
  };

  const handleSetDelay = async (delayMins: number) => {
    if (!centre) return;
    try {
      await setOfficerCentreDelay(centre.id, delayMins);
    } catch (err) {
      console.error('Failed to set delay', err);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    try {
      await transitionBookingStatus(bookingId, 'ARRIVED');
      loadOfficerData(false);
    } catch (err) {
      console.error('Failed to check in farmer', err);
    }
  };

  const handleCallToDesk = async (booking: Booking) => {
    if (!centre) return;
    try {
      await transitionBookingStatus(booking.id, 'NOW_SERVING');
      const queueEntries = Object.values(dataStore.getQueueEntries()).filter((q) => q.centreId === centre.id);
      queueEntries.forEach((q) => {
        const remaining = Math.max(0, q.tokenNumber - booking.tokenNumber);
        dataStore.updateQueueEntry(q.bookingId, {
          currentToken: booking.tokenNumber,
          farmersAhead: remaining,
          isTurnApproaching: remaining <= 2 && remaining > 0,
          lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        });
      });
      loadOfficerData(false);
    } catch (err) {
      console.error('Failed to call farmer to desk', err);
    }
  };

  const handleStartVerification = async (bookingId: string) => {
    try {
      await transitionBookingStatus(bookingId, 'VERIFICATION');
      loadOfficerData(false);
    } catch (err) {
      console.error('Failed to start verification', err);
    }
  };

  // Payment Lifecycle Actions
  const handleInitiatePayment = async (procurementId: string) => {
    try {
      await paymentService.updatePaymentStatus(procurementId, 'INITIATED');
      loadOfficerData(false);
    } catch (err) {
      console.error('Failed to initiate payment', err);
    }
  };

  const handleAuthorizeDisburse = async (procurementId: string) => {
    try {
      await paymentService.updatePaymentStatus(procurementId, 'PAID');
      loadOfficerData(false);
    } catch (err) {
      console.error('Failed to authorize payment', err);
    }
  };

  const handleAuthorizeBatchPayments = async () => {
    try {
      const eligiblePayments = payments.filter((p) => p.status === 'PENDING' || p.status === 'INITIATED');
      for (const p of eligiblePayments) {
        await paymentService.updatePaymentStatus(p.procurementId, 'PAID');
      }
      setBatchSettlementSuccess(`Successfully authorized ${eligiblePayments.length} DBT payment batches via PFMS.`);
      setTimeout(() => setBatchSettlementSuccess(null), 5000);
      loadOfficerData(false);
    } catch (err) {
      console.error('Failed to authorize batch payments', err);
    }
  };

  const handleSaveCapacity = (capacityPerHourKg: number) => {
    if (!centre) return;
    dataStore.updateCentre(centre.id, { capacityPerHourKg });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 4000);
  };

  // Determine current active route
  const currentPath = location.pathname;
  const isDashboard =
    currentPath === '/officer/dashboard' || currentPath === '/officer' || currentPath === '/officer/';
  const isLiveQueue = currentPath === '/officer/queue';
  const isBookings = currentPath === '/officer/bookings';
  const isProcurements = currentPath === '/officer/procurements';
  const isPayments = currentPath === '/officer/payments';
  const isAnalytics = currentPath === '/officer/analytics';
  const isSettings = currentPath === '/officer/settings';

  // Loading State
  if (isLoading && !officer) {
    return (
      <div className="min-h-[550px] flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-[#166534] mb-4">
          <RefreshCw className="w-7 h-7 animate-spin" />
        </div>
        <h3 className="text-lg font-bold text-[#111827]">Loading today's queue...</h3>
        <p className="text-sm text-[#6B7280] mt-1">
          Synchronizing officer operational records with mandi intake gate.
        </p>
      </div>
    );
  }

  // Error State
  if (error || !officer || !centre || !stats) {
    return (
      <div className="min-h-[450px] flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-[#DC2626] mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-[#111827]">We couldn't load the queue.</h3>
        <p className="text-sm text-[#6B7280] mt-1 max-w-md">
          {error || 'Internal communication timeout. Please retry.'}
        </p>
        <div className="mt-5">
          <Button variant="primary" onClick={() => loadOfficerData(true)}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] bg-[#F8FAFC]">
      {/* 1. Desktop Sidebar */}
      <OfficerSidebar
        officer={officer}
        centre={centre}
        stats={stats}
        onRefreshData={() => loadOfficerData(false)}
      />

      {/* 2. Main Workspace (Route-driven Views) */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 space-y-6 overflow-y-auto">
        {isDashboard && (
          <OfficerOverviewTab
            centre={centre}
            stats={stats}
            bookings={bookings}
            onSetDelay={handleSetDelay}
            onOpenCheckIn={() => setCheckInModalOpen(true)}
            onServeNext={handleServeNext}
            isAdvancingQueue={isAdvancingQueue}
            onOpenDetail={(b) => setDetailBooking(b)}
          />
        )}

        {isLiveQueue && (
          <OfficerQueueTab
            centre={centre}
            stats={stats}
            bookings={bookings}
            onSetDelay={handleSetDelay}
            onOpenCheckIn={() => setCheckInModalOpen(true)}
            onServeNext={handleServeNext}
            isAdvancingQueue={isAdvancingQueue}
            onCheckIn={handleCheckIn}
            onCallToDesk={handleCallToDesk}
            onStartVerification={handleStartVerification}
            onOpenQualityCheck={(b) => setQcBooking(b)}
            onOpenWeighing={(b) => setWeighingBooking(b)}
            onOpenNoShow={(b) => setNoShowBooking(b)}
            onOpenReceipt={(b) => setReceiptBooking(b)}
            onOpenDetail={(b) => setDetailBooking(b)}
          />
        )}

        {isBookings && (
          <OfficerBookingsTab
            bookings={bookings}
            centreId={centre?.id}
            onOpenCheckIn={() => setCheckInModalOpen(true)}
            onOpenDetail={(b) => setDetailBooking(b)}
          />
        )}

        {isProcurements && (
          <OfficerProcurementsTab
            stats={stats}
            bookings={bookings}
            onOpenReceipt={(b) => setReceiptBooking(b)}
            onOpenDetail={(b) => setDetailBooking(b)}
          />
        )}

        {isPayments && (
          <OfficerPaymentsTab
            payments={payments}
            batchSettlementSuccess={batchSettlementSuccess}
            onAuthorizeBatchPayments={handleAuthorizeBatchPayments}
            onInitiatePayment={handleInitiatePayment}
            onAuthorizeDisburse={handleAuthorizeDisburse}
          />
        )}

        {isAnalytics && <OfficerAnalyticsTab />}

        {isSettings && (
          <OfficerSettingsTab
            centre={centre}
            onSaveCapacity={handleSaveCapacity}
            settingsSaved={settingsSaved}
          />
        )}
      </div>

      {/* 3. Operational Modals */}
      <CheckInModal
        isOpen={checkInModalOpen}
        bookings={bookings}
        onClose={() => setCheckInModalOpen(false)}
        onSuccess={() => loadOfficerData(false)}
      />

      <QCModal
        booking={qcBooking}
        onClose={() => setQcBooking(null)}
        onSuccess={() => loadOfficerData(false)}
      />

      <WeighbridgeModal
        booking={weighingBooking}
        onClose={() => setWeighingBooking(null)}
        onSuccess={() => loadOfficerData(false)}
      />

      <NoShowModal
        booking={noShowBooking}
        onClose={() => setNoShowBooking(null)}
        onSuccess={() => loadOfficerData(false)}
      />

      <ProcurementReceiptModal
        booking={receiptBooking}
        centre={centre}
        officerName={officer.name}
        onClose={() => setReceiptBooking(null)}
      />

      <BookingDetailModal
        booking={detailBooking}
        onClose={() => setDetailBooking(null)}
      />
    </div>
  );
}

export default OfficerDashboard;
