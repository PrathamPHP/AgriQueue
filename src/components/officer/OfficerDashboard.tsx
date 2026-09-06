import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Officer,
  ProcurementCentre,
  Booking,
  ProcurementStage,
  PaymentStatus,
  Payment,
  CentreStats,
} from '@/types';
import {
  getCurrentOfficer,
  getOfficerCentre,
  getTodayBookings,
  getCentreStats,
  getAllowedNextStatuses,
  transitionBookingStatus,
  advanceOfficerQueue,
  markNoShow,
  updatePaymentStatus,
  setOfficerCentreDelay,
  subscribeToOfficerUpdates,
} from '@/services/officerService';
import { paymentService } from '@/services/paymentService';
import { dataStore } from '@/services/dataStore';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { KpiCard } from '@/components/cards/KpiCard';
import { InputField } from '@/components/forms/InputField';
import { formatCurrency } from '@/lib/utils';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  FastForward,
  Scale,
  Calendar,
  Layers,
  FileText,
  CreditCard,
  Settings,
  BarChart3,
  UserCheck,
  ShieldCheck,
  RefreshCw,
  X,
  QrCode,
  ArrowRight,
  Printer,
  Check,
  TrendingUp,
  Filter,
  DollarSign,
  AlertCircle,
  Truck,
  Plus,
  HelpCircle,
  LogOut,
} from 'lucide-react';

