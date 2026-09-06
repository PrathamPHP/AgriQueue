/**
 * AgriQueue Payment Service
 * Tracks Direct Benefit Transfer (DBT) and PFMS settlements for verified procurements.
 */

import { Payment, PaymentStatus } from '@/types';
import { dataStore } from './dataStore';
import { apiClient } from './apiClient';

class PaymentService {
  public async getPaymentByProcurementId(procurementId: string): Promise<Payment | null> {
    try {
      const p = await apiClient.get<Payment>(`/payments/${procurementId}`);
      if (p) {
        dataStore.setPayment(procurementId, p, false);
        return p;
      }
    } catch {}
    const payments = dataStore.getPayments();
    return payments[procurementId] || null;
  }

  public async getPaymentByBookingId(bookingId: string): Promise<Payment | null> {
    try {
      const p = await apiClient.get<Payment>(`/payments/${bookingId}`);
      if (p) {
        dataStore.setPayment(p.procurementId, p, false);
        return p;
      }
    } catch {}
    const all = Object.values(dataStore.getPayments());
    return all.find((p) => p.bookingId === bookingId) || null;
  }

  public async getFarmerPayments(farmerId: string): Promise<Payment[]> {
    try {
      const list = await apiClient.get<Payment[]>('/payments', { farmerId });
      if (Array.isArray(list)) {
        dataStore.upsertPayments(list, false);
        return list;
      }
    } catch {}
    const all = Object.values(dataStore.getPayments());
    return all.filter((p) => p.farmerId === farmerId);
  }

  public async getCentrePayments(centreId: string): Promise<Payment[]> {
    try {
      const list = await apiClient.get<Payment[]>('/payments', { centreId });
      if (Array.isArray(list)) {
        dataStore.upsertPayments(list, false);
        return list;
      }
    } catch {}
    const all = Object.values(dataStore.getPayments());
    const centreBookingIds = new Set(
      dataStore
        .getBookings()
        .filter((b) => b.centreId === centreId)
        .map((b) => b.id)
    );
    return all.filter((p) => centreBookingIds.has(p.bookingId));
  }

  public async getAllPayments(): Promise<Payment[]> {
    try {
      const list = await apiClient.get<Payment[]>('/payments');
      if (Array.isArray(list)) {
        dataStore.upsertPayments(list, false);
        return list;
      }
    } catch {}
    return Object.values(dataStore.getPayments());
  }

  public async updatePaymentStatus(
    procurementId: string,
    status: PaymentStatus,
    referenceId?: string
  ): Promise<Payment> {
    try {
      const updated = await apiClient.patch<Payment>(`/procurements/${procurementId}/payment`, {
        status,
        referenceId,
      });
      if (updated) {
        dataStore.setPayment(procurementId, updated);
        return updated;
      }
    } catch (e) {
      console.warn('[PaymentService] Backend payment update error:', e);
    }

    const existing = dataStore.getPayment(procurementId);
    if (!existing) {
      throw new Error(`Payment for procurement ${procurementId} not found`);
    }

    const updated: Payment = {
      ...existing,
      status,
      referenceId:
        referenceId ||
        (status === 'PAID'
          ? (existing.referenceId?.startsWith('PFMS')
              ? existing.referenceId
              : `PFMS-${(dataStore.getBookingById(existing.bookingId)?.stateId || 'IN').replace(/^(state|ut)-/, '').toUpperCase().slice(0, 3) || 'IN'}-2026-${Date.now().toString().slice(-6)}`)
          : existing.referenceId),
      initiatedAt:
        status === 'INITIATED' || status === 'PAID'
          ? existing.initiatedAt || new Date().toLocaleString()
          : existing.initiatedAt,
      paidAt: status === 'PAID' ? new Date().toLocaleString() : existing.paidAt,
      statusMessage:
        status === 'PAID'
          ? 'Credited to beneficiary account via PFMS'
          : status === 'INITIATED'
          ? 'Payment order initiated and batched for PFMS treasury settlement'
          : 'Processing in banking batch',
    };

    dataStore.setPayment(procurementId, updated);

    if (status === 'INITIATED') {
      dataStore.addNotification({
        id: `notif-pay-init-${Date.now()}`,
        farmerId: existing.farmerId,
        type: 'payment',
        title: 'DBT Payment Order Initiated',
        message: `DBT payment of ₹${existing.amount.toLocaleString('en-IN')} has been approved and batched for PFMS treasury settlement.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        actionRoute: `/farmer/payment/${existing.id}`,
      });
    } else if (status === 'PAID') {
      dataStore.addNotification({
        id: `notif-pay-paid-${Date.now()}`,
        farmerId: existing.farmerId,
        type: 'payment',
        title: 'DBT Payment Credited',
        message: `Payment of ₹${existing.amount.toLocaleString('en-IN')} credited to your bank account (${existing.bankAccountMasked}) via PFMS. Ref: ${updated.referenceId}.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        isRead: false,
        actionRoute: `/farmer/payment/${existing.id}`,
      });
    }

    return updated;
  }
}

export const paymentService = new PaymentService();
