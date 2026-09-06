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
      const dCentreIds = new Set(dCentres.map((c) => c.id));

      const dBookings = bookings.filter((b) => dCentreIds.has(b.centreId));
      const dQueues = queueEntries.filter((q) => dCentreIds.has(q.centreId));
      const dPayments = payments.filter((p) => {
        const b = dBookings.find((cb) => cb.id === p.bookingId);
        return Boolean(b);
      });

      const dCompleted = dBookings.filter((b) => b.currentStage === 'COMPLETED');
      const dWaiting = dBookings.filter(
        (b) => b.currentStage === 'BOOKED' || b.currentStage === 'ARRIVED'
      );
      const dProcuredKg = dCompleted.reduce(
        (sum, b) => sum + (b.acceptedQuantityKg || b.quantityKg || 0),
        0
      );

      const dDisbursed = dPayments
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

      const dPending = dPayments
        .filter((p) => p.status === 'PENDING' || p.status === 'INITIATED')
        .reduce((sum, p) => sum + p.amount, 0);

      let dWait = 0;
      if (dWaiting.length > 0) {
        const wQueues = dQueues.filter((q) => dWaiting.some((b) => b.id === q.bookingId));
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
    const [states, bookings, queueEntries, payments, farmersCount] = await Promise.all([
      prisma.state.findMany({
        include: {
          districts: {
            include: { centres: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.booking.findMany(),
      prisma.queueEntry.findMany(),
      prisma.payment.findMany(),
      prisma.farmer.count(),
    ]);

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
      const sCentreIds = new Set(sCentres.map((c) => c.id));

      const sBookings = bookings.filter((b) => sCentreIds.has(b.centreId));
      const sQueues = queueEntries.filter((q) => sCentreIds.has(q.centreId));
      const sPayments = payments.filter((p) => {
        const b = sBookings.find((cb) => cb.id === p.bookingId);
        return Boolean(b);
      });

      const sCompleted = sBookings.filter((b) => b.currentStage === 'COMPLETED');
      const sWaiting = sBookings.filter(
        (b) => b.currentStage === 'BOOKED' || b.currentStage === 'ARRIVED'
      );
      const sProcuredKg = sCompleted.reduce(
        (sum, b) => sum + (b.acceptedQuantityKg || b.quantityKg || 0),
        0
      );
      const sProcuredTonnes = Math.round(sProcuredKg / 10) / 100;

      const sDisbursed = sPayments
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

      const sPending = sPayments
        .filter((p) => p.status === 'PENDING' || p.status === 'INITIATED')
        .reduce((sum, p) => sum + p.amount, 0);

      let sWait = 0;
      if (sWaiting.length > 0) {
        const wQueues = sQueues.filter((q) => sWaiting.some((b) => b.id === q.bookingId));
        if (wQueues.length > 0) {
          sWait = Math.round(
            wQueues.reduce((s, q) => s + q.estimatedWaitingMinutes, 0) / wQueues.length
          );
        }
      }

      stateSummaries.push({
        stateId: state.id,
        stateName: state.name,
        stateCode: state.code,
        totalDistricts: sDistricts.length,
        totalCentres: sCentres.length,
        activeCentres: sCentres.filter((c) => c.operationalStatus !== 'CLOSED').length,
        totalBookingsToday: sBookings.length,
        currentlyWaiting: sWaiting.length,
        completedToday: sCompleted.length,
        totalProcuredTonnes: sProcuredTonnes,
        totalDisbursedAmount: sDisbursed,
        pendingDisbursementAmount: sPending,
        avgWaitTimeMin: sWait,
      });

      totalDistricts += sDistricts.length;
      totalCentres += sCentres.length;
      activeCentres += sCentres.filter((c) => c.operationalStatus !== 'CLOSED').length;
      totalBookingsToday += sBookings.length;
      currentlyWaiting += sWaiting.length;
      completedToday += sCompleted.length;
      totalProcuredKg += sProcuredKg;
      totalDisbursedAmount += sDisbursed;
      pendingDisbursementAmount += sPending;

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
    const [bookings, centres, farmersCount, payments] = await Promise.all([
      prisma.booking.findMany(),
      prisma.procurementCentre.findMany(),
      prisma.farmer.count(),
      prisma.payment.findMany(),
    ]);

    const completed = bookings.filter((b) => b.currentStage === 'COMPLETED');
    const totalProcuredKg = completed.reduce(
      (sum, b) => sum + (b.acceptedQuantityKg || b.quantityKg || 0),
      0
    );
    const totalProcuredTonnes = Math.round(totalProcuredKg / 10) / 100;

    const totalDisbursedAmount = payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingDisbursementAmount = payments
      .filter((p) => p.status === 'PENDING' || p.status === 'INITIATED')
      .reduce((sum, p) => sum + p.amount, 0);

    const centreCongestionList = centres.slice(0, 10).map((centre) => {
      const cBookings = bookings.filter((b) => b.centreId === centre.id);
      const util = Math.min(100, Math.round((cBookings.length / 20) * 100));
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

    res.json({
      success: true,
      data: {
        totalProcuredTonnes,
        totalDisbursedAmount,
        pendingDisbursementAmount,
        averageWaitTimeMin: 0,
        activeCentresCount: centres.filter((c) => c.operationalStatus !== 'CLOSED').length,
        totalRegisteredFarmers: farmersCount,
        totalBookingsToday: bookings.length,
        centreCongestionList,
      },
    });
  } catch (error) {
    next(error);
  }
}
