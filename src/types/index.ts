export type UserRole = 'farmer' | 'officer' | 'admin';

export type LanguageCode = 'en' | 'hi' | 'kn';

// 1. Farmer Entity
export interface Farmer {
  id: string;
  mobileNumber: string;
  name: string;
  nameHindi?: string;
  languagePref: LanguageCode;
  aadhaarNumber?: string;
  address: string;
  village?: string;
  district: string;
  state: string;
  stateId?: string;
  districtId?: string;
  centreId?: string;
  landAreaAcres?: number;
  bankAccountMasked?: string;
  createdAt: string;
}

// 2. Crop Entity
export interface Crop {
  id: string;
  name: string;
  nameHindi: string;
  baseProcessingTimeMin: number;
  throughputRateKgPerMin: number;
  mspPerQuintal: number;
}

// 2.5 Geographic Master Entities
export interface State {
  id: string;
  name: string;
  code: string;
  type?: 'STATE' | 'UNION_TERRITORY';
  isActive?: boolean;
}

export interface District {
  id: string;
  stateId: string;
  name: string;
  code: string;
  isActive?: boolean;
}

// 3. Procurement Centre Entity
export type CentreOperationalStatus =
  | 'OPERATIONAL'
  | 'CLOSED'
  | 'MAINTENANCE'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'OPEN'
  | 'DELAYED';

export interface ProcurementCentre {
  id: string;
  districtId: string;
  stateId?: string;
  name: string;
  code?: string;
  address?: string;
  district?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  dailyCapacityMT?: number;
  capacityPerHourKg: number;
  openingTime?: string;
  closingTime?: string;
  workingHours?: {
    start: string;
    end: string;
  };
  activeGates?: number;
  activeWeighbridges?: number;
  currentDelayMinutes: number;
  distanceKm?: number;
  activeOfficerName?: string;
  congestionLevel?: 'Low' | 'Moderate' | 'High';
  avgWaitTimeMin?: number;
  capacityAvailablePercent?: number;
  operationalStatus?: CentreOperationalStatus;
  isActive?: boolean;
  contactPhone?: string;
}

// 4. Slot Entity
export type SlotStatus = 'AVAILABLE' | 'FILLING_FAST' | 'FULL';

export interface Slot {
  id: string;
  centreId: string;
  date: string;
  startTime: string;
  endTime: string;
  start?: string;
  end?: string;
  timeWindow?: string;
  slotLoadMinutes?: number;
  effectiveCapacityMinutes?: number;
  congestionScore?: number;
  status: SlotStatus;
  isRecommended?: boolean;
  reasons?: string[];
  estimatedWaitMinutes?: number;
}

export interface SlotRecommendation {
  id: string;
  slotId?: string;
  centreId: string;
  date: string;
  startTime: string;
  endTime: string;
  start?: string;
  end?: string;
  timeWindow: string;
  status: 'Available' | 'Almost Full' | 'Busy';
  statusCode: 'AVAILABLE' | 'ALMOST_FULL' | 'BUSY';
  isRecommended: boolean;
  estimatedWaitMinutes: number;
  availableCapacityPercent?: number;
  suitabilityScore?: number;
  reasons: string[];
}

// 5. Procurement Stages & Booking Entity
export type ProcurementStage =
  | 'BOOKED'
  | 'ARRIVED'
  | 'CHECKED_IN'
  | 'WAITING'
  | 'NOW_SERVING'
  | 'VERIFICATION'
  | 'QUALITY_CHECK'
  | 'WEIGHING'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED';

export interface Officer {
  id: string;
  name: string;
  email: string;
  mobile: string;
  stateId?: string;
  districtId?: string;
  centreId: string;
  centreName: string;
  deskNumber: string;
  role: string;
}

export interface CentreStats {
  todayBookingsCount: number;
  currentlyWaitingCount: number;
  completedTodayCount: number;
  avgWaitTimeMin: number;
  noShowCount: number;
  totalQuantityProcuredKg: number;
  currentDelayMinutes: number;
  currentToken: number;
  capacity?: number;
  totalDisbursedAmount?: number;
  pendingDisbursementAmount?: number;
}

