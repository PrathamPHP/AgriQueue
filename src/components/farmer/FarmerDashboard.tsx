import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FarmerDashboardData,
  LanguageCode,
} from '@/types';
import {
  getFarmerDashboardData,
  subscribeToFarmerUpdates,
} from '@/services/farmerService';
import { dataStore } from '@/services/dataStore';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/common/Card';
import { NotificationBanner } from '@/components/feedback/NotificationBanner';
import { QueueCard } from '@/components/cards/QueueCard';
import { Timeline, TimelineStep } from '@/components/common/Timeline';
import { formatCurrency } from '@/lib/utils';
import {
  CalendarPlus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  CreditCard,
  History,
  MapPin,
  RefreshCw,
  Bell,
  ArrowRight,
  Wheat,
  Scale,
  FileText,
  LogOut,
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

export interface FarmerDashboardProps {
  currentLanguage?: LanguageCode;
}

export const FarmerDashboard: React.FC<FarmerDashboardProps> = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [data, setData] = useState<FarmerDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState<boolean>(false);

  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const dashboardData = await getFarmerDashboardData();
      setData(dashboardData);
      setError(null);
    } catch (err) {
      console.error('Failed to load farmer dashboard data:', err);
      setError('Unable to load your live booking telemetry. Please try again.');
    } finally {
      setIsLoading(false);
      if (isManualRefresh) {
        setTimeout(() => setIsRefreshing(false), 400);
      }
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    const unsubscribe = subscribeToFarmerUpdates(() => {
      loadDashboardData();
    });
    return () => unsubscribe();
  }, [loadDashboardData]);

  const handleRefresh = () => {
    loadDashboardData(true);
  };

  const handleLogout = () => {
    dataStore.logoutFarmer();
    navigate('/login', { replace: true });
  };

  const getGreeting = (name: string, nameHindi?: string) => {
    if (language === 'hi') {
      return `नमस्ते, ${nameHindi || name}`;
    }
    if (language === 'kn') {
      return `ಸುಸ್ವಾಗತ, ${name}`;
    }
    return `Welcome, ${name}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-[450px] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-[#166534] mb-4">
          <RefreshCw className="w-7 h-7 animate-spin" />
        </div>
        <h3 className="text-lg font-bold text-[#111827]">
          {t('loadingDetails', 'Loading your procurement details...')}
        </h3>
        <p className="text-xs sm:text-sm text-[#6B7280] mt-1 max-w-sm">
          Fetching live token, queue status, and centre updates.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-[#DC2626] mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-[#111827]">
          {t('unableToLoad', "We couldn't load your booking.")}
        </h3>
        <p className="text-xs sm:text-sm text-[#6B7280] mt-1 max-w-md">
          {error || 'An unexpected error occurred while communicating with the server.'}
        </p>
        <div className="mt-5">
          <Button
            variant="primary"
            onClick={() => loadDashboardData(true)}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            {t('tryAgain', 'Try Again')}
          </Button>
        </div>
      </div>
    );
  }

  const {
    farmer,
    dashboardState,
    activeBooking,
    queueStatus,
    procurement,
    payment,
    recentNotifications,
  } = data;

  if (!farmer) {
    return null;
  }

  const hasUpcomingBooking = activeBooking !== null;
  const isQueueActive = queueStatus !== null && queueStatus.isQueueActive && activeBooking?.currentStage !== 'COMPLETED';
  const unreadCount = recentNotifications.filter((n) => !n.isRead).length;

  const buildTimelineSteps = (): TimelineStep[] => {
    if (!activeBooking) return [];

    const currentStage = activeBooking.currentStage;
    const stagesOrder = ['BOOKED', 'ARRIVED', 'VERIFICATION', 'QUALITY_CHECK', 'WEIGHING', 'COMPLETED'];
    const currentIndex = stagesOrder.indexOf(currentStage);

    const stepDefinitions: Record<string, { title: string; desc: string }> = {
      BOOKED: { title: 'Slot Booked & Token Issued', desc: `Token #${activeBooking.tokenNumber} confirmed for ${activeBooking.timeWindow}.` },
      ARRIVED: { title: 'Centre Gate Entry', desc: 'Checked in at procurement centre gate.' },
      VERIFICATION: { title: 'Identity & Land Verification', desc: 'Farmer Aadhaar, land record, and crop quota verified.' },
      QUALITY_CHECK: { title: 'Grain Quality Inspection', desc: activeBooking.qualityGrade ? `Graded as ${activeBooking.qualityGrade}.` : 'Quality test in progress.' },
      WEIGHING: { title: 'Digital Weighment', desc: activeBooking.acceptedQuantityKg ? `Net weight: ${activeBooking.acceptedQuantityKg} kg.` : 'Gross and tare weighment.' },
      COMPLETED: { title: 'Procurement Completed', desc: 'Digital receipt generated. Ready for payment initiation.' },
    };

    return stagesOrder.map((stageKey, idx) => {
      const isCompleted = idx < currentIndex || (currentStage === 'COMPLETED' && idx <= currentIndex);
      const isCurrent = idx === currentIndex && currentStage !== 'COMPLETED';
      const def = stepDefinitions[stageKey];

      return {
        stage: stageKey as any,
        title: def.title,
        description: def.desc,
        timestamp: (activeBooking.stageTimestamps as any)[stageKey],
        status: isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming',
      };
    });
  };

  return (
    <div className="w-full space-y-5 animate-fade-in pb-10">
      {/* 1. Farmer Profile & Greeting Header */}
      <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#166534] flex items-center justify-center font-extrabold text-lg shrink-0 border border-emerald-200 shadow-subtle">
            {farmer.name.charAt(0)}
          </div>

          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-[#111827] tracking-tight">
              {getGreeting(farmer.name, farmer.nameHindi)}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-[#6B7280]">
              <span className="flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {farmer.village}, {farmer.district}
              </span>
              <span>•</span>
              <span className="font-mono text-slate-600">{farmer.mobileNumber}</span>
              {farmer.bankAccountMasked && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                    {farmer.bankAccountMasked}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons: Refresh + Logout + Notifications */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            title="Refresh live data"
          >
            {t('refresh', 'Refresh')}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleLogout}
            icon={<LogOut className="w-3.5 h-3.5 text-red-600" />}
            className="text-red-700 hover:bg-red-50 border-red-200"
            title="Logout from Farmer Portal"
          >
            {t('logout', 'Logout')}
          </Button>

          <button
            onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)}
            className="relative p-2.5 text-slate-600 hover:text-[#166534] bg-slate-50 hover:bg-emerald-50 rounded-button border border-slate-200 transition-colors"
            aria-label="Open notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#DC2626] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notifications Drawer */}
      {notificationDrawerOpen && (
        <Card className="animate-fade-in border-emerald-200">
          <CardHeader className="py-3 bg-emerald-50/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-[#166534]" />
                Recent Notifications ({recentNotifications.length})
              </CardTitle>
              <button
                onClick={() => setNotificationDrawerOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
              >
                Close
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">No new notifications.</div>
            ) : (
              recentNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    dataStore.markNotificationRead(notif.id);
                    if (notif.actionRoute) navigate(notif.actionRoute);
                  }}
                  className={`p-3.5 hover:bg-slate-50 text-xs transition-colors cursor-pointer ${
                    !notif.isRead ? 'bg-emerald-50/50 font-medium' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#111827] flex items-center gap-1.5">
                      {!notif.isRead && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{notif.timestamp}</span>
                  </div>
                  <p className="text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Dynamic Alerts */}
      {dashboardState === 'TURN_APPROACHING' && (
        <div className="animate-fade-in">
          <NotificationBanner
            variant="warning"
            title="Your turn is approaching! Please report to Gate 2."
            message={`There are only ${queueStatus?.farmersAhead || 1} farmers ahead of you. Keep your vehicle ready for weighment.`}
            actionText="View Live Virtual Queue"
            onAction={() => navigate('/farmer/queue')}
          />
        </div>
      )}

      {queueStatus && queueStatus.currentDelayMinutes > 0 && (
        <div className="animate-fade-in">
          <NotificationBanner
            variant="delay"
            title={`Notice: Centre delayed by ${queueStatus.currentDelayMinutes} mins`}
            message={`Dynamic arrival recommendation: Please arrive at ${queueStatus.recommendedArrivalTime || '11:28 AM'} to prevent mandi congestion.`}
            actionText="View Live Queue"
            onAction={() => navigate('/farmer/queue')}
          />
        </div>
      )}

      {/* 2. Main Content Section: Empty vs Active */}
      {!hasUpcomingBooking ? (
        /* Empty State */
        <Card className="border-dashed border-2 border-slate-300 bg-white text-center py-12 px-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#166534] flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-subtle">
            <Wheat className="w-8 h-8" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-[#111827]">
            {t('noActiveBooking', "You don't have any upcoming procurement bookings.")}
          </h2>

          <p className="text-sm text-[#6B7280] max-w-md mx-auto mt-1.5 leading-relaxed">
            {t('noActiveBookingDesc', 'Book a congestion-free time slot at your nearest accredited mandi to guarantee MSP procurement and skip physical queues.')}
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              variant="primary"
              onClick={() => navigate('/farmer/book-slot')}
              icon={<CalendarPlus className="w-5 h-5" />}
              className="w-full sm:w-auto"
            >
              {t('bookFirstSlot', 'Book Your First Slot')}
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/farmer/bookings')}
              icon={<History className="w-5 h-5" />}
              className="w-full sm:w-auto"
            >
              {t('myBookings', 'My Bookings')}
            </Button>
          </div>
        </Card>
      ) : (
        /* Active Booking Section */
        <div className="space-y-5">
          <Card className="border-emerald-200/90 shadow-card">
            <CardHeader className="bg-slate-50/70 py-3.5 sm:py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
                      Your Active Procurement Booking
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                    <span className="text-xs text-slate-500 font-mono">
                      Token #{activeBooking.tokenNumber}
                    </span>
                  </div>
                  <CardTitle className="text-lg sm:text-xl mt-0.5">
                    {activeBooking.cropName} ({activeBooking.cropNameHindi || 'गेहूं'}) • {activeBooking.quantityKg} kg
                  </CardTitle>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={activeBooking.currentStage as any} size="sm" />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              {/* Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50/80 rounded-input border border-slate-100">
                <div>
                  <div className="text-xs text-[#6B7280] font-medium">Quantity</div>
                  <div className="text-base sm:text-lg font-extrabold text-[#111827] mt-0.5">
                    {activeBooking.quantityKg.toLocaleString()} kg
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {(activeBooking.quantityKg / 100).toFixed(1)} Quintals
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#6B7280] font-medium">Token Number</div>
                  <div className="text-base sm:text-lg font-extrabold text-[#166534] mt-0.5">
                    #{activeBooking.tokenNumber}
                  </div>
                  <div className="text-[11px] text-emerald-800 font-semibold">
                    Digital Pass Issued
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#6B7280] font-medium">Scheduled Date</div>
                  <div className="text-sm sm:text-base font-bold text-[#111827] mt-0.5">
                    {activeBooking.date}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {activeBooking.timeWindow}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#6B7280] font-medium">Procurement Centre</div>
                  <div className="text-xs sm:text-sm font-bold text-[#111827] mt-0.5 truncate" title={activeBooking.centreName}>
                    {activeBooking.centreName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Gate 2 Check-in
                  </div>
                </div>
              </div>

              {/* Sub-section: Live Virtual Queue Active */}
              {isQueueActive && queueStatus && (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#111827] flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#166534]" />
                      Live Virtual Queue Status
                    </h3>
                    <span className="text-[11px] font-semibold text-[#166534] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-ping" />
                      Live Telemetry
                    </span>
                  </div>

                  <QueueCard
                    userToken={activeBooking.tokenNumber}
                    currentToken={queueStatus.currentToken}
                    farmersAhead={queueStatus.farmersAhead}
                    estimatedWaitMinutes={queueStatus.estimatedWaitingMinutes}
                    centreName={activeBooking.centreName}
                    slotWindow={activeBooking.timeWindow}
                    delayMinutes={queueStatus.currentDelayMinutes}
                    recommendedArrivalTime={queueStatus.recommendedArrivalTime}
                    onViewDetails={() => navigate('/farmer/queue')}
                  />
                </div>
              )}

              {/* Sub-section: Payment Tracking if Completed/Pending */}
              {(dashboardState === 'PAYMENT_PENDING' ||
                dashboardState === 'PAYMENT_COMPLETED' ||
                activeBooking.currentStage === 'COMPLETED') && (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#111827] flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-[#166534]" />
                      Procurement Summary & Direct Payout Status
                    </h3>
                    <StatusBadge status={payment?.status || 'PENDING'} size="sm" />
                  </div>

                  <div className="p-4 bg-slate-50 rounded-input border border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-xs text-slate-500">Accepted Quantity</span>
                        <div className="text-base font-extrabold text-slate-900 mt-0.5">
                          {procurement?.acceptedQuantityKg || activeBooking.acceptedQuantityKg || activeBooking.quantityKg} kg
                        </div>
                        <span className="text-[10px] text-slate-400">Net certified weight</span>
                      </div>

                      <div>
                        <span className="text-xs text-slate-500">Quality Grade</span>
                        <div className="text-base font-extrabold text-[#166534] mt-0.5">
                          {procurement?.qualityGrade || activeBooking.qualityGrade || 'Grade A'}
                        </div>
                        <span className="text-[10px] text-slate-400">FAQ Compliant</span>
                      </div>

                      <div>
                        <span className="text-xs text-slate-500">Total MSP Payable</span>
                        <div className="text-lg font-extrabold text-[#166534] mt-0.5">
                          {formatCurrency(
                            payment?.amount ||
                              procurement?.netPayableAmount ||
                              Math.round(
                                ((procurement?.acceptedQuantityKg ||
                                  activeBooking.acceptedQuantityKg ||
                                  activeBooking.quantityKg) /
                                  100) *
                                  (procurement?.mspRatePerQuintal ||
                                    dataStore.getCropById(activeBooking.cropId)?.mspPerQuintal ||
                                    2275)
                              )
                          )}
                        </div>
                        <span className="text-[10px] text-emerald-800 font-semibold">
                          PFMS Direct Benefit Transfer
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        payment?.status === 'PAID' ? 'bg-emerald-100 text-[#16A34A]' : 'bg-amber-100 text-[#F59E0B]'
                      }`}>
                        {payment?.status === 'PAID' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>

                      <div className="text-xs min-w-0">
                        <div className="font-bold text-[#111827]">
                          {payment?.status === 'PAID'
                            ? 'Payment Credited to Aadhaar-Linked Account'
                            : 'PFMS Treasury Settlement in Progress'}
                        </div>
                        <p className="text-slate-600 mt-0.5 leading-relaxed">
                          {payment?.statusMessage || 'Payment order cleared by Mandi Senior Inspector.'}{' '}
                          {payment?.referenceId && (
                            <span className="font-mono text-slate-800">
                              (Ref: {payment.referenceId})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-section: 6-Stage Timeline */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Procurement Lifecycle Progress
                  </span>
                  <span className="text-xs text-[#166534] font-semibold">
                    Live Verified
                  </span>
                </div>
                <Timeline steps={buildTimelineSteps()} />
              </div>
            </CardContent>

            <CardFooter className="flex-col sm:flex-row gap-3">
              <div className="text-xs text-[#6B7280]">
                Need assistance? Call Mandi Helpline:{' '}
                <a
                  href="tel:18001801551"
                  className="text-[#166534] font-bold hover:underline inline-flex items-center gap-1"
                >
                  1800-180-1551
                </a>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {isQueueActive && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => navigate('/farmer/queue')}
                    icon={<ArrowRight className="w-4 h-4" />}
                    iconPosition="right"
                    className="w-full sm:w-auto"
                  >
                    View Live Queue
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/farmer/procurement/${activeBooking.id}`)}
                  icon={<FileText className="w-4 h-4" />}
                  className="w-full sm:w-auto"
                >
                  Full Gate Pass & Receipt
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* 3. Quick Actions Section (PRD Mandated) */}
      <div>
        <h2 className="text-sm sm:text-base font-bold text-[#111827] mb-3">
          Quick Actions (त्वरित सेवाएं)
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/farmer/book-slot')}
            className="p-4 bg-white border border-slate-200 rounded-card shadow-card hover:shadow-card-hover hover:border-[#166534] text-left transition-all duration-200 flex flex-col justify-between gap-3 group active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-button bg-emerald-50 text-[#166534] flex items-center justify-center group-hover:bg-[#166534] group-hover:text-white transition-colors">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#111827]">Book Slot</div>
              <div className="text-xs text-[#6B7280] mt-0.5">Smart allocation</div>
            </div>
          </button>

          <button
            onClick={() => navigate('/farmer/queue')}
            className="p-4 bg-white border border-slate-200 rounded-card shadow-card hover:shadow-card-hover hover:border-[#166534] text-left transition-all duration-200 flex flex-col justify-between gap-3 group active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-button bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-700 group-hover:text-white transition-colors">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#111827]">Live Queue</div>
              <div className="text-xs text-[#6B7280] mt-0.5">Real-time token</div>
            </div>
          </button>

          <button
            onClick={() => navigate('/farmer/bookings')}
            className="p-4 bg-white border border-slate-200 rounded-card shadow-card hover:shadow-card-hover hover:border-[#166534] text-left transition-all duration-200 flex flex-col justify-between gap-3 group active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-button bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-700 group-hover:text-white transition-colors">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#111827]">My Bookings</div>
              <div className="text-xs text-[#6B7280] mt-0.5">Tokens & receipts</div>
            </div>
          </button>

          <button
            onClick={() => {
              if (payment) {
                navigate(`/farmer/payment/${payment.id}`);
              } else if (activeBooking) {
                navigate(`/farmer/payment/pay-${activeBooking.id}`);
              } else {
                navigate('/farmer/bookings');
              }
            }}
            className="p-4 bg-white border border-slate-200 rounded-card shadow-card hover:shadow-card-hover hover:border-[#166534] text-left transition-all duration-200 flex flex-col justify-between gap-3 group active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-button bg-purple-50 text-purple-700 flex items-center justify-center group-hover:bg-purple-700 group-hover:text-white transition-colors">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#111827]">Payment Status</div>
              <div className="text-xs text-[#6B7280] mt-0.5">DBT / PFMS tracker</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
