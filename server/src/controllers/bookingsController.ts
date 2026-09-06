import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';

export async function createBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      farmerId,
      cropId,
      quantityKg,
      centreId,
      slotId,
      date,
      timeWindow,
    } = req.body;

    if (!cropId || !centreId || !slotId || !date || !timeWindow) {
      throw new AppError('Missing required fields: cropId, centreId, slotId, date, timeWindow', 400);
    }

    // Resolve farmer
    let targetFarmerId = farmerId;
    if (!targetFarmerId) {
      const firstFarmer = await prisma.farmer.findFirst();
      if (!firstFarmer) {
        throw new AppError('Please register or sign in as a farmer first.', 400);
      }
      targetFarmerId = firstFarmer.id;
    }

    const farmer = await prisma.farmer.findUnique({ where: { id: targetFarmerId } });
    if (!farmer) {
      throw new AppError(`Farmer with ID ${targetFarmerId} not found`, 404);
    }

    const crop = await prisma.crop.findUnique({ where: { id: cropId } });
    if (!crop) {
      throw new AppError(`Crop with ID ${cropId} not found`, 404);
    }

    const centre = await prisma.procurementCentre.findUnique({ where: { id: centreId } });
    if (!centre) {
      throw new AppError(`Procurement Centre with ID ${centreId} not found`, 404);
    }

    // Execute atomic transactional booking creation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Calculate next sequential token number for this centre and date
      const maxTokenAgg = await tx.booking.aggregate({
        where: {
          centreId,
          bookingDate: date,
        },
        _max: {
          tokenNumber: true,
        },
      });

      const nextTokenNumber = (maxTokenAgg._max.tokenNumber || 0) + 1;
      const bookingId = `book-${farmer.id.replace('farmer-', '')}-${nextTokenNumber}-${Date.now().toString().slice(-4)}`;

      // 2. Ensure slot record exists
      let targetSlot = await tx.slot.findUnique({ where: { id: slotId } });
      if (!targetSlot) {
        targetSlot = await tx.slot.findFirst({
          where: {
            centreId,
            date,
            OR: [
              { timeWindow },
              { id: `${slotId}-${centreId}-${date}` },
            ],
          },
        });
      }

      const finalSlotId = targetSlot?.id || (slotId.includes(centreId) ? slotId : `${slotId}-${centreId}-${date}`);

      if (!targetSlot) {
        const [startTime, endTime] = (timeWindow || '09:00 AM – 09:30 AM').split('–').map((s: string) => s.trim());
        targetSlot = await tx.slot.create({
          data: {
            id: finalSlotId,
            centreId,
            date,
            startTime: startTime || '09:00 AM',
            endTime: endTime || '09:30 AM',
            timeWindow: timeWindow || `${startTime || '09:00 AM'} – ${endTime || '09:30 AM'}`,
            capacity: 15,
            status: 'AVAILABLE',
          },
        });
      }

      // 3. Create Booking
      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const districtId = centre.districtId || farmer.districtId;
      const stateId = centre.stateId || farmer.stateId;

      const createdBooking = await tx.booking.create({
        data: {
          id: bookingId,
          tokenNumber: nextTokenNumber,
          farmerId: farmer.id,
          farmerName: farmer.name,
          farmerMobile: farmer.mobileNumber,
          stateId,
          districtId,
          centreId: centre.id,
          centreName: centre.name,
          cropId: crop.id,
          cropName: crop.name,
          cropNameHindi: crop.nameHindi,
          quantityKg: Number(quantityKg) || 600,
          slotId: targetSlot.id,
          bookingDate: date,
          timeWindow: targetSlot.timeWindow || timeWindow,
          status: 'confirmed',
          currentStage: 'BOOKED',
          stageTimestamps: { BOOKED: timeStr },
          priorityFlag: Number(quantityKg) >= 2500,
          estimatedArrivalNotice: `Please arrive at ${centre.name} 15 minutes before your slot.`,
        },
      });

      // 4. Calculate Queue State
      const existingActiveQueues = await tx.queueEntry.findMany({
        where: {
          centreId: centre.id,
          isQueueActive: true,
        },
      });

      const centreCurrentToken =
        existingActiveQueues.length > 0
          ? Math.max(...existingActiveQueues.map((q) => q.currentToken))
          : 0;

      const farmersAhead =
        centreCurrentToken > 0
          ? Math.max(0, nextTokenNumber - centreCurrentToken)
          : Math.max(0, nextTokenNumber - 1);

      const waitTimeMin = Math.round(
        farmersAhead * (crop.baseProcessingTimeMin || 8) + centre.currentDelayMinutes
      );

      const recommendedArrivalTime = timeWindow.split('–')[0].trim();

      const createdQueueEntry = await tx.queueEntry.create({
        data: {
          id: `q-${createdBooking.id}`,
          bookingId: createdBooking.id,
          centreId: centre.id,
          tokenNumber: createdBooking.tokenNumber,
          currentToken: centreCurrentToken,
          farmersAhead,
          estimatedWaitingMinutes: waitTimeMin,
          currentDelayMinutes: centre.currentDelayMinutes,
          recommendedArrivalTime,
          isQueueActive: true,
          isTurnApproaching: farmersAhead <= 2 && farmersAhead > 0,
          lastUpdated: timeStr,
          totalInitialDistance: farmersAhead + 2,
        },
      });

      // 5. Send Notification
      const createdNotification = await tx.notification.create({
        data: {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          farmerId: farmer.id,
          type: 'booking',
          title: 'Procurement Slot Confirmed',
          message: `Token #${nextTokenNumber} booked at ${centre.name} for ${timeWindow}. MSP rate: ₹${crop.mspPerQuintal}/q.`,
          timestamp: timeStr,
          isRead: false,
          actionRoute: '/farmer/queue',
        },
      });

      return {
        booking: createdBooking,
        queueEntry: createdQueueEntry,
        notification: createdNotification,
      };
    });

    res.status(201).json({
      success: true,
      data: {
        ...result.booking,
        date: result.booking.bookingDate,
        queueEntry: result.queueEntry,
        notification: result.notification,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getBookingById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        queueEntry: true,
        procurement: {
          include: {
            payment: true,
          },
        },
      },
    });
    if (!booking) {
      throw new AppError(`Booking with ID ${id} not found`, 404);
    }
    res.json({
      success: true,
      data: {
        ...booking,
        date: booking.bookingDate,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { centreId, date, status, farmerId, currentStage, search, page, pageSize, limit } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const sizeNum = Math.min(100, Math.max(1, parseInt(String(pageSize || limit), 10) || 20));

    const whereClause: any = {};
    if (centreId) whereClause.centreId = String(centreId);
    if (date) whereClause.bookingDate = String(date);
    if (farmerId) whereClause.farmerId = String(farmerId);

    if (status && status !== 'ALL') {
      whereClause.status = String(status);
    }

    if (currentStage && currentStage !== 'ALL') {
      const stageStr = String(currentStage);
      if (stageStr === 'WAITING') {
        whereClause.currentStage = { in: ['BOOKED', 'ARRIVED', 'CHECKED_IN', 'WAITING', 'NOW_SERVING'] };
      } else if (stageStr === 'IN_PROGRESS') {
        whereClause.currentStage = { in: ['VERIFICATION', 'QUALITY_CHECK', 'WEIGHING'] };
      } else {
        whereClause.currentStage = stageStr;
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const tokenNum = parseInt(q.replace('#', ''), 10);
      whereClause.OR = [
        { farmerName: { contains: q, mode: 'insensitive' } },
        { farmerMobile: { contains: q } },
        { cropName: { contains: q, mode: 'insensitive' } },
        ...(isNaN(tokenNum) ? [] : [{ tokenNumber: tokenNum }]),
      ];
    }

    const [totalItems, bookings] = await Promise.all([
      prisma.booking.count({ where: whereClause }),
      prisma.booking.findMany({
        where: whereClause,
        orderBy: { tokenNumber: 'asc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        include: {
          queueEntry: true,
          procurement: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / sizeNum));

    res.json({
      success: true,
      count: bookings.length,
      data: bookings.map((b) => ({ ...b, date: b.bookingDate })),
      pagination: {
        page: pageNum,
        pageSize: sizeNum,
        totalItems,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCentreBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { centreId } = req.params;
    const { date, status, currentStage, search, page, pageSize } = req.query;

    const whereClause: any = { centreId };
    if (date) whereClause.bookingDate = String(date);
    if (status && status !== 'ALL') whereClause.status = String(status);

    if (currentStage && currentStage !== 'ALL') {
      const stageStr = String(currentStage);
      if (stageStr === 'WAITING') {
        whereClause.currentStage = { in: ['BOOKED', 'ARRIVED', 'CHECKED_IN', 'WAITING', 'NOW_SERVING'] };
      } else if (stageStr === 'IN_PROGRESS') {
        whereClause.currentStage = { in: ['VERIFICATION', 'QUALITY_CHECK', 'WEIGHING'] };
      } else {
        whereClause.currentStage = stageStr;
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const tokenNum = parseInt(q.replace('#', ''), 10);
      whereClause.OR = [
        { farmerName: { contains: q, mode: 'insensitive' } },
        { farmerMobile: { contains: q } },
        { cropName: { contains: q, mode: 'insensitive' } },
        ...(isNaN(tokenNum) ? [] : [{ tokenNumber: tokenNum }]),
      ];
    }

    // Check if client explicitly requested pagination
    if (page !== undefined || pageSize !== undefined) {
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const sizeNum = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 20));

      const [totalItems, bookings] = await Promise.all([
        prisma.booking.count({ where: whereClause }),
        prisma.booking.findMany({
          where: whereClause,
          orderBy: { tokenNumber: 'asc' },
          skip: (pageNum - 1) * sizeNum,
          take: sizeNum,
          include: {
            queueEntry: true,
            procurement: true,
          },
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(totalItems / sizeNum));

      res.json({
        success: true,
        count: bookings.length,
        data: bookings.map((b) => ({ ...b, date: b.bookingDate })),
        pagination: {
          page: pageNum,
          pageSize: sizeNum,
          totalItems,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
      return;
    }

    // Default backward compatible (unpaginated for internal queue operations)
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: { tokenNumber: 'asc' },
      include: {
        queueEntry: true,
        procurement: true,
      },
    });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings.map((b) => ({ ...b, date: b.bookingDate })),
      pagination: {
        page: 1,
        pageSize: bookings.length,
        totalItems: bookings.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: 'cancelled',
          currentStage: 'CANCELLED',
        },
      });

      await tx.queueEntry.updateMany({
        where: { bookingId: id },
        data: { isQueueActive: false },
      });

      return updated;
    });

    res.json({
      success: true,
      data: {
        ...result,
        date: result.bookingDate,
      },
    });
  } catch (error) {
    next(error);
  }
}
