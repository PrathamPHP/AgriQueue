import React, { useState, useEffect } from 'react';
import { Booking } from '@/types';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardContent } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { bookingService } from '@/services/bookingService';
import {
  UserCheck,
  Calendar,
  Search,
} from 'lucide-react';

interface OfficerBookingsTabProps {
  bookings: Booking[];
  centreId?: string;
  onOpenCheckIn: () => void;
  onOpenDetail: (booking: Booking) => void;
}

export const OfficerBookingsTab: React.FC<OfficerBookingsTabProps> = ({
  bookings,
  centreId,
  onOpenCheckIn,
  onOpenDetail,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [rosterPage, setRosterPage] = useState<number>(1);
  const PAGE_SIZE = 15;

  const [paginatedData, setPaginatedData] = useState<Booking[] | null>(null);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setRosterPage(1);
  }, [searchQuery, statusFilter]);

  // Server-side paginated retrieval with backend search and filtering
  useEffect(() => {
    if (!centreId) {
      setPaginatedData(null);
      return;
    }
    let isMounted = true;
    setIsLoading(true);

    bookingService
      .getPaginatedCentreBookings(centreId, {
        page: rosterPage,
        pageSize: PAGE_SIZE,
        search: searchQuery,
        status: statusFilter,
      })
      .then((res) => {
        if (!isMounted) return;
        setPaginatedData(res.data);
        setTotalItems(res.pagination.totalItems);
        setTotalPages(res.pagination.totalPages);
      })
      .catch((err) => {
        console.warn('Failed to load paginated centre bookings:', err);
        if (isMounted) setPaginatedData(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [centreId, rosterPage, searchQuery, statusFilter]);

  // Fallback client-side filtering if offline or centreId not yet available
  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      b.farmerName.toLowerCase().includes(q) ||
      b.tokenNumber.toString().includes(q.replace('#', '')) ||
      b.farmerMobile.includes(q) ||
      b.cropName.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'WAITING') {
      return ['BOOKED', 'ARRIVED', 'CHECKED_IN', 'WAITING', 'NOW_SERVING'].includes(b.currentStage);
    }
    if (statusFilter === 'IN_PROGRESS') {
      return ['VERIFICATION', 'QUALITY_CHECK', 'WEIGHING'].includes(b.currentStage);
    }
    if (statusFilter === 'COMPLETED') {
      return b.currentStage === 'COMPLETED';
    }
    if (statusFilter === 'NO_SHOW') {
      return b.currentStage === 'NO_SHOW';
    }
    return true;
  });

  const rosterTotalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const paginatedRosterBookings = filteredBookings.slice(
    (rosterPage - 1) * PAGE_SIZE,
    rosterPage * PAGE_SIZE
  );

  const displayBookings = paginatedData !== null ? paginatedData : paginatedRosterBookings;
  const displayTotalItems = paginatedData !== null ? totalItems : filteredBookings.length;
  const displayTotalPages = paginatedData !== null ? totalPages : rosterTotalPages;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
            Master Depot Register
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
            All Centre Bookings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete roster of scheduled farmer slots, arrivals, in-progress intakes, and completed lots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenCheckIn}
            icon={<UserCheck className="w-4 h-4" />}
          >
            Quick Check-In
          </Button>
        </div>
      </div>

      {/* Bookings Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">Total Bookings</span>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">{bookings.length}</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">Scheduled</span>
          <div className="text-xl font-extrabold text-blue-700 mt-0.5">
            {bookings.filter((b) => b.currentStage === 'BOOKED').length}
          </div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">Completed</span>
          <div className="text-xl font-extrabold text-[#16A34A] mt-0.5">
            {bookings.filter((b) => b.currentStage === 'COMPLETED').length}
          </div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">No-Shows</span>
          <div className="text-xl font-extrabold text-red-600 mt-0.5">
            {bookings.filter((b) => b.currentStage === 'NO_SHOW').length}
          </div>
        </div>
      </div>

      {/* Filter & Master Bookings Table */}
      <Card className="border-slate-200">
        <CardHeader className="py-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'All Bookings' },
                { id: 'WAITING', label: 'Scheduled / Waiting' },
                { id: 'IN_PROGRESS', label: 'In Progress' },
                { id: 'COMPLETED', label: 'Completed' },
                { id: 'NO_SHOW', label: 'No-Shows' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`text-xs px-2.5 py-1 rounded-button font-semibold border transition-colors ${
                    statusFilter === f.id
                      ? 'bg-[#166534] text-white border-[#166534]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bookings..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-input focus:outline-none focus:border-[#166534]"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="px-4 py-3">Token</th>
                  <th className="px-4 py-3">Farmer</th>
                  <th className="px-4 py-3">Produce / Qty</th>
                  <th className="px-4 py-3">Scheduled Slot</th>
                  <th className="px-4 py-3">Current Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      {isLoading ? 'Loading bookings...' : 'No bookings for this procurement centre.'}
                    </td>
                  </tr>
                ) : (
                  displayBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold">#{b.tokenNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{b.farmerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{b.farmerMobile}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{b.cropName}</div>
                        <div className="text-[11px] text-slate-500">
                          {b.acceptedQuantityKg || b.quantityKg} kg
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div>{b.timeWindow}</div>
                        <div className="text-[10px] text-slate-400">{b.date}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.currentStage} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenDetail(b)}
                        >
                          View Dossier
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {displayTotalItems > PAGE_SIZE && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
              <div>
                Showing {(rosterPage - 1) * PAGE_SIZE + 1} to{' '}
                {Math.min(rosterPage * PAGE_SIZE, displayTotalItems)} of {displayTotalItems} bookings
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rosterPage === 1 || isLoading}
                  onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="font-semibold text-slate-800">
                  Page {rosterPage} of {displayTotalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rosterPage >= displayTotalPages || isLoading}
                  onClick={() => setRosterPage((p) => Math.min(displayTotalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default OfficerBookingsTab;
