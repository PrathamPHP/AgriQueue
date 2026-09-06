/**
 * AgriQueue Farmer Service
 * Composes farmer profiles, active bookings, live queue positions,
 * and procurement tracking from the central data store.
 */

import {
  Farmer,
  Booking,
  QueueEntry,
  Procurement,
  Payment,
  Notification,
  FarmerDashboardData,
  FarmerDashboardStageType,
  Crop,
  ProcurementCentre,
  SlotRecommendation,
} from '@/types';
import { dataStore } from './dataStore';
import { bookingService, CreateBookingParams } from './bookingService';
import { slotService } from './slotService';
import { procurementService } from './procurementService';
import { paymentService } from './paymentService';
import { apiClient } from './apiClient';

class FarmerService {
  public async getCurrentFarmer(): Promise<Farmer | null> {
    return dataStore.getCurrentFarmer();
  }

  public async getAllFarmers(): Promise<Farmer[]> {
    try {
      const list = await apiClient.get<Farmer[]>('/farmers');
      if (Array.isArray(list)) {
        dataStore.upsertFarmers(list, false);
        return list;
      }
    } catch {}
    return dataStore.getFarmers();
  }

  public async registerFarmer(params: Partial<Farmer>): Promise<Farmer> {
    try {
      const created = await apiClient.post<Farmer>('/farmers', {
        name: params.name,
        mobileNumber: params.mobileNumber,
        aadhaarNumber: params.aadhaarNumber,
        languagePref: params.languagePref || 'en',
        address: params.address,
        village: params.village,
        state: params.state,
        district: params.district,
        stateId: params.stateId,
        districtId: params.districtId,
        landAreaAcres: params.landAreaAcres,
        bankAccountMasked: params.bankAccountMasked,
      });
      dataStore.addFarmer(created, true);
      return created;
    } catch (err) {
      console.warn('[FarmerService] Failed to register farmer via API, saving to local store:', err);
      const fallbackFarmer: Farmer = {
        id: params.id || `farmer-${Date.now().toString().slice(-6)}`,
        name: params.name || 'Farmer',
        mobileNumber: params.mobileNumber || '',
        aadhaarNumber: params.aadhaarNumber,
        languagePref: params.languagePref || 'en',
        address: params.address || '',
        village: params.village,
        state: params.state || '',
        district: params.district || '',
        stateId: params.stateId || 'state-haryana',
        districtId: params.districtId || 'dist-karnal',
        landAreaAcres: params.landAreaAcres,
        bankAccountMasked: params.bankAccountMasked,
        createdAt: new Date().toISOString(),
      };
      dataStore.addFarmer(fallbackFarmer, true);
      return fallbackFarmer;
    }
  }

  public async switchFarmer(farmerId: string): Promise<Farmer | null> {
    dataStore.setCurrentFarmerId(farmerId);
    return dataStore.getCurrentFarmer();
  }

  public async getCrops(): Promise<Crop[]> {
    try {
      const list = await apiClient.get<Crop[]>('/crops');
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    } catch {}
    return dataStore.getCrops();
  }

  public async getCentres(): Promise<ProcurementCentre[]> {
    try {
      const list = await apiClient.get<ProcurementCentre[]>('/centres');
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    } catch {}
    return dataStore.getCentres();
  }

  public async getSmartRecommendations(
    centreId: string,
    cropId: string,
    quantityKg: number,
    date?: string
  ): Promise<SlotRecommendation[]> {
    return slotService.getSmartRecommendations(centreId, cropId, quantityKg, date);
  }

  public async createBooking(params: CreateBookingParams): Promise<Booking> {
    return bookingService.createBooking(params);
  }

  public async getActiveBooking(farmerId: string): Promise<Booking | null> {
    return bookingService.getActiveBooking(farmerId);
  }

  public async getFarmerBookings(farmerId: string): Promise<Booking[]> {
    return bookingService.getFarmerBookings(farmerId);
  }

  public async getPaginatedFarmerBookings(
    farmerId: string,
    options: { page: number; pageSize: number; status?: string }
  ) {
    return bookingService.getPaginatedFarmerBookings(farmerId, options);
  }

  public async getFarmerNotifications(farmerId: string): Promise<Notification[]> {
    try {
      const notifs = await apiClient.get<Notification[]>(`/farmers/${farmerId}/notifications`);
      if (Array.isArray(notifs)) {
        return notifs;
      }
    } catch {}
    return dataStore.getNotifications().filter((n) => n.farmerId === farmerId);
  }

