import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';

export async function updatePaymentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { procurementId } = req.params;
    const { status, referenceId } = req.body;

    if (!status) {
      throw new AppError('status is required', 400);
    }

    const existingPayment = await prisma.payment.findFirst({
      where: {
        OR: [{ procurementId }, { id: procurementId }, { bookingId: procurementId }],
      },
      include: {
        booking: true,
      },
    });

    if (!existingPayment) {
      throw new AppError(`Payment associated with ${procurementId} not found`, 404);
    }

    const statePrefix = existingPayment.booking?.stateId
      ? existingPayment.booking.stateId.replace(/^(state|ut)-/, '').toUpperCase().slice(0, 3)
      : 'IN';

    const generatedRef =
      referenceId ||
      existingPayment.referenceId ||
      `PFMS-${statePrefix}-2026-${Date.now().toString().slice(-6)}`;

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const nowIso = new Date().toISOString();

    const statusMessage =
      status === 'PAID'
        ? 'Credited to beneficiary account via PFMS'
        : status === 'INITIATED'
        ? 'Payment order initiated and batched for PFMS treasury settlement'
        : status === 'PROCESSING'
        ? 'Processing in banking batch'
        : 'Payment order created';

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          status,
          referenceId: status === 'INITIATED' || status === 'PAID' ? generatedRef : existingPayment.referenceId,
          initiatedAt:
            status === 'INITIATED' || status === 'PAID'
              ? existingPayment.initiatedAt || nowIso
              : existingPayment.initiatedAt,
          paidAt: status === 'PAID' ? existingPayment.paidAt || nowIso : existingPayment.paidAt,
          statusMessage,
        },
      });

      // Send notifications to farmer
      if (status === 'INITIATED') {
        await tx.notification.create({
          data: {
            id: `notif-pay-init-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            farmerId: existingPayment.farmerId,
            type: 'payment',
            title: 'DBT Payment Order Initiated',
            message: `DBT payment of ₹${p.amount.toLocaleString('en-IN')} has been approved and batched for PFMS treasury settlement.`,
            timestamp: timeStr,
            isRead: false,
            actionRoute: `/farmer/payment/${p.id}`,
          },
        });
      } else if (status === 'PAID') {
        await tx.notification.create({
          data: {
            id: `notif-pay-paid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            farmerId: existingPayment.farmerId,
            type: 'payment',
            title: 'DBT Payment Credited',
            message: `₹${p.amount.toLocaleString('en-IN')} has been credited directly to your bank account via PFMS (Ref: ${p.referenceId}).`,
            timestamp: timeStr,
            isRead: false,
            actionRoute: `/farmer/payment/${p.id}`,
          },
        });
      }

      return p;
    });

    res.json({ success: true, data: updatedPayment });
  } catch (error) {
    next(error);
  }
}

export async function getPaymentById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id }, { procurementId: id }, { bookingId: id }],
      },
      include: {
        booking: true,
        procurement: true,
      },
    });

    if (!payment) {
      throw new AppError(`Payment ${id} not found`, 404);
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
}

export async function getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { farmerId, status } = req.query;
    const whereClause: any = {};
    if (farmerId) whereClause.farmerId = String(farmerId);
    if (status) whereClause.status = String(status);

    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        booking: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: payments.length, data: payments });
  } catch (error) {
    next(error);
  }
}
