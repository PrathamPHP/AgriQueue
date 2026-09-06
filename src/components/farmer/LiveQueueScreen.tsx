import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveQueueScreenData, LanguageCode } from '@/types';
import {
  getLiveQueueScreenData,
  subscribeToQueueUpdates,
} from '@/services/queueService';
import { useTranslation } from '@/i18n/LanguageContext';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardFooter } from '@/components/common/Card';
import { NotificationBanner } from '@/components/feedback/NotificationBanner';
import { formatMinutes } from '@/lib/utils';
import {
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Calendar,
  RefreshCw,
  ArrowRight,
  Building2,
  CalendarPlus,
  AlertCircle,
  Activity,
  Sparkles,
} from 'lucide-react';

export interface LiveQueueScreenProps {
  currentLanguage: LanguageCode;
}

export const LiveQueueScreen: React.FC<LiveQueueScreenProps> = ({
  currentLanguage,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<LiveQueueScreenData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadQueueData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      setError(null);
      const queueData = await getLiveQueueScreenData();
      setData(queueData);
    } catch (err: any) {
      if (err.message === 'NO_ACTIVE_BOOKING') {
        setData(null);
      } else {
        console.error('Failed to load queue data', err);
        setError("We couldn't load the latest queue status.");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadQueueData(true);
    const unsubscribe = subscribeToQueueUpdates(() => {
      loadQueueData(false);
    });
    return () => unsubscribe();
  }, [loadQueueData]);

  if (isLoading) {
    return (
      <div className="min-h-[450px] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-[#166534] mb-4">
          <RefreshCw className="w-7 h-7 animate-spin" />
        </div>
        <h3 className="text-lg font-bold text-[#111827]">
          {t('connectedToQueue', 'Connecting to Live Virtual Queue...')}
        </h3>
        <p className="text-xs sm:text-sm text-[#6B7280] mt-1 max-w-sm">
          Calculating token position, intake pace, and dynamic mandi ETA.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-[#DC2626] mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-[#111827]">Queue Telemetry Unavailable</h3>
        <p className="text-xs sm:text-sm text-[#6B7280] mt-1 max-w-md">{error}</p>
        <div className="mt-5">
          <Button variant="primary" onClick={() => loadQueueData(true)} icon={<RefreshCw className="w-4 h-4" />}>
            {t('tryAgain', 'Retry Connection')}
          </Button>
        </div>
      </div>
    );
  }

  if (!data || !data.booking) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-5 animate-fade-in py-8">
        <Card className="border-dashed border-2 border-slate-300 bg-white text-center py-12 px-6">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-[#166534] flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-subtle">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#111827]">
            {t('noActiveBooking', 'Your queue has not started because you do not have an active booking.')}
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7280] max-w-md mx-auto mt-1.5 leading-relaxed">
            {t('noActiveBookingDesc', 'Schedule a procurement appointment at your nearest mandi depot to receive your live virtual queue token and dynamic arrival time.')}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => navigate('/farmer/book-slot')}
              icon={<CalendarPlus className="w-4 h-4" />}
            >
              {t('bookSlot', 'Book a Slot')}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/farmer/dashboard')}
            >
              {t('dashboard', 'Return to Dashboard')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const {
    farmerTokenNumber,
    currentToken,
    farmersAhead,
    queuePosition,
    estimatedWaitMinutes,
    recommendedArrivalTime,
    bookedSlot,
    centreName,
    todayDate,
    lastUpdated,
    delayMinutes,
    queueState,
    booking,
    totalInitialQueueLength,
  } = data;

  const maxGap = Math.max(1, totalInitialQueueLength);
  const remainingGap = Math.max(0, farmerTokenNumber - currentToken);
  const progressPercent =
    farmerTokenNumber <= currentToken
      ? 100
      : Math.min(100, Math.max(8, Math.round(((maxGap - remainingGap) / maxGap) * 100)));

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 animate-fade-in pb-12">
      {/* 1. Live Queue Header */}
      <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-ping" />
            <h1 className="text-lg sm:text-xl font-extrabold text-[#111827] tracking-tight">
              Live Virtual Queue (लाइव कतार)
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1 font-bold text-slate-800">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              {centreName}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {todayDate}
            </span>
            <span>•</span>
            <span>Slot: {bookedSlot}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 self-end sm:self-auto">
          <span>Updated: <strong className="text-slate-800 font-mono">{lastUpdated}</strong></span>
          <button
            onClick={() => loadQueueData(false)}
            className="p-1.5 text-slate-500 hover:text-[#166534] bg-slate-50 rounded border border-slate-200 transition-colors"
            title="Refresh queue"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Queue State Advisory Banners */}
      {queueState === 'APPROACHING' && (
        <div className="animate-fade-in">
          <NotificationBanner
            variant="warning"
            title="Your turn is approaching!"
            message="Please reach the procurement centre within 20 minutes. Keep your vehicle positioned near Gate 2."
          />
        </div>
      )}

      {queueState === 'NEXT_IN_QUEUE' && (
        <div className="animate-fade-in p-4 bg-amber-100 border-2 border-amber-400 rounded-card flex items-start gap-3 text-amber-900 shadow-card">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-base font-extrabold">You're next in queue!</h4>
            <p className="text-xs sm:text-sm mt-0.5 font-medium leading-relaxed">
              Token #{currentToken} is finishing weighbridge clearance. Please be ready at the procurement counter now.
            </p>
          </div>
        </div>
      )}

      {queueState === 'NOW_SERVING' && (
        <div className="animate-fade-in p-5 bg-[#DCFCE7] border-2 border-[#166534] rounded-card flex items-start gap-3.5 text-emerald-900 shadow-card">
          <div className="w-9 h-9 rounded-full bg-[#166534] text-white flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="flex-1">
            <h4 className="text-base sm:text-lg font-extrabold text-[#166534]">
              It's your turn! (Now Serving Token #{farmerTokenNumber})
            </h4>
            <p className="text-xs sm:text-sm mt-0.5 text-emerald-800 font-medium">
              Please proceed immediately to Desk 1 / Weighbridge 2 for physical verification and produce moisture test.
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                variant="primary"
                onClick={() => navigate(`/farmer/procurement/${booking.id}`)}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                iconPosition="right"
              >
                Open Processing Tracker
              </Button>
            </div>
          </div>
        </div>
      )}

      {queueState === 'DELAYED' && (
        <div className="animate-fade-in">
          <NotificationBanner
            variant="delay"
            title={`Your procurement centre is currently delayed (+${delayMinutes} min)`}
            message={`Due to heavy incoming farm trailers, queue movement is operating at revised throughput. Your updated recommended arrival time is ${recommendedArrivalTime}.`}
          />
        </div>
      )}

      {/* 3. Hero Queue Card */}
      <Card className="border-2 border-emerald-300 bg-white overflow-hidden shadow-card">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Active Virtual Token Queue
          </span>
          <span className="text-xs text-[#166534] font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            Live Sync
          </span>
        </div>

        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* Side-by-Side Tokens */}
          <div className="grid grid-cols-2 gap-4 divide-x divide-slate-100">
            {/* Farmer Token */}
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <span className="text-xs font-extrabold tracking-wider text-[#6B7280] uppercase">
                {t('yourToken', 'Your Token')}
              </span>
              <div className="text-4xl sm:text-5xl font-black text-[#166534] mt-1 tracking-tight transition-all duration-300">
                #{farmerTokenNumber}
              </div>
              <span className="text-xs text-[#166534] font-semibold mt-1">
                {farmersAhead === 0 ? 'Now Processing' : `Position #${queuePosition} in Queue`}
              </span>
            </div>

            {/* Current Serving Token */}
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <span className="text-xs font-extrabold tracking-wider text-[#6B7280] uppercase">
                {t('nowServing', 'Now Serving')}
              </span>
              <div className="text-4xl sm:text-5xl font-black text-[#111827] mt-1 tracking-tight transition-all duration-300">
                #{currentToken}
              </div>
              <span className="text-xs text-[#16A34A] font-semibold mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-ping inline-block" />
                Inside Centre
              </span>
            </div>
          </div>

          {/* Queue Progress Bar */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Current Token #{currentToken}
              </span>
              <span className="text-xs font-extrabold text-[#166534]">
                {progressPercent}% Cleared
              </span>
              <span className="flex items-center gap-1 text-[#166534]">
                Your Token #{farmerTokenNumber}
                <span className="w-2 h-2 rounded-full bg-[#166534]" />
              </span>
            </div>

            <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
              <div
                className="h-full bg-[#166534] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>Mandi Intake Gate</span>
              <span>Weighbridge & Processing</span>
            </div>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-input flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-[#6B7280] font-medium block">
                  {t('farmersAhead', 'Farmers Ahead')}
                </span>
                <div className="text-lg sm:text-xl font-extrabold text-[#111827] mt-0.5">
                  {farmersAhead === 0 ? '0 (Your Turn)' : `${farmersAhead} farmers`}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-input flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#166534] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-[#6B7280] font-medium block">
                  {t('estimatedWaitingTime', 'Estimated Wait')}
                </span>
                <div className="text-lg sm:text-xl font-extrabold text-[#166534] mt-0.5">
                  {farmersAhead === 0 ? 'Immediate' : formatMinutes(estimatedWaitMinutes)}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-input flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-[#F59E0B] flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-[#6B7280] font-medium block">
                  {t('recommendedArrival', 'Recommended Arrival')}
                </span>
                <div className="text-lg sm:text-xl font-extrabold text-[#111827] mt-0.5">
                  {recommendedArrivalTime}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-input border border-slate-100 text-xs text-slate-600 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Data-Driven ETA Calculation:</strong> Wait time is computed dynamically from crop throughput ({booking.cropName} at 50kg/min), individual loads of all {farmersAhead} vehicles ahead, and live weighbridge pace.
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 bg-slate-50/50">
          <button
            onClick={() => navigate('/farmer/dashboard')}
            className="text-xs font-bold text-[#166534] hover:underline"
          >
            ← Back to Farmer Dashboard
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              size="md"
              variant="outline"
              onClick={() => navigate(`/farmer/procurement/${booking.id}`)}
              icon={<Activity className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              View Full Stage Tracking
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LiveQueueScreen;
