import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsService } from '@/services/analyticsService';
import { geographyService } from '@/services/geographyService';
import { dataStore } from '@/services/dataStore';
import { NationalStats, AdminUser } from '@/types';
import { GeographicBreadcrumbs } from '@/components/common/GeographicBreadcrumbs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { KpiCard } from '@/components/cards/KpiCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import { formatCurrency } from '@/lib/utils';
import {
  Globe,
  Building2,
  Users,
  Calendar,
  Clock,
  ShieldCheck,
  RefreshCw,
  Download,
  ArrowRight,
  Activity,
  CheckCircle2,
  Landmark,
  LogOut,
  MapPin,
} from 'lucide-react';
import { AgroIndiaMapComponent } from '@/components/map/AgroIndiaMapComponent';
import { useAdminMap } from './AdminMapContext';

export const NationalAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const adminMapCtx = useAdminMap();
  const isShared = adminMapCtx?.isSharedMapActive ?? false;
  const activeViewMode = isShared ? adminMapCtx.viewMode : 'map';

  const [stats, setStats] = useState<NationalStats | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'table'>('map');
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser>(dataStore.getCurrentAdmin());
  const [adminList, setAdminList] = useState<AdminUser[]>(dataStore.getAdminUsers());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  const loadStats = async () => {
    try {
      const admin = dataStore.getCurrentAdmin();
      setCurrentAdmin(admin);
      setAdminList(dataStore.getAdminUsers());

      // Access scope enforcement: State and District admins cannot view nationwide command
      const scopeVal = admin.scopeId || admin.scopeValue;
      if (admin.scopeType === 'STATE' && scopeVal) {
        navigate(`/admin/state/${scopeVal}`, { replace: true });
        return;
      }
      if (admin.scopeType === 'DISTRICT' && scopeVal) {
        navigate(`/admin/district/${scopeVal}`, { replace: true });
        return;
      }

      const data = await analyticsService.getNationalStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load national stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const unsubscribe = dataStore.subscribe(() => {
      loadStats();
    });
    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadStats();
    setTimeout(() => setIsRefreshing(false), 500);
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

  const handleExportCsv = () => {
    if (!stats) return;
    const headers = [
      'State Code',
      'State Name',
      'Districts Count',
      'Centres Count',
      'Today Bookings',
      'Completed Procurements',
      'Procured (Tonnes)',
      'DBT Disbursed (INR)',
      'Avg Wait (Mins)',
    ];
    const rows = stats.stateSummaries.map((s) => [
      s.stateCode,
      `"${s.stateName}"`,
      s.totalDistricts,
      s.totalCentres,
      s.totalBookingsToday,
      s.completedToday,
      s.totalProcuredTonnes,
      s.totalDisbursedAmount,
      s.avgWaitTimeMin,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `national_procurement_telemetry_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 4000);
  };

  const renderStateTable = () => (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-700" />
              State Performance & Procurement Telemetry
            </CardTitle>
            <CardDescription>
              Click on any state to inspect district-level and mandi-level operations
            </CardDescription>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing {stats?.stateSummaries.length || 0} States / UTs
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3 text-center">Districts</th>
                <th className="py-2.5 px-3 text-center">Centres</th>
                <th className="py-2.5 px-3 text-center">Bookings</th>
                <th className="py-2.5 px-3 text-center">Farmers Waiting</th>
                <th className="py-2.5 px-3 text-right">Procurement Volume</th>
                <th className="py-2.5 px-3 text-center">Average Wait</th>
                <th className="py-2.5 px-3 text-right">Pending Payments</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats?.stateSummaries.map((s) => (
                <tr
                  key={s.stateId}
                  className="hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/admin/state/${s.stateId}`)}
                >
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900 group-hover:text-emerald-800">
                      {s.stateName}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 font-semibold">
                      {s.stateCode}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-medium text-slate-700">
                    {s.totalDistricts}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="font-bold text-emerald-800">
                      {s.activeCentres} / {s.totalCentres}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="font-bold text-slate-900">{s.totalBookingsToday}</span>
                  </td>
                  <td className="py-3 px-3 text-center font-medium text-amber-800">
                    {s.currentlyWaiting}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {s.totalProcuredTonnes === 0 ? '0 MT' : `${s.totalProcuredTonnes} MT`}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        s.avgWaitTimeMin > 25
                          ? 'bg-red-100 text-red-800'
                          : s.avgWaitTimeMin > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.avgWaitTimeMin > 0 ? `${s.avgWaitTimeMin}m` : '--'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-amber-700">
                    {formatCurrency(s.pendingDisbursementAmount)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ArrowRight className="w-3.5 h-3.5" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/state/${s.stateId}`);
                      }}
                    >
                      Inspect State
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading || !stats) {
    if (isShared) {
      return (
        <div className="flex items-center justify-center p-8 text-center text-xs text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin text-[#166534] mr-2" />
          <span>Loading National Command Telemetry...</span>
        </div>
      );
    }
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-7 h-7 animate-spin text-[#166534] mb-3" />
        <h3 className="text-base font-bold text-slate-900">Loading National Command Telemetry...</h3>
        <p className="text-xs text-slate-500 mt-1">
          Aggregating state directorates, district mandis, and nationwide PFMS DBT.
        </p>
      </div>
    );
  }

  // When inside AdminLayout (shared persistent map experience)
  if (isShared) {
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Top 4 Primary National KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            title="Procurement Volume"
            value={stats.totalProcuredTonnes === 0 ? '0 MT' : `${stats.totalProcuredTonnes.toLocaleString('en-IN')} MT`}
            subtitle={
              stats.totalProcuredTonnes === 0
                ? 'Awaiting live weighments'
                : `${(stats.totalProcuredTonnes * 10).toLocaleString('en-IN')} Quintals`
            }
            icon={<Globe className="w-5 h-5 text-[#166534]" />}
          />

          <KpiCard
            title="DBT Disbursed (PFMS)"
            value={formatCurrency(stats.totalDisbursedAmount)}
            subtitle={
              stats.pendingDisbursementAmount > 0
                ? `${formatCurrency(stats.pendingDisbursementAmount)} pending`
                : 'Direct bank transfers'
            }
            icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
          />

          <KpiCard
            title="Nationwide Bookings"
            value={stats.totalBookingsToday.toString()}
            subtitle={
              stats.totalBookingsToday === 0
                ? 'No bookings logged yet'
                : `${stats.currentlyWaiting} waiting • ${stats.completedToday} served`
            }
            icon={<Calendar className="w-5 h-5 text-blue-600" />}
          />

          <KpiCard
            title="Active Mandi Network"
            value={`${stats.activeCentres} / ${stats.totalCentres}`}
            subtitle={`Across ${stats.totalStates} States & ${stats.totalDistricts} Districts`}
            icon={<Building2 className="w-5 h-5 text-amber-600" />}
          />
        </div>

        {/* Secondary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-card border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 font-medium">Farmers Served:</span>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {stats.completedToday} Farmers
            </p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">National Avg Wait Time:</span>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {stats.nationalAvgWaitTimeMin > 0 ? `${stats.nationalAvgWaitTimeMin} mins` : '--'}
            </p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Pending Payments:</span>
            <p className="text-sm font-bold text-amber-700 mt-0.5">
              {formatCurrency(stats.pendingDisbursementAmount)}
            </p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Platform Status:</span>
            <p className="text-sm font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> All Systems Operational
            </p>
          </div>
        </div>

        {/* Empty State Banner per SIH Specification */}
        {stats.totalBookingsToday === 0 && (
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-card flex items-center gap-3 text-amber-900 text-xs animate-fade-in">
            <Activity className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-sm text-amber-950">No procurement activity available yet.</p>
              <p className="text-amber-800 mt-0.5">
                Reference geography is mapped above. As farmers book slots and mandis process weighments, real-time national telemetry will populate automatically.
              </p>
            </div>
          </div>
        )}

        {/* When in Table view mode, display the state table */}
        {activeViewMode === 'table' && renderStateTable()}
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Geographic Breadcrumbs */}
      <GeographicBreadcrumbs showBack={false} />

      {/* Header with Title and Scope Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse-subtle" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              Department of Food & Public Distribution • National Command
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827] mt-0.5">
            Nationwide Agricultural Procurement Command
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
            Single multi-tier oversight across States, Districts, and Mandis • SIH 2026
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
            Refresh
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
            title="Logout from National Command"
          >
            Logout
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportCsv}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {exportSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-input text-xs font-bold text-[#166534] flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>National telemetry successfully exported to CSV file!</span>
        </div>
      )}

      {/* Top 4 Primary National KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Procurement Volume"
          value={stats.totalProcuredTonnes === 0 ? '0 MT' : `${stats.totalProcuredTonnes.toLocaleString('en-IN')} MT`}
          subtitle={
            stats.totalProcuredTonnes === 0
              ? 'Awaiting live weighments'
              : `${(stats.totalProcuredTonnes * 10).toLocaleString('en-IN')} Quintals`
          }
          icon={<Globe className="w-5 h-5 text-[#166534]" />}
        />

        <KpiCard
          title="DBT Disbursed (PFMS)"
          value={formatCurrency(stats.totalDisbursedAmount)}
          subtitle={
            stats.pendingDisbursementAmount > 0
              ? `${formatCurrency(stats.pendingDisbursementAmount)} pending`
              : 'Direct bank transfers'
          }
          icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
        />

        <KpiCard
          title="Nationwide Bookings"
          value={stats.totalBookingsToday.toString()}
          subtitle={
            stats.totalBookingsToday === 0
              ? 'No bookings logged yet'
              : `${stats.currentlyWaiting} waiting • ${stats.completedToday} served`
          }
          icon={<Calendar className="w-5 h-5 text-blue-600" />}
        />

        <KpiCard
          title="Active Mandi Network"
          value={`${stats.activeCentres} / ${stats.totalCentres}`}
          subtitle={`Across ${stats.totalStates} States & ${stats.totalDistricts} Districts`}
          icon={<Building2 className="w-5 h-5 text-amber-600" />}
        />
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-card border border-slate-200 text-xs">
        <div>
          <span className="text-slate-500 font-medium">Farmers Served:</span>
          <p className="text-sm font-bold text-slate-800 mt-0.5">
            {stats.completedToday} Farmers
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">National Avg Wait Time:</span>
          <p className="text-sm font-bold text-slate-800 mt-0.5">
            {stats.nationalAvgWaitTimeMin > 0 ? `${stats.nationalAvgWaitTimeMin} mins` : '--'}
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Pending Payments:</span>
          <p className="text-sm font-bold text-amber-700 mt-0.5">
            {formatCurrency(stats.pendingDisbursementAmount)}
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Platform Status:</span>
          <p className="text-sm font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> All Systems Operational
          </p>
        </div>
      </div>

      {/* Empty State Banner per SIH Specification */}
      {stats.totalBookingsToday === 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-card flex items-center gap-3 text-amber-900 text-xs animate-fade-in">
          <Activity className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-sm text-amber-950">No procurement activity available yet.</p>
            <p className="text-amber-800 mt-0.5">
              Reference geography is mapped below. As farmers book slots and mandis process weighments, real-time national telemetry will populate automatically.
            </p>
          </div>
        </div>
      )}

      {/* View Switcher: Interactive Map vs Table */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#166534]" />
            National Procurement Geography & Telemetry
          </h2>
          <p className="text-xs text-slate-500">
            Switch between interactive nationwide geospatial mapping and tabular state drilldowns
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-card border border-slate-200 shrink-0">
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-bold transition-all ${
              viewMode === 'map'
                ? 'bg-white text-[#166534] shadow-subtle'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Interactive Map
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-bold transition-all ${
              viewMode === 'table'
                ? 'bg-white text-[#166534] shadow-subtle'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            State Table ({stats.stateSummaries.length})
          </button>
        </div>
      </div>

      {viewMode === 'map' ? (
        <div className="animate-fade-in space-y-3">
          <AgroIndiaMapComponent
            onSelectState={(stateName) => {
              const matched = geographyService.getStateByName(stateName);
              if (matched) {
                navigate(`/admin/state/${matched.id}`);
              }
            }}
            onSelectDistrict={(districtData) => {
              console.log('District selected:', districtData);
            }}
          />
        </div>
      ) : (
        /* State-by-State Telemetry Table */
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  State Performance & Procurement Telemetry
                </CardTitle>
                <CardDescription>
                  Click on any state to inspect district-level and mandi-level operations
                </CardDescription>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Showing {stats.stateSummaries.length} States / UTs
              </span>
            </div>
          </CardHeader>
          <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3 text-center">Districts</th>
                  <th className="py-2.5 px-3 text-center">Centres</th>
                  <th className="py-2.5 px-3 text-center">Bookings</th>
                  <th className="py-2.5 px-3 text-center">Farmers Waiting</th>
                  <th className="py-2.5 px-3 text-right">Procurement Volume</th>
                  <th className="py-2.5 px-3 text-center">Average Wait</th>
                  <th className="py-2.5 px-3 text-right">Pending Payments</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.stateSummaries.map((s) => (
                  <tr
                    key={s.stateId}
                    className="hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/admin/state/${s.stateId}`)}
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 group-hover:text-emerald-800">
                        {s.stateName}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 font-semibold">
                        {s.stateCode}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-slate-700">
                      {s.totalDistricts}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-emerald-800">
                        {s.activeCentres} / {s.totalCentres}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-slate-900">{s.totalBookingsToday}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-amber-800">
                      {s.currentlyWaiting}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {s.totalProcuredTonnes === 0 ? '0 MT' : `${s.totalProcuredTonnes} MT`}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          s.avgWaitTimeMin > 25
                            ? 'bg-red-100 text-red-800'
                            : s.avgWaitTimeMin > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.avgWaitTimeMin > 0 ? `${s.avgWaitTimeMin}m` : '--'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-amber-700">
                      {formatCurrency(s.pendingDisbursementAmount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowRight className="w-3.5 h-3.5" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/state/${s.stateId}`);
                        }}
                      >
                        Inspect State
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
};
