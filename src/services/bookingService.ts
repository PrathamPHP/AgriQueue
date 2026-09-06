/**
 * AgriQueue Booking Service
 * Handles slot reservations, draft state between wizard routes, dynamic token generation,
 * and retrieval of active/historical bookings.
 */

import { Booking, QueueEntry } from '@/types';
import { dataStore } from './dataStore';
import { storageService } from './storageService';
import { apiClient } from './apiClient';

export interface DraftBooking {
  cropId?: string;
  quantityKg?: number;
  centreId?: string;
  slotId?: string;
  date?: string;
  timeWindow?: string;
}

const DRAFT_KEY = 'draft_booking';

export interface CreateBookingParams {
  cropId: string;
  quantityKg: number;
  centreId: string;
  slotId: string;
  date: string;
  timeWindow: string;
}

class BookingService {
  // --- Draft State between Wizard Steps ---
  public getDraftBooking(): DraftBooking {
    return storageService.get<DraftBooking>(DRAFT_KEY, {});
  }

  public saveDraftBooking(draft: Partial<DraftBooking>): DraftBooking {
    const current = this.getDraftBooking();
    const updated = { ...current, ...draft };
    storageService.set(DRAFT_KEY, updated);
    return updated;
  }

  public clearDraftBooking(): void {
    storageService.remove(DRAFT_KEY);
  }

  // --- Dynamic Token Generation & Booking Creation ---
  public async createBooking(params: CreateBookingParams): Promise<Booking> {
    const farmer = dataStore.getCurrentFarmer();
    const crop = dataStore.getCropById(params.cropId);
    const centre = dataStore.getCentreById(params.centreId);

    if (!farmer) {
      throw new Error('Please register or sign in as a farmer first.');
    }

    if (!crop || !centre) {
      throw new Error('Invalid crop or procurement centre specified');
    }

    // Authoritative transactional creation via REST API / PostgreSQL
    const created = await apiClient.post<any>('/bookings', {
      farmerId: farmer.id,
      cropId: params.cropId,
      quantityKg: params.quantityKg,
      centreId: params.centreId,
      slotId: params.slotId,
      date: params.date,
      timeWindow: params.timeWindow,
    });

    const booking: Booking = {
      ...created,
      date: created.date || created.bookingDate || params.date,
    };

    dataStore.addBooking(booking);

    if (created.queueEntry) {
      dataStore.setQueueEntry(booking.id, created.queueEntry);
    }
    if (created.notification) {
      dataStore.addNotification(created.notification);
    }

    this.clearDraftBooking();
    return booking;
  }

  public async getActiveBooking(farmerId: string): Promise<Booking | null> {
    // Try to get freshest from backend, fallback to in-memory store
    try {
      const bookings = await this.getFarmerBookings(farmerId);
      const inProgress = bookings.find(
        (b) => b.status === 'confirmed' && b.currentStage !== 'COMPLETED'
      );
      if (inProgress) return inProgress;
      return bookings[0] || null;
    } catch {
      const bookings = dataStore.getBookings().filter((b) => b.farmerId === farmerId);
      const inProgress = bookings.find(
        (b) => b.status === 'confirmed' && b.currentStage !== 'COMPLETED'
      );
      return inProgress || bookings[0] || null;
    }
  }

  public async getFarmerBookings(farmerId: string): Promise<Booking[]> {
    try {
      const bookings = await apiClient.get<Booking[]>(`/farmers/${farmerId}/bookings`);
      if (Array.isArray(bookings)) {
        const normalized = bookings.map((b) => ({
          ...b,
          date: b.date || (b as any).bookingDate,
        }));
        dataStore.upsertBookings(normalized, false);
        for (const b of bookings) {
          if ((b as any).queueEntry) {
            dataStore.setQueueEntry(b.id, (b as any).queueEntry);
          }
        }
        return normalized;
      }
    } catch (e) {
      console.warn('[BookingService] Failed to fetch farmer bookings from API:', e);
    }

    return dataStore
      .getBookings()
      .filter((b) => b.farmerId === farmerId)
      .sort((a, b) => b.tokenNumber - a.tokenNumber);
  }

  public async getCentreBookings(centreId: string): Promise<Booking[]> {
    try {
      const bookings = await apiClient.get<Booking[]>(`/centres/${centreId}/bookings`);
      if (Array.isArray(bookings)) {
        const normalized = bookings.map((b) => ({
          ...b,
          date: b.date || (b as any).bookingDate,
        }));
        dataStore.upsertBookings(normalized, false);
        for (const b of bookings) {
          if ((b as any).queueEntry) {
            dataStore.setQueueEntry(b.id, (b as any).queueEntry);
          }
        }
        return normalized;
      }
    } catch (e) {
      console.warn('[BookingService] Failed to fetch centre bookings from API:', e);
    }

    return dataStore
      .getBookings()
      .filter((b) => b.centreId === centreId)
      .sort((a, b) => a.tokenNumber - b.tokenNumber);
  }

  public async getBookingById(id: string): Promise<Booking | null> {
    try {
      const booking = await apiClient.get<Booking>(`/bookings/${id}`);
      if (booking) {
        const normalized = { ...booking, date: booking.date || (booking as any).bookingDate };
        dataStore.addBooking(normalized, false);
        if ((booking as any).queueEntry) {
          dataStore.setQueueEntry(booking.id, (booking as any).queueEntry, false);
        }
        return normalized;
      }
    } catch (e) {
      console.warn(`[BookingService] Failed to fetch booking ${id} from API:`, e);
    }

    return dataStore.getBookingById(id) || null;
  }

  public async cancelBooking(id: string): Promise<void> {
    try {
      await apiClient.patch(`/bookings/${id}/cancel`);
    } catch (e) {
      console.warn(`[BookingService] Failed to cancel booking ${id} via API:`, e);
    }
    dataStore.updateBooking(id, { status: 'cancelled' });
  }
}

export const bookingService = new BookingService();
