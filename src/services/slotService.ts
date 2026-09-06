/**
 * AgriQueue Slot Recommendation Service
 * Intelligently ranks and scores available procurement slots based on crop throughput,
 * farmer batch quantity, centre capacity, existing bookings, and current delay factors.
 */

import { SlotRecommendation } from '@/types';
import { dataStore } from './dataStore';
import { apiClient } from './apiClient';

interface TimeWindowTemplate {
  id: string;
  startTime: string;
  endTime: string;
  timeWindow: string;
  baseCongestionScore: number;
}

const DEFAULT_WINDOWS: TimeWindowTemplate[] = [
  { id: 'slot-0900', startTime: '09:00 AM', endTime: '09:30 AM', timeWindow: '09:00 AM – 09:30 AM', baseCongestionScore: 3 },
  { id: 'slot-0930', startTime: '09:30 AM', endTime: '10:00 AM', timeWindow: '09:30 AM – 10:00 AM', baseCongestionScore: 4 },
  { id: 'slot-1000', startTime: '10:00 AM', endTime: '10:30 AM', timeWindow: '10:00 AM – 10:30 AM', baseCongestionScore: 5 },
  { id: 'slot-1030', startTime: '10:30 AM', endTime: '11:00 AM', timeWindow: '10:30 AM – 11:00 AM', baseCongestionScore: 4 },
  { id: 'slot-1100', startTime: '11:00 AM', endTime: '11:30 AM', timeWindow: '11:00 AM – 11:30 AM', baseCongestionScore: 2 },
  { id: 'slot-1130', startTime: '11:30 AM', endTime: '12:00 PM', timeWindow: '11:30 AM – 12:00 PM', baseCongestionScore: 1 },
  { id: 'slot-0130', startTime: '01:30 PM', endTime: '02:00 PM', timeWindow: '01:30 PM – 02:00 PM', baseCongestionScore: 2 },
  { id: 'slot-0200', startTime: '02:00 PM', endTime: '02:30 PM', timeWindow: '02:00 PM – 02:30 PM', baseCongestionScore: 3 },
  { id: 'slot-0300', startTime: '03:00 PM', endTime: '03:30 PM', timeWindow: '03:00 PM – 03:30 PM', baseCongestionScore: 4 },
];

const normalizeDate = (dateStr?: string): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
};

export function normalizeRecommendation(r: any, centreId: string, date: string): SlotRecommendation {
  const id = r.id || r.slotId || `slot-${(r.startTime || '09:00').replace(/[^0-9]/g, '')}`;
  const startTime = r.startTime || r.start || '09:00 AM';
  const endTime = r.endTime || r.end || '09:30 AM';
  const timeWindow = r.timeWindow || `${startTime} – ${endTime}`;
  return {
    id,
    slotId: id,
    centreId: r.centreId || centreId,
    date: r.date || date,
    startTime,
    endTime,
    start: startTime,
    end: endTime,
    timeWindow,
    estimatedWaitMinutes: typeof r.estimatedWaitMinutes === 'number' ? r.estimatedWaitMinutes : 15,
    availableCapacityPercent: typeof r.availableCapacityPercent === 'number' ? r.availableCapacityPercent : 75,
    status: r.status || 'Available',
    statusCode: r.statusCode || 'AVAILABLE',
    isRecommended: Boolean(r.isRecommended),
    reasons: Array.isArray(r.reasons) && r.reasons.length > 0 ? r.reasons : ['Optimal Throughput Window'],
  };
}

class SlotService {
  public async getSmartRecommendations(
    centreId: string,
    cropId: string,
    quantityKg: number,
    date?: string
  ): Promise<SlotRecommendation[]> {
    const targetDate = normalizeDate(date);
    try {
      const apiRecs = await apiClient.post<SlotRecommendation[]>('/slots/recommend', {
        centreId,
        cropId,
        quantityKg,
        date: targetDate,
      });
      if (Array.isArray(apiRecs) && apiRecs.length > 0) {
        return apiRecs.map((r) => normalizeRecommendation(r, centreId, targetDate));
      }
    } catch (e) {
      console.warn('[SlotService] Backend recommendation fallback:', e);
    }

    const centre = dataStore.getCentreById(centreId);
    const crop = dataStore.getCropById(cropId);

    const centreDelay = centre?.currentDelayMinutes || 0;
    const isHeavyLoad = quantityKg >= 1200;

    const existingBookings = dataStore
      .getBookings()
      .filter((b) => b.centreId === centreId && b.date === date);

    const scoredSlots = DEFAULT_WINDOWS.map((window) => {
      const bookingsInSlot = existingBookings.filter((b) => b.slotId === window.id).length;

      let congestionPenalty = window.baseCongestionScore * 4 + bookingsInSlot * 12;
      if (isHeavyLoad && (window.id === 'slot-0930' || window.id === 'slot-1000')) {
        congestionPenalty += 20;
      }

      const estimatedWait = Math.max(
        6,
        Math.round(
          (centre?.avgWaitTimeMin || 18) * 0.5 +
            window.baseCongestionScore * 3 +
            centreDelay * 0.4 +
            bookingsInSlot * 6
        )
      );

      const capacityPercent = Math.max(
        5,
        Math.min(95, 100 - (bookingsInSlot * 25 + window.baseCongestionScore * 10))
      );

      const suitabilityScore = 100 - (congestionPenalty + estimatedWait);

      let status: 'Available' | 'Almost Full' | 'Busy' = 'Available';
      let statusCode: 'AVAILABLE' | 'ALMOST_FULL' | 'BUSY' = 'AVAILABLE';

      if (capacityPercent < 25) {
        status = 'Busy';
        statusCode = 'BUSY';
      } else if (capacityPercent < 55) {
        status = 'Almost Full';
        statusCode = 'ALMOST_FULL';
      }

      const reasons: string[] = [];
      if (estimatedWait <= 14) {
        reasons.push('Shortest Mandi Waiting Window');
      }
      if (capacityPercent >= 60) {
        reasons.push('Ample Weighbridge Bandwidth');
      }
      if (isHeavyLoad) {
        reasons.push(`Optimized for Bulk Load (${quantityKg} kg)`);
      } else {
        reasons.push('Fast Gate Check-in Corridor');
      }
      if (centreDelay === 0) {
        reasons.push('Zero Reported Delays Today');
      }

      return {
        id: window.id,
        centreId,
        date,
        startTime: window.startTime,
        endTime: window.endTime,
        timeWindow: window.timeWindow,
        estimatedWaitMinutes: estimatedWait,
        status,
        statusCode,
        isRecommended: false,
        suitabilityScore,
        reasons: reasons.slice(0, 3),
      };
    });

    const sorted = [...scoredSlots].sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    const topSlotId = sorted[0]?.id;

    return scoredSlots.map((slot) =>
      normalizeRecommendation(
        {
          ...slot,
          isRecommended: slot.id === topSlotId,
        },
        centreId,
        targetDate
      )
    );
  }
}

export const slotService = new SlotService();
