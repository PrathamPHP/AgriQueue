/**
 * AgriQueue Analytics Service
 * Computes live operational KPIs for Mandi Officers and State-level Admin Dashboards
 * directly from the single normalized data store.
 */

import { CentreStats, DistrictStats, StateStats, NationalStats } from '@/types';
import { dataStore } from './dataStore';
import { apiClient } from './apiClient';

export interface AdminAnalytics {
  totalProcuredTonnes: number;
  totalDisbursedAmount: number;
  pendingDisbursementAmount: number;
  averageWaitTimeMin: number;
  activeCentresCount: number;
  totalRegisteredFarmers: number;
  totalBookingsToday: number;
  centreCongestionList: {
    centreId: string;
    centreName: string;
    utilizationPercent: number;
    delayMinutes: number;
    status: 'AVAILABLE' | 'FILLING_FAST' | 'FULL';
  }[];
}

class AnalyticsService {
  public async getCentreStats(centreId: string): Promise<CentreStats> {
    try {
      const stats = await apiClient.get<CentreStats>(`/analytics/centres/${centreId}`);
      if (stats && stats.todayBookingsCount !== undefined) {
        return stats;
      }
    } catch {}

    const bookings = dataStore.getBookings().filter((b) => b.centreId === centreId);
    const centre = dataStore.getCentreById(centreId);

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

    const delay = centre?.currentDelayMinutes || 0;

    // Payments for this centre
    const allPayments = Object.values(dataStore.getPayments());
    const bookingIds = new Set(bookings.map((b) => b.id));
    const centrePayments = allPayments.filter((p) => bookingIds.has(p.bookingId));

    const totalDisbursedAmount = centrePayments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingDisbursementAmount = centrePayments
      .filter((p) => p.status === 'PENDING' || p.status === 'INITIATED')
      .reduce((sum, p) => sum + p.amount, 0);

    // Dynamic wait time calculation: calculate ONLY when real waiting data exists
    const queueEntries = Object.values(dataStore.getQueueEntries()).filter(
      (q) => q.centreId === centreId
    );
    const waitingQueueEntries = queueEntries.filter((q) => {
      const b = bookings.find((bk) => bk.id === q.bookingId);
      return b && (b.currentStage === 'BOOKED' || b.currentStage === 'ARRIVED');
    });

    let avgWaitTimeMin = 0;
    if (waitingQueueEntries.length > 0) {
      const sumWait = waitingQueueEntries.reduce((sum, q) => sum + q.estimatedWaitingMinutes, 0);
      avgWaitTimeMin = Math.round(sumWait / waitingQueueEntries.length);
    } else if (completedBookings.length > 0 && delay > 0) {
      avgWaitTimeMin = delay;
    }

    const currentToken =
      queueEntries.length > 0
        ? Math.max(...queueEntries.map((q) => q.currentToken))
        : 0;

    return {
      todayBookingsCount,
      currentlyWaitingCount,
      completedTodayCount,
      avgWaitTimeMin,
      noShowCount,
      totalQuantityProcuredKg,
      currentDelayMinutes: delay,
      currentToken,
      capacity: centre?.capacity || 20,
      totalDisbursedAmount,
      pendingDisbursementAmount,
    };
  }

