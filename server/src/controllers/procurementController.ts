import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';

export async function checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      throw new AppError('bookingId is required for check-in', 400);
    }

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new AppError(`Booking ${bookingId} not found`, 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: {
          currentStage: 'VERIFICATION',
          stageTimestamps: {
            ...((booking.stageTimestamps as any) || {}),
            VERIFICATION: timeStr,
          },
        },
      });

      await tx.queueEntry.updateMany({
        where: { bookingId },
        data: {
          isQueueActive: true,
          farmersAhead: 0,
          isTurnApproaching: false,
          lastUpdated: timeStr,
        },
      });

      return b;
    });

    res.json({
      success: true,
      data: {
        ...updated,
        date: updated.bookingDate,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function qualityCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      bookingId,
      qualityGrade = 'Grade A',
      moisturePercent,
      foreignMatterPercent,
      remarks,
    } = req.body;

    if (!bookingId) {
      throw new AppError('bookingId is required for quality check', 400);
    }

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new AppError(`Booking ${bookingId} not found`, 404);
    }

    const qcRemark = remarks || `Quality verified: Grade ${qualityGrade}, Moisture: ${moisturePercent ?? 11.8}%, Foreign Matter: ${foreignMatterPercent ?? 0.8}%`;

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        qualityGrade,
        remarks: qcRemark,
        currentStage: 'WEIGHING',
        stageTimestamps: {
          ...((booking.stageTimestamps as any) || {}),
          QUALITY_CHECK: timeStr,
        },
      },
    });

    res.json({
      success: true,
      data: {
        ...updated,
        date: updated.bookingDate,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function recordWeighbridge(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      bookingId,
      actualWeightKg,
      grossWeightKg,
      tareWeightKg,
      deductions = 0,
      officerId = 'off-sunita',
      officerName = 'Officer Sunita Sharma',
      qualityGrade,
      remarks,
    } = req.body;

    if (!bookingId) {
      throw new AppError('bookingId is required for weighbridge recording', 400);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { crop: true, farmer: true },
    });
    if (!booking) {
      throw new AppError(`Booking ${bookingId} not found`, 404);
    }

    // Determine accepted weight
    let finalWeight = actualWeightKg ? Number(actualWeightKg) : 0;
    if (!finalWeight && grossWeightKg && tareWeightKg) {
      finalWeight = Number(grossWeightKg) - Number(tareWeightKg);
    }
    if (!finalWeight) {
      finalWeight = booking.quantityKg;
    }

    const msp = booking.crop?.mspPerQuintal || 2275;
    const grossAmount = Math.round((finalWeight / 100) * msp);
    const netAmount = Math.max(0, grossAmount - Number(deductions));

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update booking
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          actualWeightKg: finalWeight,
          acceptedQuantityKg: finalWeight,
          currentStage: 'COMPLETED',
          status: 'completed',
          qualityGrade: qualityGrade || booking.qualityGrade || 'Grade A',
          remarks: remarks || booking.remarks || 'Produce weighed and accepted at digital weighbridge',
          stageTimestamps: {
            ...((booking.stageTimestamps as any) || {}),
            WEIGHING: timeStr,
            COMPLETED: timeStr,
          },
        },
      });

      // 2. Mark queue entry completed
      await tx.queueEntry.updateMany({
        where: { bookingId },
        data: {
          isQueueActive: false,
          farmersAhead: 0,
          isTurnApproaching: false,
          lastUpdated: timeStr,
        },
      });

      // 3. Upsert ProcurementRecord
      const procurementId = `prc-${bookingId.replace('book-', '')}`;
      const procurement = await tx.procurementRecord.upsert({
        where: { bookingId },
        update: {
          acceptedQuantityKg: finalWeight,
          actualWeightKg: finalWeight,
          qualityGrade: updatedBooking.qualityGrade || 'Grade A',
          remarks: updatedBooking.remarks,
          totalGrossAmount: grossAmount,
          deductions: Number(deductions),
          netPayableAmount: netAmount,
          officerId,
          officerName,
        },
        create: {
          id: procurementId,
          bookingId,
          farmerId: booking.farmerId,
          cropId: booking.cropId,
          cropName: booking.cropName,
          bookedQuantityKg: booking.quantityKg,
          acceptedQuantityKg: finalWeight,
          actualWeightKg: finalWeight,
          qualityGrade: updatedBooking.qualityGrade || 'Grade A',
          remarks: updatedBooking.remarks,
          officerId,
          officerName,
          mspRatePerQuintal: msp,
          totalGrossAmount: grossAmount,
          deductions: Number(deductions),
          netPayableAmount: netAmount,
        },
      });

      // 4. Upsert Payment Record (Pending PFMS Settlement)
      const paymentId = `pay-${procurement.id.replace('prc-', '')}`;
      const maskedAccount = booking.farmer?.bankAccountNumber
        ? `•••• •••• ${booking.farmer.bankAccountNumber.slice(-4)}`
        : '•••• •••• 4521';

      const payment = await tx.payment.upsert({
        where: { bookingId },
        update: {
          amount: netAmount,
        },
        create: {
          id: paymentId,
          procurementId: procurement.id,
          bookingId: booking.id,
          farmerId: booking.farmerId,
          amount: netAmount,
          status: 'PENDING',
          paymentMode: 'DBT / PFMS',
          bankAccountMasked: maskedAccount,
          statusMessage: 'Weighbridge slip generated. Ready for payment approval.',
        },
      });

      // 5. Notify farmer
      await tx.notification.create({
        data: {
          id: `notif-proc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          farmerId: booking.farmerId,
          type: 'procurement',
          title: 'Produce Weighed & Procured',
          message: `${finalWeight} kg of ${booking.cropName} weighed. Net amount ₹${netAmount.toLocaleString('en-IN')} approved for DBT transfer.`,
          timestamp: timeStr,
          isRead: false,
          actionRoute: `/farmer/dashboard`,
        },
      });

      return { booking: updatedBooking, procurement, payment };
    });

    res.json({
      success: true,
      data: {
        booking: {
          ...result.booking,
          date: result.booking.bookingDate,
        },
        procurement: result.procurement,
        payment: result.payment,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getProcurementById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const procurement = await prisma.procurementRecord.findFirst({
      where: {
        OR: [{ id }, { bookingId: id }],
      },
      include: {
        booking: true,
        farmer: true,
        crop: true,
        payment: true,
      },
    });

    if (!procurement) {
      throw new AppError(`Procurement with ID ${id} not found`, 404);
    }

    res.json({ success: true, data: procurement });
  } catch (error) {
    next(error);
  }
}

export async function getCentreProcurements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { centreId } = req.params;
    const procurements = await prisma.procurementRecord.findMany({
      where: {
        booking: { centreId },
      },
      include: {
        booking: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: procurements.length, data: procurements });
  } catch (error) {
    next(error);
  }
}
