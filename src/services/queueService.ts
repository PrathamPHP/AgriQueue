/**
 * AgriQueue Queue Calculation & Service Layer
 * Computes dynamic virtual queue positions, ETA based on crop intake rates,
 * dynamic arrival calibration, and centre throughput.
 */

import {
  Booking,
  QueueEntry,
  LiveQueueScreenData,
  QueueVisualState,
} from '@/types';
import { dataStore } from './dataStore';
import { bookingService } from './bookingService';
import { apiClient } from './apiClient';

class QueueService {
  public calculateETA(
    farmersAhead: number,
    cropId: string,
    delayMinutes: number = 0
  ): { etaMinutes: number; breakdown: string } {
    if (farmersAhead <= 0) {
      return { etaMinutes: 0, breakdown: 'Immediate processing at gate' };
    }

    const crop = dataStore.getCropById(cropId);
    const baseTime = crop?.baseProcessingTimeMin || 8;
    const avgMinsPerFarmer = Math.max(3, Math.round(baseTime * 0.35 + 1.5));

    const calculatedWait = farmersAhead * avgMinsPerFarmer + delayMinutes;
    const breakdown = `${farmersAhead} farmers ahead × ~${avgMinsPerFarmer}m avg intake${
      delayMinutes > 0 ? ` + ${delayMinutes}m live centre delay` : ''
    }`;

    return { etaMinutes: calculatedWait, breakdown };
  }

  public calculateRecommendedArrivalTime(
    slotWindow: string,
    delayMinutes: number = 0
  ): { originalArrival: string; recommendedArrival: string } {
    const startStr = slotWindow.split('–')[0].trim();

    try {
      const [time, modifier] = startStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;

      const originalDate = new Date();
      originalDate.setHours(hours, minutes - 15, 0, 0);

      const recommendedDate = new Date(originalDate.getTime() + delayMinutes * 60000);

      const formatTime = (d: Date) => {
        let h = d.getHours();
        const m = d.getMinutes().toString().padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return `${h}:${m} ${ampm}`;
      };

      return {
        originalArrival: formatTime(originalDate),
        recommendedArrival: formatTime(recommendedDate),
      };
    } catch {
      return {
        originalArrival: '15 mins prior',
        recommendedArrival: '15 mins prior',
      };
    }
  }

  public async getLiveQueueScreenData(farmerId?: string): Promise<LiveQueueScreenData> {
    const activeFarmer = dataStore.getCurrentFarmer();
    if (!activeFarmer && !farmerId) {
      throw new Error('NO_ACTIVE_BOOKING');
    }
    const targetFarmerId = farmerId || activeFarmer?.id || '';
    const booking = await bookingService.getActiveBooking(targetFarmerId);

    if (!booking) {
      throw new Error('NO_ACTIVE_BOOKING');
    }

    const centre = dataStore.getCentreById(booking.centreId) || {
      id: booking.centreId,
      name: booking.centreName,
      currentDelayMinutes: 0,
    };

    let entry = dataStore.getQueueEntry(booking.id);
    if (!entry) {
      const existingQueueEntries = Object.values(dataStore.getQueueEntries()).filter(
        (q) => q.centreId === booking.centreId && q.bookingId !== booking.id
      );
      const centreCurrentToken =
        existingQueueEntries.length > 0
          ? Math.max(...existingQueueEntries.map((q) => q.currentToken))
          : 0;
      const farmersAhead = Math.max(0, booking.tokenNumber - 1);
      const crop = dataStore.getCropById(booking.cropId);
      const waitTimeMin = Math.round(
        farmersAhead * (crop?.baseProcessingTimeMin || 8) + centre.currentDelayMinutes
      );

      entry = {
        id: `q-${booking.id}`,
        bookingId: booking.id,
        centreId: booking.centreId,
        tokenNumber: booking.tokenNumber,
        currentToken: centreCurrentToken,
        farmersAhead,
        estimatedWaitingMinutes: waitTimeMin,
        currentDelayMinutes: centre.currentDelayMinutes,
        recommendedArrivalTime: booking.timeWindow.split('–')[0].trim(),
        isQueueActive: true,
        isTurnApproaching: farmersAhead <= 2,
        lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        totalInitialDistance: farmersAhead + 1,
      };
      dataStore.setQueueEntry(booking.id, entry);
    }

    const currentToken = entry.currentToken;
    const rawFarmersAhead =
      currentToken > 0
        ? Math.max(0, booking.tokenNumber - currentToken)
        : Math.max(0, booking.tokenNumber - 1);

    const { etaMinutes } = this.calculateETA(
      rawFarmersAhead,
      booking.cropId,
      centre.currentDelayMinutes
    );

    const { originalArrival, recommendedArrival } = this.calculateRecommendedArrivalTime(
      booking.timeWindow,
      centre.currentDelayMinutes
    );

    let queueState: QueueVisualState = 'WAITING';
    if (booking.currentStage === 'COMPLETED') {
      queueState = 'COMPLETED';
    } else if (booking.currentStage === 'NO_SHOW') {
      queueState = 'MISSED';
    } else if (
      booking.currentStage === 'NOW_SERVING' ||
      booking.currentStage === 'VERIFICATION' ||
      booking.currentStage === 'QUALITY_CHECK' ||
      booking.currentStage === 'WEIGHING' ||
      (currentToken > 0 && rawFarmersAhead === 0 && currentToken === booking.tokenNumber)
    ) {
      queueState = 'NOW_SERVING';
    } else if (currentToken === 0) {
      queueState = 'WAITING';
    } else if (rawFarmersAhead === 1) {
      queueState = 'NEXT_IN_QUEUE';
    } else if (rawFarmersAhead === 2) {
      queueState = 'APPROACHING';
    } else if (centre.currentDelayMinutes > 15) {
      queueState = 'DELAYED';
    } else if (booking.currentStage === 'BOOKED' && !entry.isQueueActive) {
      queueState = 'QUEUE_NOT_STARTED';
    }

    return {
      farmerTokenNumber: booking.tokenNumber,
      currentToken,
      farmersAhead: rawFarmersAhead,
      queuePosition: rawFarmersAhead + 1,
      estimatedWaitMinutes: etaMinutes,
      originalArrivalTime: originalArrival,
      recommendedArrivalTime: recommendedArrival,
      bookedSlot: booking.timeWindow,
      centreName: booking.centreName,
      centreId: booking.centreId,
      todayDate: booking.date,
      lastUpdated: entry.lastUpdated,
      delayMinutes: centre.currentDelayMinutes,
      queueState,
      booking,
      totalInitialQueueLength: entry.totalInitialDistance || (rawFarmersAhead + 3),
    };
  }

