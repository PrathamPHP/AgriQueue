import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';

export async function getCentreStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { centreId } = req.params;
    const centre = await prisma.procurementCentre.findUnique({ where: { id: centreId } });
    if (!centre) {
      throw new AppError(`Procurement Centre ${centreId} not found`, 404);
    }

    const bookings = await prisma.booking.findMany({ where: { centreId } });
    const queueEntries = await prisma.queueEntry.findMany({ where: { centreId } });
    const payments = await prisma.payment.findMany({
      where: { booking: { centreId } },
    });

    const todayBookingsCount = bookings.length;
    const completedBookings = bookings.filter((b) => b.currentStage === 'COMPLETED');
    const completedTodayCount = completedBookings.length;
    const noShowCount = bookings.filter((b) => b.currentStage === 'NO_SHOW').length;
    const currentlyWaitingCount = bookings.filter(
      (b) => b.currentStage === 'BOOKED' || b.currentStage === 'ARRIVED'
    ).length;

    const totalQuantityProcuredKg = completedBookings.reduce(
      (sum, b) => sum + (b.acceptedQuantityKg || b.quantityKg || 0),
      0
    );

    const totalDisbursedAmount = payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingDisbursementAmount = payments
      .filter((p) => p.status === 'PENDING' || p.status === 'INITIATED')
      .reduce((sum, p) => sum + p.amount, 0);

    const waitingQueueEntries = queueEntries.filter((q) => {
      const b = bookings.find((bk) => bk.id === q.bookingId);
      return b && (b.currentStage === 'BOOKED' || b.currentStage === 'ARRIVED');
    });

    let avgWaitTimeMin = 0;
    if (waitingQueueEntries.length > 0) {
      const sumWait = waitingQueueEntries.reduce((sum, q) => sum + q.estimatedWaitingMinutes, 0);
      avgWaitTimeMin = Math.round(sumWait / waitingQueueEntries.length);
    } else if (completedBookings.length > 0 && centre.currentDelayMinutes > 0) {
      avgWaitTimeMin = centre.currentDelayMinutes;
    }

    const currentToken =
      queueEntries.length > 0 ? Math.max(...queueEntries.map((q) => q.currentToken)) : 0;

    res.json({
      success: true,
      data: {
        todayBookingsCount,
        currentlyWaitingCount,
        completedTodayCount,
        avgWaitTimeMin,
        noShowCount,
        totalQuantityProcuredKg,
        currentDelayMinutes: centre.currentDelayMinutes,
        currentToken,
        capacity: 20,
        totalDisbursedAmount,
        pendingDisbursementAmount,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getDistrictStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { districtId } = req.params;
    const district = await prisma.district.findUnique({
      where: { id: districtId },
      include: { centres: true },
    });
    if (!district) {
      throw new AppError(`District ${districtId} not found`, 404);
    }

    const centres = district.centres;
    const centreIds = centres.map((c) => c.id);

    const bookings = await prisma.booking.findMany({
      where: { centreId: { in: centreIds } },
    });
    const queueEntries = await prisma.queueEntry.findMany({
      where: { centreId: { in: centreIds } },
    });
    const payments = await prisma.payment.findMany({
      where: { booking: { centreId: { in: centreIds } } },
    });

    const centreSummaries = [];
    let totalBookingsToday = 0;
    let currentlyWaiting = 0;
    let completedToday = 0;
    let totalProcuredKg = 0;
    let totalDisbursedAmount = 0;
    let pendingDisbursementAmount = 0;
    let totalWaitTimeSum = 0;
    let activeCentresWithWait = 0;

    for (const centre of centres) {
      const cBookings = bookings.filter((b) => b.centreId === centre.id);
      const cQueues = queueEntries.filter((q) => q.centreId === centre.id);
      const cPayments = payments.filter((p) => {
        const b = cBookings.find((cb) => cb.id === p.bookingId);
        return Boolean(b);
      });

      const completed = cBookings.filter((b) => b.currentStage === 'COMPLETED');
      const waiting = cBookings.filter(
        (b) => b.currentStage === 'BOOKED' || b.currentStage === 'ARRIVED'
      );
      const noShow = cBookings.filter((b) => b.currentStage === 'NO_SHOW').length;
      const cProcuredKg = completed.reduce(
        (sum, b) => sum + (b.acceptedQuantityKg || b.quantityKg || 0),
        0
      );

      const disbursed = cPayments
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

      const pending = cPayments
        .filter((p) => p.status === 'PENDING' || p.status === 'INITIATED')
        .reduce((sum, p) => sum + p.amount, 0);

      let waitTime = 0;
      if (waiting.length > 0) {
        const wQueues = cQueues.filter((q) => waiting.some((b) => b.id === q.bookingId));
        if (wQueues.length > 0) {
          waitTime = Math.round(
            wQueues.reduce((s, q) => s + q.estimatedWaitingMinutes, 0) / wQueues.length
          );
        }
      }

      const capUtilization = Math.min(100, Math.round((cBookings.length / 20) * 100));

      centreSummaries.push({
        centreId: centre.id,
        centreName: centre.name,
        centreCode: centre.code || centre.id.toUpperCase(),
        status: centre.operationalStatus || 'OPEN',
        capacity: 20,
        capacityUtilization: capUtilization,
        todayBookingsCount: cBookings.length,
        currentlyWaitingCount: waiting.length,
        completedTodayCount: completed.length,
        avgWaitTimeMin: waitTime,
        noShowCount: noShow,
        totalQuantityProcuredKg: cProcuredKg,
        currentDelayMinutes: centre.currentDelayMinutes,
        currentToken: cQueues.length > 0 ? Math.max(...cQueues.map((q) => q.currentToken)) : 0,
        totalDisbursedAmount: disbursed,
        pendingDisbursementAmount: pending,
      });

      totalBookingsToday += cBookings.length;
      currentlyWaiting += waiting.length;
      completedToday += completed.length;
      totalProcuredKg += cProcuredKg;
      totalDisbursedAmount += disbursed;
      pendingDisbursementAmount += pending;

      if (waitTime > 0) {
        totalWaitTimeSum += waitTime;
        activeCentresWithWait++;
      }
    }

    const avgWaitTimeMin =
      activeCentresWithWait > 0 ? Math.round(totalWaitTimeSum / activeCentresWithWait) : 0;

    res.json({
      success: true,
      data: {
        districtId,
        districtName: district.name,
        stateId: district.stateId,
        totalCentres: centres.length,
        activeCentres: centres.filter((c) => c.operationalStatus !== 'CLOSED').length,
        totalBookingsToday,
        currentlyWaiting,
        completedToday,
        totalProcuredKg,
        totalDisbursedAmount,
        pendingDisbursementAmount,
        avgWaitTimeMin,
        centreSummaries,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getStateStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { stateId } = req.params;
    const state = await prisma.state.findUnique({
      where: { id: stateId },
      include: {
        districts: {
          include: { centres: true },
        },
      },
    });

    if (!state) {
      throw new AppError(`State ${stateId} not found`, 404);
    }

    const allCentres = state.districts.flatMap((d) => d.centres);
    const centreIds = allCentres.map((c) => c.id);

    const bookings = await prisma.booking.findMany({
      where: { centreId: { in: centreIds } },
    });
    const queueEntries = await prisma.queueEntry.findMany({
      where: { centreId: { in: centreIds } },
    });
    const payments = await prisma.payment.findMany({
      where: { booking: { centreId: { in: centreIds } } },
    });

    // Index bookings, queues, and payments by district and bookingId for O(1) access
    const districtBookingMap = new Map<string, typeof bookings>();
    for (const b of bookings) {
      let list = districtBookingMap.get(b.districtId);
      if (!list) {
        list = [];
        districtBookingMap.set(b.districtId, list);
      }
      list.push(b);
    }

    const queueByBookingId = new Map<string, (typeof queueEntries)[0]>();
    for (const q of queueEntries) {
      queueByBookingId.set(q.bookingId, q);
    }

    const paymentsByBookingId = new Map<string, (typeof payments)[0]>();
    for (const p of payments) {
      paymentsByBookingId.set(p.bookingId, p);
    }

    const districtSummaries = [];
    let totalBookingsToday = 0;
    let currentlyWaiting = 0;
    let completedToday = 0;
    let totalProcuredKg = 0;
    let totalDisbursedAmount = 0;
    let pendingDisbursementAmount = 0;
    let totalWaitTimeSum = 0;
    let districtsWithWait = 0;

    for (const district of state.districts) {
      const dCentres = district.centres;
      const dBookings = districtBookingMap.get(district.id) || [];

      const dCompleted = dBookings.filter((b) => b.currentStage === 'COMPLETED');
      const dWaiting = dBookings.filter(
        (b) => b.currentStage === 'BOOKED' || b.currentStage === 'ARRIVED'
      );
      const dProcuredKg = dCompleted.reduce(
        (sum, b) => sum + (b.acceptedQuantityKg || b.quantityKg || 0),
        0
      );

      const dPayments = dBookings
        .map((b) => paymentsByBookingId.get(b.id))
        .filter((p): p is (typeof payments)[0] => Boolean(p));

      const dDisbursed = dPayments
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

      const dPending = dPayments
        .filter((p) => p.status === 'PENDING' || p.status === 'INITIATED')
        .reduce((sum, p) => sum + p.amount, 0);

      let dWait = 0;
      if (dWaiting.length > 0) {
        const wQueues = dWaiting
          .map((b) => queueByBookingId.get(b.id))
          .filter((q): q is (typeof queueEntries)[0] => Boolean(q));
        if (wQueues.length > 0) {
          dWait = Math.round(
            wQueues.reduce((s, q) => s + q.estimatedWaitingMinutes, 0) / wQueues.length
          );
        }
      }

      districtSummaries.push({
        districtId: district.id,
        districtName: district.name,
        districtCode: district.code,
        totalCentres: dCentres.length,
        activeCentres: dCentres.filter((c) => c.operationalStatus !== 'CLOSED').length,
        totalBookingsToday: dBookings.length,
        currentlyWaiting: dWaiting.length,
        completedToday: dCompleted.length,
        totalProcuredKg: dProcuredKg,
        totalDisbursedAmount: dDisbursed,
        pendingDisbursementAmount: dPending,
        avgWaitTimeMin: dWait,
      });

      totalBookingsToday += dBookings.length;
      currentlyWaiting += dWaiting.length;
      completedToday += dCompleted.length;
      totalProcuredKg += dProcuredKg;
      totalDisbursedAmount += dDisbursed;
      pendingDisbursementAmount += dPending;

      if (dWait > 0) {
        totalWaitTimeSum += dWait;
        districtsWithWait++;
      }
    }

    const totalProcuredTonnes = Math.round(totalProcuredKg / 10) / 100;
    const avgWaitTimeMin =
      districtsWithWait > 0 ? Math.round(totalWaitTimeSum / districtsWithWait) : 0;

    res.json({
      success: true,
      data: {
        stateId,
        stateName: state.name,
        stateCode: state.code,
        totalDistricts: state.districts.length,
        totalCentres: allCentres.length,
        activeCentres: allCentres.filter((c) => c.operationalStatus !== 'CLOSED').length,
        totalBookingsToday,
        currentlyWaiting,
        completedToday,
        totalProcuredKg,
        totalProcuredTonnes,
        totalDisbursedAmount,
        pendingDisbursementAmount,
        avgWaitTimeMin,
        districtSummaries,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getNationalStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [states, bookingGroups, payments, queueEntries, farmersCount] = await Promise.all([
      prisma.state.findMany({
        include: {
          districts: {
            include: { centres: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.booking.groupBy({
        by: ['stateId', 'currentStage'],
        _count: { id: true },
        _sum: { acceptedQuantityKg: true, quantityKg: true },
      }),
      prisma.payment.findMany({
        select: {
          amount: true,
          status: true,
          booking: {
            select: { stateId: true },
          },
        },
      }),
      prisma.queueEntry.findMany({
        where: {
          isQueueActive: true,
          estimatedWaitingMinutes: { gt: 0 },
        },
        select: {
          estimatedWaitingMinutes: true,
          booking: {
            select: { stateId: true, currentStage: true },
          },
        },
      }),
      prisma.farmer.count(),
    ]);

    // Build O(1) state lookup maps
    const stateBookingMap = new Map<
      string,
      { total: number; waiting: number; completed: number; procuredKg: number }
    >();

    for (const bg of bookingGroups) {
      const sId = bg.stateId;
      if (!sId) continue;
      let curr = stateBookingMap.get(sId);
      if (!curr) {
        curr = { total: 0, waiting: 0, completed: 0, procuredKg: 0 };
        stateBookingMap.set(sId, curr);
      }
      curr.total += bg._count.id;
      if (bg.currentStage === 'BOOKED' || bg.currentStage === 'ARRIVED') {
        curr.waiting += bg._count.id;
      }
      if (bg.currentStage === 'COMPLETED') {
        curr.completed += bg._count.id;
        curr.procuredKg += bg._sum.acceptedQuantityKg ?? bg._sum.quantityKg ?? 0;
      }
    }

    const statePaymentMap = new Map<string, { disbursed: number; pending: number }>();
    for (const p of payments) {
      const sId = p.booking?.stateId;
      if (!sId) continue;
      let curr = statePaymentMap.get(sId);
      if (!curr) {
        curr = { disbursed: 0, pending: 0 };
        statePaymentMap.set(sId, curr);
      }
      if (p.status === 'PAID') {
        curr.disbursed += p.amount;
      } else if (p.status === 'PENDING' || p.status === 'INITIATED') {
        curr.pending += p.amount;
      }
    }

    const stateWaitMap = new Map<string, { sum: number; count: number }>();
    for (const q of queueEntries) {
      const sId = q.booking?.stateId;
      const stage = q.booking?.currentStage;
      if (!sId || (stage !== 'BOOKED' && stage !== 'ARRIVED')) continue;
      let curr = stateWaitMap.get(sId);
      if (!curr) {
        curr = { sum: 0, count: 0 };
        stateWaitMap.set(sId, curr);
      }
      curr.sum += q.estimatedWaitingMinutes;
      curr.count += 1;
    }

    const stateSummaries = [];
    let totalDistricts = 0;
    let totalCentres = 0;
    let activeCentres = 0;
    let totalBookingsToday = 0;
    let currentlyWaiting = 0;
    let completedToday = 0;
    let totalProcuredKg = 0;
    let totalDisbursedAmount = 0;
    let pendingDisbursementAmount = 0;
    let totalWaitTimeSum = 0;
    let statesWithWait = 0;

    for (const state of states) {
      const sDistricts = state.districts;
      const sCentres = sDistricts.flatMap((d) => d.centres);
      const bData = stateBookingMap.get(state.id) || { total: 0, waiting: 0, completed: 0, procuredKg: 0 };
      const pData = statePaymentMap.get(state.id) || { disbursed: 0, pending: 0 };
      const wData = stateWaitMap.get(state.id);

      const sProcuredTonnes = Math.round(bData.procuredKg / 10) / 100;
      const sWait = wData && wData.count > 0 ? Math.round(wData.sum / wData.count) : 0;

      stateSummaries.push({
        stateId: state.id,
        stateName: state.name,
        stateCode: state.code,
        totalDistricts: sDistricts.length,
        totalCentres: sCentres.length,
        activeCentres: sCentres.filter((c) => c.operationalStatus !== 'CLOSED').length,
        totalBookingsToday: bData.total,
        currentlyWaiting: bData.waiting,
        completedToday: bData.completed,
        totalProcuredTonnes: sProcuredTonnes,
        totalDisbursedAmount: pData.disbursed,
        pendingDisbursementAmount: pData.pending,
        avgWaitTimeMin: sWait,
      });

      totalDistricts += sDistricts.length;
      totalCentres += sCentres.length;
      activeCentres += sCentres.filter((c) => c.operationalStatus !== 'CLOSED').length;
      totalBookingsToday += bData.total;
      currentlyWaiting += bData.waiting;
      completedToday += bData.completed;
      totalProcuredKg += bData.procuredKg;
      totalDisbursedAmount += pData.disbursed;
      pendingDisbursementAmount += pData.pending;

      if (sWait > 0) {
        totalWaitTimeSum += sWait;
        statesWithWait++;
      }
    }

    const totalProcuredTonnes = Math.round(totalProcuredKg / 10) / 100;
    const nationalAvgWaitTimeMin =
      statesWithWait > 0 ? Math.round(totalWaitTimeSum / statesWithWait) : 0;

    res.json({
      success: true,
      data: {
        totalStates: states.length,
        totalDistricts,
        totalCentres,
        activeCentres,
        totalRegisteredFarmers: farmersCount,
        totalBookingsToday,
        currentlyWaiting,
        completedToday,
        totalProcuredTonnes,
        totalDisbursedAmount,
        pendingDisbursementAmount,
        nationalAvgWaitTimeMin,
        stateSummaries,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [bookingsCount, completedProcuredSum, centres, farmersCount, paymentGroups, bookingCountsByCentre] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.aggregate({
        where: { currentStage: 'COMPLETED' },
        _sum: { acceptedQuantityKg: true, quantityKg: true },
      }),
      prisma.procurementCentre.findMany({
        take: 10,
        orderBy: { name: 'asc' },
      }),
      prisma.farmer.count(),
      prisma.payment.groupBy({
        by: ['status'],
        _sum: { amount: true },
      }),
      prisma.booking.groupBy({
        by: ['centreId'],
        _count: { id: true },
      }),
    ]);

    const totalProcuredKg =
      completedProcuredSum._sum.acceptedQuantityKg ?? completedProcuredSum._sum.quantityKg ?? 0;
    const totalProcuredTonnes = Math.round(totalProcuredKg / 10) / 100;

    let totalDisbursedAmount = 0;
    let pendingDisbursementAmount = 0;
    for (const pg of paymentGroups) {
      if (pg.status === 'PAID') {
        totalDisbursedAmount += pg._sum.amount ?? 0;
      } else if (pg.status === 'PENDING' || pg.status === 'INITIATED') {
        pendingDisbursementAmount += pg._sum.amount ?? 0;
      }
    }

    const centreBookingCountMap = new Map(bookingCountsByCentre.map((b) => [b.centreId, b._count.id]));

    const centreCongestionList = centres.map((centre) => {
      const bCount = centreBookingCountMap.get(centre.id) || 0;
      const util = Math.min(100, Math.round((bCount / 20) * 100));
      const status =
        util >= 85 ? 'FULL' : util >= 50 ? 'FILLING_FAST' : 'AVAILABLE';
      return {
        centreId: centre.id,
        centreName: centre.name,
        utilizationPercent: util,
        delayMinutes: centre.currentDelayMinutes,
        status: status as 'AVAILABLE' | 'FILLING_FAST' | 'FULL',
      };
    });

    const activeCentresCount = await prisma.procurementCentre.count({
      where: { operationalStatus: { not: 'CLOSED' } },
    });

    res.json({
      success: true,
      data: {
        totalProcuredTonnes,
        totalDisbursedAmount,
        pendingDisbursementAmount,
        averageWaitTimeMin: 0,
        activeCentresCount,
        totalRegisteredFarmers: farmersCount,
        totalBookingsToday: bookingsCount,
        centreCongestionList,
      },
    });
  } catch (error) {
    next(error);
  }
}
