import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { analyticsService } from '@/services/analyticsService';
import { geographyService } from '@/services/geographyService';
import { dataStore } from '@/services/dataStore';
import { AgroIndiaMapComponent } from '@/components/map/AgroIndiaMapComponent';
import { StateStats, State, AdminUser } from '@/types';
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
  AlertTriangle,
  Landmark,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAdminMap } from './AdminMapContext';

export const StateDashboard: React.FC = () => {
  const { stateId } = useParams<{ stateId: string }>();
  const navigate = useNavigate();
  const adminMapCtx = useAdminMap();
  const isShared = adminMapCtx?.isSharedMapActive ?? false;

  const [stateStats, setStateStats] = useState<StateStats | null>(null);
  const [stateObj, setStateObj] = useState<State | undefined>(() =>
    stateId ? dataStore.getStateById(stateId) : undefined
  );
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser>(dataStore.getCurrentAdmin());
  const [adminList, setAdminList] = useState<AdminUser[]>(dataStore.getAdminUsers());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [rebalanceMessage, setRebalanceMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!stateId) return;
    try {
      const admin = dataStore.getCurrentAdmin();
      setCurrentAdmin(admin);
      setAdminList(dataStore.getAdminUsers());

      // Access scope enforcement:
      const scopeVal = admin.scopeId || admin.scopeValue;
      if (admin.scopeType === 'DISTRICT' && scopeVal) {
        navigate(`/admin/district/${scopeVal}`, { replace: true });
        return;
      }
      if (admin.scopeType === 'STATE' && scopeVal && scopeVal !== stateId) {
        navigate(`/admin/state/${scopeVal}`, { replace: true });
        return;
      }

      const s = dataStore.getStateById(stateId);
      setStateObj(s);
      const stats = await analyticsService.getStateStats(stateId);
      setStateStats(stats);
    } catch (err) {
      console.error('Failed to load state stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = dataStore.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [stateId]);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleExportCsv = () => {
    if (!stateStats || !stateObj) return;
    const headers = [
      'District Code',
      'District Name',
      'Centres Active',
      'Today Bookings',
      'Completed Procurements',
      'Procured (Kg)',
      'Avg Wait (Mins)',
    ];
    const rows = stateStats.districtSummaries.map((d) => [
      d.districtCode,
      `"${d.districtName}"`,
      `${d.activeCentres}/${d.totalCentres}`,
      d.totalBookingsToday,
      d.completedToday,
      d.totalProcuredKg,
      d.avgWaitTimeMin,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${stateObj.code.toLowerCase()}_state_procurement_telemetry_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 4000);
  };

  const handleTriggerRebalance = (districtName: string) => {
    setRebalanceMessage(
      `State Load Advisory Issued: Recommended inter-depot slot diversion initiated for ${districtName}. Nearby under-utilized mandis prioritized in farmer booking recommendations.`
    );
  };

  const renderDistrictTable = () => {
    if (!stateStats || !stateObj) return null;
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-700" />
                District Administrative Jurisdictions
              </CardTitle>
              <CardDescription>
                Detailed overview of procurement operations across {stateObj.name} districts
              </CardDescription>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {stateStats.districtSummaries.length} Districts Registered
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">District</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3 text-center">Centres</th>
                  <th className="py-2.5 px-3 text-center">Bookings</th>
                  <th className="py-2.5 px-3 text-center">Farmers Waiting</th>
                  <th className="py-2.5 px-3 text-center">Completed</th>
                  <th className="py-2.5 px-3 text-right">Procured (Kg)</th>
                  <th className="py-2.5 px-3 text-center">Avg Wait</th>
                  <th className="py-2.5 px-3 text-right">Pending Payments</th>
                  <th className="py-2.5 px-3 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stateStats.districtSummaries.map((d) => (
                  <tr
                    key={d.districtId}
                    className="hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/admin/district/${d.districtId}`)}
                  >
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 group-hover:text-emerald-800">
                        {d.districtName}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                        {d.districtCode}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-emerald-800">
                      {d.activeCentres} / {d.totalCentres}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900">
                      {d.totalBookingsToday}
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-amber-800">
                      {d.currentlyWaiting}
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-slate-700">
                      {d.completedToday}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {d.totalProcuredKg.toLocaleString('en-IN')} kg
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          d.avgWaitTimeMin > 25
                            ? 'bg-red-100 text-red-800'
                            : d.avgWaitTimeMin > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {d.avgWaitTimeMin > 0 ? `${d.avgWaitTimeMin}m` : '--'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-amber-700">
                      {formatCurrency(d.pendingDisbursementAmount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowRight className="w-3.5 h-3.5" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/district/${d.districtId}`);
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
    );
  };

  if (isLoading || !stateStats || !stateObj) {
    if (isShared) {
      return (
        <div className="flex items-center justify-center p-8 text-center text-xs text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin text-[#166534] mr-2" />
          <span>Loading State Directorate Telemetry...</span>
        </div>
      );
    }
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-7 h-7 animate-spin text-[#166534] mb-3" />
        <h3 className="text-base font-bold text-slate-900">Loading State Directorate Telemetry...</h3>
        <p className="text-xs text-slate-500 mt-1">Aggregating district mandis and live weighbridge queues.</p>
      </div>
    );
  }

  // When inside AdminLayout (shared persistent map experience)
  if (isShared) {
    return (
      <div className="space-y-5 animate-fade-in">
        {rebalanceMessage && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-input text-xs font-medium text-blue-900 flex items-center justify-between gap-2 animate-fade-in">
            <span>{rebalanceMessage}</span>
            <button
              onClick={() => setRebalanceMessage(null)}
              className="text-blue-600 hover:text-blue-800 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Zero Procurement Activity State Notice */}
        {stateStats.totalBookingsToday === 0 && stateStats.totalProcuredKg === 0 && (
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-950">
                  No procurement activity recorded yet for this state.
                </h4>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  Procurement centres are operational across all {stateStats.totalDistricts} districts. New farmer bookings and weighbridge receipts will appear here in real time.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold bg-amber-100/90 text-amber-800 px-2.5 py-1 rounded-full shrink-0">
              Awaiting Activity
            </span>
          </div>
        )}

        {/* State-Level KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            title="Procured Grain"
            value={stateStats.totalProcuredKg === 0 ? '0 kg' : `${(Math.round(stateStats.totalProcuredKg / 10) / 100).toFixed(2)} MT`}
            subtitle={
              stateStats.totalProcuredKg === 0
                ? 'Awaiting weighbridge entries'
                : `${stateStats.totalProcuredKg.toLocaleString('en-IN')} kg accepted`
            }
            icon={<Building2 className="w-5 h-5 text-[#166534]" />}
          />

          <KpiCard
            title="State DBT Disbursed"
            value={formatCurrency(stateStats.totalDisbursedAmount)}
            subtitle={
              stateStats.pendingDisbursementAmount > 0
                ? `${formatCurrency(stateStats.pendingDisbursementAmount)} pending`
                : 'Direct bank transfer'
            }
            icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
          />

          <KpiCard
            title="State Bookings"
            value={stateStats.totalBookingsToday.toString()}
            subtitle={
              stateStats.totalBookingsToday === 0
                ? 'No bookings yet'
                : `${stateStats.currentlyWaiting} waiting • ${stateStats.completedToday} completed`
            }
            icon={<Calendar className="w-5 h-5 text-blue-600" />}
          />

          <KpiCard
            title="Active Mandis"
            value={`${stateStats.activeCentres} / ${stateStats.totalCentres}`}
            subtitle={`Across ${stateStats.totalDistricts} Districts`}
            icon={<MapPin className="w-5 h-5 text-amber-600" />}
          />
        </div>

        {/* Secondary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-card border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 font-medium">Farmers Waiting:</span>
            <p className="text-sm font-bold text-amber-800 mt-0.5">
              {stateStats.currentlyWaiting} Farmers
            </p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">State Avg Wait Time:</span>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {stateStats.avgWaitTimeMin > 0 ? `${stateStats.avgWaitTimeMin} mins` : '--'}
            </p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Pending Payments:</span>
            <p className="text-sm font-bold text-amber-700 mt-0.5">
              {formatCurrency(stateStats.pendingDisbursementAmount)}
            </p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Completed Procurements:</span>
            <p className="text-sm font-bold text-emerald-800 mt-0.5">
              {stateStats.completedToday} Completed
            </p>
          </div>
        </div>

        {/* Empty State Banner per SIH Specification */}
        {stateStats.totalBookingsToday === 0 && (
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-card flex items-center gap-3 text-amber-900 text-xs animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-sm text-amber-950">No bookings recorded for this state.</p>
              <p className="text-amber-800 mt-0.5">
                Districts and mandis within {stateObj.name} are active. As farmers book procurement slots, telemetry will update dynamically.
              </p>
            </div>
          </div>
        )}

        {/* District Table */}
        {renderDistrictTable()}
      </div>
    );
  }

  const procuredTonnes = parseFloat((stateStats.totalProcuredKg / 1000).toFixed(2));

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Geographic Breadcrumbs */}
      <GeographicBreadcrumbs
        stateId={stateObj.id}
        stateName={stateObj.name}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse-subtle" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              State Directorate of Food & Civil Supplies
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827] mt-0.5">
            {stateObj.name} State Procurement Telemetry
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
            Real-time multi-district tracking • State Code: {stateObj.code}
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
            title="Logout from State Directorate"
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
          <span>{stateObj.name} State telemetry exported to CSV successfully!</span>
        </div>
      )}

      {rebalanceMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-input text-xs font-medium text-blue-900 flex items-center justify-between gap-2 animate-fade-in">
          <span>{rebalanceMessage}</span>
          <button
            onClick={() => setRebalanceMessage(null)}
            className="text-blue-600 hover:text-blue-800 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Interactive State Geospatial Map */}
      <div className="w-full animate-fade-in">
        <AgroIndiaMapComponent
          initialState={stateObj.name}
          onBackToIndia={() => navigate('/admin/national')}
          onSelectState={(selectedStateName) => {
            const nextState = geographyService.getStateByName(selectedStateName);
            if (nextState && nextState.id !== stateObj.id) {
              navigate(`/admin/state/${nextState.id}`);
            }
          }}
          onSelectDistrict={(districtData) => {
            console.log('District selected in state:', districtData);
          }}
        />
      </div>

      {/* Zero Procurement Activity State Notice */}
      {stateStats.totalBookingsToday === 0 && stateStats.totalProcuredKg === 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">
                No procurement activity recorded yet for this state.
              </h4>
              <p className="text-xs text-amber-800/80 mt-0.5">
                Procurement centres are operational across all {stateStats.totalDistricts} districts. New farmer bookings and weighbridge receipts will appear here in real time.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold bg-amber-100/90 text-amber-800 px-2.5 py-1 rounded-full shrink-0">
            Awaiting Activity
          </span>
        </div>
      )}

      {/* State-Level KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Procured Grain"
          value={stateStats.totalProcuredKg === 0 ? '0 kg' : `${(Math.round(stateStats.totalProcuredKg / 10) / 100).toFixed(2)} MT`}
          subtitle={
            stateStats.totalProcuredKg === 0
              ? 'Awaiting weighbridge entries'
              : `${stateStats.totalProcuredKg.toLocaleString('en-IN')} kg accepted`
          }
          icon={<Building2 className="w-5 h-5 text-[#166534]" />}
        />

        <KpiCard
          title="State DBT Disbursed"
          value={formatCurrency(stateStats.totalDisbursedAmount)}
          subtitle={
            stateStats.pendingDisbursementAmount > 0
              ? `${formatCurrency(stateStats.pendingDisbursementAmount)} pending`
              : 'Direct bank transfer'
          }
          icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
        />

        <KpiCard
          title="State Bookings"
          value={stateStats.totalBookingsToday.toString()}
          subtitle={
            stateStats.totalBookingsToday === 0
              ? 'No bookings yet'
              : `${stateStats.currentlyWaiting} waiting • ${stateStats.completedToday} completed`
          }
          icon={<Calendar className="w-5 h-5 text-blue-600" />}
        />

        <KpiCard
          title="Active Mandis"
          value={`${stateStats.activeCentres} / ${stateStats.totalCentres}`}
          subtitle={`Across ${stateStats.totalDistricts} Districts`}
          icon={<MapPin className="w-5 h-5 text-amber-600" />}
        />
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-card border border-slate-200 text-xs">
        <div>
          <span className="text-slate-500 font-medium">Farmers Waiting:</span>
          <p className="text-sm font-bold text-amber-800 mt-0.5">
            {stateStats.currentlyWaiting} Farmers
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">State Avg Wait Time:</span>
          <p className="text-sm font-bold text-slate-800 mt-0.5">
            {stateStats.avgWaitTimeMin > 0 ? `${stateStats.avgWaitTimeMin} mins` : '--'}
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Pending Payments:</span>
          <p className="text-sm font-bold text-amber-700 mt-0.5">
            {formatCurrency(stateStats.pendingDisbursementAmount)}
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Completed Procurements:</span>
          <p className="text-sm font-bold text-emerald-800 mt-0.5">
            {stateStats.completedToday} Completed
          </p>
        </div>
      </div>

      {/* Empty State Banner per SIH Specification */}
      {stateStats.totalBookingsToday === 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-card flex items-center gap-3 text-amber-900 text-xs animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-sm text-amber-950">No bookings recorded for this state.</p>
            <p className="text-amber-800 mt-0.5">
              Districts and mandis within {stateObj.name} are active. As farmers book procurement slots, telemetry will update dynamically.
            </p>
          </div>
        </div>
      )}

      {/* District-by-District Breakdown Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-700" />
                District Administrative Jurisdictions
              </CardTitle>
              <CardDescription>
                Detailed overview of procurement operations across {stateObj.name} districts
              </CardDescription>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {stateStats.districtSummaries.length} Districts Registered
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">District</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3 text-center">Centres</th>
                  <th className="py-2.5 px-3 text-center">Bookings</th>
                  <th className="py-2.5 px-3 text-center">Farmers Waiting</th>
                  <th className="py-2.5 px-3 text-center">Completed</th>
                  <th className="py-2.5 px-3 text-right">Procured (Kg)</th>
                  <th className="py-2.5 px-3 text-center">Avg Wait</th>
                  <th className="py-2.5 px-3 text-right">Pending Payments</th>
                  <th className="py-2.5 px-3 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stateStats.districtSummaries.map((d) => (
                  <tr
                    key={d.districtId}
                    className="hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/admin/district/${d.districtId}`)}
                  >
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 group-hover:text-emerald-800">
                        {d.districtName}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                        {d.districtCode}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-emerald-800">
                      {d.activeCentres} / {d.totalCentres}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900">
                      {d.totalBookingsToday}
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-amber-800">
                      {d.currentlyWaiting}
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-slate-700">
                      {d.completedToday}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {d.totalProcuredKg.toLocaleString('en-IN')} kg
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          d.avgWaitTimeMin > 25
                            ? 'bg-red-100 text-red-800'
                            : d.avgWaitTimeMin > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {d.avgWaitTimeMin > 0 ? `${d.avgWaitTimeMin}m` : '--'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-amber-700">
                      {formatCurrency(d.pendingDisbursementAmount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowRight className="w-3.5 h-3.5" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/district/${d.districtId}`);
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