  public async advanceQueue(bookingId: string): Promise<void> {
    const entry = dataStore.getQueueEntry(bookingId);
    if (entry) {
      try {
        await apiClient.post(`/centres/${entry.centreId}/queue/call-next`);
        await dataStore.syncFromBackend();
        return;
      } catch (e) {
        console.warn('[QueueService] Backend call-next failed, updating local:', e);
      }
    }

    if (!entry) return;
    const nextToken = entry.currentToken + 1;
    const farmersAhead = Math.max(0, entry.tokenNumber - nextToken);

    dataStore.updateQueueEntry(bookingId, {
      currentToken: nextToken,
      farmersAhead,
      isTurnApproaching: farmersAhead <= 2,
      lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    });

    const booking = dataStore.getBookingById(bookingId);
    if (booking && farmersAhead === 0 && booking.currentStage === 'BOOKED') {
      dataStore.updateBooking(bookingId, {
        currentStage: 'ARRIVED',
        stageTimestamps: {
          ...booking.stageTimestamps,
          ARRIVED: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        },
      });
    }
  }

  public async callNext(centreId: string): Promise<any> {
    try {
      const res = await apiClient.post(`/centres/${centreId}/queue/call-next`);
      await dataStore.syncFromBackend();
      return res;
    } catch (e) {
      console.warn('[QueueService] Backend call-next error:', e);
      throw e;
    }
  }

  public async resetQueueForDemo(bookingId: string): Promise<void> {
    const booking = dataStore.getBookingById(bookingId);
    if (!booking) return;

    const startingToken = Math.max(1, booking.tokenNumber - 8);
    dataStore.updateQueueEntry(bookingId, {
      currentToken: startingToken,
      farmersAhead: booking.tokenNumber - startingToken,
      isTurnApproaching: false,
      lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    });
  }

  public async setCentreDelay(centreId: string, delayMinutes: number): Promise<void> {
    try {
      await apiClient.post(`/centres/${centreId}/delay`, { delayMinutes });
      await dataStore.syncFromBackend();
      return;
    } catch (e) {
      console.warn('[QueueService] Backend delay update failed, setting local:', e);
    }
    dataStore.updateCentre(centreId, { currentDelayMinutes: delayMinutes });
  }

  public subscribeToQueueUpdates(listener: () => void): () => void {
    return dataStore.subscribe(listener);
  }
}

export const queueService = new QueueService();
export const getLiveQueueScreenData = (fId?: string) => queueService.getLiveQueueScreenData(fId);
export const advanceQueue = (bId: string) => queueService.advanceQueue(bId);
export const resetQueueForDemo = (bId: string) => queueService.resetQueueForDemo(bId);
export const setCentreDelay = (cId: string, dMin: number) => queueService.setCentreDelay(cId, dMin);
export const subscribeToQueueUpdates = (fn: () => void) => queueService.subscribeToQueueUpdates(fn);
