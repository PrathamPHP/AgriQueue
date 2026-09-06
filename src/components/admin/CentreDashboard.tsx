import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { analyticsService } from '@/services/analyticsService';
import { dataStore } from '@/services/dataStore';
import {
  ProcurementCentre,
  District,
  State,
  CentreStats,
  Booking,
  QueueEntry,
  AdminUser,
} from '@/types';
import { GeographicBreadcrumbs } from '@/components/common/GeographicBreadcrumbs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { KpiCard } from '@/components/cards/KpiCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import { formatCurrency } from '@/lib/utils';
import {
  Building2,
  Calendar,
  Clock,
  RefreshCw,
  ExternalLink,
  MapPin,
  Ticket,
  Scale,
  Users,
  AlertCircle,
  Sliders,
  Landmark,
  ShieldCheck,
  ChevronRight,
  LogOut,
  AlertTriangle,
} from 'lucide-react';

export const CentreDashboard: React.FC = () => {
  const { centreId } = useParams<{ centreId: string }>();
  const navigate = useNavigate();

  const [centre, setCentre] = useState<ProcurementCentre | undefined>(undefined);
  const [district, setDistrict] = useState<District | undefined>(undefined);
  const [stateObj, setStateObj] = useState<State | undefined>(undefined);
  const [stats, setStats] = useState<CentreStats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser>(dataStore.getCurrentAdmin());
  const [adminList, setAdminList] = useState<AdminUser[]>(dataStore.getAdminUsers());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadData = async () => {
    if (!centreId) return;
    try {
      const admin = dataStore.getCurrentAdmin();
      setCurrentAdmin(admin);
      setAdminList(dataStore.getAdminUsers());

      const c = dataStore.getCentreById(centreId);
      setCentre(c);

      let d: District | undefined;
      if (c && c.districtId) {
        d = dataStore.getDistrictById(c.districtId);
        setDistrict(d);
        if (d) {
          const s = dataStore.getStateById(d.stateId);
          setStateObj(s);
        }
      }

      // Access scope enforcement:
      const scopeVal = admin.scopeId || admin.scopeValue;
      if (admin.scopeType === 'DISTRICT' && scopeVal && c && c.districtId !== scopeVal) {
        navigate(`/admin/district/${scopeVal}`, { replace: true });
        return;
      }
      if (admin.scopeType === 'STATE' && scopeVal && d && d.stateId !== scopeVal) {
        navigate(`/admin/state/${scopeVal}`, { replace: true });
        return;
      }

      const st = await analyticsService.getCentreStats(centreId);
      setStats(st);

      const allBookings = dataStore.getBookings().filter((b) => b.centreId === centreId);
      setBookings(allBookings);

      const allQueues = Object.values(dataStore.getQueueEntries()).filter(
        (q) => q.centreId === centreId
      );
      setQueueEntries(allQueues);
    } catch (err) {
      console.error('Failed to load centre dashboard data:', err);
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
  }, [centreId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleOpenOfficerTerminal = () => {
    if (!centre) return;
    // Find officer assigned to this centre or set current officer
    const officers = dataStore.getOfficers();
    const assignedOfficer = officers.find((o) => o.centreId === centre.id);
    if (assignedOfficer) {
      dataStore.setCurrentOfficerId(assignedOfficer.id);
    }
    navigate('/officer/dashboard');
  };

  if (isLoading || !centre || !stats) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-7 h-7 animate-spin text-[#166534] mb-3" />
        <h3 className="text-base font-bold text-slate-900">Loading Mandi Telemetry...</h3>
        <p className="text-xs text-slate-500 mt-1">Connecting to depot gate and weighbridge terminal.</p>
      </div>
    );
  }

  const capacityUtil = Math.min(100, Math.round((bookings.length / (centre.capacity || 20)) * 100));

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Geographic Breadcrumbs */}
      <GeographicBreadcrumbs
        stateId={stateObj?.id}
        stateName={stateObj?.name}
        districtId={district?.id}
        districtName={district?.name}
        centreId={centre.id}
        centreName={centre.name}
      />

      {/* Mandi Detail Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse-subtle" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              Procurement Depot & Mandi Command
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827] mt-0.5">
            {centre.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600">
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-800">
              {centre.code || centre.id.toUpperCase()}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {centre.address}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {centre.openingTime || '09:00'} - {centre.closingTime || '17:00'}
            </span>
          </div>
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
            title="Logout from Centre Management"
          >
            Logout
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            onClick={handleOpenOfficerTerminal}
          >
            Open Officer Terminal
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Current Serving Token"
          value={stats.currentToken > 0 ? `#${stats.currentToken}` : '--'}
          subtitle={
            stats.currentlyWaitingCount > 0
              ? `${stats.currentlyWaitingCount} farmers in virtual queue`
              : 'Gate idle'
          }
          icon={<Ticket className="w-5 h-5 text-[#166534]" />}
        />

        <KpiCard
          title="Procured Grain"
          value={`${stats.totalQuantityProcuredKg.toLocaleString('en-IN')} kg`}
          subtitle={
            stats.completedTodayCount > 0
              ? `${stats.completedTodayCount} weighbridge entries completed`
              : 'Awaiting weighment records'
          }
          icon={<Scale className="w-5 h-5 text-emerald-600" />}
        />

        <KpiCard
          title="Today's Bookings"
          value={stats.todayBookingsCount.toString()}
          subtitle={`Capacity: ${centre.capacity} slots/day (${capacityUtil}% booked)`}
          icon={<Calendar className="w-5 h-5 text-blue-600" />}
        />

        <KpiCard
          title="Average Wait Time"
          value={stats.avgWaitTimeMin > 0 ? `${stats.avgWaitTimeMin} min` : '--'}
          subtitle={
            stats.currentDelayMinutes > 0
              ? `Live delay: +${stats.currentDelayMinutes} min`
              : 'Optimal queue movement'
          }
          icon={<Clock className="w-5 h-5 text-amber-600" />}
        />
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-card border border-slate-200 text-xs">
        <div>
          <span className="text-slate-500 font-medium">Currently Waiting:</span>
          <p className="text-sm font-bold text-amber-800 mt-0.5">
            {stats.currentlyWaitingCount} Farmers
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Pending Payments:</span>
          <p className="text-sm font-bold text-amber-700 mt-0.5">
            {formatCurrency(stats.pendingDisbursementAmount || 0)}
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">DBT Disbursed:</span>
          <p className="text-sm font-bold text-emerald-700 mt-0.5">
            {formatCurrency(stats.totalDisbursedAmount || 0)}
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-medium">Completed Procurements:</span>
          <p className="text-sm font-bold text-slate-800 mt-0.5">
            {stats.completedTodayCount} Settled
          </p>
        </div>
      </div>

      {/* Live Operational Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mandi Operational Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-700" />
              Depot Infrastructure & Capacity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">Operational Status:</span>
              <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">
                {centre.operationalStatus || 'OPERATIONAL'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">Daily Capacity Quota:</span>
              <span className="font-bold text-slate-800">{centre.capacity} slots/day</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">Capacity Utilization:</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      capacityUtil > 80 ? 'bg-red-500' : capacityUtil > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${capacityUtil}%` }}
                  />
                </div>
                <span className="font-bold text-slate-800">{capacityUtil}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Contact Person / Helpline:</span>
              <span className="font-semibold text-slate-800">{centre.contactPhone || '1800-180-1551'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Live Queue Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" />
              Live Weighbridge & Gate Telemetry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">Farmers Arrived at Gate:</span>
              <span className="font-bold text-slate-800">{stats.currentlyWaitingCount}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">Procurements Settled:</span>
              <span className="font-bold text-emerald-700">{stats.completedTodayCount}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">No-Show / Unreported:</span>
              <span className="font-bold text-slate-600">{stats.noShowCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Queue Synchronization:</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Real-time active
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings for this Mandi */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              Depot Booking Ledger ({bookings.length} Records)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              icon={<ExternalLink className="w-3.5 h-3.5" />}
              onClick={handleOpenOfficerTerminal}
            >
              Open in Officer Operations
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-800">No activity recorded for this centre.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Farmers booking slots at this mandi will populate this ledger.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Token #</th>
                    <th className="py-2.5 px-3">Farmer Name</th>
                    <th className="py-2.5 px-3">Crop</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Slot Time</th>
                    <th className="py-2.5 px-3 text-center">Stage</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-bold font-mono text-emerald-900">
                        {b.tokenNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{b.farmerName}</td>
                      <td className="py-2.5 px-3">{b.cropName}</td>
                      <td className="py-2.5 px-3 font-medium">{b.quantityKg} kg</td>
                      <td className="py-2.5 px-3 text-slate-600">{b.timeWindow}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-semibold text-slate-700">{b.currentStage}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <StatusBadge status={b.currentStage} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
