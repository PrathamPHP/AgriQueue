import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Farmer, FarmerDashboardStageType } from '@/types';
import { dataStore } from '@/services/dataStore';
import { farmerService, simulateStateTransition } from '@/services/farmerService';
import { queueService } from '@/services/queueService';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import {
  RotateCcw,
  FastForward,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const DemoControls: React.FC = () => {
  const navigate = useNavigate();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [currentFarmer, setCurrentFarmer] = useState<Farmer | null>(dataStore.getCurrentFarmer());
  const [message, setMessage] = useState<string>('');

  const load = () => {
    setFarmers(dataStore.getFarmers());
    setCurrentFarmer(dataStore.getCurrentFarmer());
  };

  useEffect(() => {
    load();
    const unsubscribe = dataStore.subscribe(load);
    return () => unsubscribe();
  }, []);

  const flashMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3500);
  };

  const handleSwitchFarmer = (farmerId: string) => {
    farmerService.switchFarmer(farmerId);
    flashMessage(`Switched active farmer to: ${farmerId}`);
  };

  const handleStateChange = async (state: FarmerDashboardStageType) => {
    await simulateStateTransition(state);
    flashMessage(`Transformed active farmer state to: ${state}`);
  };

  const handleAdvanceQueue = async () => {
    if (!currentFarmer) {
      flashMessage('No active farmer registered. Please register a farmer first.');
      return;
    }
    const booking = await farmerService.getActiveBooking(currentFarmer.id);
    if (booking) {
      await queueService.advanceQueue(booking.id);
      flashMessage(`Advanced queue: Token served moved forward by 1 step`);
    } else {
      flashMessage('No active booking to advance. Book a slot first.');
    }
  };

  const handleResetQueue = async () => {
    if (!currentFarmer) {
      flashMessage('No active farmer registered.');
      return;
    }
    const booking = await farmerService.getActiveBooking(currentFarmer.id);
    if (booking) {
      await queueService.resetQueueForDemo(booking.id);
      flashMessage('Queue position reset to 8 farmers ahead.');
    }
  };

  const handleToggleDelay = async (delay: number) => {
    const centres = dataStore.getCentres();
    if (centres.length > 0) {
      await queueService.setCentreDelay(centres[1]?.id || centres[0].id, delay);
      flashMessage(`Set delay for centre to +${delay} minutes`);
    }
  };

  const handleFullReset = () => {
    if (window.confirm('Reset all application data back to a fresh state? All registered farmers and bookings will be cleared.')) {
      dataStore.resetApplicationData();
      flashMessage('Application state cleared. Redirecting to login...');
      setTimeout(() => navigate('/login'), 800);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          SIH 2026 Jury & Evaluator Testing Suite
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">
          Demo Control Center & Simulation Suite
        </h1>
        <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
          This panel is decoupled from the public Farmer UI. Use these tools to inspect edge cases, test multi-persona synchronization, and demonstrate live state transitions to judges.
        </p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-input text-xs font-bold text-[#166534] flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {message}
        </div>
      )}

      {/* 1. Farmer Account Selection */}
      <Card>
        <CardHeader>
          <CardTitle>1. Select Active Farmer Persona</CardTitle>
          <CardDescription>
            Switch between pre-configured seed farmers to test various initial states
          </CardDescription>
        </CardHeader>
        <CardContent>
          {farmers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-card border border-dashed border-slate-200">
              No registered farmers currently in store.
              <div className="mt-3">
                <Button size="sm" variant="primary" onClick={() => navigate('/login')}>
                  Register New Farmer
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {farmers.map((f) => {
                const isSelected = currentFarmer ? f.id === currentFarmer.id : false;
                return (
                  <button
                    key={f.id}
                    onClick={() => handleSwitchFarmer(f.id)}
                    className={`p-3 rounded-card text-left border transition-all ${
                      isSelected
                        ? 'border-[#166534] bg-emerald-50 ring-2 ring-[#166534]/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-sm text-slate-900">{f.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{f.village}, {f.district}</div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">{f.mobileNumber}</div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. State Transition Simulator */}
      <Card>
        <CardHeader>
          <CardTitle>2. Quick State Transition Simulator</CardTitle>
          <CardDescription>
            Instantly morph the active farmer's dashboard and tracking into any of the 8 PRD operational stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStateChange('NO_BOOKING')}
            >
              1. No Booking
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStateChange('UPCOMING_BOOKING')}
            >
              2. Upcoming (Tomorrow)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStateChange('IN_VIRTUAL_QUEUE')}
            >
              3. In Virtual Queue
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStateChange('TURN_APPROACHING')}
            >
              4. Turn Approaching
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStateChange('PROCUREMENT_IN_PROGRESS')}
            >
              5. QC / Weighing
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStateChange('PAYMENT_PENDING')}
            >
              6. Payment Pending
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStateChange('PAYMENT_COMPLETED')}
            >
              7. Payment Completed
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/farmer/dashboard')}
            >
              Open Farmer View →
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Live Virtual Queue Simulation */}
      <Card>
        <CardHeader>
          <CardTitle>3. Live Queue Progression & Mandi Delay Controls</CardTitle>
          <CardDescription>
            Simulate gate arrivals, token progression, and delay notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              icon={<FastForward className="w-4 h-4" />}
              onClick={handleAdvanceQueue}
            >
              Advance Queue 1 Step
            </Button>
            <Button
              variant="outline"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={handleResetQueue}
            >
              Reset Queue Position
            </Button>
            <Button
              variant="outline"
              icon={<Clock className="w-4 h-4 text-amber-600" />}
              onClick={() => handleToggleDelay(15)}
            >
              Inject +15m Mandi Delay
            </Button>
            <Button
              variant="outline"
              icon={<Clock className="w-4 h-4 text-emerald-600" />}
              onClick={() => handleToggleDelay(0)}
            >
              Clear Delay (0m)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. SIH Presentation Controls */}
      <Card className="border-red-200 bg-red-50/30">
        <CardHeader>
          <CardTitle className="text-red-900 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-red-600" />
            4. Hackathon Presentation & Reset Utilities
          </CardTitle>
          <CardDescription>
            Prepare the prototype for judges or reset all telemetry without inserting fake data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => {
                dataStore.resetApplicationData();
                flashMessage('✓ All transactional data cleared (farmers, bookings, queues, payments). Reference data preserved.');
              }}
            >
              RESET TRANSACTION DATA
            </Button>

            <Button
              variant="primary"
              icon={<Sparkles className="w-4 h-4" />}
              onClick={() => {
                dataStore.resetApplicationData();
                flashMessage('✓ Demo environment initialized to clean start. Redirecting to registration...');
                setTimeout(() => navigate('/login'), 700);
              }}
            >
              PREPARE DEMO ENVIRONMENT
            </Button>
          </div>

          <p className="text-[11px] text-slate-500 italic">
            Note: "Prepare Demo Environment" resets reference data and application settings without inserting synthetic transactions, allowing the presenter to execute the real registration and slot booking live.
          </p>
        </CardContent>
      </Card>

      {/* Direct Jump Navigation Links */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 text-xs">
        <span className="text-slate-500 font-medium">Quick Direct Navigation:</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/farmer/dashboard')}
            className="font-bold text-[#166534] hover:underline"
          >
            Farmer Dashboard
          </button>
          <span className="text-slate-300">•</span>
          <button
            onClick={() => navigate('/farmer/queue')}
            className="font-bold text-[#166534] hover:underline"
          >
            Live Virtual Queue
          </button>
          <span className="text-slate-300">•</span>
          <button
            onClick={() => navigate('/officer/dashboard')}
            className="font-bold text-[#166534] hover:underline"
          >
            Officer Dashboard
          </button>
          <span className="text-slate-300">•</span>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="font-bold text-[#166534] hover:underline"
          >
            Admin State Monitor
          </button>
        </div>
      </div>
    </div>
  );
};
