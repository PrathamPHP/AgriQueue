/**
 * AgriQueue Officer Service
 * Operations service for procurement centre staff managing gate entry, verification,
 * quality inspection, digital weighbridge readings, and queue step progression.
 */

import {
  Officer,
  ProcurementCentre,
  Booking,
  ProcurementStage,
  PaymentStatus,
  Payment,
  CentreStats,
} from '@/types';
import { dataStore } from './dataStore';
import { bookingService } from './bookingService';
import { procurementService } from './procurementService';
import { paymentService } from './paymentService';
import { analyticsService } from './analyticsService';

class OfficerService {
  public async getCurrentOfficer(): Promise<Officer> {
    return dataStore.getCurrentOfficer();
  }

  public async getOfficerCentre(officerId?: string): Promise<ProcurementCentre> {
    const officer = dataStore.getCurrentOfficer();
    const centre = dataStore.getCentreById(officer.centreId);
    return centre || dataStore.getCentres()[0];
  }

  public async getTodayBookings(centreId: string): Promise<Booking[]> {
    return bookingService.getCentreBookings(centreId);
  }

  public async getCentreStats(centreId: string): Promise<CentreStats> {
    return analyticsService.getCentreStats(centreId);
  }

  public getAllowedNextStatuses(currentStage: ProcurementStage): ProcurementStage[] {
    switch (currentStage) {
      case 'BOOKED':
        return ['ARRIVED', 'NO_SHOW'];
      case 'ARRIVED':
      case 'CHECKED_IN':
        return ['NOW_SERVING', 'VERIFICATION', 'NO_SHOW'];
      case 'NOW_SERVING':
        return ['VERIFICATION', 'NO_SHOW'];
      case 'VERIFICATION':
        return ['QUALITY_CHECK', 'NO_SHOW'];
      case 'QUALITY_CHECK':
        return ['WEIGHING', 'CANCELLED'];
      case 'WEIGHING':
        return ['COMPLETED'];
      case 'COMPLETED':
      case 'NO_SHOW':
      case 'CANCELLED':
      default:
        return [];
    }
  }

  public async checkInFarmer(bookingId: string): Promise<Booking> {
    return procurementService.transitionStage(bookingId, 'ARRIVED');
  }

  public async transitionBookingStatus(
    bookingId: string,
    targetStage: ProcurementStage,
    metadata?: any
  ): Promise<Booking> {
    return procurementService.transitionStage(bookingId, targetStage, metadata);
  }

  public async advanceOfficerQueue(centreId: string): Promise<{ newCurrentToken: number; servedBooking?: Booking }> {
    const bookings = await this.getTodayBookings(centreId);

    // Prioritize checked-in farmers over unarrived ones
    const checkedInBookings = bookings
      .filter((b) => b.currentStage === 'ARRIVED' || b.currentStage === 'CHECKED_IN')
      .sort((a, b) => a.tokenNumber - b.tokenNumber);

    const otherEligibleBookings = bookings
      .filter((b) => b.currentStage === 'BOOKED' || b.currentStage === 'WAITING')
      .sort((a, b) => a.tokenNumber - b.tokenNumber);

    const targetBooking =
      checkedInBookings.length > 0
        ? checkedInBookings[0]
        : otherEligibleBookings.length > 0
        ? otherEligibleBookings[0]
        : undefined;

    const queueEntries = Object.values(dataStore.getQueueEntries()).filter(
      (q) => q.centreId === centreId
    );

    const currentToken =
      queueEntries.length > 0
        ? Math.max(...queueEntries.map((q) => q.currentToken))
        : 0;

    if (!targetBooking) {
      return { newCurrentToken: currentToken };
    }

    const nextToken = targetBooking.tokenNumber;

    // Advance target booking to NOW_SERVING
    await procurementService.transitionStage(targetBooking.id, 'NOW_SERVING');

    const centre = dataStore.getCentreById(centreId);
    const delayMinutes = centre?.currentDelayMinutes || 0;

    // Update all queue entries for this centre
    const allCentreEntries = Object.values(dataStore.getQueueEntries()).filter(
      (q) => q.centreId === centreId
    );

    allCentreEntries.forEach((q) => {
      const remaining = Math.max(0, q.tokenNumber - nextToken);
      const bookingForEntry = bookings.find((b) => b.id === q.bookingId);
      const baseTime = bookingForEntry?.cropId
        ? (dataStore.getCropById(bookingForEntry.cropId)?.baseProcessingTimeMin || 8)
        : 8;
      const waitMin = Math.round(remaining * baseTime + delayMinutes);

      dataStore.updateQueueEntry(q.bookingId, {
        currentToken: nextToken,
        farmersAhead: remaining,
        estimatedWaitingMinutes: waitMin,
        isTurnApproaching: remaining <= 2 && remaining > 0,
        lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });

      // If turn is approaching (1 or 2 ahead), send proactive alert to waiting farmer
      if ((remaining === 1 || remaining === 2) && bookingForEntry) {
        dataStore.addNotification({
          id: `notif-appr-${Date.now()}-${bookingForEntry.id}`,
          farmerId: bookingForEntry.farmerId,
          type: 'status',
          title: `Your Turn is Approaching (Token #${bookingForEntry.tokenNumber})`,
          message: `Current token serving is #${nextToken}. Only ${remaining} farmer${remaining > 1 ? 's' : ''} ahead of you. Please be ready at Gate 2.`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          isRead: false,
          actionRoute: '/farmer/queue',
        });
      }
    });

    return {
      newCurrentToken: nextToken,
      servedBooking: dataStore.getBookingById(targetBooking.id) || targetBooking,
    };
  }

  public async markNoShow(bookingId: string): Promise<Booking> {
    return procurementService.transitionStage(bookingId, 'NO_SHOW');
  }

  public async updatePaymentStatus(procurementId: string, status: PaymentStatus): Promise<Payment> {
    return paymentService.updatePaymentStatus(procurementId, status);
  }

  public async setOfficerCentreDelay(centreId: string, delayMinutes: number): Promise<void> {
    dataStore.updateCentre(centreId, { currentDelayMinutes: delayMinutes });
  }

  public subscribeToOfficerUpdates(listener: () => void): () => void {
    return dataStore.subscribe(listener);
  }
}

export const officerService = new OfficerService();
export const getCurrentOfficer = () => officerService.getCurrentOfficer();
export const getOfficerCentre = (oId?: string) => officerService.getOfficerCentre(oId);
export const getTodayBookings = (cId: string) => officerService.getTodayBookings(cId);
export const getCentreStats = (cId: string) => officerService.getCentreStats(cId);
export const getAllowedNextStatuses = (s: ProcurementStage) => officerService.getAllowedNextStatuses(s);
export const checkInFarmer = (bId: string) => officerService.checkInFarmer(bId);
export const transitionBookingStatus = (bId: string, s: ProcurementStage, m?: any) =>
  officerService.transitionBookingStatus(bId, s, m);
export const advanceOfficerQueue = (cId: string) => officerService.advanceOfficerQueue(cId);
export const markNoShow = (bId: string) => officerService.markNoShow(bId);
export const updatePaymentStatus = (pId: string, s: PaymentStatus) =>
  officerService.updatePaymentStatus(pId, s);
export const setOfficerCentreDelay = (cId: string, d: number) =>
  officerService.setOfficerCentreDelay(cId, d);
export const subscribeToOfficerUpdates = (fn: () => void) => officerService.subscribeToOfficerUpdates(fn);
