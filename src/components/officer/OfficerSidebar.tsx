import React from 'react';
import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import { Officer, ProcurementCentre, CentreStats } from '@/types';
import { dataStore } from '@/services/dataStore';
import {
  Layers,
  Clock,
  Calendar,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';

interface OfficerSidebarProps {
  officer: Officer;
  centre: ProcurementCentre;
  stats: CentreStats;
  onRefreshData: () => void;
}

export const OfficerSidebar: React.FC<OfficerSidebarProps> = ({
  officer,
  centre,
  stats,
  onRefreshData,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      path: '/officer/dashboard',
      label: 'Dashboard Overview',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      path: '/officer/queue',
      label: "Today's Live Queue",
      icon: <Clock className="w-4 h-4" />,
      badge: stats?.currentlyWaitingCount,
    },
    {
      path: '/officer/bookings',
      label: 'All Centre Bookings',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      path: '/officer/procurements',
      label: 'Completed Procurements',
      icon: <FileText className="w-4 h-4" />,
      badge: stats && stats.completedTodayCount > 0 ? stats.completedTodayCount : undefined,
    },
    {
      path: '/officer/payments',
      label: 'DBT / PFMS Orders',
      icon: <CreditCard className="w-4 h-4" />,
    },
    {
      path: '/officer/analytics',
      label: 'Mandi Throughput',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      path: '/officer/settings',
      label: 'Depot Capacity Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between shrink-0 hidden md:flex">
      <div className="space-y-6">
        {/* Centre Badge & Depot Switcher */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-input">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Operational Mandi Depot
          </span>
          <select
            value={centre.id}
            onChange={(e) => {
              dataStore.setOfficerCentre(e.target.value);
              onRefreshData();
            }}
            className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#166534] focus:ring-1 focus:ring-[#166534]"
            title="Switch assigned depot / centre"
          >
            {dataStore.getCentres().map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.district})
              </option>
            ))}
          </select>
          <div className="mt-2.5 pt-2.5 border-t border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Active Officer Persona
            </span>
            <select
              value={officer.id}
              onChange={(e) => {
                dataStore.setCurrentOfficerId(e.target.value);
                const chosenOff = dataStore.getOfficers().find((o) => o.id === e.target.value);
                if (chosenOff) {
                  dataStore.setOfficerCentre(chosenOff.centreId);
                }
                onRefreshData();
              }}
              className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#166534] focus:ring-1 focus:ring-[#166534]"
              title="Switch active officer persona"
            >
              {dataStore.getOfficers().map((o) => {
                const c = dataStore.getCentreById(o.centreId);
                return (
                  <option key={o.id} value={o.id}>
                    {o.name} — {c?.code || c?.name || ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#166534] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-ping" />
            <span>Gate 2 / Weighbridge Active</span>
          </div>
        </div>

        {/* Navigation Links using Router NavLink */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path === '/officer/dashboard' &&
                (location.pathname === '/officer' || location.pathname === '/officer/'));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-button text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#166534] text-white shadow-subtle'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-white text-[#166534]'
                        : 'bg-emerald-100 text-[#166534]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Officer Profile Pill */}
      <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-input flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#166534] text-white font-bold flex items-center justify-center text-xs shrink-0">
            {officer.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 text-xs flex-1">
            <div className="font-bold text-slate-900 truncate">{officer.name}</div>
            <div className="text-[11px] text-emerald-800 truncate">{officer.deskNumber}</div>
          </div>
        </div>
        <button
          onClick={() => {
            dataStore.logoutOfficer();
            navigate('/login', { replace: true });
          }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded text-[11px] font-bold transition-colors cursor-pointer"
          title="Logout from Officer Terminal"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
export default OfficerSidebar;
