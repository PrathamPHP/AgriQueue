/**
 * AgriQueue Central Data Store
 * Normalized, reactive, persistent single source of truth for the SIH prototype.
 * Clean, production-ready state with ZERO hardcoded demo transactions.
 */

import {
  Farmer,
  ProcurementCentre,
  Crop,
  Booking,
  QueueEntry,
  Procurement,
  Payment,
  Notification,
  Officer,
  State,
  District,
  AdminUser,
} from '@/types';
import { storageService } from './storageService';
import { apiClient } from './apiClient';
import {
  SEED_STATES,
  SEED_DISTRICTS,
  SEED_CENTRES,
  SEED_CROPS,
  SEED_OFFICERS,
  SEED_ADMINS,
} from './seedData';

export const AGRIQUEUE_SCHEMA_VERSION = 'v5_nationwide_scalable';

class DataStore {
  private states: State[] = [];
  private districts: District[] = [];
  private centres: ProcurementCentre[] = [];
  private crops: Crop[] = [];
  private farmers: Farmer[] = [];
  private currentFarmerId: string = '';
  private officers: Officer[] = [];
  private currentOfficerId: string = 'off-sunita';
  private adminUsers: AdminUser[] = [];
  private currentAdminId: string = 'admin-national';
  private bookings: Booking[] = [];
  private queueEntries: Record<string, QueueEntry> = {};
  private procurements: Record<string, Procurement> = {};
  private payments: Record<string, Payment> = {};
  private notifications: Notification[] = [];

  private subscribers: Set<() => void> = new Set();

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // 1. Synchronous bootstrap from structured seed constants for zero-flicker startup
    this.states = JSON.parse(JSON.stringify(SEED_STATES));
    this.districts = JSON.parse(JSON.stringify(SEED_DISTRICTS));
    this.centres = JSON.parse(JSON.stringify(SEED_CENTRES));
    this.crops = JSON.parse(JSON.stringify(SEED_CROPS));
    this.officers = JSON.parse(JSON.stringify(SEED_OFFICERS));
    this.adminUsers = JSON.parse(JSON.stringify(SEED_ADMINS));

    // 2. Only active persona preferences are read from storage
    this.currentFarmerId = storageService.get<string>('currentFarmerId', '');
    this.currentOfficerId = storageService.get<string>('currentOfficerId', 'off-sunita');
    this.currentAdminId = storageService.get<string>('currentAdminId', 'admin-national');
    this.farmers = [];
    this.bookings = [];
    this.queueEntries = {};
    this.procurements = {};
    this.payments = {};
    this.notifications = [];

