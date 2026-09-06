/**
 * AgriQueue Procurement Service
 * Handles operational procurement workflows: Gate Check-in, Verification,
 * Quality Assessment (Grade A/B/C), Digital Weighbridge, Receipt generation,
 * and automatic PFMS payment initiation.
 */

import {
  Procurement,
  Booking,
  ProcurementStage,
  Payment,
} from '@/types';
import { dataStore } from './dataStore';
import { apiClient } from './apiClient';

class ProcurementService {
  public async getProcurementByBookingId(bookingId: string): Promise<Procurement | null> {
    try {
      const prc = await apiClient.get<Procurement>(`/procurements/${bookingId}`);
      if (prc) {
        dataStore.setProcurement(bookingId, prc, false);
        return prc;
      }
    } catch {
      // Fallback to local store
    }

    const existing = dataStore.getProcurement(bookingId);
    if (existing) return existing;

    const booking = dataStore.getBookingById(bookingId);
    if (!booking) return null;

    const crop = dataStore.getCropById(booking.cropId);
    const msp = crop?.mspPerQuintal || 2275;
    const acceptedQty = booking.acceptedQuantityKg || booking.quantityKg;
    const totalAmount = Math.round((acceptedQty / 100) * msp);

    const officer = dataStore.getCurrentOfficer();

    const newProcurement: Procurement = {
      id: `prc-${booking.id.replace('book-', '')}`,
      bookingId: booking.id,
      cropId: booking.cropId,
      cropName: booking.cropName,
      bookedQuantityKg: booking.quantityKg,
      acceptedQuantityKg: acceptedQty,
      actualWeightKg: booking.actualWeightKg || acceptedQty,
      qualityGrade: booking.qualityGrade || 'Grade A',
      remarks: booking.remarks || 'Produce verified against FCI / Agmarknet Grade standards',
      officerId: officer.id,
      officerName: officer.name,
      completedAt: new Date().toISOString(),
      mspRatePerQuintal: msp,
      totalGrossAmount: totalAmount,
      deductions: 0,
      netPayableAmount: totalAmount,
    };

    dataStore.setProcurement(booking.id, newProcurement);
    return newProcurement;
  }