export function OfficerDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  // Officer & Centre State
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [centre, setCentre] = useState<ProcurementCentre | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<CentreStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Concurrency and debounce guards
  const isFetchingRef = useRef<boolean>(false);
  const pendingRefreshRef = useRef<boolean>(false);

  // Modal States
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<Booking | null>(null);
  const [selectedProcurementForReceipt, setSelectedProcurementForReceipt] = useState<Booking | null>(null);
  const [batchSettlementSuccess, setBatchSettlementSuccess] = useState<string | null>(null);
  const [capacityInput, setCapacityInput] = useState<string>('2800');
  const [settingsSaved, setSettingsSaved] = useState<boolean>(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState<boolean>(false);
  const [quickCheckInInput, setQuickCheckInInput] = useState<string>('');
  const [quickCheckInError, setQuickCheckInError] = useState<string>('');

  // Workflow Action Modals
  const [activeActionBooking, setActiveActionBooking] = useState<Booking | null>(null);
  const [qcModalOpen, setQcModalOpen] = useState<boolean>(false);
  const [selectedGrade, setSelectedGrade] = useState<'Grade A' | 'Grade B' | 'Grade C'>('Grade A');
  const [isQcAccepted, setIsQcAccepted] = useState<boolean>(true);
  const [qcRemarks, setQcRemarks] = useState<string>('Standard moisture (11.2%), zero foreign debris');
  const [qcErrorMessage, setQcErrorMessage] = useState<string>('');

  const [weighingModalOpen, setWeighingModalOpen] = useState<boolean>(false);
  const [actualWeightKg, setActualWeightKg] = useState<string>('');
  const [acceptedQuantityKg, setAcceptedQuantityKg] = useState<string>('');
  const [weighingErrorMessage, setWeighingErrorMessage] = useState<string>('');

  const [noShowConfirmModalOpen, setNoShowConfirmModalOpen] = useState<boolean>(false);
  const [bookingToNoShow, setBookingToNoShow] = useState<Booking | null>(null);
  const [isAdvancingQueue, setIsAdvancingQueue] = useState<boolean>(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

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
      setCapacityInput(offCentre.capacityPerHourKg.toString());

      const [todayBookings, centreStats, allPayments] = await Promise.all([
        getTodayBookings(offCentre.id),
        getCentreStats(offCentre.id),
        paymentService.getAllPayments(),
      ]);
      setBookings(todayBookings);
      setStats(centreStats);
      const centreBookingIds = new Set(todayBookings.map((b) => b.id));
      setPayments(allPayments.filter((p) => centreBookingIds.has(p.bookingId)));
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

  // Handle "Serve Next Farmer" CTA
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

  // Handle Delay Controls
  const handleSetDelay = async (delayMins: number) => {
    if (!centre) return;
    try {
      await setOfficerCentreDelay(centre.id, delayMins);
    } catch (err) {
      console.error('Failed to set delay', err);
    }
  };

  // Quick Check-in Submit
  const handleQuickCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCheckInInput.trim() || !centre) return;

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

    try {
      await transitionBookingStatus(found.id, 'ARRIVED');
      setQuickCheckInInput('');
      setQuickCheckInError('');
      setCheckInModalOpen(false);
    } catch (err) {
      console.error(err);
      setQuickCheckInError('Failed to check in farmer.');
    }
  };

  // Open Quality Check Modal
  const openQualityCheck = (booking: Booking) => {
    setActiveActionBooking(booking);
    setSelectedGrade(booking.qualityGrade || 'Grade A');
    setIsQcAccepted(true);
    setQcRemarks(booking.remarks || 'Standard moisture (11.2%), zero foreign debris, meets FCI specs');
    setQcErrorMessage('');
    setQcModalOpen(true);
  };

  // Submit Quality Check
  const handleSubmitQualityCheck = async () => {
    if (!activeActionBooking || isSubmittingAction) return;
    if (!isQcAccepted && !qcRemarks.trim()) {
      setQcErrorMessage('Please specify the reason for quality rejection in remarks.');
      return;
    }
    setIsSubmittingAction(true);
    try {
      if (isQcAccepted) {
        await transitionBookingStatus(activeActionBooking.id, 'WEIGHING', {
          qualityGrade: selectedGrade,
          remarks: qcRemarks,
        });
      } else {
        await transitionBookingStatus(activeActionBooking.id, 'CANCELLED', {
          qualityGrade: selectedGrade,
          remarks: qcRemarks,
        });
      }
      setQcModalOpen(false);
      setActiveActionBooking(null);
      loadOfficerData(false);
    } catch (err: any) {
      console.error(err);
      setQcErrorMessage(err.message || 'Failed to submit quality check.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Open Weighing Modal
  const openWeighing = (booking: Booking) => {
    setActiveActionBooking(booking);
    const estActual = booking.actualWeightKg ? booking.actualWeightKg.toString() : booking.quantityKg.toString();
    const estAccepted = booking.acceptedQuantityKg ? booking.acceptedQuantityKg.toString() : estActual;
    setActualWeightKg(estActual);
    setAcceptedQuantityKg(estAccepted);
    setWeighingErrorMessage('');
    setWeighingModalOpen(true);
  };

  // Submit Weighing & Procurement Completion
  const handleSubmitWeighing = async () => {
    if (!activeActionBooking || isSubmittingAction) return;
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

    setIsSubmittingAction(true);
    try {
      const crop = dataStore.getCropById(activeActionBooking.cropId);
      const msp = crop?.mspPerQuintal || 2275;
      const totalPayable = Math.round((accepted / 100) * msp);

      await transitionBookingStatus(activeActionBooking.id, 'COMPLETED', {
        actualWeightKg: actual,
        acceptedQuantityKg: accepted,
        totalGrossAmount: totalPayable,
        netPayableAmount: totalPayable,
      });
      setWeighingModalOpen(false);
      setActiveActionBooking(null);
      loadOfficerData(false);
    } catch (err: any) {
      console.error(err);
      setWeighingErrorMessage(err.message || 'Failed to complete weighing and procurement.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Direct Workflow Actions
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

  // Open No-Show Confirmation
  const openNoShowModal = (booking: Booking) => {
    setBookingToNoShow(booking);
    setNoShowConfirmModalOpen(true);
  };

  // Confirm No-Show
  const handleConfirmNoShow = async () => {
    if (!bookingToNoShow) return;
    try {
      await markNoShow(bookingToNoShow.id);
      setNoShowConfirmModalOpen(false);
      setBookingToNoShow(null);
      loadOfficerData(false);
    } catch (err) {
      console.error(err);
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

  // Authorize All Pending PFMS Batch Payments
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

  // Settle Single Payment
  const handleSettleSinglePayment = async (procurementId: string) => {
    try {
      await paymentService.updatePaymentStatus(procurementId, 'PAID');
      loadOfficerData(false);
    } catch (err) {
      console.error('Failed to settle payment', err);
    }
  };

  // Save Depot Capacity Settings
  const handleSaveDepotSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!centre) return;
    const parsedCap = parseInt(capacityInput, 10);
    if (!isNaN(parsedCap) && parsedCap > 0) {
      dataStore.updateCentre(centre.id, { capacityPerHourKg: parsedCap });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 4000);
    }
  };

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      b.farmerName.toLowerCase().includes(q) ||
      b.tokenNumber.toString().includes(q.replace('#', '')) ||
      b.farmerMobile.includes(q) ||
      b.cropName.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'WAITING') {
      return ['BOOKED', 'ARRIVED', 'CHECKED_IN', 'WAITING', 'NOW_SERVING'].includes(b.currentStage);
    }
    if (statusFilter === 'IN_PROGRESS') {
      return ['VERIFICATION', 'QUALITY_CHECK', 'WEIGHING'].includes(b.currentStage);
    }
    if (statusFilter === 'COMPLETED') {
      return b.currentStage === 'COMPLETED';
    }
    if (statusFilter === 'NO_SHOW') {
      return b.currentStage === 'NO_SHOW';
    }
    return true;
  });

  // Pagination State for Bookings & Live Queue Tables
  const [queuePage, setQueuePage] = useState<number>(1);
  const [rosterPage, setRosterPage] = useState<number>(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    setQueuePage(1);
    setRosterPage(1);
  }, [searchQuery, statusFilter]);

  const queueTotalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const paginatedQueueBookings = filteredBookings.slice(
    (queuePage - 1) * PAGE_SIZE,
    queuePage * PAGE_SIZE
  );

  const rosterTotalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const paginatedRosterBookings = filteredBookings.slice(
    (rosterPage - 1) * PAGE_SIZE,
    rosterPage * PAGE_SIZE
  );

  // Determine current active route for content rendering
  const currentPath = location.pathname;
  const isDashboard =
    currentPath === '/officer/dashboard' || currentPath === '/officer' || currentPath === '/officer/';
  const isLiveQueue = currentPath === '/officer/queue';
  const isBookings = currentPath === '/officer/bookings';
  const isProcurements = currentPath === '/officer/procurements';
  const isPayments = currentPath === '/officer/payments';
  const isAnalytics = currentPath === '/officer/analytics';
  const isSettings = currentPath === '/officer/settings';

  // Navigation Items matching the required 7 functional routes
  const navItems = [
    {
      path: '/officer/dashboard',
      label: 'Dashboard Overview',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      path: '/officer/queue',
      label: "Today's Live Queue",
      icon: <Clock className="w-4 h-4" />,
      badge: stats?.currentlyWaitingCount,
    },
    {
      path: '/officer/bookings',
      label: 'All Centre Bookings',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      path: '/officer/procurements',
      label: 'Completed Procurements',
      icon: <FileText className="w-4 h-4" />,
      badge: stats && stats.completedTodayCount > 0 ? stats.completedTodayCount : undefined,
    },
    {
      path: '/officer/payments',
      label: 'DBT / PFMS Orders',
      icon: <CreditCard className="w-4 h-4" />,
    },
    {
      path: '/officer/analytics',
      label: 'Mandi Throughput',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      path: '/officer/settings',
      label: 'Depot Capacity Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

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
      {/* ========================================================================= */}
      {/* 1. LEFT DESKTOP SIDEBAR */}
      {/* ========================================================================= */}
      <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between shrink-0 hidden md:flex">
        <div className="space-y-6">
          {/* Centre Badge & Depot Switcher */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-input">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Operational Mandi Depot
            </span>
            <select
              value={centre.id}
              onChange={(e) => {
                dataStore.setOfficerCentre(e.target.value);
                loadOfficerData(false);
              }}
              className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#166534] focus:ring-1 focus:ring-[#166534]"
              title="Switch assigned depot / centre"
            >
              {dataStore.getCentres().map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.district})
                </option>
              ))}
            </select>
            <div className="mt-2.5 pt-2.5 border-t border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Active Officer Persona
              </span>
              <select
                value={officer.id}
                onChange={(e) => {
                  dataStore.setCurrentOfficerId(e.target.value);
                  const chosenOff = dataStore.getOfficers().find((o) => o.id === e.target.value);
                  if (chosenOff) {
                    dataStore.setOfficerCentre(chosenOff.centreId);
                  }
                  loadOfficerData(false);
                }}
                className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#166534] focus:ring-1 focus:ring-[#166534]"
                title="Switch active officer persona"
              >
                {dataStore.getOfficers().map((o) => {
                  const c = dataStore.getCentreById(o.centreId);
                  return (
                    <option key={o.id} value={o.id}>
                      {o.name} — {c?.code || c?.name || ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#166534] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-ping" />
              <span>Gate 2 / Weighbridge Active</span>
            </div>
          </div>

          {/* Navigation Links using Router NavLink */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path === '/officer/dashboard' &&
                  (location.pathname === '/officer' || location.pathname === '/officer/'));

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-button text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#166534] text-white shadow-subtle'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isActive
                          ? 'bg-white text-[#166534]'
                          : 'bg-emerald-100 text-[#166534]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Officer Profile Pill */}
        <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-input flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#166534] text-white font-bold flex items-center justify-center text-xs shrink-0">
              {officer.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 text-xs flex-1">
              <div className="font-bold text-slate-900 truncate">{officer.name}</div>
              <div className="text-[11px] text-emerald-800 truncate">{officer.deskNumber}</div>
            </div>
          </div>
          <button
            onClick={() => {
              dataStore.logoutOfficer();
              navigate('/login', { replace: true });
            }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded text-[11px] font-bold transition-colors cursor-pointer"
            title="Logout from Officer Terminal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN OPERATIONAL WORKSPACE */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 2. MAIN OPERATIONAL WORKSPACE (ROUTE-DRIVEN VIEWS) */}
      {/* ========================================================================= */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 space-y-6 overflow-y-auto">
        {/* ======================================================================= */}
        {/* ROUTE 1: /officer/dashboard (Dashboard Overview) */}
        {/* ======================================================================= */}
        {isDashboard && (
          <div className="space-y-6">
            {/* Top Operational Action Bar */}
            <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
                    Mandi Operational Terminal
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                  <span className="text-xs text-slate-500">
                    {centre.district}, {centre.state}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
                  {centre.name}
                </h1>
              </div>

              {/* Action Hub */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-button text-xs">
                  <span className="text-slate-500 font-medium px-1.5">Delay:</span>
                  <button
                    onClick={() => handleSetDelay(0)}
                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                      centre.currentDelayMinutes === 0
                        ? 'bg-emerald-100 text-[#166534]'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    0m
                  </button>
                  <button
                    onClick={() => handleSetDelay(15)}
                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                      centre.currentDelayMinutes === 15
                        ? 'bg-amber-100 text-amber-900'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    +15m
                  </button>
                  <button
                    onClick={() => handleSetDelay(30)}
                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                      centre.currentDelayMinutes === 30
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
                  onClick={() => setCheckInModalOpen(true)}
                  icon={<UserCheck className="w-4 h-4" />}
                >
                  Check-In Farmer
                </Button>

                <Button
                  size="md"
                  variant="primary"
                  onClick={handleServeNext}
                  icon={<FastForward className="w-4 h-4" />}
                  className="shadow-subtle"
                >
                  Serve Next Farmer
                </Button>
              </div>
            </div>

            {/* Dynamic KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title="Today's Bookings"
                value={stats.todayBookingsCount}
                subtitle={`Target: ${((centre.capacityPerHourKg * 8) / 1000).toFixed(0)} MT Capacity`}
                trend={stats.todayBookingsCount > 0 ? { value: 'Intake on Track', direction: 'up', isPositive: true } : undefined}
                icon={<Calendar className="w-5 h-5" />}
              />
              <KpiCard
                title="Currently Waiting"
                value={stats.currentlyWaitingCount}
                subtitle="Inside mandi premises"
                trend={stats.currentlyWaitingCount > 0 ? {
                  value: `${stats.currentlyWaitingCount} in queue`,
                  direction: 'neutral',
                  isPositive: true,
                } : undefined}
                icon={<Users className="w-5 h-5" />}
                iconBgColor="bg-blue-50"
                iconColor="text-blue-700"
              />
              <KpiCard
                title="Completed Today"
                value={stats.completedTodayCount}
                subtitle="Cleared weighbridge & receipt"
                trend={stats.completedTodayCount > 0 ? { value: '+14% vs yesterday', direction: 'up', isPositive: true } : undefined}
                icon={<CheckCircle2 className="w-5 h-5" />}
                iconBgColor="bg-emerald-50"
                iconColor="text-[#16A34A]"
              />
              <KpiCard
                title="Average Waiting Time"
                value={stats.avgWaitTimeMin > 0 ? `${stats.avgWaitTimeMin} mins` : '--'}
                subtitle={stats.todayBookingsCount > 0 ? "Dynamic throughput" : "No active queue"}
                trend={stats.avgWaitTimeMin > 0 ? { value: '-82% vs unmanaged', direction: 'down', isPositive: true } : undefined}
                icon={<Clock className="w-5 h-5" />}
                iconBgColor="bg-amber-50"
                iconColor="text-amber-700"
              />
            </div>

            {/* Overview Operational Split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Live Queue Pulse Card */}
              <Card className="border-slate-200">
                <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Live Gate & Queue Pulse</CardTitle>
                    <CardDescription>Real-time intake progression</CardDescription>
                  </div>
                  <Link
                    to="/officer/queue"
                    className="text-xs font-bold text-[#166534] hover:underline flex items-center gap-1"
                  >
                    Manage Queue <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {bookings.find((b) => b.currentStage === 'NOW_SERVING' || b.currentStage === 'VERIFICATION') ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-input flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#166534] uppercase tracking-wider block">
                          Currently At Gate 2 / Desk
                        </span>
                        <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                          {bookings.find((b) => b.currentStage === 'NOW_SERVING' || b.currentStage === 'VERIFICATION')?.farmerName}
                        </div>
                        <div className="text-xs text-slate-600">
                          Token #{bookings.find((b) => b.currentStage === 'NOW_SERVING' || b.currentStage === 'VERIFICATION')?.tokenNumber} •{' '}
                          {bookings.find((b) => b.currentStage === 'NOW_SERVING' || b.currentStage === 'VERIFICATION')?.cropName}
                        </div>
                      </div>
                      <StatusBadge status="NOW_SERVING" label="Serving" />
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-input text-xs text-slate-600 flex items-center justify-between">
                      <span>No farmer currently at desk. Ready to call next token.</span>
                      <Button size="sm" variant="primary" onClick={handleServeNext}>
                        Call Next
                      </Button>
                    </div>
                  )}

                  <div className="text-xs font-bold text-slate-700 mt-2">Next in Queue:</div>
                  <div className="space-y-1.5">
                    {bookings.filter((b) => ['BOOKED', 'ARRIVED', 'WAITING'].includes(b.currentStage)).length === 0 ? (
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-md text-xs text-slate-500 text-center">
                        No farmers are currently in the queue.
                      </div>
                    ) : (
                      bookings
                        .filter((b) => ['BOOKED', 'ARRIVED', 'WAITING'].includes(b.currentStage))
                        .slice(0, 3)
                        .map((b) => (
                          <div
                            key={b.id}
                            className="p-2.5 bg-slate-50 rounded-md border border-slate-100 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">
                                #{b.tokenNumber}
                              </span>
                              <span className="font-bold text-slate-800">{b.farmerName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">{b.quantityKg} kg</span>
                              <StatusBadge status={b.currentStage} size="sm" />
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Depot Intake & Capacity Card */}
              <Card className="border-slate-200">
                <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Intake Capacity & Velocity</CardTitle>
                    <CardDescription>Daily procurement throughput</CardDescription>
                  </div>
                  <Link
                    to="/officer/analytics"
                    className="text-xs font-bold text-[#166534] hover:underline flex items-center gap-1"
                  >
                    View Analytics <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-700">Intake Progress vs Target</span>
                      <span className="text-[#166534]">
                        {(stats.totalQuantityProcuredKg / 1000).toFixed(1)} MT / {((centre.capacityPerHourKg * 8) / 1000).toFixed(1)} MT
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#166534] h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (stats.totalQuantityProcuredKg / (centre.capacityPerHourKg * 8)) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-slate-50 rounded-input border border-slate-200 text-xs">
                      <span className="text-slate-500 block">Operating Capacity:</span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {centre.capacityPerHourKg.toLocaleString()} kg / hr
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-input border border-slate-200 text-xs">
                      <span className="text-slate-500 block">Weighbridge Status:</span>
                      <span className="font-extrabold text-[#16A34A] text-sm flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Both Gates Active
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-input text-xs text-amber-900 flex items-center justify-between">
                    <span>Active buffer delay: <strong>{centre.currentDelayMinutes} mins</strong></span>
                    <Link to="/officer/settings" className="text-xs font-bold text-amber-800 hover:underline">
                      Configure Depot
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Completed Procurements Strip */}
            <Card className="border-slate-200">
              <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recent Mandi Procurements</CardTitle>
                  <CardDescription>Latest lots verified and cleared for DBT</CardDescription>
                </div>
                <Link
                  to="/officer/procurements"
                  className="text-xs font-bold text-[#166534] hover:underline flex items-center gap-1"
                >
                  View All Completed Procurements <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <th className="px-4 py-3">Token</th>
                        <th className="px-4 py-3">Farmer</th>
                        <th className="px-4 py-3">Crop & Net Qty</th>
                        <th className="px-4 py-3">Grade</th>
                        <th className="px-4 py-3">Total Value</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bookings.filter((b) => b.currentStage === 'COMPLETED').length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-xs">
                            No completed procurements yet.
                          </td>
                        </tr>
                      ) : (
                        bookings
                          .filter((b) => b.currentStage === 'COMPLETED')
                          .slice(0, 3)
                          .map((b) => (
                            <tr key={b.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-mono font-bold">#{b.tokenNumber}</td>
                              <td className="px-4 py-3 font-bold text-slate-900">{b.farmerName}</td>
                              <td className="px-4 py-3">
                                {b.acceptedQuantityKg || b.quantityKg} kg {b.cropName}
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 bg-emerald-100 text-[#166534] rounded font-bold text-[11px]">
                                  {b.qualityGrade || 'Grade A'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold text-[#166534]">
                                {formatCurrency(
                                  Math.round(((b.acceptedQuantityKg || b.quantityKg) / 100) * 2275)
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedBookingForDetail(b)}
                                >
                                  Dossier
                                </Button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ROUTE 2: /officer/queue (Today's Live Queue) */}
        {/* ======================================================================= */}
        {isLiveQueue && (
          <div className="space-y-6">
            {/* Top Operational Action Bar */}
            <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
                    Gate & Queue Operations
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                  <span className="text-xs text-slate-500">Live Intake</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
                  Today's Live Queue Dispatch
                </h1>
              </div>

              {/* Action Hub */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-button text-xs">
                  <span className="text-slate-500 font-medium px-1.5">Delay:</span>
                  <button
                    onClick={() => handleSetDelay(0)}
                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                      centre.currentDelayMinutes === 0
                        ? 'bg-emerald-100 text-[#166534]'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    0m
                  </button>
                  <button
                    onClick={() => handleSetDelay(15)}
                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                      centre.currentDelayMinutes === 15
                        ? 'bg-amber-100 text-amber-900'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    +15m
                  </button>
                  <button
                    onClick={() => handleSetDelay(30)}
                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                      centre.currentDelayMinutes === 30
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
                  onClick={() => setCheckInModalOpen(true)}
                  icon={<UserCheck className="w-4 h-4" />}
                >
                  Check-In Farmer
                </Button>

                <Button
                  size="md"
                  variant="primary"
                  onClick={handleServeNext}
                  icon={<FastForward className="w-4 h-4" />}
                  className="shadow-subtle"
                >
                  Serve Next Farmer
                </Button>
              </div>
            </div>

            {/* Queue Stage Summary Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Waiting in Queue</span>
                <div className="text-xl font-extrabold text-[#111827] mt-0.5">
                  {stats.currentlyWaitingCount}
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">In Verification</span>
                <div className="text-xl font-extrabold text-blue-700 mt-0.5">
                  {bookings.filter((b) => b.currentStage === 'VERIFICATION').length}
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Quality Inspection</span>
                <div className="text-xl font-extrabold text-amber-700 mt-0.5">
                  {bookings.filter((b) => b.currentStage === 'QUALITY_CHECK').length}
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">At Weighbridge</span>
                <div className="text-xl font-extrabold text-[#16A34A] mt-0.5">
                  {bookings.filter((b) => b.currentStage === 'WEIGHING').length}
                </div>
              </div>
            </div>

            {/* LIVE QUEUE TABLE WITH WORKFLOW ACTIONS */}
            <Card className="border-slate-200">
              <CardHeader className="py-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      Live Gate & Procurement Stream
                    </CardTitle>
                    <CardDescription>
                      Advance farmers through Arrival → Verification → QC → Weighing → Payment
                    </CardDescription>
                  </div>

                  {/* Status Filter Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'ALL', label: 'All' },
                      { id: 'WAITING', label: 'Waiting / In Queue' },
                      { id: 'IN_PROGRESS', label: 'In QC / Weighing' },
                      { id: 'COMPLETED', label: 'Completed' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setStatusFilter(f.id)}
                        className={`text-xs px-2.5 py-1 rounded-button font-semibold border transition-colors ${
                          statusFilter === f.id
                            ? 'bg-[#166534] text-white border-[#166534]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="mt-3 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by farmer name, mobile number, or token #..."
                    className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-input focus:outline-none focus:border-[#166534] focus:ring-1 focus:ring-[#166534]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        <th className="px-3.5 py-3.5">Token</th>
                        <th className="px-3.5 py-3.5">Farmer</th>
                        <th className="px-3.5 py-3.5">Crop & Declared Qty</th>
                        <th className="px-3.5 py-3.5">Booked Slot</th>
                        <th className="px-3.5 py-3.5">Arrival Status</th>
                        <th className="px-3.5 py-3.5">Queue Status</th>
                        <th className="px-3.5 py-3.5">Procurement Stage</th>
                        <th className="px-3.5 py-3.5 text-right">Operational Action</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredBookings.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            No farmers are currently waiting.
                          </td>
                        </tr>
                      ) : (
                        paginatedQueueBookings.map((b) => {
                          const isServingNow =
                            b.currentStage === 'NOW_SERVING' ||
                            b.currentStage === 'VERIFICATION' ||
                            b.currentStage === 'QUALITY_CHECK' ||
                            b.currentStage === 'WEIGHING';

                          const queueEntry = dataStore.getQueueEntry(b.id);
                          const isCheckedIn = Boolean(
                            b.stageTimestamps.ARRIVED ||
                            b.stageTimestamps.CHECKED_IN ||
                            b.currentStage !== 'BOOKED'
                          );
                          const checkInTime = b.stageTimestamps.ARRIVED || b.stageTimestamps.CHECKED_IN;

                          let queueStatusLabel = 'Waiting';
                          if (b.currentStage === 'COMPLETED') {
                            queueStatusLabel = 'Completed';
                          } else if (b.currentStage === 'CANCELLED') {
                            queueStatusLabel = 'Disapproved';
                          } else if (b.currentStage === 'NO_SHOW') {
                            queueStatusLabel = 'Missed';
                          } else if (isServingNow) {
                            queueStatusLabel = 'Serving Now';
                          } else if (queueEntry) {
                            if (queueEntry.farmersAhead === 0) {
                              queueStatusLabel = 'Next to Call';
                            } else {
                              queueStatusLabel = `${queueEntry.farmersAhead} ahead`;
                            }
                          }

                          return (
                            <tr
                              key={b.id}
                              className={`transition-colors duration-150 hover:bg-slate-50/80 ${
                                isServingNow ? 'bg-emerald-50/40 font-medium' : ''
                              }`}
                            >
                              <td className="px-3.5 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                                  #{b.tokenNumber}
                                </span>
                              </td>

                              <td className="px-3.5 py-3.5">
                                <div className="font-bold text-slate-900 leading-snug">{b.farmerName}</div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  {b.farmerMobile}
                                </div>
                              </td>

                              <td className="px-3.5 py-3.5">
                                <div className="font-semibold text-slate-800">{b.cropName}</div>
                                <div className="text-[11px] text-slate-500">
                                  {b.acceptedQuantityKg || b.quantityKg} kg
                                </div>
                              </td>

                              <td className="px-3.5 py-3.5 whitespace-nowrap text-slate-700">
                                <div className="font-medium text-xs">{b.timeWindow}</div>
                                <div className="text-[10px] text-slate-400">{b.date}</div>
                              </td>

                              <td className="px-3.5 py-3.5 whitespace-nowrap">
                                {isCheckedIn ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    {checkInTime ? `Present (${checkInTime})` : 'Present'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-500" />
                                    Awaiting Arrival
                                  </span>
                                )}
                              </td>

                              <td className="px-3.5 py-3.5 whitespace-nowrap">
                                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  {queueStatusLabel}
                                </span>
                              </td>

                              <td className="px-3.5 py-3.5 whitespace-nowrap">
                                <StatusBadge status={b.currentStage} size="sm" />
                              </td>

                              <td className="px-3.5 py-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {b.currentStage === 'BOOKED' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => handleCheckIn(b.id)}
                                      >
                                        Check In
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openNoShowModal(b)}
                                        className="text-red-700 hover:bg-red-50 border-red-200"
                                      >
                                        No-Show
                                      </Button>
                                    </>
                                  )}

                                  {(b.currentStage === 'ARRIVED' || b.currentStage === 'CHECKED_IN') && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => handleCallToDesk(b)}
                                      >
                                        Call to Desk / Serve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openNoShowModal(b)}
                                        className="text-red-700 hover:bg-red-50 border-red-200"
                                      >
                                        No-Show
                                      </Button>
                                    </>
                                  )}

                                  {b.currentStage === 'NOW_SERVING' && (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => handleStartVerification(b.id)}
                                    >
                                      Start Verification
                                    </Button>
                                  )}

                                  {b.currentStage === 'VERIFICATION' && (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => openQualityCheck(b)}
                                    >
                                      Complete Verification
                                    </Button>
                                  )}

                                  {b.currentStage === 'QUALITY_CHECK' && (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => openQualityCheck(b)}
                                    >
                                      Complete Quality Check
                                    </Button>
                                  )}

                                  {b.currentStage === 'WEIGHING' && (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => openWeighing(b)}
                                    >
                                      Complete Procurement
                                    </Button>
                                  )}

                                  {b.currentStage === 'COMPLETED' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedProcurementForReceipt(b)}
                                      icon={<FileText className="w-3.5 h-3.5" />}
                                    >
                                      J-Form Receipt
                                    </Button>
                                  )}

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedBookingForDetail(b)}
                                  >
                                    Dossier
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredBookings.length > PAGE_SIZE && (
                  <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
                    <div>
                      Showing {(queuePage - 1) * PAGE_SIZE + 1} to{' '}
                      {Math.min(queuePage * PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={queuePage === 1}
                        onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <span className="font-semibold text-slate-800">
                        Page {queuePage} of {queueTotalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={queuePage >= queueTotalPages}
                        onClick={() => setQueuePage((p) => Math.min(queueTotalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ROUTE 3: /officer/bookings (All Centre Bookings Master Roster) */}
        {/* ======================================================================= */}
        {isBookings && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
                  Master Depot Register
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
                  All Centre Bookings
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Complete roster of scheduled farmer slots, arrivals, in-progress intakes, and completed lots.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCheckInModalOpen(true)}
                  icon={<UserCheck className="w-4 h-4" />}
                >
                  Quick Check-In
                </Button>
              </div>
            </div>

            {/* Bookings Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Total Bookings</span>
                <div className="text-xl font-extrabold text-slate-900 mt-0.5">{bookings.length}</div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Scheduled</span>
                <div className="text-xl font-extrabold text-blue-700 mt-0.5">
                  {bookings.filter((b) => b.currentStage === 'BOOKED').length}
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Completed</span>
                <div className="text-xl font-extrabold text-[#16A34A] mt-0.5">
                  {bookings.filter((b) => b.currentStage === 'COMPLETED').length}
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">No-Shows</span>
                <div className="text-xl font-extrabold text-red-600 mt-0.5">
                  {bookings.filter((b) => b.currentStage === 'NO_SHOW').length}
                </div>
              </div>
            </div>

            {/* Filter & Master Bookings Table */}
            <Card className="border-slate-200">
              <CardHeader className="py-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'ALL', label: 'All Bookings' },
                      { id: 'WAITING', label: 'Scheduled / Waiting' },
                      { id: 'IN_PROGRESS', label: 'In Progress' },
                      { id: 'COMPLETED', label: 'Completed' },
                      { id: 'NO_SHOW', label: 'No-Shows' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setStatusFilter(f.id)}
                        className={`text-xs px-2.5 py-1 rounded-button font-semibold border transition-colors ${
                          statusFilter === f.id
                            ? 'bg-[#166534] text-white border-[#166534]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[260px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search bookings..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-input focus:outline-none focus:border-[#166534]"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <th className="px-4 py-3">Token</th>
                        <th className="px-4 py-3">Farmer</th>
                        <th className="px-4 py-3">Produce / Qty</th>
                        <th className="px-4 py-3">Scheduled Slot</th>
                        <th className="px-4 py-3">Current Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBookings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                            <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            No bookings for this procurement centre.
                          </td>
                        </tr>
                      ) : (
                        paginatedRosterBookings.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono font-bold">#{b.tokenNumber}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{b.farmerName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{b.farmerMobile}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{b.cropName}</div>
                            <div className="text-[11px] text-slate-500">
                              {b.acceptedQuantityKg || b.quantityKg} kg
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            <div>{b.timeWindow}</div>
                            <div className="text-[10px] text-slate-400">{b.date}</div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={b.currentStage} size="sm" />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedBookingForDetail(b)}
                            >
                              View Dossier
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  </table>
                </div>
                {filteredBookings.length > PAGE_SIZE && (
                  <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
                    <div>
                      Showing {(rosterPage - 1) * PAGE_SIZE + 1} to{' '}
                      {Math.min(rosterPage * PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length} bookings
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rosterPage === 1}
                        onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <span className="font-semibold text-slate-800">
                        Page {rosterPage} of {rosterTotalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rosterPage >= rosterTotalPages}
                        onClick={() => setRosterPage((p) => Math.min(rosterTotalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ROUTE 4: /officer/procurements (Completed Procurements) */}
        {/* ======================================================================= */}
        {isProcurements && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
                  Certified Mandi Intake Records
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
                  Completed Procurements
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Official intake weighment certificates, moisture compliance records, and government procurement receipts.
                </p>
              </div>
            </div>

            {/* Procurements Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Net MT Procured</span>
                <div className="text-xl font-extrabold text-[#166534] mt-0.5">
                  {(stats.totalQuantityProcuredKg / 1000).toFixed(2)} MT
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Total Value (MSP)</span>
                <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {formatCurrency(Math.round((stats.totalQuantityProcuredKg / 100) * 2275))}
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Quality Pass Rate</span>
                <div className="text-xl font-extrabold text-[#16A34A] mt-0.5">100% Grade A/B</div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Certified Lots</span>
                <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {bookings.filter((b) => b.currentStage === 'COMPLETED').length}
                </div>
              </div>
            </div>

            {/* Completed Procurements Table */}
            <Card className="border-slate-200">
              <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Certified Procurement Batches</CardTitle>
                  <CardDescription>Weighbridge receipts cleared for DBT settlement</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <th className="px-4 py-3">Receipt / Token</th>
                        <th className="px-4 py-3">Farmer</th>
                        <th className="px-4 py-3">Crop</th>
                        <th className="px-4 py-3">Certified Weight</th>
                        <th className="px-4 py-3">Quality Grade</th>
                        <th className="px-4 py-3">DBT Amount</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bookings.filter((b) => b.currentStage === 'COMPLETED').length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            No completed procurements today.
                          </td>
                        </tr>
                      ) : (
                        bookings
                          .filter((b) => b.currentStage === 'COMPLETED')
                          .map((b) => {
                            const netWeight = b.acceptedQuantityKg || b.quantityKg;
                            const dbtAmount = Math.round((netWeight / 100) * 2275);
                            return (
                              <tr key={b.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  <span className="font-mono font-bold text-slate-900">
                                    #{b.tokenNumber}
                                  </span>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    RCP-{b.id.slice(-6).toUpperCase()}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-900">{b.farmerName}</div>
                                  <div className="text-[11px] text-slate-500 font-mono">{b.farmerMobile}</div>
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-800">{b.cropName}</td>
                                <td className="px-4 py-3 font-bold text-slate-900">{netWeight} kg</td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-0.5 bg-emerald-100 text-[#166534] rounded font-bold text-[11px]">
                                    {b.qualityGrade || 'Grade A'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-extrabold text-[#166534]">
                                  {formatCurrency(dbtAmount)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedProcurementForReceipt(b)}
                                      icon={<FileText className="w-3.5 h-3.5" />}
                                    >
                                      J-Form
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setSelectedBookingForDetail(b)}
                                    >
                                      Dossier
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ROUTE 5: /officer/payments (DBT / PFMS Orders) */}
        {/* ======================================================================= */}
        {isPayments && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
                  Treasury Settlement Pipeline
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
                  DBT / PFMS Payment Orders
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Public Financial Management System (PFMS) Direct Benefit Transfer batches and bank credit authorisations.
                </p>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleAuthorizeBatchPayments}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Authorize All Pending Batches
              </Button>
            </div>

            {batchSettlementSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-card flex items-center gap-2.5 text-xs text-[#166534] font-bold animate-fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{batchSettlementSuccess}</span>
              </div>
            )}

            {/* Payment KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Total Disbursed</span>
                <div className="text-xl font-extrabold text-[#166534] mt-0.5">
                  {formatCurrency(
                    payments
                      .filter((p) => p.status === 'PAID')
                      .reduce((sum, p) => sum + p.amount, 0)
                  )}
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">Pending Authorization</span>
                <div className="text-xl font-extrabold text-amber-600 mt-0.5">
                  {formatCurrency(
                    payments
                      .filter((p) => p.status === 'PENDING')
                      .reduce((sum, p) => sum + p.amount, 0)
                  )}
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">NPCI Account Match</span>
                <div className="text-xl font-extrabold text-[#16A34A] mt-0.5">100% Verified</div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
                <span className="text-[11px] text-slate-500 font-bold uppercase">PFMS Settlement SLA</span>
                <div className="text-xl font-extrabold text-slate-900 mt-0.5">&lt; 24 Hours</div>
              </div>
            </div>

            {/* Payment Orders Table */}
            <Card className="border-slate-200">
              <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Beneficiary Bank Transfer Orders</CardTitle>
                  <CardDescription>Direct deposit to Aadhaar-seeded accounts via RBI / PFMS gateway</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <th className="px-4 py-3">PFMS Ref #</th>
                        <th className="px-4 py-3">Beneficiary Account</th>
                        <th className="px-4 py-3">Amount (₹)</th>
                        <th className="px-4 py-3">Mode</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            No pending payments.
                          </td>
                        </tr>
                      ) : (
                        payments.map((p) => {
                          const isPaid = p.status === 'PAID';
                          return (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <div className="font-mono font-bold text-slate-900">{p.referenceId}</div>
                                <div className="text-[10px] text-slate-400">{p.initiatedAt}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-900">{p.bankAccountMasked}</div>
                                <div className="text-[11px] text-slate-500">{p.statusMessage}</div>
                              </td>
                              <td className="px-4 py-3 font-extrabold text-[#166534]">
                                {formatCurrency(p.amount)}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                                {p.paymentMode}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge
                                  status={p.status}
                                  label={
                                    p.status === 'PAID'
                                      ? 'Credited (PAID)'
                                      : p.status === 'INITIATED'
                                      ? 'Order Initiated'
                                      : 'Pending Approval'
                                  }
                                  size="sm"
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {p.status === 'PENDING' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleInitiatePayment(p.procurementId)}
                                      >
                                        Initiate Payment
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => handleAuthorizeDisburse(p.procurementId)}
                                      >
                                        Authorize / Disburse
                                      </Button>
                                    </>
                                  )}

                                  {p.status === 'INITIATED' && (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => handleAuthorizeDisburse(p.procurementId)}
                                    >
                                      Authorize / Disburse
                                    </Button>
                                  )}

                                  {p.status === 'PAID' && (
                                    <span className="text-xs font-bold text-[#16A34A] flex items-center justify-end gap-1">
                                      <Check className="w-3.5 h-3.5" /> Disbursed
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ROUTE 6: /officer/analytics (Mandi Throughput) */}
        {/* ======================================================================= */}
        {isAnalytics && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
                Depot Telemetry & Intelligence
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
                Mandi Throughput & Performance
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Real-time metrics on gate turnaround SLAs, weighbridge dissipation velocity, and congestion telemetry.
              </p>
            </div>

            {/* Performance KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title="Gate-to-Exit SLA"
                value="22 mins"
                subtitle="Target: < 30 mins"
                trend={{ value: '-78% vs unmanaged', direction: 'down', isPositive: true }}
                icon={<Clock className="w-5 h-5" />}
              />
              <KpiCard
                title="Weighbridge Load"
                value="68%"
                subtitle="Optimal queue velocity"
                trend={{ value: 'Zero congestion backlog', direction: 'neutral', isPositive: true }}
                icon={<Scale className="w-5 h-5" />}
                iconBgColor="bg-blue-50"
                iconColor="text-blue-700"
              />
              <KpiCard
                title="Slot Adherence"
                value="96.4%"
                subtitle="Farmers arriving in window"
                trend={{ value: '+4.2% this week', direction: 'up', isPositive: true }}
                icon={<TrendingUp className="w-5 h-5" />}
                iconBgColor="bg-emerald-50"
                iconColor="text-[#16A34A]"
              />
              <KpiCard
                title="Moisture Acceptance"
                value="94.8%"
                subtitle="First-pass QC clearance"
                trend={{ value: 'Standard limit < 12%', direction: 'neutral', isPositive: true }}
                icon={<ShieldCheck className="w-5 h-5" />}
                iconBgColor="bg-amber-50"
                iconColor="text-amber-700"
              />
            </div>

            {/* Hourly Intake Distribution */}
            <Card className="border-slate-200">
              <CardHeader className="py-4 border-b border-slate-100">
                <CardTitle className="text-base">Hourly Intake Velocity (Today)</CardTitle>
                <CardDescription>Procurement volume vs depot hourly capacity ceiling</CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {[
                  { time: '08:00 AM – 10:00 AM', volume: 5400, max: 5600, percent: 96 },
                  { time: '10:00 AM – 12:00 PM', volume: 5200, max: 5600, percent: 92 },
                  { time: '12:00 PM – 02:00 PM', volume: 3800, max: 5600, percent: 68 },
                  { time: '02:00 PM – 04:00 PM', volume: 4600, max: 5600, percent: 82 },
                  { time: '04:00 PM – 06:00 PM', volume: 2400, max: 5600, percent: 43 },
                ].map((slot) => (
                  <div key={slot.time} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800">{slot.time}</span>
                      <span className="text-slate-600">
                        {slot.volume.toLocaleString()} kg / {slot.max.toLocaleString()} kg ({slot.percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          slot.percent > 90 ? 'bg-amber-500' : 'bg-[#166534]'
                        }`}
                        style={{ width: `${slot.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Gate Load Balancer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-slate-200 rounded-card shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#166534]">
                    Gate 1 (Heavy Multi-Axle Trucks)
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-[#166534] font-bold text-[10px] rounded">
                    Active
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">Digital Weighbridge #1</div>
                <p className="text-xs text-slate-500 mt-1">
                  14 trucks processed today. Average gross-to-tare weighing turnaround: 6.4 minutes.
                </p>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-card shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#166534]">
                    Gate 2 (Tractor Trolleys & Small Loads)
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-[#166534] font-bold text-[10px] rounded">
                    Active
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">Digital Weighbridge #2</div>
                <p className="text-xs text-slate-500 mt-1">
                  28 tractor trolleys cleared. Average weighing turnaround: 4.1 minutes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ROUTE 7: /officer/settings (Depot Capacity Settings) */}
        {/* ======================================================================= */}
        {isSettings && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
                Depot Parameters & Control
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
                Depot Capacity Settings
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Configure hourly intake ceiling, operating gates, quality thresholds, and smart slot allocation rules.
              </p>
            </div>

            {settingsSaved && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-card flex items-center gap-2.5 text-xs text-[#166534] font-bold animate-fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Depot operational parameters saved and applied successfully.</span>
              </div>
            )}

            <Card className="border-slate-200">
              <CardHeader className="py-4 border-b border-slate-100">
                <CardTitle className="text-base">Operational Capacity Calibration</CardTitle>
                <CardDescription>Directly impacts slot availability in the farmer booking wizard</CardDescription>
              </CardHeader>
              <form onSubmit={handleSaveDepotSettings}>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Depot Facility Name:
                      </label>
                      <input
                        type="text"
                        disabled
                        value={centre.name}
                        className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-input text-slate-600 font-semibold cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        District & State:
                      </label>
                      <input
                        type="text"
                        disabled
                        value={`${centre.district}, ${centre.state}`}
                        className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-input text-slate-600 font-semibold cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField
                      label="Hourly Intake Capacity (kg / hour)"
                      type="number"
                      value={capacityInput}
                      onChange={(e) => setCapacityInput(e.target.value)}
                      trailingIcon={<span className="text-xs font-bold text-slate-500">KG/HR</span>}
                      helperText="Target rate for digital weighbridges (e.g. 2,800 kg/hr = ~28 quintals/hr)."
                      required
                    />

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Slot Window Duration:
                      </label>
                      <select
                        defaultValue="30"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-input font-medium focus:outline-none focus:border-[#166534]"
                      >
                        <option value="15">15 Minutes</option>
                        <option value="30">30 Minutes (Recommended)</option>
                        <option value="45">45 Minutes</option>
                        <option value="60">60 Minutes</option>
                      </select>
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Farmer reservation interval window length.
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-input border border-slate-200 space-y-3 text-xs">
                    <div className="font-bold text-slate-800">Operational Gate Weighbridges:</div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-900 block">Gate 1: Heavy Weighbridge</span>
                        <span className="text-slate-500">Multi-axle commercial transport entry</span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-100 text-[#166534] font-bold rounded text-xs">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <div>
                        <span className="font-semibold text-slate-900 block">Gate 2: Tractor Trolley Weighbridge</span>
                        <span className="text-slate-500">Local farm vehicle & tractor entry</span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-100 text-[#166534] font-bold rounded text-xs">
                        Active
                      </span>
                    </div>
                  </div>
                </CardContent>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                  <Button type="submit" variant="primary">
                    Save Depot Configuration
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL: QUICK CHECK-IN FARMER (Token / Phone / QR) */}
      {/* ========================================================================= */}
      {checkInModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md shadow-elevated border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-slate-100">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#166534]" />
                Check In Farmer at Gate
              </CardTitle>
              <button
                onClick={() => {
                  setCheckInModalOpen(false);
                  setQuickCheckInError('');
                }}
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
                  onClick={() => {
                    setCheckInModalOpen(false);
                    setQuickCheckInError('');
                  }}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Confirm Gate Check-In
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: QUALITY CHECK (Grade A/B/C & Acceptance/Rejection) */}
      {/* ========================================================================= */}
      {qcModalOpen && activeActionBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md shadow-elevated border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-slate-100">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#166534]" />
                Produce Quality Inspection (Token #{activeActionBooking.tokenNumber})
              </CardTitle>
              <button
                onClick={() => setQcModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-input text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Farmer:</span>
                  <span className="font-bold text-slate-900">{activeActionBooking.farmerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Produce:</span>
                  <span className="font-bold text-slate-900">
                    {activeActionBooking.quantityKg.toLocaleString()} kg {activeActionBooking.cropName}
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
              <Button variant="outline" onClick={() => setQcModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={isQcAccepted ? "primary" : "danger"}
                onClick={handleSubmitQualityCheck}
              >
                {isQcAccepted ? "Pass & Move to Weighbridge" : "Confirm Rejection"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: WEIGHBRIDGE RECORD & PROCUREMENT COMPLETION */}
      {/* ========================================================================= */}
      {weighingModalOpen && activeActionBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md shadow-elevated border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-slate-100">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#166534]" />
                Digital Weighbridge Entry (Token #{activeActionBooking.tokenNumber})
              </CardTitle>
              <button
                onClick={() => setWeighingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-input text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Farmer:</span>
                  <span className="font-bold text-slate-900">{activeActionBooking.farmerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Declared Quantity (Booked):</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {activeActionBooking.quantityKg.toLocaleString()} kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Approved Quality:</span>
                  <span className="font-bold text-[#166534]">
                    {activeActionBooking.qualityGrade || 'Grade A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">MSP Benchmark Rate:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    ₹{(dataStore.getCropById(activeActionBooking.cropId)?.mspPerQuintal || 2275).toLocaleString()} / Quintal
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
                    {parseFloat(acceptedQuantityKg) || 0} kg × ₹{(dataStore.getCropById(activeActionBooking.cropId)?.mspPerQuintal || 2275)}/q
                  </span>
                </div>
                <span className="text-lg font-extrabold text-[#166534]">
                  {formatCurrency(
                    Math.round(
                      ((parseFloat(acceptedQuantityKg) || 0) / 100) *
                        (dataStore.getCropById(activeActionBooking.cropId)?.mspPerQuintal || 2275)
                    )
                  )}
                </span>
              </div>
            </CardContent>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setWeighingModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmitWeighing}>
                Complete Procurement & Generate Payment
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: NO-SHOW CONFIRMATION */}
      {/* ========================================================================= */}
      {noShowConfirmModalOpen && bookingToNoShow && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-sm shadow-elevated border-red-300">
            <CardHeader className="py-4 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-[#DC2626] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Confirm No-Show
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5 text-xs text-slate-700 leading-relaxed">
              Are you sure you want to mark Token #{bookingToNoShow.tokenNumber} ({bookingToNoShow.farmerName}) as <strong>No-Show</strong>?
              <p className="mt-2 text-slate-500">
                This will release their scheduled slot and notify the farmer to rebook or report to the helpdesk.
              </p>
            </CardContent>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setNoShowConfirmModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmNoShow}>
                Confirm Mark No-Show
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8.5. MODAL: J-FORM PROCUREMENT RECEIPT */}
      {/* ========================================================================= */}
      {selectedProcurementForReceipt && (
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
                onClick={() => setSelectedProcurementForReceipt(null)}
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
                    RCP-{selectedProcurementForReceipt.id.slice(-6).toUpperCase()}
                  </span>
                  <span className="text-slate-400 block text-[10px]">
                    Token #{selectedProcurementForReceipt.tokenNumber}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-1">
                <div>
                  <span className="text-slate-500 block">Farmer Name:</span>
                  <span className="font-bold text-slate-900">{selectedProcurementForReceipt.farmerName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Registered Mobile:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedProcurementForReceipt.farmerMobile}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Commodity:</span>
                  <span className="font-bold text-slate-900">{selectedProcurementForReceipt.cropName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Quality Grade:</span>
                  <span className="font-bold text-[#166534]">
                    {selectedProcurementForReceipt.qualityGrade || 'Grade A'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-input border border-slate-200 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-600">Accepted Net Weight:</span>
                  <span className="font-bold text-slate-900">
                    {selectedProcurementForReceipt.acceptedQuantityKg || selectedProcurementForReceipt.quantityKg} KG
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">MSP Rate (Govt Benchmark):</span>
                  <span className="font-bold text-slate-900">₹2,275 / Quintal</span>
                </div>
                <div className="flex justify-between text-[#166534] pt-1 border-t border-slate-200 text-sm">
                  <span className="font-bold">Total DBT Payable:</span>
                  <span className="font-extrabold">
                    {formatCurrency(
                      Math.round(
                        (((selectedProcurementForReceipt.acceptedQuantityKg ||
                          selectedProcurementForReceipt.quantityKg) /
                          100) *
                          2275)
                      )
                    )}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-input border border-emerald-200 flex items-center justify-between text-[11px] text-[#166534]">
                <span>Status: <strong>Weighbridge Certified & Dispatched to PFMS</strong></span>
                <span className="font-bold">Verified by {officer.name}</span>
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
                  onClick={() => setSelectedProcurementForReceipt(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. DRAWER: FARMER & BOOKING FULL AUDIT DETAILS */}
      {/* ========================================================================= */}
      {selectedBookingForDetail && (
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
                    Token #{selectedBookingForDetail.tokenNumber} — {selectedBookingForDetail.farmerName}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedBookingForDetail(null)}
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
                    <span className="font-mono font-bold">{selectedBookingForDetail.farmerMobile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Booking ID:</span>
                    <span className="font-mono text-slate-700">{selectedBookingForDetail.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Scheduled Slot:</span>
                    <span className="font-bold text-slate-800">{selectedBookingForDetail.timeWindow}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Commodity:</span>
                    <span className="font-bold">{selectedBookingForDetail.cropName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Declared Quantity:</span>
                    <span className="font-bold">{selectedBookingForDetail.quantityKg.toLocaleString()} kg</span>
                  </div>
                  {selectedBookingForDetail.acceptedQuantityKg && (
                    <div className="flex justify-between text-[#166534]">
                      <span className="font-medium">Accepted Quantity:</span>
                      <span className="font-extrabold">{selectedBookingForDetail.acceptedQuantityKg} kg</span>
                    </div>
                  )}
                  {selectedBookingForDetail.qualityGrade && (
                    <div className="flex justify-between text-[#166534]">
                      <span className="font-medium">Quality Grade:</span>
                      <span className="font-extrabold">{selectedBookingForDetail.qualityGrade}</span>
                    </div>
                  )}
                </div>

                {/* Stage Timestamps Timeline */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Audit Log & Stage Timestamps:
                  </h4>
                  <div className="space-y-2 border-l-2 border-slate-200 pl-3 ml-1">
                    {Object.entries(selectedBookingForDetail.stageTimestamps || {}).map(([stage, time]) => (
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
              <Button variant="outline" onClick={() => setSelectedBookingForDetail(null)}>
                Close Dossier
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OfficerDashboard;