export type BookingStatus = 'confirmed' | 'rescheduled' | 'cancelled' | 'no_show' | 'completed';

export interface Booking {
  id: string;
  tokenNumber: number;
  farmerId: string;
  farmerName: string;
  farmerMobile: string;
  stateId?: string;
  districtId?: string;
  centreId: string;
  centreName: string;
  cropId: string;
  cropName: string;
  cropNameHindi?: string;
  quantityKg: number;
  slotId: string;
  date: string;
  timeWindow: string;
  status: BookingStatus;
  currentStage: ProcurementStage;
  stageTimestamps: Partial<Record<ProcurementStage, string>>;
  qualityGrade?: 'Grade A' | 'Grade B' | 'Grade C';
  acceptedQuantityKg?: number;
  actualWeightKg?: number;
  rejectionReason?: string;
  remarks?: string;
  priorityFlag: boolean;
  estimatedArrivalNotice?: string;
}

// 6. Queue Entry Entity (Real-time virtual queue position)
export interface QueueEntry {
  id: string;
  bookingId: string;
  centreId: string;
  tokenNumber: number;
  currentToken: number;
  farmersAhead: number;
  estimatedWaitingMinutes: number;
  currentDelayMinutes: number;
  recommendedArrivalTime?: string;
  isQueueActive: boolean;
  isTurnApproaching: boolean;
  lastUpdated: string;
  totalInitialDistance?: number;
}

export type QueueVisualState =
  | 'QUEUE_NOT_STARTED'
  | 'WAITING'
  | 'APPROACHING'
  | 'NEXT_IN_QUEUE'
  | 'NOW_SERVING'
  | 'DELAYED'
  | 'MISSED'
  | 'COMPLETED';

export interface LiveQueueScreenData {
  farmerTokenNumber: number;
  currentToken: number;
  farmersAhead: number;
  queuePosition: number;
  estimatedWaitMinutes: number;
  originalArrivalTime: string;
  recommendedArrivalTime: string;
  bookedSlot: string;
  centreName: string;
  centreId: string;
  todayDate: string;
  lastUpdated: string;
  delayMinutes: number;
  queueState: QueueVisualState;
  booking: Booking;
  totalInitialQueueLength: number;
}

// 7. Procurement Result Entity
export interface Procurement {
  id: string;
  bookingId: string;
  cropId: string;
  cropName: string;
  bookedQuantityKg: number;
  acceptedQuantityKg: number;
  qualityGrade: 'Grade A' | 'Grade B' | 'Grade C';
  officerId: string;
  officerName: string;
  completedAt: string;
  mspRatePerQuintal: number;
  totalGrossAmount: number;
  deductions?: number;
  netPayableAmount: number;
  actualWeightKg?: number;
  remarks?: string;
}

// 8. Payment Tracking Entity
export type PaymentStatus = 'PENDING' | 'INITIATED' | 'PAID';

export interface Payment {
  id: string;
  procurementId: string;
  bookingId: string;
  farmerId: string;
  amount: number;
  status: PaymentStatus;
  referenceId?: string;
  paymentMode?: string; // e.g. 'DBT / PFMS'
  initiatedAt?: string;
  paidAt?: string;
  bankAccountMasked?: string;
  statusMessage?: string;
}

// 9. Notification Entity
export type NotificationType = 'booking' | 'eta' | 'delay' | 'status' | 'payment';

export interface Notification {
  id: string;
  farmerId: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionRoute?: string;
}

// 10. Aggregated Dashboard State
export type FarmerDashboardStageType =
  | 'NO_BOOKING'
  | 'UPCOMING_BOOKING'
  | 'IN_VIRTUAL_QUEUE'
  | 'TURN_APPROACHING'
  | 'PROCUREMENT_IN_PROGRESS'
  | 'PROCUREMENT_COMPLETED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_COMPLETED';

