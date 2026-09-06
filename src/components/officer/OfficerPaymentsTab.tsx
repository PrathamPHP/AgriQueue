import React from 'react';
import { Payment } from '@/types';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle2, Check } from 'lucide-react';

interface OfficerPaymentsTabProps {
  payments: Payment[];
  batchSettlementSuccess: string | null;
  onAuthorizeBatchPayments: () => void;
  onInitiatePayment: (procurementId: string) => void;
  onAuthorizeDisburse: (procurementId: string) => void;
}

export const OfficerPaymentsTab: React.FC<OfficerPaymentsTabProps> = ({
  payments,
  batchSettlementSuccess,
  onAuthorizeBatchPayments,
  onInitiatePayment,
  onAuthorizeDisburse,
}) => {
  const totalDisbursed = payments
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingAuthorization = payments
    .filter((p) => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
            Treasury Settlement Pipeline
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
            DBT / PFMS Payment Orders
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Public Financial Management System (PFMS) Direct Benefit Transfer batches and bank credit authorisations.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={onAuthorizeBatchPayments}
          icon={<CheckCircle2 className="w-4 h-4" />}
        >
          Authorize All Pending Batches
        </Button>
      </div>

      {batchSettlementSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-card flex items-center gap-2.5 text-xs text-[#166534] font-bold animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{batchSettlementSuccess}</span>
        </div>
      )}

      {/* Payment KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">Total Disbursed</span>
          <div className="text-xl font-extrabold text-[#166534] mt-0.5">
            {formatCurrency(totalDisbursed)}
          </div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">Pending Authorization</span>
          <div className="text-xl font-extrabold text-amber-600 mt-0.5">
            {formatCurrency(pendingAuthorization)}
          </div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">NPCI Account Match</span>
          <div className="text-xl font-extrabold text-[#16A34A] mt-0.5">100% Verified</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">PFMS Settlement SLA</span>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">&lt; 24 Hours</div>
        </div>
      </div>

      {/* Payment Orders Table */}
      <Card className="border-slate-200">
        <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Beneficiary Bank Transfer Orders</CardTitle>
            <CardDescription>Direct deposit to Aadhaar-seeded accounts via RBI / PFMS gateway</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="px-4 py-3">PFMS Ref #</th>
                  <th className="px-4 py-3">Beneficiary Account</th>
                  <th className="px-4 py-3">Amount (₹)</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No pending payments.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-slate-900">{p.referenceId}</div>
                          <div className="text-[10px] text-slate-400">{p.initiatedAt}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{p.bankAccountMasked}</div>
                          <div className="text-[11px] text-slate-500">{p.statusMessage}</div>
                        </td>
                        <td className="px-4 py-3 font-extrabold text-[#166534]">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                          {p.paymentMode}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={p.status}
                            label={
                              p.status === 'PAID'
                                ? 'Credited (PAID)'
                                : p.status === 'INITIATED'
                                ? 'Order Initiated'
                                : 'Pending Approval'
                            }
                            size="sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.status === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onInitiatePayment(p.procurementId)}
                                >
                                  Initiate Payment
                                </Button>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => onAuthorizeDisburse(p.procurementId)}
                                >
                                  Authorize / Disburse
                                </Button>
                              </>
                            )}

                            {p.status === 'INITIATED' && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => onAuthorizeDisburse(p.procurementId)}
                              >
                                Authorize / Disburse
                              </Button>
                            )}

                            {p.status === 'PAID' && (
                              <span className="text-xs font-bold text-[#16A34A] flex items-center justify-end gap-1">
                                <Check className="w-3.5 h-3.5" /> Disbursed
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
export default OfficerPaymentsTab;