  public async transitionStage(
    bookingId: string,
    targetStage: ProcurementStage,
    metadata?: Partial<Procurement>
  ): Promise<Booking> {
    const booking = dataStore.getBookingById(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const updatedTimestamps = {
      ...booking.stageTimestamps,
      [targetStage]: timeStr,
    };

    const bookingStatus =
      targetStage === 'COMPLETED'
        ? 'completed'
        : targetStage === 'NO_SHOW'
        ? 'no_show'
        : targetStage === 'CANCELLED'
        ? 'cancelled'
        : 'confirmed';

    // Call authoritative PostgreSQL backend endpoints
    try {
      if (targetStage === 'ARRIVED' || targetStage === 'CHECKED_IN' || targetStage === 'VERIFICATION') {
        await apiClient.post('/procurement/check-in', { bookingId });
      } else if (targetStage === 'QUALITY_CHECK') {
        await apiClient.post('/procurement/qc', {
          bookingId,
          qualityGrade: metadata?.qualityGrade,
          remarks: metadata?.remarks,
        });
      } else if (targetStage === 'WEIGHING' || targetStage === 'COMPLETED') {
        await apiClient.post('/procurement/weighbridge', {
          bookingId,
          actualWeightKg: metadata?.actualWeightKg,
          qualityGrade: metadata?.qualityGrade,
          remarks: metadata?.remarks,
          deductions: metadata?.deductions,
        });
      }
    } catch (apiErr) {
      console.warn('[ProcurementService] Backend stage transition sync error:', apiErr);
    }

    dataStore.updateBooking(bookingId, {
      currentStage: targetStage,
      stageTimestamps: updatedTimestamps,
      status: bookingStatus,
      ...(metadata?.qualityGrade ? { qualityGrade: metadata.qualityGrade } : {}),
      ...(metadata?.acceptedQuantityKg ? { acceptedQuantityKg: metadata.acceptedQuantityKg } : {}),
      ...(metadata?.actualWeightKg ? { actualWeightKg: metadata.actualWeightKg } : {}),
      ...(metadata?.remarks ? { remarks: metadata.remarks } : {}),
    });

    // Update Queue Entry
    const queueEntry = dataStore.getQueueEntry(bookingId);
    if (queueEntry) {
      if (targetStage === 'ARRIVED' || targetStage === 'CHECKED_IN') {
        dataStore.updateQueueEntry(bookingId, {
          isQueueActive: true,
          lastUpdated: timeStr,
        });
      } else if (targetStage === 'NOW_SERVING') {
        dataStore.updateQueueEntry(bookingId, {
          farmersAhead: 0,
          isTurnApproaching: false,
          currentToken: booking.tokenNumber,
          lastUpdated: timeStr,
        });
      } else if (targetStage === 'COMPLETED' || targetStage === 'NO_SHOW' || targetStage === 'CANCELLED') {
        dataStore.updateQueueEntry(bookingId, {
          isQueueActive: false,
          lastUpdated: timeStr,
        });
      }
    }

    // Update or create Procurement record
    let prc = await this.getProcurementByBookingId(bookingId);
    if (prc) {
      dataStore.updateProcurement(bookingId, {
        ...metadata,
      });
    }

    // Role notifications based on stage transition
    if (targetStage === 'ARRIVED' || targetStage === 'CHECKED_IN') {
      dataStore.addNotification({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        farmerId: booking.farmerId,
        type: 'status',
        title: 'Gate Check-In Confirmed',
        message: `Arrival confirmed at ${booking.centreName}. Please proceed to the designated waiting area.`,
        timestamp: timeStr,
        isRead: false,
        actionRoute: '/farmer/queue',
      });
    } else if (targetStage === 'NOW_SERVING') {
      dataStore.addNotification({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        farmerId: booking.farmerId,
        type: 'status',
        title: `Now Serving: Token #${booking.tokenNumber}`,
        message: `Token #${booking.tokenNumber} is now being served at Desk 1 / Weighbridge 2. Please proceed immediately.`,
        timestamp: timeStr,
        isRead: false,
        actionRoute: '/farmer/queue',
      });
    } else if (targetStage === 'CANCELLED') {
      dataStore.addNotification({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        farmerId: booking.farmerId,
        type: 'status',
        title: 'Produce Lot Disapproved',
        message: `Your lot of ${booking.cropName} did not meet procurement specifications: ${metadata?.remarks || 'Moisture / quality variance'}.`,
        timestamp: timeStr,
        isRead: false,
        actionRoute: '/farmer/bookings',
      });
    } else if (targetStage === 'COMPLETED') {
      const farmer = dataStore.getFarmers().find((f) => f.id === booking.farmerId);
      const crop = dataStore.getCropById(booking.cropId);
      const msp = crop?.mspPerQuintal || 2275;
      const acceptedKg = metadata?.acceptedQuantityKg || booking.acceptedQuantityKg || booking.quantityKg;
      const amount = Math.round((acceptedKg / 100) * msp);

      const prcId = prc?.id || `prc-${booking.id}`;
      const payment: Payment = {
        id: `pay-${booking.id}`,
        procurementId: prcId,
        bookingId: booking.id,
        farmerId: booking.farmerId,
        amount,
        status: 'PENDING',
        bankAccountMasked: farmer?.bankAccountMasked || 'Aadhaar-Linked Primary Account',
        referenceId: `PFMS-${(dataStore.getCentreById(booking.centreId)?.code || 'IN').replace(/[^A-Z]/g, '').slice(0, 3) || 'GOI'}-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        paymentMode: 'DBT / PFMS',
        initiatedAt: `${booking.date}, ${timeStr}`,
        statusMessage: 'Payment file dispatched for PFMS treasury settlement',
      };
      dataStore.setPayment(prcId, payment);

      dataStore.addNotification({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        farmerId: booking.farmerId,
        type: 'status',
        title: 'Procurement Verified & Completed',
        message: `${acceptedKg} kg ${booking.cropName} accepted at MSP rate ₹${msp}/q. DBT payment order of ₹${amount.toLocaleString('en-IN')} initiated.`,
        timestamp: timeStr,
        isRead: false,
        actionRoute: `/farmer/payment/${payment.id}`,
      });
    }

    return dataStore.getBookingById(bookingId)!;
  }

  public async recordQualityCheck(
    bookingId: string,
    grade: 'Grade A' | 'Grade B' | 'Grade C',
    isAcceptedOrRemarks?: boolean | string,
    remarksOrUndefined?: string
  ): Promise<Booking> {
    let isAccepted = true;
    let remarks = '';

    if (typeof isAcceptedOrRemarks === 'boolean') {
      isAccepted = isAcceptedOrRemarks;
      remarks = remarksOrUndefined || '';
    } else if (typeof isAcceptedOrRemarks === 'string') {
      remarks = isAcceptedOrRemarks;
    }

    if (!isAccepted) {
      return this.transitionStage(bookingId, 'CANCELLED', {
        qualityGrade: grade,
        remarks: remarks || 'Quality check rejected due to non-compliance with procurement standards',
      });
    }

    return this.transitionStage(bookingId, 'WEIGHING', {
      qualityGrade: grade,
      remarks: remarks || 'Moisture and quality verified within tolerance',
    });
  }

  public async recordWeighing(
    bookingId: string,
    actualWeightKg: number,
    acceptedQuantityKg?: number
  ): Promise<Booking> {
    const booking = dataStore.getBookingById(bookingId);
    if (!booking) throw new Error('Booking not found');

    const accepted = acceptedQuantityKg !== undefined ? acceptedQuantityKg : actualWeightKg;

    if (isNaN(actualWeightKg) || actualWeightKg <= 0) {
      throw new Error('Please enter a valid positive actual weight in kg.');
    }
    if (isNaN(accepted) || accepted <= 0) {
      throw new Error('Please enter a valid positive accepted quantity in kg.');
    }
    if (accepted > actualWeightKg) {
      throw new Error('Accepted quantity cannot exceed actual measured weight.');
    }

    const crop = dataStore.getCropById(booking.cropId);
    const msp = crop?.mspPerQuintal || 2275;
    const totalPayable = Math.round((accepted / 100) * msp);

    return this.transitionStage(bookingId, 'COMPLETED', {
      actualWeightKg,
      acceptedQuantityKg: accepted,
      totalGrossAmount: totalPayable,
      netPayableAmount: totalPayable,
    });
  }
}

export const procurementService = new ProcurementService();
