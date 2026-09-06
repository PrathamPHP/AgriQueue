import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';

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

const getTodayFormatted = (): string => {
  return new Date().toISOString().split('T')[0];
};

function formatSlotResponse(slot: any) {
  return {
    ...slot,
    start: slot.startTime,
    end: slot.endTime,
    timeWindow: slot.timeWindow || `${slot.startTime} – ${slot.endTime}`,
  };
}

export async function getSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { centreId, date, limit } = req.query;
    const whereClause: any = {};
    if (centreId) whereClause.centreId = String(centreId);
    if (date) whereClause.date = String(date);

    const takeLimit = limit ? Math.min(Number(limit), 100) : 50;

    const slots = await prisma.slot.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' },
      take: takeLimit,
    });
    res.json({ success: true, count: slots.length, data: slots.map(formatSlotResponse) });
  } catch (error) {
    next(error);
  }
}

export async function getCentreSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { centreId } = req.params;
    const { date } = req.query;
    const whereClause: any = { centreId };

    const todayStr = new Date().toISOString().split('T')[0];
    if (date) {
      whereClause.date = String(date);
    } else {
      whereClause.date = todayStr;
    }

    const slots = await prisma.slot.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' },
      take: 25,
    });
    res.json({ success: true, count: slots.length, data: slots.map(formatSlotResponse) });
  } catch (error) {
    next(error);
  }
}

export async function recommendSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { centreId, cropId, quantityKg = 600, date } = req.body;

    if (!centreId) {
      throw new AppError('centreId is required for slot recommendation', 400);
    }

    const targetDate = date || getTodayFormatted();

    const centre = await prisma.procurementCentre.findUnique({
      where: { id: centreId },
    });
    if (!centre) {
      throw new AppError(`Procurement Centre ${centreId} not found`, 404);
    }

    let crop = null;
    if (cropId) {
      crop = await prisma.crop.findUnique({ where: { id: cropId } });
    }

    const centreDelay = centre.currentDelayMinutes || 0;
    const isHeavyLoad = Number(quantityKg) >= 1200;

    // Get existing bookings for this centre and date from PostgreSQL
    const existingBookings = await prisma.booking.findMany({
      where: {
        centreId,
        bookingDate: targetDate,
        status: { not: 'cancelled' },
      },
    });

    // Query database slots for this centre and date
    const dbSlots = await prisma.slot.findMany({
      where: {
        centreId,
        date: targetDate,
      },
    });

    const scoredSlots = DEFAULT_WINDOWS.map((window) => {
      const matchingDbSlot = dbSlots.find(
        (s) => s.startTime === window.startTime || s.timeWindow === window.timeWindow
      );
      const slotId = matchingDbSlot?.id || `${window.id}-${centreId}-${targetDate}`;

      const bookingsInSlot = existingBookings.filter(
        (b) => b.slotId === window.id || b.slotId === slotId
      ).length;

      let congestionPenalty = window.baseCongestionScore * 4 + bookingsInSlot * 12;
      if (isHeavyLoad && (window.id === 'slot-0930' || window.id === 'slot-1000')) {
        congestionPenalty += 20;
      }

      const estimatedWait = Math.max(
        6,
        Math.round(
          (centre.avgWaitTimeMin || 18) * 0.5 +
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
      }
      if (reasons.length === 0) {
        reasons.push('Regular Throughput Expected');
      }

      return {
        id: slotId,
        slotId: slotId,
        centreId,
        date: targetDate,
        startTime: window.startTime,
        endTime: window.endTime,
        start: window.startTime,
        end: window.endTime,
        timeWindow: window.timeWindow,
        estimatedWaitMinutes: estimatedWait,
        availableCapacityPercent: capacityPercent,
        suitabilityScore,
        status,
        statusCode,
        reasons,
        isRecommended: false,
      };
    });

    // Best slot gets marked as recommended
    const sorted = [...scoredSlots].sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    const bestSlotId = sorted[0]?.id;

    const results = scoredSlots.map((slot) => ({
      ...slot,
      isRecommended: slot.id === bestSlotId,
    }));

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    next(error);
  }
}