  public async getDistrictStats(districtId: string): Promise<DistrictStats> {
    try {
      const stats = await apiClient.get<DistrictStats>(`/analytics/districts/${districtId}`);
      if (stats && stats.totalCentres !== undefined) {
        return stats;
      }
    } catch {}

    const district = dataStore.getDistrictById(districtId);
    const centres = dataStore.getCentresByDistrict(districtId);
    const allBookings = dataStore.getBookings();

    const centreIdSet = new Set(centres.map((c) => c.id));
    const districtBookings = allBookings.filter((b) => centreIdSet.has(b.centreId));

    const centreSummaries: DistrictStats['centreSummaries'] = [];
    let totalBookingsToday = 0;
    let currentlyWaiting = 0;
    let completedToday = 0;
    let totalProcuredKg = 0;
    let totalDisbursedAmount = 0;
    let pendingDisbursementAmount = 0;
    let totalWaitTimeSum = 0;
    let activeCentresWithBookings = 0;

    for (const centre of centres) {
      const stats = await this.getCentreStats(centre.id);
      const cBookings = districtBookings.filter((b) => b.centreId === centre.id);
      const capUtilization = Math.min(100, Math.round((cBookings.length / (centre.capacity || 20)) * 100));

      centreSummaries.push({
        ...stats,
        centreId: centre.id,
        centreName: centre.name,
        centreCode: centre.code || centre.id.toUpperCase(),
        status: centre.operationalStatus || 'OPERATIONAL',
        capacity: centre.capacity || 20,
        capacityUtilization: capUtilization,
        totalDisbursedAmount: stats.totalDisbursedAmount || 0,
        pendingDisbursementAmount: stats.pendingDisbursementAmount || 0,
      });

      totalBookingsToday += stats.todayBookingsCount;
      currentlyWaiting += stats.currentlyWaitingCount;
      completedToday += stats.completedTodayCount;
      totalProcuredKg += stats.totalQuantityProcuredKg;
      totalDisbursedAmount += stats.totalDisbursedAmount || 0;
      pendingDisbursementAmount += stats.pendingDisbursementAmount || 0;

      if (stats.avgWaitTimeMin > 0) {
        totalWaitTimeSum += stats.avgWaitTimeMin;
        activeCentresWithBookings++;
      }
    }

    const avgWaitTimeMin =
      activeCentresWithBookings > 0
        ? Math.round(totalWaitTimeSum / activeCentresWithBookings)
        : 0;

    return {
      districtId,
      districtName: district?.name || 'Unknown District',
      stateId: district?.stateId || '',
      totalCentres: centres.length,
      activeCentres: centres.filter(
        (c) =>
          c.isActive !== false &&
          c.operationalStatus !== 'CLOSED' &&
          c.operationalStatus !== 'INACTIVE'
      ).length,
      totalBookingsToday,
      currentlyWaiting,
      completedToday,
      totalProcuredKg,
      totalDisbursedAmount,
      pendingDisbursementAmount,
      avgWaitTimeMin,
      centreSummaries,
    };
  }

  public async getStateStats(stateId: string): Promise<StateStats> {
    try {
      const stats = await apiClient.get<StateStats>(`/analytics/states/${stateId}`);
      if (stats && stats.totalDistricts !== undefined) {
        return stats;
      }
    } catch {}

    const state = dataStore.getStateById(stateId);
    const districts = dataStore.getDistricts(stateId);

    const districtSummaries: StateStats['districtSummaries'] = [];
    let totalCentres = 0;
    let activeCentres = 0;
    let totalBookingsToday = 0;
    let currentlyWaiting = 0;
    let completedToday = 0;
    let totalProcuredKg = 0;
    let totalDisbursedAmount = 0;
    let pendingDisbursementAmount = 0;
    let totalWaitTimeSum = 0;
    let districtsWithWait = 0;

    for (const district of districts) {
      const dStats = await this.getDistrictStats(district.id);

      districtSummaries.push({
        districtId: district.id,
        districtName: district.name,
        districtCode: district.code,
        totalCentres: dStats.totalCentres,
        activeCentres: dStats.activeCentres,
        totalBookingsToday: dStats.totalBookingsToday,
        currentlyWaiting: dStats.currentlyWaiting,
        completedToday: dStats.completedToday,
        totalProcuredKg: dStats.totalProcuredKg,
        totalDisbursedAmount: dStats.totalDisbursedAmount,
        pendingDisbursementAmount: dStats.pendingDisbursementAmount,
        avgWaitTimeMin: dStats.avgWaitTimeMin,
      });

      totalCentres += dStats.totalCentres;
      activeCentres += dStats.activeCentres;
      totalBookingsToday += dStats.totalBookingsToday;
      currentlyWaiting += dStats.currentlyWaiting;
      completedToday += dStats.completedToday;
      totalProcuredKg += dStats.totalProcuredKg;
      totalDisbursedAmount += dStats.totalDisbursedAmount;
      pendingDisbursementAmount += dStats.pendingDisbursementAmount;

      if (dStats.avgWaitTimeMin > 0) {
        totalWaitTimeSum += dStats.avgWaitTimeMin;
        districtsWithWait++;
      }
    }

    const avgWaitTimeMin =
      districtsWithWait > 0
        ? Math.round(totalWaitTimeSum / districtsWithWait)
        : 0;

    return {
      stateId,
      stateName: state?.name || 'Unknown State',
      totalDistricts: districts.length,
      totalCentres,
      activeCentres,
      totalBookingsToday,
      currentlyWaiting,
      completedToday,
      totalProcuredKg,
      totalDisbursedAmount,
      pendingDisbursementAmount,
      avgWaitTimeMin,
      districtSummaries,
    };
  }

