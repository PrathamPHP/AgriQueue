import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { analyticsService } from '@/services/analyticsService';
import { dataStore } from '@/services/dataStore';
import { DistrictStats, District, State, AdminUser } from '@/types';
import { GeographicBreadcrumbs } from '@/components/common/GeographicBreadcrumbs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { KpiCard } from '@/components/cards/KpiCard';
import { Button } from '@/components/common/Button';
import { formatCurrency } from '@/lib/utils';
import {
  Building2,
  Calendar,
  Clock,
  ShieldCheck,
  RefreshCw,
  Download,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Sliders,
  Check,
  Landmark,
  AlertTriangle,
  ChevronRight,
  LogOut,
} from 'lucide-react';

export const DistrictDashboard: React.FC = () => {
  const { districtId } = useParams<{ districtId: string }>();
  const navigate = useNavigate();

  const [districtStats, setDistrictStats] = useState<DistrictStats | null>(null);
  const [districtObj, setDistrictObj] = useState<District | undefined>(undefined);
  const [stateObj, setStateObj] = useState<State | undefined>(undefined);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser>(dataStore.getCurrentAdmin());
  const [adminList, setAdminList] = useState<AdminUser[]>(dataStore.getAdminUsers());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [divertNotice, setDivertNotice] = useState<string | null>(null);

  const loadData = async () => {
    if (!districtId) return;
    try {
      const admin = dataStore.getCurrentAdmin();
      setCurrentAdmin(admin);
      setAdminList(dataStore.getAdminUsers());

      const d = dataStore.getDistrictById(districtId);
      setDistrictObj(d);

      // Access scope enforcement:
      const scopeVal = admin.scopeId || admin.scopeValue;
      if (admin.scopeType === 'DISTRICT' && scopeVal && scopeVal !== districtId) {
        navigate(`/admin/district/${scopeVal}`, { replace: true });
        return;
      }
      if (admin.scopeType === 'STATE' && scopeVal && d && d.stateId !== scopeVal) {
        navigate(`/admin/state/${scopeVal}`, { replace: true });
        return;
      }

      if (d) {
        const s = dataStore.getStateById(d.stateId);
        setStateObj(s);
      }
      const stats = await analyticsService.getDistrictStats(districtId);
      setDistrictStats(stats);
    } catch (err) {
      console.error('Failed to load district stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminScopeSwitch = (adminId: string) => {
    dataStore.setCurrentAdminId(adminId);
    const admin = dataStore.getCurrentAdmin();
    setCurrentAdmin(admin);
    const scopeVal = admin.scopeId || admin.scopeValue;
    if (admin.scopeType === 'STATE' && scopeVal) {
      navigate(`/admin/state/${scopeVal}`);
    } else if (admin.scopeType === 'DISTRICT' && scopeVal) {
      navigate(`/admin/district/${scopeVal}`);
    } else {
      navigate('/admin/national');
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = dataStore.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [districtId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleExportCsv = () => {
    if (!districtStats || !districtObj) return;
    const headers = [
      'Centre Code',
      'Centre Name',
      'Status',
      'Capacity Utilization %',
      'Today Bookings',
      'Waiting in Queue',
      'Completed',
      'Procured (Kg)',
      'Current Delay (Min)',
      'Current Serving Token',
    ];
    const rows = districtStats.centreSummaries.map((c) => [
      c.centreCode,
      `"${c.centreName}"`,
      c.status,
      `${c.capacityUtilization}%`,
      c.todayBookingsCount,
      c.currentlyWaitingCount,
      c.completedTodayCount,
      c.totalQuantityProcuredKg,
      c.currentDelayMinutes,
      c.currentToken,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${districtObj.name.toLowerCase()}_district_mandi_telemetry_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 4000);
  };

  const handleDivertTraffic = (centreName: string) => {
    setDivertNotice(
      `Gate Diversion Active for ${centreName}: Slot availability throttled for overloaded depot. Farmers in neighbouring blocks will receive recommendation cards for adjacent under-capacity centres.`
    );
  };

  if (isLoading || !districtStats || !districtObj) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-7 h-7 animate-spin text-[#166534] mb-3" />
        <h3 className="text-base font-bold text-slate-900">Loading District Telemetry...</h3>
        <p className="text-xs text-slate-500 mt-1">Inspecting mandis, weighbridge terminals, and gate delays.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Geographic Breadcrumbs */}
      <GeographicBreadcrumbs
        stateId={stateObj?.id}
        stateName={stateObj?.name}
        districtId={districtObj.id}
        districtName={districtObj.name}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse-subtle" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              District Administration • Food & Civil Supplies
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827] mt-0.5">
            {districtObj.name} District Mandi Telemetry
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
            {stateObj?.name} • District Code: {districtObj.code}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Admin Persona Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-button border border-slate-200 text-xs">
            <span className="text-slate-500 font-semibold px-2 flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-slate-600" />
              Role:
            </span>
            <select
              value={currentAdmin.id}
              onChange={(e) => handleAdminScopeSwitch(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 font-semibold text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
            >
              {adminList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.scopeType})
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            onClick={handleRefresh}
            isLoading={isRefreshing}
          >
            Refresh Data
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={<LogOut className="w-3.5 h-3.5 text-red-600" />}
            onClick={() => {
              dataStore.logoutAdmin();
              navigate('/login', { replace: true });
            }}
            className="text-red-700 hover:bg-red-50 border-red-200"
            title="Logout from District Command"
          >
            Logout
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportCsv}
          >
            Export Register (CSV)
          </Button>
        </div>
      </div>

      {exportSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-input text-xs font-bold text-[#166534] flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{districtObj.name} District telemetry exported to CSV successfully!</span>
        </div>
      )}

      {divertNotice && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-input text-xs font-medium text-amber-900 flex items-center justify-between gap-2 animate-fade-in">
          <span>{divertNotice}</span>
          <button
            onClick={() => setDivertNotice(null)}
            className="text-amber-700 hover:text-amber-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* District KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="District Procurement"
          value={districtStats.totalProcuredKg === 0 ? '0 kg' : `${districtStats.totalProcuredKg.toLocaleString('en-IN')} kg`}
          subtitle={
            districtStats.totalProcuredKg === 0
              ? 'Awaiting weighment records'
              : `${(Math.round(districtStats.totalProcuredKg / 10) / 100).toFixed(2)} MT`
          }
          icon={<Building2 className="w-5 h-5 text-[#166534]" />}
        />

        <KpiCard
          title="District DBT Disbursed"
          value={formatCurrency(districtStats.totalDisbursedAmount)}
          subtitle={
            districtStats.pendingDisbursementAmount > 0
              ? `${formatCurrency(districtStats.pendingDisbursementAmount)} pending`
              : 'Direct bank transfer'
          }
          icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
        />

        <KpiCard
          title="District Bookings"
          value={districtStats.totalBookingsToday.toString()}
          subtitle={
            districtStats.totalBookingsToday === 0
              ? 'No bookings yet'
              : `${districtStats.currentlyWaiting} waiting • ${districtStats.completedToday} completed`
          }
          icon={<Calendar className="w-5 h-5 text-blue-600" />}
        />

        <KpiCard
          title="Operational Mandis"
          value={`${districtStats.activeCentres} / ${districtStats.totalCentres}`}
          subtitle="All locations live & reporting"
          icon={<MapPin className="w-5 h-5 text-amber-600" />}
        />
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-card border border-slate-200 text-xs">
        <div>
          <span className="text-slate-500 font-medium">Currently Waiting:</span>
          <p className="text-sm font-bold text-amber-800 mt-0.5">
            {districtStats.currentlyWaiting} Farmers
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">District Avg Wait Time:</span>
          <p className="text-sm font-bold text-slate-800 mt-0.5">
            {districtStats.avgWaitTimeMin > 0 ? `${districtStats.avgWaitTimeMin} mins` : '--'}
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Pending Payments:</span>
          <p className="text-sm font-bold text-amber-700 mt-0.5">
            {formatCurrency(districtStats.pendingDisbursementAmount)}
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Completed Procurements:</span>
          <p className="text-sm font-bold text-emerald-800 mt-0.5">
            {districtStats.completedToday} Completed
          </p>
        </div>
      </div>

      {/* Empty State Banner per SIH Specification */}
      {districtStats.totalBookingsToday === 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-card flex items-center gap-3 text-amber-900 text-xs animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-sm text-amber-950">No procurement activity recorded.</p>
            <p className="text-amber-800 mt-0.5">
              Procurement centres in {districtObj.name} district are operational. As bookings are scheduled, live gate and weighbridge queues will appear here.
            </p>
          </div>
        </div>
      )}

      {/* Mandis in District Breakdown Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-700" />
                Procurement Centres & Mandis in {districtObj.name}
              </CardTitle>
              <CardDescription>
                Live gate status, capacity, bookings, queue lengths, and payment metrics
              </CardDescription>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {districtStats.centreSummaries.length} Mandis
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Centre Name</th>
                  <th className="py-2.5 px-3 text-center">Capacity</th>
                  <th className="py-2.5 px-3 text-center">Bookings</th>
                  <th className="py-2.5 px-3 text-center">Currently Waiting</th>
                  <th className="py-2.5 px-3 text-center">Completed</th>
                  <th className="py-2.5 px-3 text-center">Average Wait</th>
                  <th className="py-2.5 px-3 text-right">Procurement Volume</th>
                  <th className="py-2.5 px-3 text-right">Payment Pending</th>
                  <th className="py-2.5 px-3 text-center">Operational Status</th>
                  <th className="py-2.5 px-3 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {districtStats.centreSummaries.map((c) => (
                  <tr
                    key={c.centreId}
                    className="hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/admin/centre/${c.centreId}`)}
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 group-hover:text-emerald-800">
                        {c.centreName}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 font-semibold">
                        {c.centreCode}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="text-slate-800 font-semibold">{c.capacity} slots</div>
                      <div className="text-[10px] text-slate-500">({c.capacityUtilization}% booked)</div>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900">
                      {c.todayBookingsCount}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-amber-800">
                      {c.currentlyWaitingCount}
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-slate-700">
                      {c.completedTodayCount}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          c.avgWaitTimeMin > 20
                            ? 'bg-red-100 text-red-800'
                            : c.avgWaitTimeMin > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.avgWaitTimeMin > 0 ? `${c.avgWaitTimeMin}m` : '--'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {c.totalQuantityProcuredKg.toLocaleString('en-IN')} kg
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-amber-700">
                      {formatCurrency(c.pendingDisbursementAmount || 0)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowRight className="w-3.5 h-3.5" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/centre/${c.centreId}`);
                        }}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DistrictDashboard;
