import React from 'react';
import { Link } from 'react-router-dom';
import { ProcurementCentre, CentreStats, Booking } from '@/types';
import { OfficerTopBar } from './OfficerTopBar';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { KpiCard } from '@/components/cards/KpiCard';
import { formatCurrency } from '@/lib/utils';
import {
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Check,
} from 'lucide-react';

interface OfficerOverviewTabProps {
  centre: ProcurementCentre;
  stats: CentreStats;
  bookings: Booking[];
  onSetDelay: (delayMins: number) => void;
  onOpenCheckIn: () => void;
  onServeNext: () => void;
  isAdvancingQueue: boolean;
  onOpenDetail: (booking: Booking) => void;
}

export const OfficerOverviewTab: React.FC<OfficerOverviewTabProps> = ({
  centre,
  stats,
  bookings,
  onSetDelay,
  onOpenCheckIn,
  onServeNext,
  isAdvancingQueue,
  onOpenDetail,
}) => {
  const servingBooking = bookings.find(
    (b) => b.currentStage === 'NOW_SERVING' || b.currentStage === 'VERIFICATION'
  );

  const nextInQueue = bookings
    .filter((b) => ['BOOKED', 'ARRIVED', 'WAITING'].includes(b.currentStage))
    .slice(0, 3);

  const recentCompleted = bookings
    .filter((b) => b.currentStage === 'COMPLETED')
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Top Operational Action Bar */}
      <OfficerTopBar
        title={centre.name}
        subtitleCategory="Mandi Operational Terminal"
        subtitleLocation={`${centre.district}, ${centre.state}`}
        currentDelayMinutes={centre.currentDelayMinutes}
        onSetDelay={onSetDelay}
        onOpenCheckIn={onOpenCheckIn}
        onServeNext={onServeNext}
        isAdvancingQueue={isAdvancingQueue}
      />

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
            {servingBooking ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-input flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#166534] uppercase tracking-wider block">
                    Currently At Gate 2 / Desk
                  </span>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {servingBooking.farmerName}
                  </div>
                  <div className="text-xs text-slate-600">
                    Token #{servingBooking.tokenNumber} • {servingBooking.cropName}
                  </div>
                </div>
                <StatusBadge status="NOW_SERVING" label="Serving" />
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-input text-xs text-slate-600 flex items-center justify-between">
                <span>No farmer currently at desk. Ready to call next token.</span>
                <Button size="sm" variant="primary" onClick={onServeNext} disabled={isAdvancingQueue}>
                  Call Next
                </Button>
              </div>
            )}

            <div className="text-xs font-bold text-slate-700 mt-2">Next in Queue:</div>
            <div className="space-y-1.5">
              {nextInQueue.length === 0 ? (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-md text-xs text-slate-500 text-center">
                  No farmers are currently in the queue.
                </div>
              ) : (
                nextInQueue.map((b) => (
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
                {recentCompleted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-xs">
                      No completed procurements yet.
                    </td>
                  </tr>
                ) : (
                  recentCompleted.map((b) => (
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
                          onClick={() => onOpenDetail(b)}
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
  );
};
export default OfficerOverviewTab;
