import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { dataStore } from '@/services/dataStore';
import { bookingService } from '@/services/bookingService';
import { useTranslation } from '@/i18n/LanguageContext';
import { Home, CalendarPlus, Users, Activity } from 'lucide-react';

export interface MobileBottomNavigationProps {
  className?: string;
}

export const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  className,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTokenNumber, setActiveTokenNumber] = useState<number | null>(null);

  const checkActiveBooking = async () => {
    const farmer = dataStore.getCurrentFarmer();
    if (!farmer) {
      setActiveTokenNumber(null);
      return;
    }
    const active = await bookingService.getActiveBooking(farmer.id);
    if (active && active.currentStage !== 'COMPLETED' && active.status === 'confirmed') {
      setActiveTokenNumber(active.tokenNumber);
    } else {
      setActiveTokenNumber(null);
    }
  };

  useEffect(() => {
    checkActiveBooking();
    const unsubscribe = dataStore.subscribe(() => {
      checkActiveBooking();
    });
    return () => unsubscribe();
  }, []);

  const navItems = [
    {
      path: '/farmer/dashboard',
      label: t('dashboard', 'Home'),
      icon: <Home className="w-5 h-5" />,
      isActive: location.pathname === '/farmer/dashboard',
    },
    {
      path: '/farmer/book-slot',
      label: t('bookSlot', 'Book Slot'),
      icon: <CalendarPlus className="w-5 h-5" />,
      isActive: location.pathname.startsWith('/farmer/book-slot'),
    },
    {
      path: '/farmer/queue',
      label: t('liveQueue', 'Live Queue'),
      icon: <Users className="w-5 h-5" />,
      badge: activeTokenNumber ? `#${activeTokenNumber}` : undefined,
      isActive: location.pathname === '/farmer/queue',
    },
    {
      path: '/farmer/bookings',
      label: t('paymentStatus', 'Status & Pay'),
      icon: <Activity className="w-5 h-5" />,
      isActive:
        location.pathname === '/farmer/bookings' ||
        location.pathname.startsWith('/farmer/procurement') ||
        location.pathname.startsWith('/farmer/payment'),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-elevated safe-bottom sm:hidden',
        className
      )}
    >
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 transition-colors tap-target select-none',
                item.isActive ? 'text-[#166534]' : 'text-[#6B7280] hover:text-[#111827]'
              )}
            >
              {item.isActive && (
                <span className="absolute top-0 w-8 h-1 bg-[#166534] rounded-b-full transition-all duration-200" />
              )}

              <div className="relative">
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1.5 -right-3.5 bg-[#F59E0B] text-slate-900 text-[9px] font-extrabold px-1 rounded-full border border-white">
                    {item.badge}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  'text-[10px] font-semibold tracking-tight',
                  item.isActive ? 'font-bold text-[#166534]' : 'text-[#6B7280]'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
