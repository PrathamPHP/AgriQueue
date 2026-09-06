import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Booking, LanguageCode } from '@/types';
import { bookingService } from '@/services/bookingService';
import { dataStore } from '@/services/dataStore';
import { useTranslation } from '@/i18n/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import {
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  CalendarPlus,
  Scale,
  CreditCard,
  QrCode,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface FarmerBookingsListProps {
  currentLanguage: LanguageCode;
}

export const FarmerBookingsList: React.FC<FarmerBookingsListProps> = ({ currentLanguage }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 5;
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const loadBookings = async (targetPage: number = page, targetFilter: 'ALL' | 'ACTIVE' | 'COMPLETED' = filter) => {
    setIsLoading(true);
    try {
      const farmer = dataStore.getCurrentFarmer();
      if (!farmer) {
        setBookings([]);
        setPagination({
          page: 1,
          pageSize: PAGE_SIZE,
          totalItems: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        });
        return;
      }
      const res = await bookingService.getPaginatedFarmerBookings(farmer.id, {
        page: targetPage,
        pageSize: PAGE_SIZE,
        status: targetFilter,
      });
      setBookings(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookings(page, filter);
  }, [page, filter]);

  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      loadBookings(page, filter);
    });
    return () => unsubscribe();
  }, [page, filter]);

  const handleFilterChange = (newFilter: 'ALL' | 'ACTIVE' | 'COMPLETED') => {
    setFilter(newFilter);
    setPage(1);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/farmer/dashboard')}
              className="text-xs font-bold text-[#166534] hover:underline"
            >
              ← {t('dashboard', 'Dashboard')}
            </button>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">{t('myBookings', 'Procurement Bookings')}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827] mt-1">
            {t('myBookings', 'My Procurement Bookings')}
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            Track all scheduled and historical procurement tokens issued in your name.
          </p>
        </div>

        <Button
          variant="primary"
          icon={<CalendarPlus className="w-4 h-4" />}
          onClick={() => navigate('/farmer/book-slot')}
        >
          {t('bookSlot', 'Book New Slot')}
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <button
          onClick={() => handleFilterChange('ALL')}
          className={`text-xs sm:text-sm font-bold px-3 py-1.5 rounded-button transition-colors ${
            filter === 'ALL'
              ? 'bg-[#166534] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All {filter === 'ALL' && pagination.totalItems > 0 ? `(${pagination.totalItems})` : ''}
        </button>
        <button
          onClick={() => handleFilterChange('ACTIVE')}
          className={`text-xs sm:text-sm font-bold px-3 py-1.5 rounded-button transition-colors ${
            filter === 'ACTIVE'
              ? 'bg-[#166534] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Active / Scheduled {filter === 'ACTIVE' && pagination.totalItems > 0 ? `(${pagination.totalItems})` : ''}
        </button>
        <button
          onClick={() => handleFilterChange('COMPLETED')}
          className={`text-xs sm:text-sm font-bold px-3 py-1.5 rounded-button transition-colors ${
            filter === 'COMPLETED'
              ? 'bg-[#166534] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Completed {filter === 'COMPLETED' && pagination.totalItems > 0 ? `(${pagination.totalItems})` : ''}
        </button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="min-h-[250px] flex flex-col items-center justify-center p-6 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-[#166534] mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading your bookings...</p>
        </div>
      ) : bookings.length === 0 ? (
        /* Empty state */
        <Card className="p-8 text-center bg-white border border-dashed border-slate-300">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#166534] flex items-center justify-center mx-auto mb-3">
            <CalendarPlus className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {filter === 'COMPLETED' ? 'No completed procurements yet.' : 'No bookings yet.'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Schedule a procurement slot at your nearest accredited mandi to receive guaranteed MSP.
          </p>
          <div className="mt-4">
            <Button
              variant="primary"
              onClick={() => navigate('/farmer/book-slot')}
              icon={<CalendarPlus className="w-4 h-4" />}
            >
              Book a Slot Now
            </Button>
          </div>
        </Card>
      ) : (
        /* Bookings List */
        /* Bookings List */
        <div className="space-y-3">
          {bookings.map((booking) => {
            const isCompleted = booking.currentStage === 'COMPLETED';

            return (
              <Card key={booking.id} className="p-4 bg-white border border-slate-200 hover:shadow-card transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-card bg-[#DCFCE7] text-[#166534] flex flex-col items-center justify-center font-bold shrink-0 border border-emerald-200">
                      <span className="text-[10px] uppercase font-semibold text-emerald-800">Token</span>
                      <span className="text-base leading-none font-extrabold">#{booking.tokenNumber}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm sm:text-base">
                          {booking.cropName} ({booking.cropNameHindi || 'गेहूं'}) • {booking.quantityKg} kg
                        </span>
                        <StatusBadge status={booking.currentStage as any} size="sm" />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {booking.centreName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {booking.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {booking.timeWindow}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                    {!isCompleted ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Clock className="w-3.5 h-3.5" />}
                          onClick={() => navigate('/farmer/queue')}
                        >
                          Live Queue
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<QrCode className="w-3.5 h-3.5" />}
                          onClick={() => navigate(`/farmer/procurement/${booking.id}`)}
                        >
                          Gate Pass
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Scale className="w-3.5 h-3.5" />}
                          onClick={() => navigate(`/farmer/procurement/${booking.id}`)}
                        >
                          View Receipt
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<CreditCard className="w-3.5 h-3.5" />}
                          onClick={() => navigate(`/farmer/payment/pay-${booking.id}`)}
                        >
                          Payment
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
              <div>
                Showing{' '}
                <span className="font-bold text-slate-900">
                  {pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-bold text-slate-900">
                  {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)}
                </span>{' '}
                of <span className="font-bold text-slate-900">{pagination.totalItems}</span> bookings
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="px-2 font-semibold text-slate-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FarmerBookingsList;
