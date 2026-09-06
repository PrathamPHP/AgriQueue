import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';

export async function getCentreQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { centreId } = req.params;
    const queueEntries = await prisma.queueEntry.findMany({
      where: {
        centreId,
        isQueueActive: true,
      },
      include: {
        booking: true,
      },
      orderBy: { tokenNumber: 'asc' },
    });

    res.json({ success: true, count: queueEntries.length, data: queueEntries });
  } catch (error) {
    next(error);
  }
}

export async function callNext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { centreId } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch active entries
      const activeEntries = await tx.queueEntry.findMany({
        where: {
          centreId,
          isQueueActive: true,
        },
        include: {
          booking: true,
        },
        orderBy: { tokenNumber: 'asc' },
      });

      if (activeEntries.length === 0) {
        return { message: 'No farmers currently in queue for this centre.', activeEntries: [] };
      }

      // 2. Determine current token and next token
      const currentToken = Math.max(0, ...activeEntries.map((e) => e.currentToken));
      // Find the lowest token number strictly greater than currentToken
      const nextEntry = activeEntries.find((e) => e.tokenNumber > currentToken);
      const newCurrentToken = nextEntry ? nextEntry.tokenNumber : currentToken + 1;

      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // 3. Update all active queue entries for this centre
      const updatedEntries = [];
      for (const entry of activeEntries) {
        const farmersAhead = Math.max(0, entry.tokenNumber - newCurrentToken);
        const waitTimeMin = Math.max(
          0,
          Math.round(farmersAhead * 8 + entry.currentDelayMinutes)
        );
        const isTurnApproaching = farmersAhead <= 2 && farmersAhead > 0;

        const updated = await tx.queueEntry.update({
          where: { id: entry.id },
          data: {
            currentToken: newCurrentToken,
            farmersAhead,
            estimatedWaitingMinutes: waitTimeMin,
            isTurnApproaching,
            lastUpdated: timeStr,
          },
        });
        updatedEntries.push(updated);

        // If this entry is the one called (farmersAhead === 0)
        if (farmersAhead === 0 && entry.booking.currentStage === 'BOOKED') {
          await tx.booking.update({
            where: { id: entry.bookingId },
            data: {
              currentStage: 'ARRIVED',
              stageTimestamps: {
                ...((entry.booking.stageTimestamps as any) || {}),
                ARRIVED: timeStr,
              },
            },
          });

          await tx.notification.create({
            data: {
              id: `notif-called-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              farmerId: entry.booking.farmerId,
              type: 'queue',
              title: 'Your Turn Has Arrived!',
              message: `Token #${entry.tokenNumber} is now being called to Gate 1 / Weighbridge at ${entry.booking.centreName}.`,
              timestamp: timeStr,
              isRead: false,
              actionRoute: '/farmer/queue',
            },
          });
        } else if (isTurnApproaching && farmersAhead === 2) {
          // Notify that turn is approaching
          await tx.notification.create({
            data: {
              id: `notif-near-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              farmerId: entry.booking.farmerId,
              type: 'queue',
              title: 'Turn Approaching: 2 Farmers Ahead',
              message: `Your token #${entry.tokenNumber} has only 2 farmers ahead. Please stay near the gate.`,
              timestamp: timeStr,
              isRead: false,
              actionRoute: '/farmer/queue',
            },
          });
        }
      }

      return {
        newCurrentToken,
        calledToken: nextEntry ? nextEntry.tokenNumber : newCurrentToken,
        updatedCount: updatedEntries.length,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateCentreDelay(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { centreId } = req.params;
    const { delayMinutes, reason = 'Traffic / Equipment Maintenance' } = req.body;

    const delay = Number(delayMinutes) || 0;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update centre
      const centre = await tx.procurementCentre.update({
        where: { id: centreId },
        data: { currentDelayMinutes: delay },
      });

      // 2. Update active queues
      const activeQueues = await tx.queueEntry.findMany({
        where: { centreId, isQueueActive: true },
        include: { booking: true },
      });

      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      for (const q of activeQueues) {
        const waitTimeMin = Math.round(q.farmersAhead * 8 + delay);
        await tx.queueEntry.update({
          where: { id: q.id },
          data: {
            currentDelayMinutes: delay,
            estimatedWaitingMinutes: waitTimeMin,
            lastUpdated: timeStr,
          },
        });

        if (delay > 0) {
          await tx.notification.create({
            data: {
              id: `notif-delay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              farmerId: q.booking.farmerId,
              type: 'delay',
              title: `Mandi Delay Alert: +${delay} mins`,
              message: `${centre.name} has reported an operational delay of ~${delay} min due to: ${reason}. Slot ETA updated automatically.`,
              timestamp: timeStr,
              isRead: false,
              actionRoute: '/farmer/queue',
            },
          });
        }
      }

      return { centre, affectedQueuesCount: activeQueues.length };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getLiveQueueForFarmer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { farmerId } = req.params;

    // Find latest active booking
    const booking = await prisma.booking.findFirst({
      where: {
        farmerId,
        status: 'confirmed',
        currentStage: { not: 'COMPLETED' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        queueEntry: true,
        centre: true,
      },
    });

    if (!booking) {
      throw new AppError('NO_ACTIVE_BOOKING', 404);
    }

    res.json({
      success: true,
      data: {
        booking: {
          ...booking,
          date: booking.bookingDate,
        },
        queueEntry: booking.queueEntry,
        centre: booking.centre,
      },
    });
  } catch (error) {
    next(error);
  }
}