    // 3. Immediately trigger authoritative asynchronous sync from PostgreSQL REST API
    this.syncFromBackend().catch((err) => {
      console.warn('[DataStore] Backend initial sync notice:', err?.message || err);
    });
  }

  /**
   * Authoritatively syncs in-memory data structures from PostgreSQL REST API.
   */
  public async syncFromBackend(): Promise<void> {
    try {
      const [statesRes, districtsRes, centresRes, cropsRes, farmersRes, officersRes, adminsRes, paymentsRes, bookingsRes] =
        await Promise.all([
          apiClient.get<any[]>('/states').catch(() => []),
          apiClient.get<any[]>('/districts').catch(() => []),
          apiClient.get<any[]>('/centres').catch(() => []),
          apiClient.get<any[]>('/crops').catch(() => []),
          apiClient.get<any[]>('/farmers').catch(() => []),
          apiClient.get<any[]>('/officers').catch(() => []),
          apiClient.get<any[]>('/admins').catch(() => []),
          apiClient.get<any[]>('/payments').catch(() => []),
          apiClient.get<any[]>('/bookings').catch(() => []),
        ]);

      if (Array.isArray(statesRes) && statesRes.length > 0) this.states = statesRes;
      if (Array.isArray(districtsRes) && districtsRes.length > 0) this.districts = districtsRes;
      if (Array.isArray(centresRes) && centresRes.length > 0) this.centres = centresRes;
      if (Array.isArray(cropsRes) && cropsRes.length > 0) this.crops = cropsRes;
      if (Array.isArray(farmersRes)) {
        this.farmers = farmersRes;
        if (!this.currentFarmerId && farmersRes.length > 0) {
          this.currentFarmerId = farmersRes[0].id;
        }
      }
      if (Array.isArray(officersRes) && officersRes.length > 0) this.officers = officersRes;
      if (Array.isArray(adminsRes) && adminsRes.length > 0) this.adminUsers = adminsRes;

      // Sync bookings, queues, procurements from PostgreSQL
      if (Array.isArray(bookingsRes)) {
        const queueMap: Record<string, QueueEntry> = {};
        const procMap: Record<string, Procurement> = {};
        for (const b of bookingsRes) {
          if ((b as any).queueEntry) {
            queueMap[b.id] = (b as any).queueEntry;
          }
          if ((b as any).procurement) {
            procMap[b.id] = (b as any).procurement;
          }
        }
        this.bookings = bookingsRes;
        this.queueEntries = queueMap;
        this.procurements = procMap;
      }

      if (Array.isArray(paymentsRes) && paymentsRes.length > 0) {
        const payMap: Record<string, Payment> = {};
        for (const p of paymentsRes) {
          payMap[p.procurementId || p.id] = p;
        }
        this.payments = payMap;
      }

      if (this.currentFarmerId) {
        try {
          const notifs = await apiClient.get<Notification[]>(`/farmers/${this.currentFarmerId}/notifications`);
          if (Array.isArray(notifs)) {
            this.notifications = notifs;
          }
        } catch {}
      }

      this.notify();
    } catch (err) {
      console.warn('[DataStore] syncFromBackend error:', err);
    }
  }

  /**
   * Resets local UI cache and triggers fresh sync from backend.
   */
  public resetApplicationData(): void {
    this.states = JSON.parse(JSON.stringify(SEED_STATES));
    this.districts = JSON.parse(JSON.stringify(SEED_DISTRICTS));
    this.centres = JSON.parse(JSON.stringify(SEED_CENTRES));
    this.crops = JSON.parse(JSON.stringify(SEED_CROPS));
    this.officers = JSON.parse(JSON.stringify(SEED_OFFICERS));
    this.adminUsers = JSON.parse(JSON.stringify(SEED_ADMINS));
    this.farmers = [];
    this.bookings = [];
    this.queueEntries = {};
    this.procurements = {};
    this.payments = {};
    this.notifications = [];

    this.persist();
    this.syncFromBackend();
    this.notify();
  }

  public resetToSeedData(): void {
    this.resetApplicationData();
  }

  /**
   * Validates full relational integrity across all geographic, user, and transaction entities.
   * Returns validation status and detailed error list if any broken foreign keys are found.
   */
  public validateDataIntegrity(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const stateIdSet = new Set(this.states.map((s) => s.id));
    const districtIdSet = new Set(this.districts.map((d) => d.id));
    const centreIdSet = new Set(this.centres.map((c) => c.id));
    const cropIdSet = new Set(this.crops.map((c) => c.id));
    const farmerIdSet = new Set(this.farmers.map((f) => f.id));

    // 1. Districts -> States
    for (const district of this.districts) {
      if (!stateIdSet.has(district.stateId)) {
        errors.push(`District '${district.id}' (${district.name}) references invalid stateId '${district.stateId}'`);
      }
    }

    // 2. Centres -> Districts & States
    for (const centre of this.centres) {
      if (!districtIdSet.has(centre.districtId)) {
        errors.push(`Centre '${centre.id}' (${centre.name}) references invalid districtId '${centre.districtId}'`);
      }
      if (centre.stateId && !stateIdSet.has(centre.stateId)) {
        errors.push(`Centre '${centre.id}' (${centre.name}) references invalid stateId '${centre.stateId}'`);
      }
    }

    // 3. Officers -> Centres
    for (const officer of this.officers) {
      if (!centreIdSet.has(officer.centreId)) {
        errors.push(`Officer '${officer.id}' (${officer.name}) references invalid centreId '${officer.centreId}'`);
      }
    }

    // 4. Admin Users -> States / Districts
    for (const admin of this.adminUsers) {
      if (admin.role === 'STATE_ADMIN' && admin.stateId && !stateIdSet.has(admin.stateId)) {
        errors.push(`State Admin '${admin.id}' (${admin.name}) references invalid stateId '${admin.stateId}'`);
      }
      if (admin.role === 'DISTRICT_ADMIN' && admin.districtId && !districtIdSet.has(admin.districtId)) {
        errors.push(`District Admin '${admin.id}' (${admin.name}) references invalid districtId '${admin.districtId}'`);
      }
    }

    // 5. Bookings -> Farmers, Centres, Crops
    for (const booking of this.bookings) {
      if (!farmerIdSet.has(booking.farmerId)) {
        errors.push(`Booking '${booking.id}' references non-existent farmerId '${booking.farmerId}'`);
      }
      if (!centreIdSet.has(booking.centreId)) {
        errors.push(`Booking '${booking.id}' references non-existent centreId '${booking.centreId}'`);
      }
      if (!cropIdSet.has(booking.cropId)) {
        errors.push(`Booking '${booking.id}' references non-existent cropId '${booking.cropId}'`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private persist(): void {
    if (this.currentFarmerId) {
      storageService.set('currentFarmerId', this.currentFarmerId);
    } else {
      storageService.remove('currentFarmerId');
    }
    if (this.currentOfficerId) {
      storageService.set('currentOfficerId', this.currentOfficerId);
    } else {
      storageService.remove('currentOfficerId');
    }
    if (this.currentAdminId) {
      storageService.set('currentAdminId', this.currentAdminId);
    } else {
      storageService.remove('currentAdminId');
    }
  }

  public subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  public notify(): void {
    this.persist();
    this.subscribers.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('[DataStore] Error in subscriber listener:', err);
      }
    });
  }

  // --- Farmers ---
  public getFarmers(): Farmer[] {
    return [...this.farmers];
  }

  public isFarmerAuthenticated(): boolean {
    return !!this.currentFarmerId && this.farmers.some((f) => f.id === this.currentFarmerId);
  }

  public logoutFarmer(): void {
    this.currentFarmerId = '';
    storageService.remove('currentFarmerId');
    this.notify();
  }

  public isOfficerAuthenticated(): boolean {
    return !!this.currentOfficerId;
  }

  public logoutOfficer(): void {
    this.currentOfficerId = '';
    storageService.remove('currentOfficerId');
    this.notify();
  }

  public isAdminAuthenticated(): boolean {
    return !!this.currentAdminId;
  }

  public logoutAdmin(): void {
    this.currentAdminId = '';
    storageService.remove('currentAdminId');
    this.notify();
  }

  public getCurrentFarmer(): Farmer | null {
    if (!this.currentFarmerId) {
      return null;
    }
    const farmer = this.farmers.find((f) => f.id === this.currentFarmerId);
    return farmer ? { ...farmer } : null;
  }

  public setCurrentFarmerId(id: string): void {
    const exists = this.farmers.find((f) => f.id === id);
    if (exists) {
      this.currentFarmerId = id;
      storageService.set('currentFarmerId', id);
      this.notify();
    }
  }

  public addFarmer(farmer: Farmer, shouldNotify: boolean = true): void {
    const idx = this.farmers.findIndex((f) => f.id === farmer.id);
    if (idx >= 0) {
      this.farmers[idx] = farmer;
    } else {
      this.farmers.push(farmer);
    }
    this.currentFarmerId = farmer.id;
    storageService.set('farmers', this.farmers);
    storageService.set('currentFarmerId', farmer.id);
    if (shouldNotify) {
      this.notify();
    }
  }

  public upsertFarmers(farmersList: Farmer[], shouldNotify: boolean = false): void {
    const map = new Map<string, Farmer>();
    for (const f of this.farmers) {
      map.set(f.id, f);
    }
    for (const f of farmersList) {
      map.set(f.id, f);
    }
    this.farmers = Array.from(map.values());
    storageService.set('farmers', this.farmers);
    if (shouldNotify) {
      this.notify();
    }
  }

  // --- Geographic Hierarchy ---
  public getStates(): State[] {
    return [...this.states];
  }

  public getStateById(id: string): State | undefined {
    const s = this.states.find((x) => x.id === id);
    return s ? { ...s } : undefined;
  }

  public getDistricts(stateId?: string): District[] {
    if (stateId) {
      return this.districts.filter((d) => d.stateId === stateId).map((d) => ({ ...d }));
    }
    return [...this.districts];
  }

  public getDistrictById(id: string): District | undefined {
    const d = this.districts.find((x) => x.id === id);
    return d ? { ...d } : undefined;
  }

  public getCentresByDistrict(districtId: string): ProcurementCentre[] {
    return this.centres.filter((c) => c.districtId === districtId).map((c) => ({ ...c }));
  }

  public getCentresByState(stateId: string): ProcurementCentre[] {
    const districtIds = new Set(this.districts.filter((d) => d.stateId === stateId).map((d) => d.id));
    return this.centres
      .filter((c) => c.stateId === stateId || (c.districtId && districtIds.has(c.districtId)))
      .map((c) => ({ ...c }));
  }

  // --- Admin Users ---
  public getAdminUsers(): AdminUser[] {
    return [...this.adminUsers];
  }

  public getCurrentAdmin(): AdminUser {
    const admin = this.adminUsers.find((a) => a.id === this.currentAdminId);
    return admin ? { ...admin } : { ...this.adminUsers[0] };
  }

  public setCurrentAdminId(id: string): void {
    const exists = this.adminUsers.find((a) => a.id === id);
    if (exists) {
      this.currentAdminId = id;
      this.notify();
    }
  }

  // --- Officers ---
  public getOfficers(): Officer[] {
    return [...this.officers];
  }

  public getOfficersByCentre(centreId: string): Officer[] {
    return this.officers.filter((o) => o.centreId === centreId).map((o) => ({ ...o }));
  }

  public getCurrentOfficer(): Officer {
    const officer = this.officers.find((o) => o.id === this.currentOfficerId);
    return officer ? { ...officer } : { ...this.officers[0] };
  }

  public setCurrentOfficerId(id: string): void {
    const exists = this.officers.find((o) => o.id === id);
    if (exists) {
      this.currentOfficerId = id;
      this.notify();
    }
  }

  public updateOfficer(id: string, patch: Partial<Officer>): void {
    this.officers = this.officers.map((o) => (o.id === id ? { ...o, ...patch } : o));
    this.notify();
  }

  public setOfficerCentre(centreId: string): void {
    const centre = this.getCentreById(centreId);
    if (!centre) return;
    const matchingOfficer = this.officers.find((o) => o.centreId === centreId);
    if (matchingOfficer) {
      this.currentOfficerId = matchingOfficer.id;
    } else {
      const current = this.getCurrentOfficer();
      this.updateOfficer(current.id, {
        centreId: centre.id,
        centreName: centre.name,
        stateId: centre.stateId,
        districtId: centre.districtId,
      });
    }
    this.notify();
  }

  // --- Farmers Query Helpers ---
  public getFarmersByDistrict(districtId: string): Farmer[] {
    return this.farmers.filter((f) => f.districtId === districtId).map((f) => ({ ...f }));
  }

  public getFarmersByState(stateId: string): Farmer[] {
    return this.farmers.filter((f) => f.stateId === stateId).map((f) => ({ ...f }));
  }

  // --- Centres ---
  public getCentres(): ProcurementCentre[] {
    return [...this.centres];
  }

  public getCentreById(id: string): ProcurementCentre | undefined {
    const c = this.centres.find((x) => x.id === id);
    return c ? { ...c } : undefined;
  }

  public updateCentre(id: string, patch: Partial<ProcurementCentre>): void {
    this.centres = this.centres.map((c) => (c.id === id ? { ...c, ...patch } : c));
    this.notify();
  }

  // --- Crops ---
  public getCrops(): Crop[] {
    return [...this.crops];
  }

  public getCropById(id: string): Crop | undefined {
    const c = this.crops.find((x) => x.id === id);
    return c ? { ...c } : undefined;
  }

  // --- Bookings ---
  public getBookings(): Booking[] {
    return [...this.bookings];
  }

  public getBookingsByFarmer(farmerId: string): Booking[] {
    return this.bookings.filter((b) => b.farmerId === farmerId).map((b) => ({ ...b }));
  }

  public getBookingById(id: string): Booking | undefined {
    const b = this.bookings.find((x) => x.id === id);
    return b ? { ...b } : undefined;
  }

  public addBooking(booking: Booking, shouldNotify: boolean = true): void {
    const idx = this.bookings.findIndex((b) => b.id === booking.id);
    if (idx >= 0) {
      this.bookings[idx] = booking;
    } else {
      this.bookings.unshift(booking);
    }
    if (shouldNotify) {
      this.notify();
    }
  }

  public upsertBookings(bookingsList: Booking[], shouldNotify: boolean = false): void {
    const map = new Map<string, Booking>();
    for (const b of this.bookings) {
      map.set(b.id, b);
    }
    for (const b of bookingsList) {
      map.set(b.id, b);
    }
    this.bookings = Array.from(map.values()).sort((a, b) => (b.tokenNumber || 0) - (a.tokenNumber || 0));
    if (shouldNotify) {
      this.notify();
    }
  }

  public updateBooking(id: string, patch: Partial<Booking>): void {
    this.bookings = this.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b));
    this.notify();
  }

  public deleteBooking(id: string): void {
    this.bookings = this.bookings.filter((b) => b.id !== id);
    delete this.queueEntries[id];
    delete this.procurements[id];
    this.notify();
  }

  // --- Queue Entries ---
  public getQueueEntries(): Record<string, QueueEntry> {
    return { ...this.queueEntries };
  }

  public getQueueEntry(bookingId: string): QueueEntry | undefined {
    const q = this.queueEntries[bookingId];
    return q ? { ...q } : undefined;
  }

  public setQueueEntry(bookingId: string, entry: QueueEntry, shouldNotify: boolean = true): void {
    this.queueEntries[bookingId] = entry;
    if (shouldNotify) this.notify();
  }

  public updateQueueEntry(bookingId: string, patch: Partial<QueueEntry>): void {
    if (this.queueEntries[bookingId]) {
      this.queueEntries[bookingId] = { ...this.queueEntries[bookingId], ...patch };
      this.notify();
    }
  }

  // --- Procurements ---
  public getProcurements(): Record<string, Procurement> {
    return { ...this.procurements };
  }

  public getProcurement(bookingId: string): Procurement | undefined {
    const p = this.procurements[bookingId];
    return p ? { ...p } : undefined;
  }

  public setProcurement(bookingId: string, prc: Procurement, shouldNotify: boolean = true): void {
    this.procurements[bookingId] = prc;
    if (shouldNotify) this.notify();
  }

  public updateProcurement(bookingId: string, patch: Partial<Procurement>): void {
    if (this.procurements[bookingId]) {
      this.procurements[bookingId] = { ...this.procurements[bookingId], ...patch };
      this.notify();
    }
  }

  // --- Payments ---
  public getPayments(): Record<string, Payment> {
    return { ...this.payments };
  }

  public getPayment(procurementId: string): Payment | undefined {
    const pay = this.payments[procurementId];
    return pay ? { ...pay } : undefined;
  }

  public setPayment(procurementId: string, pay: Payment, shouldNotify: boolean = true): void {
    this.payments[procurementId] = pay;
    if (shouldNotify) this.notify();
  }

  public upsertPayments(paymentsList: Payment[], shouldNotify: boolean = false): void {
    for (const p of paymentsList) {
      this.payments[p.procurementId || p.id] = p;
    }
    if (shouldNotify) this.notify();
  }

  public updatePayment(procurementId: string, patch: Partial<Payment>): void {
    if (this.payments[procurementId]) {
      this.payments[procurementId] = { ...this.payments[procurementId], ...patch };
      this.notify();
    }
  }

  // --- Notifications ---
  public getNotifications(): Notification[] {
    return [...this.notifications];
  }

  public addNotification(notif: Notification): void {
    this.notifications.unshift(notif);
    this.notify();
  }

  public markNotificationRead(id: string): void {
    this.notifications = this.notifications.map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    this.notify();
  }
}

export const dataStore = new DataStore();
