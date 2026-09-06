import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { UserRole, LanguageCode } from '@/types';
import { dataStore } from '@/services/dataStore';
import { useTranslation } from '@/i18n/LanguageContext';
import { preloadModule } from '@/lib/lazyWithRetry';
import {
  Wheat,
  Globe,
  User,
  Shield,
  Briefcase,
  LogOut,
  ChevronDown,
} from 'lucide-react';

export interface TopNavigationProps {
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  activeNotificationCount?: number;
  centreName?: string;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  currentLanguage,
  onLanguageChange,
  activeNotificationCount = 1,
  centreName,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentOfficer = dataStore.getCurrentOfficer();
  const officerCentre = dataStore.getCentreById(currentOfficer?.centreId || '');
  const activeCentreDisplay = centreName || (officerCentre ? `${officerCentre.name} (${officerCentre.code || officerCentre.id.toUpperCase()})` : 'Procurement Centre');

  const currentAdmin = dataStore.getCurrentAdmin();
  const adminScopeDisplay = currentAdmin?.scopeType === 'NATIONAL'
    ? 'National Command Oversight'
    : `${currentAdmin?.name || 'Admin'} Monitoring`;

  const getCurrentRole = (): UserRole => {
    if (location.pathname.startsWith('/officer')) return 'officer';
    if (location.pathname.startsWith('/admin')) return 'admin';
    return 'farmer';
  };

  const currentRole = getCurrentRole();
  const currentFarmer = dataStore.getCurrentFarmer();

  const handleRoleSwitch = (role: UserRole) => {
    if (role === 'farmer') {
      navigate('/farmer/dashboard');
    } else if (role === 'officer') {
      const activeFarmer = dataStore.getCurrentFarmer();
      const farmerBookings = activeFarmer
        ? dataStore.getBookingsByFarmer(activeFarmer.id)
        : dataStore.getBookings();
      if (farmerBookings.length > 0) {
        const latestBooking = farmerBookings[farmerBookings.length - 1];
        dataStore.setOfficerCentre(latestBooking.centreId);
      }
      navigate('/officer/dashboard');
    } else if (role === 'admin') {
      navigate('/admin/dashboard');
    }
  };

  const preloadPersona = (role: UserRole) => {
    if (role === 'farmer') {
      preloadModule(() => import('@/components/farmer/FarmerDashboard'));
    } else if (role === 'officer') {
      preloadModule(() => import('@/components/officer/OfficerDashboard'));
    } else if (role === 'admin') {
      preloadModule(() => import('@/components/admin/AdminLayout'));
      preloadModule(() => import('@/components/admin/AdminDashboard'));
    }
  };