export interface LiveQueueState {
  centreId: string;
  centreName: string;
  currentToken: number;
  farmersAhead: number;
  estimatedWaitingMinutes: number;
  currentDelayMinutes: number;
  recommendedArrivalTime?: string;
  lastUpdated: string;
}

export interface FarmerDashboardData {
  farmer: Farmer | null;
  dashboardState: FarmerDashboardStageType;
  activeBooking: Booking | null;
  queueStatus: QueueEntry | null;
  procurement: Procurement | null;
  payment: Payment | null;
  recentNotifications: Notification[];
}

// 11. Hierarchical Admin Scopes & Users
export type AdminScopeType = 'NATIONAL' | 'STATE' | 'DISTRICT' | 'CENTRE';
export type AdminRole = 'NATIONAL_ADMIN' | 'STATE_ADMIN' | 'DISTRICT_ADMIN' | 'CENTRE_OFFICER';

export interface AdminUser {
  id: string;
  name: string;
  email?: string;
  role: AdminRole;
  scopeType: AdminScopeType;
  scopeId?: string; // stateId, districtId, or centreId
  scopeValue?: string;
  scopeName?: string;
  stateId?: string;
  districtId?: string;
  centreId?: string;
}

// Unified User Concept for scalable geographic scoping
export interface User {
  id: string;
  name: string;
  email?: string;
  role: 'FARMER' | 'OFFICER' | 'DISTRICT_ADMIN' | 'STATE_ADMIN' | 'NATIONAL_ADMIN';
  stateId?: string;
  districtId?: string;
  centreId?: string;
}

// 12. Hierarchical Geographic Analytics Interfaces
export interface NationalStats {
  totalStates: number;
  totalDistricts: number;
  totalCentres: number;
  activeCentres: number;
  totalRegisteredFarmers: number;
  totalBookingsToday: number;
  currentlyWaiting: number;
  completedToday: number;
  totalProcuredTonnes: number;
  totalDisbursedAmount: number;
  pendingDisbursementAmount: number;
  nationalAvgWaitTimeMin: number;
  stateSummaries: {
    stateId: string;
    stateName: string;
    stateCode: string;
    totalDistricts: number;
    totalCentres: number;
    activeCentres: number;
    totalBookingsToday: number;
    currentlyWaiting: number;
    completedToday: number;
    totalProcuredTonnes: number;
    totalDisbursedAmount: number;
    pendingDisbursementAmount: number;
    avgWaitTimeMin: number;
  }[];
}

export interface StateStats {
  stateId: string;
  stateName: string;
  totalDistricts: number;
  totalCentres: number;
  activeCentres: number;
  totalBookingsToday: number;
  currentlyWaiting: number;
  completedToday: number;
  totalProcuredKg: number;
  totalDisbursedAmount: number;
  pendingDisbursementAmount: number;
  avgWaitTimeMin: number;
  districtSummaries: {
    districtId: string;
    districtName: string;
    districtCode: string;
    totalCentres: number;
    activeCentres: number;
    totalBookingsToday: number;
    currentlyWaiting: number;
    completedToday: number;
    totalProcuredKg: number;
    totalDisbursedAmount: number;
    pendingDisbursementAmount: number;
    avgWaitTimeMin: number;
  }[];
}

export interface DistrictStats {
  districtId: string;
  districtName: string;
  stateId: string;
  totalCentres: number;
  activeCentres: number;
  totalBookingsToday: number;
  currentlyWaiting: number;
  completedToday: number;
  totalProcuredKg: number;
  totalDisbursedAmount: number;
  pendingDisbursementAmount: number;
  avgWaitTimeMin: number;
  centreSummaries: (CentreStats & {
    centreId: string;
    centreName: string;
    centreCode: string;
    status: string;
    capacity: number;
    capacityUtilization: number;
    totalDisbursedAmount: number;
    pendingDisbursementAmount: number;
  })[];
}