  public async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await apiClient.patch(`/farmers/notifications/${notificationId}/read`);
    } catch {}
    dataStore.markNotificationRead(notificationId);
  }

  public deriveDashboardState(
    booking: Booking | null,
    queue: QueueEntry | null,
    payment: Payment | null
  ): FarmerDashboardStageType {
    if (!booking) return 'NO_BOOKING';

    if (booking.currentStage === 'COMPLETED') {
      if (payment && payment.status === 'PAID') return 'PAYMENT_COMPLETED';
      return 'PAYMENT_PENDING';
    }

    if (
      booking.currentStage === 'VERIFICATION' ||
      booking.currentStage === 'QUALITY_CHECK' ||
      booking.currentStage === 'WEIGHING'
    ) {
      return 'PROCUREMENT_IN_PROGRESS';
    }

    if (booking.currentStage === 'ARRIVED') {
      return 'TURN_APPROACHING';
    }

    if (queue && queue.farmersAhead <= 2 && queue.farmersAhead > 0) {
      return 'TURN_APPROACHING';
    }

    if (queue && queue.farmersAhead > 2) {
      return 'IN_VIRTUAL_QUEUE';
    }

    return 'UPCOMING_BOOKING';
  }

  public async getFarmerDashboardData(farmerId?: string): Promise<FarmerDashboardData> {
    const current = dataStore.getCurrentFarmer();
    if (!current) {
      return {
        farmer: null,
        dashboardState: 'NO_BOOKING',
        activeBooking: null,
        queueStatus: null,
        procurement: null,
        payment: null,
        recentNotifications: [],
      };
    }
    const activeFarmerId = farmerId || current.id;
    const farmer = dataStore.getFarmers().find((f) => f.id === activeFarmerId) || current;

    const activeBooking = await this.getActiveBooking(activeFarmerId);
    let queueStatus: QueueEntry | null = null;
    let procurement: Procurement | null = null;
    let payment: Payment | null = null;

    if (activeBooking) {
      queueStatus = dataStore.getQueueEntry(activeBooking.id) || null;
      procurement = await procurementService.getProcurementByBookingId(activeBooking.id);
      if (procurement) {
        payment = await paymentService.getPaymentByProcurementId(procurement.id);
      }
    }

    const dashboardState = this.deriveDashboardState(activeBooking, queueStatus, payment);
    const recentNotifications = await this.getFarmerNotifications(activeFarmerId);

    return {
      farmer,
      dashboardState,
      activeBooking,
      queueStatus,
      procurement,
      payment,
      recentNotifications,
    };
  }

  public async simulateStateTransition(state: FarmerDashboardStageType): Promise<void> {
    const farmer = dataStore.getCurrentFarmer();
    if (!farmer) return;
    let booking = await this.getActiveBooking(farmer.id);

    if (state === 'NO_BOOKING') {
      if (booking) {
        dataStore.deleteBooking(booking.id);
      }
      return;
    }

    if (!booking) {
      const eligibleCentres = farmer.districtId
        ? dataStore.getCentresByDistrict(farmer.districtId)
        : dataStore.getCentres();
      const targetCentre = eligibleCentres[0] || dataStore.getCentres()[0];
      booking = await this.createBooking({
        cropId: 'crop-wheat',
        quantityKg: 600,
        centreId: targetCentre?.id || (dataStore.getCentres()[0]?.id ?? ''),
        slotId: 'slot-1100',
        date: 'Today, 05 Sep 2026',
        timeWindow: '11:00 AM – 11:30 AM',
      });
    }

    switch (state) {
      case 'UPCOMING_BOOKING':
        dataStore.updateBooking(booking.id, {
          currentStage: 'BOOKED',
          status: 'confirmed',
          date: 'Tomorrow, 06 Sep 2026',
        });
        break;

      case 'IN_VIRTUAL_QUEUE':
        dataStore.updateBooking(booking.id, {
          currentStage: 'BOOKED',
          status: 'confirmed',
          date: 'Today, 05 Sep 2026',
        });
        dataStore.updateQueueEntry(booking.id, {
          currentToken: Math.max(1, booking.tokenNumber - 8),
          farmersAhead: 8,
          isTurnApproaching: false,
        });
        break;

      case 'TURN_APPROACHING':
        dataStore.updateBooking(booking.id, {
          currentStage: 'BOOKED',
          status: 'confirmed',
          date: 'Today, 05 Sep 2026',
        });
        dataStore.updateQueueEntry(booking.id, {
          currentToken: booking.tokenNumber - 1,
          farmersAhead: 1,
          isTurnApproaching: true,
        });
        break;

      case 'PROCUREMENT_IN_PROGRESS':
        await procurementService.transitionStage(booking.id, 'QUALITY_CHECK');
        break;

      case 'PROCUREMENT_COMPLETED':
      case 'PAYMENT_PENDING':
        await procurementService.recordWeighing(booking.id, 600);
        await procurementService.transitionStage(booking.id, 'COMPLETED');
        break;

      case 'PAYMENT_COMPLETED':
        await procurementService.recordWeighing(booking.id, 600);
        await procurementService.transitionStage(booking.id, 'COMPLETED');
        const prc = await procurementService.getProcurementByBookingId(booking.id);
        if (prc) {
          await paymentService.updatePaymentStatus(prc.id, 'PAID');
        }
        break;
    }
  }

  public subscribe(listener: () => void): () => void {
    return dataStore.subscribe(listener);
  }
}

export const farmerService = new FarmerService();
export const getCurrentFarmer = () => farmerService.getCurrentFarmer();
export const getAllFarmers = () => farmerService.getAllFarmers();
export const registerFarmer = (p: Partial<Farmer>) => farmerService.registerFarmer(p);
export const switchFarmer = (id: string) => farmerService.switchFarmer(id);
export const getCrops = () => farmerService.getCrops();
export const getCentres = () => farmerService.getCentres();
export const getSmartRecommendations = (cId: string, crId: string, q: number, date?: string) =>
  farmerService.getSmartRecommendations(cId, crId, q, date);
export const createBooking = (p: CreateBookingParams) => farmerService.createBooking(p);
export const getActiveBooking = (fId: string) => farmerService.getActiveBooking(fId);
export const getFarmerBookings = (fId: string) => farmerService.getFarmerBookings(fId);
export const getFarmerDashboardData = (fId?: string) => farmerService.getFarmerDashboardData(fId);
export const simulateStateTransition = (state: FarmerDashboardStageType) =>
  farmerService.simulateStateTransition(state);
export const subscribeToFarmerUpdates = (fn: () => void) => farmerService.subscribe(fn);
