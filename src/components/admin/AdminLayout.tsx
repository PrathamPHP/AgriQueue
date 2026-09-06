import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { geographyService } from '@/services/geographyService';
import { analyticsService } from '@/services/analyticsService';
import { dataStore } from '@/services/dataStore';
import { AdminUser } from '@/types';
import { GeographicBreadcrumbs } from '@/components/common/GeographicBreadcrumbs';
import { Button } from '@/components/common/Button';
import { AgroIndiaMapComponent } from '@/components/map/AgroIndiaMapComponent';
import { AdminMapProvider } from './AdminMapContext';
import {
  Globe,
  Building2,
  RefreshCw,
  Download,
  CheckCircle2,
  Landmark,
  LogOut,
  MapPin,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'map' | 'table'>('map');
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser>(dataStore.getCurrentAdmin());
  const [adminList, setAdminList] = useState<AdminUser[]>(dataStore.getAdminUsers());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  // Route inspection
  const isNationalRoute =
    location.pathname === '/admin/national' ||
    location.pathname === '/admin' ||
    location.pathname === '/admin/dashboard';
  const isStateRoute = location.pathname.startsWith('/admin/state/');
  const isDistrictRoute = location.pathname.startsWith('/admin/district/');
  const isCentreRoute = location.pathname.startsWith('/admin/centre/');
  const isMapRoute = isNationalRoute || isStateRoute;

  // Extract state if on state route
  const stateIdMatch = location.pathname.match(/\/admin\/state\/([^/]+)/);
  const stateId = isStateRoute && stateIdMatch ? stateIdMatch[1] : null;
  const stateObj = stateId ? dataStore.getStateById(stateId) : null;
  const selectedStateName = stateObj ? stateObj.name : null;

  useEffect(() => {
    const admin = dataStore.getCurrentAdmin();
    setCurrentAdmin(admin);
    setAdminList(dataStore.getAdminUsers());

    const unsubscribe = dataStore.subscribe(() => {
      setCurrentAdmin(dataStore.getCurrentAdmin());
      setAdminList(dataStore.getAdminUsers());
    });
    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    dataStore.notify();
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

  const handleExportCsv = async () => {
    if (isStateRoute && stateObj) {
      const stateStats = await analyticsService.getStateStats(stateObj.id);
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
    } else {
      const stats = await analyticsService.getNationalStats();
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
    }
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 4000);
  };

  // If on district or centre level, the map is hidden and child dashboard renders directly
  if (isDistrictRoute || isCentreRoute) {
    return (
      <AdminMapProvider
        value={{
          isSharedMapActive: false,
          viewMode: 'map',
          setViewMode: () => {},
          selectedStateName: null,
          isRefreshing,
          triggerRefresh: handleRefresh,
        }}
      >
        <div style={{ display: 'none' }}>
          <AgroIndiaMapComponent
            selectedState={null}
            onSelectState={() => {}}
            onBackToIndia={() => {}}
          />
        </div>
        <Outlet />
      </AdminMapProvider>
    );
  }

  return (
    <AdminMapProvider
      value={{
        isSharedMapActive: true,
        viewMode,
        setViewMode,
        selectedStateName,
        isRefreshing,
        triggerRefresh: handleRefresh,
      }}
    >
      <div className="space-y-5 animate-fade-in pb-12">
        {/* Unified Geographic Breadcrumbs */}
        <GeographicBreadcrumbs
          showBack={isStateRoute}
          stateId={stateObj?.id}
          stateName={stateObj?.name}
        />

        {/* Unified Administrative Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse-subtle" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                {isStateRoute
                  ? 'State Directorate of Food & Civil Supplies'
                  : 'Department of Food & Public Distribution • National Command'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827] mt-0.5">
              {isStateRoute
                ? `${stateObj?.name || 'State'} State Procurement Telemetry`
                : 'Nationwide Agricultural Procurement Command'}
            </h1>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
              {isStateRoute
                ? `Real-time multi-district tracking • State Code: ${stateObj?.code || '--'}`
                : 'Single multi-tier oversight across States, Districts, and Mandis • SIH 2026'}
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
              {isStateRoute ? 'Refresh Data' : 'Refresh'}
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
              title="Logout from Administrative Command"
            >
              Logout
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleExportCsv}
            >
              {isStateRoute ? 'Export Register (CSV)' : 'Export CSV'}
            </Button>
          </div>
        </div>

        {exportSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-input text-xs font-bold text-[#166534] flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              {isStateRoute
                ? `${stateObj?.name} State telemetry exported to CSV successfully!`
                : 'National telemetry successfully exported to CSV file!'}
            </span>
          </div>
        )}

        {/* View Switcher: Shown on National overview */}
        {isNationalRoute && (
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-bold transition-all cursor-pointer ${
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-[#166534] shadow-subtle'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                State Table (36)
              </button>
            </div>
          </div>
        )}

        {/* Persistent India Map Component */}
        <div
          className="w-full transition-opacity duration-300"
          style={{
            display: isMapRoute && (isStateRoute || viewMode === 'map') ? 'block' : 'none',
          }}
        >
          <AgroIndiaMapComponent
            selectedState={selectedStateName}
            onSelectState={(stateName) => {
              const matched = geographyService.getStateByName(stateName);
              if (matched) {
                navigate(`/admin/state/${matched.id}`);
              }
            }}
            onBackToIndia={() => {
              navigate('/admin/national');
            }}
            onSelectDistrict={(districtData) => {
              console.log('District selected:', districtData);
            }}
          />
        </div>

        {/* Sub-map Telemetry & Detail View */}
        <div className="transition-opacity duration-300">
          <Outlet />
        </div>
      </div>
    </AdminMapProvider>
  );
};

export default AdminLayout;