  useEffect(() => {
    // Warm up other personas in background idle time
    const timer = setTimeout(() => {
      preloadPersona('officer');
      preloadPersona('admin');
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    setAccountMenuOpen(false);
    if (currentRole === 'farmer') {
      dataStore.logoutFarmer();
    } else if (currentRole === 'officer') {
      dataStore.logoutOfficer();
    } else if (currentRole === 'admin') {
      dataStore.logoutAdmin();
    }
    navigate('/login', { replace: true });
  };

  const isCurrentRoleAuthenticated =
    currentRole === 'farmer'
      ? dataStore.isFarmerAuthenticated()
      : currentRole === 'officer'
      ? dataStore.isOfficerAuthenticated()
      : dataStore.isAdminAuthenticated();

  const activeUserName =
    currentRole === 'farmer'
      ? currentFarmer?.name || 'Farmer'
      : currentRole === 'officer'
      ? currentOfficer?.name || 'Officer'
      : currentAdmin?.name || 'Admin';

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-subtle">
      {/* Topmost Government Official Band */}
      <div className="bg-[#166534] text-white px-4 py-1.5 text-[11px] sm:text-xs font-medium flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
          <span className="tracking-wide">
            Ministry of Consumer Affairs, Food & Public Distribution | Department of Consumer Affairs (DoCA)
          </span>
        </div>

        <div className="hidden md:flex items-center gap-3 text-emerald-100">
          <span>SIH 2026 Problem ID: 26032</span>
          <span>•</span>
          <span className="font-semibold text-white">Smart Automation Platform</span>
        </div>
      </div>

      {/* Main Navigation Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <Link to={`/${currentRole}/dashboard`} className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-button bg-[#166534] text-white flex items-center justify-center shadow-subtle shrink-0 group-hover:bg-[#155227] transition-colors">
            <Wheat className="w-6 h-6 text-amber-300" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold text-[#166534] tracking-tight">
                AgriQueue
              </span>
              <span className="bg-[#DCFCE7] text-[#166534] text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                Govt Portal
              </span>
            </div>
            <span className="text-[11px] text-[#6B7280] font-medium hidden sm:block">
              Smart Procurement Scheduling & Virtual Queue
            </span>
          </div>
        </Link>

        {/* Center: Desktop Navigation Links for Farmer */}
        {currentRole === 'farmer' && (
          <nav className="hidden md:flex items-center gap-1">
            <NavLink
              to="/farmer/dashboard"
              className={({ isActive }) =>
                cn(
                  'px-3 py-1.5 rounded-button text-xs font-bold transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-[#166534] border border-emerald-200 shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-100'
                )
              }
            >
              {t('dashboard', 'Dashboard')}
            </NavLink>
            <NavLink
              to="/farmer/book-slot"
              className={({ isActive }) =>
                cn(
                  'px-3 py-1.5 rounded-button text-xs font-bold transition-colors',
                  isActive || location.pathname.startsWith('/farmer/book-slot')
                    ? 'bg-emerald-50 text-[#166534] border border-emerald-200 shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-100'
                )
              }
            >
              {t('bookSlot', 'Book Slot')}
            </NavLink>
            <NavLink
              to="/farmer/queue"
              className={({ isActive }) =>
                cn(
                  'px-3 py-1.5 rounded-button text-xs font-bold transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-[#166534] border border-emerald-200 shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-100'
                )
              }
            >
              {t('liveQueue', 'Live Queue')}
            </NavLink>
            <NavLink
              to="/farmer/bookings"
              className={({ isActive }) =>
                cn(
                  'px-3 py-1.5 rounded-button text-xs font-bold transition-colors',
                  isActive ||
                    location.pathname.startsWith('/farmer/procurement') ||
                    location.pathname.startsWith('/farmer/payment')
                    ? 'bg-emerald-50 text-[#166534] border border-emerald-200 shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-100'
                )
              }
            >
              {t('myBookings', 'My Bookings')}
            </NavLink>
          </nav>
        )}

        {/* Center: Live Centre Status (Officer Context) */}
        {currentRole === 'officer' && (
          <Link
            to="/officer/dashboard"
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-button text-xs transition-colors"
            title="Click to view Depot Overview"
          >
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse-subtle" />
            <span className="text-[#6B7280]">Active Centre:</span>
            <span className="font-bold text-[#111827]">{activeCentreDisplay}</span>
          </Link>
        )}

        {/* Center: State Telemetry Badge (Admin Context) */}
        {currentRole === 'admin' && (
          <Link
            to="/admin/dashboard"
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-button text-xs transition-colors"
            title="Administrative Telemetry Command"
          >
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse-subtle" />
            <span className="text-purple-700 font-medium">Command:</span>
            <span className="font-bold text-purple-900">{adminScopeDisplay}</span>
          </Link>
        )}

        {/* Right Action Bar: Demo Role Switcher + Language Selector + Profile/Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Role Switcher for Hackathon Judges Demo */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-button border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5 hidden lg:inline tracking-wider">
              Demo Role:
            </span>
            <button
              onClick={() => handleRoleSwitch('farmer')}
              onMouseEnter={() => preloadPersona('farmer')}
              onFocus={() => preloadPersona('farmer')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-button text-xs font-bold transition-all',
                currentRole === 'farmer'
                  ? 'bg-white text-[#166534] shadow-subtle'
                  : 'text-[#6B7280] hover:text-[#111827]'
              )}
              title="Farmer Portal View"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Farmer</span>
            </button>

            <button
              onClick={() => handleRoleSwitch('officer')}
              onMouseEnter={() => preloadPersona('officer')}
              onFocus={() => preloadPersona('officer')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-button text-xs font-bold transition-all',
                currentRole === 'officer'
                  ? 'bg-white text-[#166534] shadow-subtle'
                  : 'text-[#6B7280] hover:text-[#111827]'
              )}
              title="Procurement Officer Dashboard"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Officer</span>
            </button>

            <button
              onClick={() => handleRoleSwitch('admin')}
              onMouseEnter={() => preloadPersona('admin')}
              onFocus={() => preloadPersona('admin')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-button text-xs font-bold transition-all',
                currentRole === 'admin'
                  ? 'bg-white text-[#166534] shadow-subtle'
                  : 'text-[#6B7280] hover:text-[#111827]'
              )}
              title="State Admin Dashboard"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          </div>

          {/* Language Selector */}
          <div className="relative flex items-center">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-button text-xs font-semibold text-[#111827]">
              <Globe className="w-3.5 h-3.5 text-[#166534]" />
              <select
                value={currentLanguage}
                onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
                className="bg-transparent border-none text-xs font-bold text-[#111827] focus:outline-none cursor-pointer"
                aria-label="Select Language"
              >
                <option value="en">EN</option>
                <option value="hi">हिंदी</option>
                <option value="kn">ಕನ್ನಡ</option>
              </select>
            </div>
          </div>

          {/* Profile & Logout Menu */}
          {isCurrentRoleAuthenticated && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-button text-xs font-bold text-slate-800 transition-colors"
                aria-label="User Account Menu"
              >
                <div className="w-5 h-5 rounded-full bg-[#166534] text-white flex items-center justify-center text-[10px] font-bold">
                  {activeUserName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:inline max-w-[100px] truncate">{activeUserName}</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-card shadow-elevated p-2 text-xs z-50 animate-fade-in">
                  <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                    <p className="font-bold text-slate-900 truncate">{activeUserName}</p>
                    <p className="text-[11px] text-slate-500 capitalize">{currentRole} Account</p>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-2 py-2 text-red-600 hover:bg-red-50 rounded font-semibold transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t('logout', 'Logout')}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
