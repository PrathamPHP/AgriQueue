import React, { useState, useEffect } from 'react';
import { ProcurementCentre, CentreStats, Booking } from '@/types';
import { dataStore } from '@/services/dataStore';
import { OfficerTopBar } from './OfficerTopBar';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  Search,
  X,
  Users,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';

interface OfficerQueueTabProps {
  centre: ProcurementCentre;
  stats: CentreStats;
  bookings: Booking[];
  onSetDelay: (delayMins: number) => void;
  onOpenCheckIn: () => void;
  onServeNext: () => void;
  isAdvancingQueue: boolean;
  onCheckIn: (bookingId: string) => void;
  onCallToDesk: (booking: Booking) => void;
  onStartVerification: (bookingId: string) => void;
  onOpenQualityCheck: (booking: Booking) => void;
  onOpenWeighing: (booking: Booking) => void;
  onOpenNoShow: (booking: Booking) => void;
  onOpenReceipt: (booking: Booking) => void;
  onOpenDetail: (booking: Booking) => void;
}

export const OfficerQueueTab: React.FC<OfficerQueueTabProps> = ({
  centre,
  stats,
  bookings,
  onSetDelay,
  onOpenCheckIn,
  onServeNext,
  isAdvancingQueue,
  onCheckIn,
  onCallToDesk,
  onStartVerification,
  onOpenQualityCheck,
  onOpenWeighing,
  onOpenNoShow,
  onOpenReceipt,
  onOpenDetail,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [queuePage, setQueuePage] = useState<number>(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    setQueuePage(1);
  }, [searchQuery, statusFilter]);

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
    return true;
  });

  const queueTotalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const paginatedQueueBookings = filteredBookings.slice(
    (queuePage - 1) * PAGE_SIZE,
    queuePage * PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      {/* Top Operational Action Bar */}
      <OfficerTopBar
        title="Today's Live Queue Dispatch"
        subtitleCategory="Gate & Queue Operations"
        subtitleLocation="Live Intake"
        currentDelayMinutes={centre.currentDelayMinutes}
        onSetDelay={onSetDelay}
        onOpenCheckIn={onOpenCheckIn}
        onServeNext={onServeNext}
        isAdvancingQueue={isAdvancingQueue}
      />

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
                                  onClick={() => onCheckIn(b.id)}
                                >
                                  Check In
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onOpenNoShow(b)}
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
                                  onClick={() => onCallToDesk(b)}
                                >
                                  Call to Desk / Serve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onOpenNoShow(b)}
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
                                onClick={() => onStartVerification(b.id)}
                              >
                                Start Verification
                              </Button>
                            )}

                            {b.currentStage === 'VERIFICATION' && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => onOpenQualityCheck(b)}
                              >
                                Complete Verification
                              </Button>
                            )}

                            {b.currentStage === 'QUALITY_CHECK' && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => onOpenQualityCheck(b)}
                              >
                                Complete Quality Check
                              </Button>
                            )}

                            {b.currentStage === 'WEIGHING' && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => onOpenWeighing(b)}
                              >
                                Complete Procurement
                              </Button>
                            )}

                            {b.currentStage === 'COMPLETED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onOpenReceipt(b)}
                                icon={<FileText className="w-3.5 h-3.5" />}
                              >
                                J-Form Receipt
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onOpenDetail(b)}
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
  );
};
export default OfficerQueueTab;