  public async getNationalStats(): Promise<NationalStats> {
    try {
      const stats = await apiClient.get<NationalStats>('/analytics/national');
      if (stats && stats.totalStates !== undefined) {
        return stats;
      }
    } catch {}

    const states = dataStore.getStates();
    const farmers = dataStore.getFarmers();

    const stateSummaries: NationalStats['stateSummaries'] = [];
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
      const sStats = await this.getStateStats(state.id);
      const procuredTonnes = Math.round(sStats.totalProcuredKg / 10) / 100;

      stateSummaries.push({
        stateId: state.id,
        stateName: state.name,
        stateCode: state.code,
        totalDistricts: sStats.totalDistricts,
        totalCentres: sStats.totalCentres,
        activeCentres: sStats.activeCentres,
        totalBookingsToday: sStats.totalBookingsToday,
        currentlyWaiting: sStats.currentlyWaiting,
        completedToday: sStats.completedToday,
        totalProcuredTonnes: procuredTonnes,
        totalDisbursedAmount: sStats.totalDisbursedAmount,
        pendingDisbursementAmount: sStats.pendingDisbursementAmount,
        avgWaitTimeMin: sStats.avgWaitTimeMin,
      });

      totalDistricts += sStats.totalDistricts;
      totalCentres += sStats.totalCentres;
      activeCentres += sStats.activeCentres;
      totalBookingsToday += sStats.totalBookingsToday;
      currentlyWaiting += sStats.currentlyWaiting;
      completedToday += sStats.completedToday;
      totalProcuredKg += sStats.totalProcuredKg;
      totalDisbursedAmount += sStats.totalDisbursedAmount;
      pendingDisbursementAmount += sStats.pendingDisbursementAmount;

      if (sStats.avgWaitTimeMin > 0) {
        totalWaitTimeSum += sStats.avgWaitTimeMin;
        statesWithWait++;
      }
    }

    const totalProcuredTonnes = Math.round(totalProcuredKg / 10) / 100;
    const nationalAvgWaitTimeMin =
      statesWithWait > 0
        ? Math.round(totalWaitTimeSum / statesWithWait)
        : 0;

    return {
      totalStates: states.length,
      totalDistricts,
      totalCentres,
      activeCentres,
      totalRegisteredFarmers: farmers.length,
      totalBookingsToday,
      currentlyWaiting,
      completedToday,
      totalProcuredTonnes,
      totalDisbursedAmount,
      pendingDisbursementAmount,
      nationalAvgWaitTimeMin,
      stateSummaries,
    };
  }

  public async getStatePerformance(): Promise<NationalStats['stateSummaries']> {
    const nat = await this.getNationalStats();
    return nat.stateSummaries;
  }

  public async getDistrictPerformance(stateId: string): Promise<StateStats['districtSummaries']> {
    const state = await this.getStateStats(stateId);
    return state.districtSummaries;
  }

  public async getCentrePerformance(districtId: string): Promise<DistrictStats['centreSummaries']> {
    const district = await this.getDistrictStats(districtId);
    return district.centreSummaries;
  }

  public async getAdminAnalytics(): Promise<AdminAnalytics> {
    try {
      const stats = await apiClient.get<AdminAnalytics>('/analytics/admin');
      if (stats && stats.activeCentresCount !== undefined) {
        return stats;
      }
    } catch {}

    const bookings = dataStore.getBookings();
    const completed = bookings.filter((b) => b.currentStage === 'COMPLETED');
    const centres = dataStore.getCentres();
    const farmers = dataStore.getFarmers();
    const payments = Object.values(dataStore.getPayments());

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

    const totalWait = centres.reduce(
      (sum, c) => sum + (c.avgWaitTimeMin || 0) + c.currentDelayMinutes,
      0
    );
    const averageWaitTimeMin = bookings.length > 0 ? Math.round(totalWait / (centres.length || 1)) : 0;

    const centreCongestionList = centres.map((c) => {
      const cBookings = bookings.filter((b) => b.centreId === c.id);
      const util = Math.min(100, Math.round((cBookings.length / 15) * 100));
      let status: 'AVAILABLE' | 'FILLING_FAST' | 'FULL' = 'AVAILABLE';
      if (util > 80) status = 'FULL';
      else if (util > 45) status = 'FILLING_FAST';

      return {
        centreId: c.id,
        centreName: c.name,
        utilizationPercent: util,
        delayMinutes: c.currentDelayMinutes,
        status,
      };
    });

    return {
      totalProcuredTonnes,
      totalDisbursedAmount,
      pendingDisbursementAmount,
      averageWaitTimeMin,
      activeCentresCount: centres.length,
      totalRegisteredFarmers: farmers.length,
      totalBookingsToday: bookings.length,
      centreCongestionList,
    };
  }
}

export const analyticsService = new AnalyticsService();
