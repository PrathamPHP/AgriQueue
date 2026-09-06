import React from 'react';
import { Booking, CentreStats } from '@/types';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { formatCurrency } from '@/lib/utils';
import { FileText } from 'lucide-react';

interface OfficerProcurementsTabProps {
  stats: CentreStats;
  bookings: Booking[];
  onOpenReceipt: (booking: Booking) => void;
  onOpenDetail: (booking: Booking) => void;
}

export const OfficerProcurementsTab: React.FC<OfficerProcurementsTabProps> = ({
  stats,
  bookings,
  onOpenReceipt,
  onOpenDetail,
}) => {
  const completedBookings = bookings.filter((b) => b.currentStage === 'COMPLETED');

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
            Certified Mandi Intake Records
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
            Completed Procurements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official intake weighment certificates, moisture compliance records, and government procurement receipts.
          </p>
        </div>
      </div>

      {/* Procurements Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">Net MT Procured</span>
          <div className="text-xl font-extrabold text-[#166534] mt-0.5">
            {(stats.totalQuantityProcuredKg / 1000).toFixed(2)} MT
          </div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">Total Value (MSP)</span>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
            {formatCurrency(Math.round((stats.totalQuantityProcuredKg / 100) * 2275))}
          </div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">Quality Pass Rate</span>
          <div className="text-xl font-extrabold text-[#16A34A] mt-0.5">100% Grade A/B</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-card shadow-card">
          <span className="text-[11px] text-slate-500 font-bold uppercase">Certified Lots</span>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
            {completedBookings.length}
          </div>
        </div>
      </div>

      {/* Completed Procurements Table */}
      <Card className="border-slate-200">
        <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Certified Procurement Batches</CardTitle>
            <CardDescription>Weighbridge receipts cleared for DBT settlement</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="px-4 py-3">Receipt / Token</th>
                  <th className="px-4 py-3">Farmer</th>
                  <th className="px-4 py-3">Crop</th>
                  <th className="px-4 py-3">Certified Weight</th>
                  <th className="px-4 py-3">Quality Grade</th>
                  <th className="px-4 py-3">DBT Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completedBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      No completed procurements today.
                    </td>
                  </tr>
                ) : (
                  completedBookings.map((b) => {
                    const netWeight = b.acceptedQuantityKg || b.quantityKg;
                    const dbtAmount = Math.round((netWeight / 100) * 2275);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-slate-900">
                            #{b.tokenNumber}
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono">
                            RCP-{b.id.slice(-6).toUpperCase()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{b.farmerName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{b.farmerMobile}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{b.cropName}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{netWeight} kg</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-emerald-100 text-[#166534] rounded font-bold text-[11px]">
                            {b.qualityGrade || 'Grade A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-extrabold text-[#166534]">
                          {formatCurrency(dbtAmount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOpenReceipt(b)}
                              icon={<FileText className="w-3.5 h-3.5" />}
                            >
                              J-Form
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onOpenDetail(b)}
                            >
                              Dossier
                            </Button>
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
export default OfficerProcurementsTab;
