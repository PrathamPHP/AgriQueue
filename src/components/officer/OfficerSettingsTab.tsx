import React, { useState, useEffect } from 'react';
import { ProcurementCentre } from '@/types';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { InputField } from '@/components/forms/InputField';
import { CheckCircle2 } from 'lucide-react';

interface OfficerSettingsTabProps {
  centre: ProcurementCentre;
  onSaveCapacity: (capacityPerHourKg: number) => void;
  settingsSaved: boolean;
}

export const OfficerSettingsTab: React.FC<OfficerSettingsTabProps> = ({
  centre,
  onSaveCapacity,
  settingsSaved,
}) => {
  const [capacityInput, setCapacityInput] = useState<string>(
    centre.capacityPerHourKg.toString()
  );

  useEffect(() => {
    setCapacityInput(centre.capacityPerHourKg.toString());
  }, [centre.capacityPerHourKg]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCap = parseInt(capacityInput, 10);
    if (!isNaN(parsedCap) && parsedCap > 0) {
      onSaveCapacity(parsedCap);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card">
        <span className="text-xs font-extrabold uppercase tracking-wider text-[#166534]">
          Depot Parameters & Control
        </span>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] mt-0.5 tracking-tight">
          Depot Capacity Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure hourly intake ceiling, operating gates, quality thresholds, and smart slot allocation rules.
        </p>
      </div>

      {settingsSaved && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-card flex items-center gap-2.5 text-xs text-[#166534] font-bold animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Depot operational parameters saved and applied successfully.</span>
        </div>
      )}

      <Card className="border-slate-200">
        <CardHeader className="py-4 border-b border-slate-100">
          <CardTitle className="text-base">Operational Capacity Calibration</CardTitle>
          <CardDescription>Directly impacts slot availability in the farmer booking wizard</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Depot Facility Name:
                </label>
                <input
                  type="text"
                  disabled
                  value={centre.name}
                  className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-input text-slate-600 font-semibold cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  District & State:
                </label>
                <input
                  type="text"
                  disabled
                  value={`${centre.district}, ${centre.state}`}
                  className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-input text-slate-600 font-semibold cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Hourly Intake Capacity (kg / hour)"
                type="number"
                value={capacityInput}
                onChange={(e) => setCapacityInput(e.target.value)}
                trailingIcon={<span className="text-xs font-bold text-slate-500">KG/HR</span>}
                helperText="Target rate for digital weighbridges (e.g. 2,800 kg/hr = ~28 quintals/hr)."
                required
              />

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Slot Window Duration:
                </label>
                <select
                  defaultValue="30"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-input font-medium focus:outline-none focus:border-[#166534]"
                >
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes (Recommended)</option>
                  <option value="45">45 Minutes</option>
                  <option value="60">60 Minutes</option>
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Farmer reservation interval window length.
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-input border border-slate-200 space-y-3 text-xs">
              <div className="font-bold text-slate-800">Operational Gate Weighbridges:</div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900 block">Gate 1: Heavy Weighbridge</span>
                  <span className="text-slate-500">Multi-axle commercial transport entry</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-[#166534] font-bold rounded text-xs">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block">Gate 2: Tractor Trolley Weighbridge</span>
                  <span className="text-slate-500">Local farm vehicle & tractor entry</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-[#166534] font-bold rounded text-xs">
                  Active
                </span>
              </div>
            </div>
          </CardContent>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
            <Button type="submit" variant="primary">
              Save Depot Configuration
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
export default OfficerSettingsTab;
