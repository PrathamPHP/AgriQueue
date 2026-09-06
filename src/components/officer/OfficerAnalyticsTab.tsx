import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { KpiCard } from '@/components/cards/KpiCard';
import { Clock, Scale, TrendingUp, ShieldCheck } from 'lucide-react';

export const OfficerAnalyticsTab: React.FC = () => {
  return (
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
  );
};
export default OfficerAnalyticsTab;
