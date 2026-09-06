import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Crop,
  ProcurementCentre,
  SlotRecommendation,
  Booking,
  LanguageCode,
  State,
  District,
} from '@/types';
import {
  getCrops,
  getCentres,
  getSmartRecommendations,
  createBooking,
  getActiveBooking,
  getCurrentFarmer,
} from '@/services/farmerService';
import { bookingService } from '@/services/bookingService';
import { geographyService } from '@/services/geographyService';
import { dataStore } from '@/services/dataStore';
import { useTranslation } from '@/i18n/LanguageContext';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/common/Card';
import { InputField } from '@/components/forms/InputField';
import { SelectDropdown } from '@/components/forms/SelectDropdown';
import { formatCurrency } from '@/lib/utils';
import {
  Wheat,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Star,
  Check,
  QrCode,
  ShieldCheck,
  Info,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export interface BookSlotWizardProps {
  currentLanguage: LanguageCode;
}

export const BookSlotWizard: React.FC<BookSlotWizardProps> = ({
  currentLanguage,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Derive current step from route
  const getStepFromPath = (): number => {
    if (location.pathname.includes('/confirmation')) return 4;
    if (location.pathname.includes('/slots')) return 3;
    if (location.pathname.includes('/centre')) return 2;
    return 1;
  };

  const currentStep = getStepFromPath();

  // Form Inputs - initialized from persisted draft
  const initialDraft = bookingService.getDraftBooking();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [centres, setCentres] = useState<ProcurementCentre[]>([]);
  const [slots, setSlots] = useState<SlotRecommendation[]>([]);

  // Geographic 3-tier hierarchy state
  const [states, setStates] = useState<State[]>([]);
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [isChangingLocation, setIsChangingLocation] = useState<boolean>(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedCropId, setSelectedCropId] = useState<string>(initialDraft.cropId || '');
  const [quantityKg, setQuantityKg] = useState<string>(
    initialDraft.quantityKg ? initialDraft.quantityKg.toString() : ''
  );
  const [bookingDate, setBookingDate] = useState<string>(initialDraft.date || todayStr);
  const [quantityError, setQuantityError] = useState<string>('');
  const [selectedCentre, setSelectedCentre] = useState<ProcurementCentre | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotRecommendation | null>(null);

  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(
    (location.state as any)?.booking || null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCentresLoading, setIsCentresLoading] = useState<boolean>(false);
  const [centresError, setCentresError] = useState<string | null>(null);
  const [isSlotsLoading, setIsSlotsLoading] = useState<boolean>(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const loadCentresForDistrict = async (distId: string, preferredCentreId?: string) => {
    if (!distId) {
      setCentres([]);
      setSelectedCentre(null);
      return;
    }
    setIsCentresLoading(true);
    setCentresError(null);
    try {
      const fetchedCentres = await geographyService.fetchCentresByDistrict(distId);
      setCentres(fetchedCentres);
      const match = preferredCentreId ? fetchedCentres.find((c) => c.id === preferredCentreId) : undefined;
      setSelectedCentre(match || fetchedCentres[0] || null);
    } catch (err: any) {
      console.error('Failed to load mandis for district:', err);
      setCentresError('Unable to load procurement centres. Please try again.');
      setCentres([]);
      setSelectedCentre(null);
    } finally {
      setIsCentresLoading(false);
    }
  };

  // Load initial crops, centres, and geographic hierarchy
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [cropsData] = await Promise.all([getCrops()]);
        setCrops(cropsData);

        const allStates = dataStore.getStates();
        setStates(allStates);

        const currentFarmer = dataStore.getCurrentFarmer() || (await getCurrentFarmer());
        let initStId = allStates[0]?.id || '';
        if (currentFarmer?.stateId && allStates.some((s) => s.id === currentFarmer.stateId)) {
          initStId = currentFarmer.stateId;
        } else if (currentFarmer?.state) {
          const matchSt = allStates.find(
            (s) => s.name.toLowerCase() === currentFarmer.state?.toLowerCase() || s.id === currentFarmer.state
          );
          if (matchSt) initStId = matchSt.id;
        }
        setSelectedStateId(initStId);

        const stateDistricts = dataStore.getDistricts(initStId);
        setDistricts(stateDistricts);

        let initDistId = stateDistricts[0]?.id || '';
        if (currentFarmer?.districtId && stateDistricts.some((d) => d.id === currentFarmer.districtId)) {
          initDistId = currentFarmer.districtId;
        } else if (currentFarmer?.district) {
          const matchDist = stateDistricts.find(
            (d) => d.name.toLowerCase() === currentFarmer.district?.toLowerCase() || d.id === currentFarmer.district
          );
          if (matchDist) initDistId = matchDist.id;
        }
        setSelectedDistrictId(initDistId);

        if (initialDraft.cropId) {
          setSelectedCropId(initialDraft.cropId);
        } else if (cropsData.length > 0) {
          setSelectedCropId(cropsData[0].id);
        }

        if (initDistId) {
          await loadCentresForDistrict(initDistId, initialDraft.centreId);
        }
      } catch (err) {
        console.error('Failed to load booking form data', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleStateChange = async (stateId: string) => {
    setSelectedStateId(stateId);
    setSelectedCentre(null);
    const newDistricts = dataStore.getDistricts(stateId);
    setDistricts(newDistricts);
    if (newDistricts.length > 0) {
      const firstDist = newDistricts[0].id;
      setSelectedDistrictId(firstDist);
      await loadCentresForDistrict(firstDist);
    } else {
      setSelectedDistrictId('');
      setCentres([]);
      setSelectedCentre(null);
    }
  };

  const handleDistrictChange = async (distId: string) => {
    setSelectedDistrictId(distId);
    setSelectedCentre(null);
    await loadCentresForDistrict(distId);
  };

  // For step 4, if confirmedBooking not in state and user is not reviewing a fresh draft, look up active booking
  useEffect(() => {
    if (currentStep === 4 && !confirmedBooking && !initialDraft.slotId) {
      const farmer = dataStore.getCurrentFarmer();
      if (farmer) {
        getActiveBooking(farmer.id).then((b) => {
          if (b) setConfirmedBooking(b);
        });
      }
    }
  }, [currentStep, confirmedBooking, initialDraft.slotId]);

  // When moving to Step 3, calculate and load smart slot recommendations based on actual inputs
  useEffect(() => {
    if (currentStep === 3) {
      const centreToUse = selectedCentre || centres.find((c) => c.id === initialDraft.centreId) || centres[0];
      const cropToUse = selectedCropId || initialDraft.cropId || crops[0]?.id;
      if (centreToUse && cropToUse) {
        if (!selectedCentre) setSelectedCentre(centreToUse);
        if (!selectedCropId) setSelectedCropId(cropToUse);
        const qty = parseFloat(quantityKg) || initialDraft.quantityKg || 750;
        const dateToUse = bookingDate || initialDraft.date || todayStr;
        setIsSlotsLoading(true);
        setSlotsError(null);
        getSmartRecommendations(centreToUse.id, cropToUse, qty, dateToUse)
          .then((recommendedSlots) => {
            setSlots(recommendedSlots);
            const matchedDraft = recommendedSlots.find((s) => s.id === initialDraft.slotId);
            const top = matchedDraft || recommendedSlots.find((s) => s.isRecommended) || recommendedSlots[0];
            setSelectedSlot(top || null);
          })
          .catch((err) => {
            console.error('Failed to load recommended slots:', err);
            setSlotsError('Unable to fetch available time slots. Please try again.');
          })
          .finally(() => {
            setIsSlotsLoading(false);
          });
      }
    }
  }, [currentStep, selectedCentre, selectedCropId, quantityKg, bookingDate, centres, crops]);

  // Step 1 Validation & Proceed
  const handleProceedStep1 = () => {
    const qty = parseFloat(quantityKg);
    if (isNaN(qty) || qty <= 0) {
      setQuantityError('Please enter a valid quantity in kg');
      return;
    }
    if (qty > 10000) {
      setQuantityError('Maximum quantity for a single booking is 10,000 kg');
      return;
    }
    setQuantityError('');

    bookingService.saveDraftBooking({
      cropId: selectedCropId,
      quantityKg: qty,
      date: bookingDate,
    });

    navigate('/farmer/book-slot/centre');
  };

  // Step 2 Proceed
  const handleProceedStep2 = (centre: ProcurementCentre) => {
    setSelectedCentre(centre);
    bookingService.saveDraftBooking({
      centreId: centre.id,
    });
    navigate('/farmer/book-slot/slots');
  };

  // Step 3 Proceed to Step 4 Review & Confirmation
  const handleSelectSlotAndProceed = (slot: SlotRecommendation) => {
    if (!slot || !slot.id) return;
    setSelectedSlot(slot);
    bookingService.saveDraftBooking({
      slotId: slot.id,
      timeWindow: slot.timeWindow,
      date: slot.date || bookingDate,
    });
    navigate('/farmer/book-slot/confirmation');
  };

  // Step 4 Final Booking Submission with Dynamic Token Generation
  const handleFinalConfirmBooking = async () => {
    const currentFarmer = dataStore.getCurrentFarmer();
    if (!currentFarmer) {
      navigate('/login');
      return;
    }
    const targetCentre = selectedCentre || centres.find((c) => c.id === initialDraft.centreId) || centres[0];
    const targetCropId = selectedCropId || initialDraft.cropId || crops[0]?.id;
    const targetQty = parseFloat(quantityKg) || initialDraft.quantityKg || 750;
    const targetSlot = selectedSlot || slots.find((s) => s.id === initialDraft.slotId) || slots[0];
    const targetDate = bookingDate || initialDraft.date || todayStr;
    const targetTimeWindow = targetSlot?.timeWindow || initialDraft.timeWindow || '10:00 AM – 10:30 AM';
    const targetSlotId = targetSlot?.id || initialDraft.slotId;

    if (!targetCentre || !targetCropId || !targetSlotId) {
      navigate('/farmer/book-slot/slots');
      return;
    }

    setIsSubmitting(true);
    try {
      const newBooking = await createBooking({
        cropId: targetCropId,
        quantityKg: targetQty,
        centreId: targetCentre.id,
        slotId: targetSlotId,
        date: targetDate,
        timeWindow: targetTimeWindow,
      });

      setConfirmedBooking(newBooking);
    } catch (err) {
      console.error('Booking confirmation failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCrop = crops.find((c) => c.id === selectedCropId);
  const currentMsp = selectedCrop ? selectedCrop.mspPerQuintal : 2275;
  const estimatedAmount = ((parseFloat(quantityKg) || 0) / 100) * currentMsp;

  const stepsList = [
    { number: 1, title: t('crop', 'Crop Details') },
    { number: 2, title: t('procurementCentre', 'Select Centre') },
    { number: 3, title: t('selectSlot', 'Select Slot') },
    { number: 4, title: t('confirmBooking', 'Confirmation') },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* 4-Step Progress Indicator */}
      <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 shadow-card">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[3px] bg-slate-200 -z-0" />
          <div
            className="absolute left-6 top-1/2 -translate-y-1/2 h-[3px] bg-[#166534] transition-all duration-300 -z-0"
            style={{ width: `${((currentStep - 1) / (stepsList.length - 1)) * 100}%` }}
          />

          {stepsList.map((step) => {
            const isCompleted = currentStep > step.number;
            const isCurrent = currentStep === step.number;

            return (
              <div key={step.number} className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-extrabold text-xs sm:text-sm transition-all duration-200 shadow-subtle ${
                    isCompleted
                      ? 'bg-[#166534] text-white'
                      : isCurrent
                      ? 'bg-[#166534] text-white ring-4 ring-[#DCFCE7]'
                      : 'bg-white text-slate-400 border-2 border-slate-300'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.number}
                </div>
                <span
                  className={`text-[11px] sm:text-xs font-bold ${
                    isCurrent
                      ? 'text-[#166534]'
                      : isCompleted
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  }`}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1: CROP DETAILS */}
      {currentStep === 1 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-[#166534] flex items-center justify-center text-xs font-extrabold">
                1
              </span>
              <CardTitle>Crop & Quantity Details</CardTitle>
            </div>
            <CardDescription>
              Select crop variety and estimated harvest quantity to determine mandatory MSP rates and throughput
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <SelectDropdown
              label="Select Crop (फसल का चयन करें)"
              value={selectedCropId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCropId(val);
                bookingService.saveDraftBooking({ cropId: val });
              }}
              options={crops.map((crop) => ({
                value: crop.id,
                label: `${crop.name} (${crop.nameHindi})`,
                sublabel: `Govt MSP: ₹${crop.mspPerQuintal}/quintal`,
              }))}
              required
            />

            <div>
              <InputField
                label="Estimated Quantity in Kilograms (मात्रा किलोग्राम में)"
                type="number"
                placeholder="e.g. 750"
                value={quantityKg}
                onChange={(e) => {
                  setQuantityKg(e.target.value);
                  const parsed = parseFloat(e.target.value);
                  if (!isNaN(parsed)) {
                    bookingService.saveDraftBooking({ quantityKg: parsed });
                  }
                  if (quantityError) setQuantityError('');
                }}
                error={quantityError}
                helperText="Minimum: 50 kg • Maximum for single slot: 10,000 kg"
                required
              />

              {/* Dynamic MSP Payout Estimation Box */}
              {parseFloat(quantityKg) > 0 && !quantityError && (
                <div className="mt-3 p-3.5 bg-[#DCFCE7]/60 rounded-input border border-emerald-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wheat className="w-5 h-5 text-[#166534]" />
                    <div>
                      <div className="text-xs text-emerald-900 font-medium">
                        Estimated MSP Value (अनुमानित मूल्य)
                      </div>
                      <div className="text-sm font-extrabold text-[#166534]">
                        {formatCurrency(estimatedAmount)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <div>Rate: ₹{currentMsp} / quintal</div>
                    <div>Load: {(parseFloat(quantityKg) / 100).toFixed(1)} Qtl</div>
                  </div>
                </div>
              )}
            </div>

            <InputField
              label="Preferred Procurement Date (खरीद की पसंदीदा तारीख) *"
              type="date"
              min={todayStr}
              value={bookingDate}
              onChange={(e) => {
                setBookingDate(e.target.value);
                bookingService.saveDraftBooking({ date: e.target.value });
              }}
              helperText="Select today or an upcoming date for mandi delivery"
              required
            />
          </CardContent>

          <CardFooter className="flex justify-between items-center bg-slate-50/50">
            <Button
              variant="outline"
              onClick={() => navigate('/farmer/dashboard')}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleProceedStep1}
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
            >
              Continue to Select Centre
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 2: SELECT PROCUREMENT CENTRE */}
      {currentStep === 2 && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#111827]">
                Select Procurement Centre (खरीद केंद्र चुनें)
              </h2>
              <p className="text-xs text-[#6B7280]">
                Comparing centres based on distance, live queue congestion, and today's capacity for {selectedCrop?.name || 'Wheat'} ({quantityKg} kg)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/farmer/book-slot')}
            >
              Back
            </Button>
          </div>

          {/* Geographic Location Ribbon with Change District Button */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-600">Selected Location: </span>
                <span className="font-bold text-emerald-950">
                  {districts.find((d) => d.id === selectedDistrictId)?.name || 'District'},{' '}
                  {states.find((s) => s.id === selectedStateId)?.name || 'State'}
                </span>
                <span className="text-slate-500 ml-1.5">
                  ({centres.length} Mandi{centres.length === 1 ? '' : 's'} available)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsChangingLocation(!isChangingLocation)}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline self-start sm:self-auto cursor-pointer"
            >
              {isChangingLocation ? 'Done Selecting' : 'Change District'}
            </button>
          </div>

          {/* Expandable State & District Selectors */}
          {isChangingLocation && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg animate-fade-in">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select State / UT (राज्य)
                </label>
                <select
                  value={selectedStateId}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                >
                  {states.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select District (ज़िला)
                </label>
                <select
                  value={selectedDistrictId}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                >
                  {districts.map((dst) => (
                    <option key={dst.id} value={dst.id}>
                      {dst.name} ({dst.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isCentresLoading && (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-lg text-slate-500">
              <Loader2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 animate-spin" />
              <p className="text-sm font-bold text-slate-800">Loading procurement centres...</p>
              <p className="text-xs text-slate-500 mt-1">Connecting to state procurement directory.</p>
            </div>
          )}

          {!isCentresLoading && centresError && (
            <div className="p-8 text-center bg-white border border-red-200 rounded-lg text-red-700">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-red-900">Unable to load procurement centres.</p>
              <p className="text-xs text-red-600 mt-1">Please try again or select a different district.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => loadCentresForDistrict(selectedDistrictId)}
              >
                Retry
              </Button>
            </div>
          )}

          {!isCentresLoading && !centresError && centres.length === 0 && (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-lg text-slate-500">
              <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">No Mandis configured in this district.</p>
              <p className="text-xs text-slate-500 mt-1">Please change the district or contact district administration.</p>
            </div>
          )}

          <div className="space-y-3">
            {centres.map((centre) => {
              const isSelected = selectedCentre?.id === centre.id;
              const isHighCongestion = centre.congestionLevel === 'High';

              return (
                <div
                  key={centre.id}
                  onClick={() => setSelectedCentre(centre)}
                  className={`p-4 sm:p-5 rounded-card border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border-[#166534] bg-white shadow-card ring-2 ring-[#166534]/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-subtle'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm sm:text-base text-[#111827]">
                          {centre.name}
                        </span>
                        {centre.distanceKm && (
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-0.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {centre.distanceKm} km away
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                        <span className="font-semibold text-slate-700">
                          {centre.district}, {centre.state}
                        </span>
                        <span>•</span>
                        <span>
                          Hours: {centre.workingHours?.start || '08:00 AM'} – {centre.workingHours?.end || '05:00 PM'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        Avg Wait: ~{centre.avgWaitTimeMin} min
                      </div>
                      <div
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          centre.congestionLevel === 'Low'
                            ? 'bg-emerald-100 text-[#166534]'
                            : isHighCongestion
                            ? 'bg-red-100 text-[#DC2626]'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {centre.congestionLevel} Congestion
                      </div>
                      <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800">
                        Capacity: {centre.capacityAvailablePercent}% Avail
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Weighbridge throughput: {centre.capacityPerHourKg} kg/hr
                    </span>
                    <Button
                      size="sm"
                      variant={isSelected ? 'primary' : 'outline'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProceedStep2(centre);
                      }}
                    >
                      {isSelected ? 'Select Centre & Continue' : 'Select'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3: SELECT RECOMMENDED TIME SLOT */}
      {currentStep === 3 && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#111827]">
                Smart Recommended Time Slot
              </h2>
              <p className="text-xs text-[#6B7280]">
                Algorithmically optimized for {quantityKg} kg load at {selectedCentre?.name}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/farmer/book-slot/centre')}
            >
              Back
            </Button>
          </div>

          {/* Loading State */}
          {isSlotsLoading && (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-lg text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-[#166534] mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Calculating optimal mandi slots...</p>
              <p className="text-xs text-slate-500 mt-1">Analyzing mandi queue congestion, throughput, and arrival timing</p>
            </div>
          )}

          {/* Error State */}
          {!isSlotsLoading && slotsError && (
            <div className="p-6 text-center bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm font-bold">{slotsError}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 text-red-700 border-red-300 hover:bg-red-100"
                onClick={() => {
                  const centreToUse = selectedCentre || centres.find((c) => c.id === initialDraft.centreId) || centres[0];
                  const cropToUse = selectedCropId || initialDraft.cropId || crops[0]?.id;
                  if (centreToUse && cropToUse) {
                    const qty = parseFloat(quantityKg) || initialDraft.quantityKg || 750;
                    const dateToUse = bookingDate || initialDraft.date || todayStr;
                    setIsSlotsLoading(true);
                    setSlotsError(null);
                    getSmartRecommendations(centreToUse.id, cropToUse, qty, dateToUse)
                      .then((recs) => {
                        setSlots(recs);
                        const matchedDraft = recs.find((s) => s.id === initialDraft.slotId);
                        const top = matchedDraft || recs.find((s) => s.isRecommended) || recs[0];
                        setSelectedSlot(top || null);
                      })
                      .catch(() => setSlotsError('Unable to fetch available time slots. Please try again.'))
                      .finally(() => setIsSlotsLoading(false));
                  }
                }}
              >
                Retry Loading Slots
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!isSlotsLoading && !slotsError && slots.length === 0 && (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-lg text-slate-500">
              <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">No slots available for this date.</p>
              <p className="text-xs text-slate-500 mt-1">Please select another date or check back later.</p>
            </div>
          )}

          {/* Slots List */}
          {!isSlotsLoading && !slotsError && slots.length > 0 && (
            <div className="space-y-3">
              {slots.map((slot) => {
                const isSelected = selectedSlot?.id === slot.id;

                if (slot.isRecommended) {
                  return (
                    <div
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot)}
                      className={`relative p-5 rounded-card border-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'border-[#166534] bg-emerald-50/50 shadow-card ring-2 ring-[#166534]/20'
                          : 'border-[#166534]/70 bg-emerald-50/20 hover:bg-emerald-50/40'
                      }`}
                    >
                      <div className="absolute -top-3 left-5 bg-[#166534] text-white text-[11px] font-extrabold px-3 py-0.5 rounded-full flex items-center gap-1 shadow-subtle uppercase tracking-wider">
                        <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                        System Recommended Slot
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
                        <div>
                          <div className="text-lg sm:text-xl font-extrabold text-[#111827]">
                            {slot.timeWindow}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-[#166534] font-bold">
                            <Clock className="w-4 h-4" />
                            Estimated Wait: ~{slot.estimatedWaitMinutes} mins
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Why Recommended:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {slot.reasons.map((r, i) => (
                              <span
                                key={i}
                                className="text-[11px] font-bold bg-[#DCFCE7] text-[#166534] px-2 py-0.5 rounded border border-emerald-300"
                              >
                                ✓ {r}
                              </span>
                            ))}
                          </div>
                        </div>

                        <Button
                          variant="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSlotAndProceed(slot);
                          }}
                        >
                          Select Recommended Slot
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={slot.id}
                    onClick={() => {
                      setSelectedSlot(slot);
                      bookingService.saveDraftBooking({
                        slotId: slot.id,
                        timeWindow: slot.timeWindow,
                        date: slot.date || bookingDate,
                      });
                    }}
                    className={`p-4 rounded-card border bg-white transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-[#166534] shadow-card ring-2 ring-[#166534]/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-base font-bold text-[#111827]">{slot.timeWindow}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Estimated wait: ~{slot.estimatedWaitMinutes} mins • {slot.status}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          slot.statusCode === 'AVAILABLE'
                            ? 'bg-emerald-50 text-[#166534]'
                            : slot.statusCode === 'ALMOST_FULL'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {slot.status}
                      </span>

                      <Button
                        size="sm"
                        variant={isSelected ? 'primary' : 'outline'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSlotAndProceed(slot);
                        }}
                      >
                        {isSelected ? 'Continue with Slot' : 'Select'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 4: REVIEW & CONFIRM (PRE-CONFIRMATION) */}
      {currentStep === 4 && !confirmedBooking && (
        <Card className="animate-fade-in border border-slate-200 bg-white shadow-card overflow-hidden">
          <CardHeader className="bg-emerald-50/60 border-b border-emerald-100">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#166534] text-white flex items-center justify-center text-xs font-extrabold">
                4
              </span>
              <CardTitle className="text-base sm:text-lg">Review & Confirm Slot Booking</CardTitle>
            </div>
            <CardDescription>
              Please review your procurement details before official token generation and mandi appointment booking.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-5">
            {/* Review Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Farmer & Contact */}
              <div className="p-4 bg-slate-50 rounded-card border border-slate-200/80 space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Farmer Details
                </div>
                <div className="text-base font-extrabold text-slate-900">
                  {dataStore.getCurrentFarmer()?.name || 'Registered Farmer'}
                </div>
                <div className="text-xs text-slate-600">
                  Mobile: <span className="font-mono font-bold text-slate-800">{dataStore.getCurrentFarmer()?.mobileNumber || '--'}</span>
                </div>
                <div className="text-xs text-slate-600">
                  Registered Region:{' '}
                  <span className="font-medium text-slate-800">
                    {dataStore.getCurrentFarmer()?.district || selectedCentre?.district},{' '}
                    {dataStore.getCurrentFarmer()?.state || selectedCentre?.state}
                  </span>
                </div>
              </div>

              {/* Centre / Mandi Details */}
              <div className="p-4 bg-slate-50 rounded-card border border-slate-200/80 space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Procurement Centre (खरीद केंद्र)
                </div>
                <div className="text-base font-extrabold text-slate-900">
                  {selectedCentre?.name || centres[0]?.name || 'District Mandi'}
                </div>
                <div className="text-xs text-slate-600">
                  Location:{' '}
                  <span className="font-medium text-slate-800">
                    {selectedCentre?.district || centres[0]?.district},{' '}
                    {selectedCentre?.state || centres[0]?.state}
                  </span>
                </div>
                <div className="text-xs text-slate-600">
                  Operating Hours:{' '}
                  <span className="font-medium text-slate-800">
                    {selectedCentre?.workingHours?.start || '09:00 AM'} –{' '}
                    {selectedCentre?.workingHours?.end || '05:00 PM'}
                  </span>
                </div>
              </div>

              {/* Crop & Load Details */}
              <div className="p-4 bg-slate-50 rounded-card border border-slate-200/80 space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Crop & Load
                </div>
                <div className="text-base font-extrabold text-slate-900">
                  {selectedCrop?.name || 'Paddy'} {selectedCrop?.nameHindi ? `(${selectedCrop.nameHindi})` : ''}
                </div>
                <div className="text-xs text-slate-600">
                  Total Quantity:{' '}
                  <span className="font-extrabold text-slate-900">
                    {parseFloat(quantityKg) || 750} kg
                  </span>{' '}
                  ({((parseFloat(quantityKg) || 750) / 100).toFixed(1)} Quintals)
                </div>
                <div className="text-xs text-emerald-800 font-semibold">
                  Govt MSP: ₹{currentMsp} / quintal
                </div>
              </div>

              {/* Appointment Slot Details */}
              <div className="p-4 bg-emerald-50/60 rounded-card border border-emerald-200 space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                  Reserved Appointment
                </div>
                <div className="text-base font-extrabold text-slate-900">
                  {selectedSlot?.timeWindow || initialDraft.timeWindow || '10:00 AM – 10:30 AM'}
                </div>
                <div className="text-xs text-slate-700">
                  Procurement Date:{' '}
                  <span className="font-bold text-[#166534]">{bookingDate}</span>
                </div>
                <div className="text-xs text-slate-600 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  Estimated Wait: ~{selectedSlot?.estimatedWaitMinutes || 12} mins
                </div>
              </div>
            </div>

            {/* Estimated MSP Valuation Card */}
            <div className="p-4 bg-[#DCFCE7]/70 rounded-card border border-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#166534] text-white flex items-center justify-center shrink-0 shadow-subtle">
                  <Wheat className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                    Estimated MSP Valuation (अनुमानित भुगतान)
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#166534]">
                    {formatCurrency(estimatedAmount)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 font-bold text-xs text-[#166534] bg-white px-2.5 py-1 rounded border border-emerald-200 shadow-subtle">
                  <ShieldCheck className="w-4 h-4 text-[#166534]" />
                  MSP Guaranteed
                </span>
              </div>
            </div>

            {/* Direct Payout Notice */}
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-card flex items-start gap-2.5 text-xs text-blue-950">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Government DBT Guarantee:</strong> Upon gate entry and electronic weighbridge verification, your procurement payment will be directly credited to your Aadhaar-linked bank account via PFMS.
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 bg-slate-50/70 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={() => navigate('/farmer/book-slot/slots')}
              icon={<ArrowLeft className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Change Slot
            </Button>
            <Button
              variant="primary"
              onClick={handleFinalConfirmBooking}
              isLoading={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
              iconPosition="right"
              className="w-full sm:w-auto"
            >
              Confirm Booking
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 4: CONFIRMATION & DIGITAL TOKEN (POST-CONFIRMATION) */}
      {currentStep === 4 && confirmedBooking && (
        <Card className="animate-fade-in border-2 border-[#166534] bg-white overflow-hidden shadow-card">
          <div className="bg-[#166534] text-white p-5 text-center space-y-1">
            <div className="w-12 h-12 rounded-full bg-white text-[#166534] flex items-center justify-center mx-auto mb-2 shadow-subtle">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Slot Booking Confirmed!
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100">
              Your procurement appointment has been successfully scheduled and secured with MSP guarantee.
            </p>
          </div>

          <CardContent className="p-5 sm:p-6 space-y-5">
            {/* Dynamic Token Hero */}
            <div className="p-5 bg-emerald-50 rounded-card border-2 border-emerald-300 text-center space-y-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 block">
                Your Official Queue Token Number
              </span>
              <div className="text-5xl sm:text-6xl font-extrabold text-[#166534] font-mono tracking-tight py-1">
                #{confirmedBooking.tokenNumber}
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Procurement Centre: <strong>{confirmedBooking.centreName}</strong>
              </p>
            </div>

            {/* Digital Gate Pass & QR Representation */}
            <div className="p-4 bg-slate-50 rounded-card border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-white border border-slate-300 rounded-lg flex items-center justify-center p-2 shadow-subtle">
                  <QrCode className="w-12 h-12 text-slate-800" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Digital Mandi Entry Pass
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    Pass ID: {confirmedBooking.id}
                  </div>
                  <div className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1 mt-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Fast-Track Check-in
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-slate-500 sm:border-l sm:border-slate-200 sm:pl-4">
                <div>Report at <strong>Gate 2</strong></div>
                <div className="text-[11px] text-slate-400 mt-0.5">{confirmedBooking.timeWindow}</div>
              </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-input border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Farmer:</span>
                <div className="font-bold text-slate-900 mt-0.5">{confirmedBooking.farmerName}</div>
              </div>
              <div>
                <span className="text-slate-500">Crop:</span>
                <div className="font-bold text-slate-900 mt-0.5">{confirmedBooking.cropName} {confirmedBooking.cropNameHindi ? `(${confirmedBooking.cropNameHindi})` : ''}</div>
              </div>
              <div>
                <span className="text-slate-500">Batch Quantity:</span>
                <div className="font-bold text-slate-900 mt-0.5">{confirmedBooking.quantityKg} kg</div>
              </div>
              <div>
                <span className="text-slate-500">Date:</span>
                <div className="font-bold text-slate-900 mt-0.5">{confirmedBooking.date}</div>
              </div>
              <div>
                <span className="text-slate-500">Booked Slot:</span>
                <div className="font-bold text-slate-900 mt-0.5">{confirmedBooking.timeWindow}</div>
              </div>
              <div>
                <span className="text-slate-500">MSP Valuation:</span>
                <div className="font-bold text-[#166534] mt-0.5">
                  {formatCurrency(((confirmedBooking.quantityKg) / 100) * (currentMsp || 2275))}
                </div>
              </div>
            </div>

            {/* Simulated SMS Alert */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-card flex items-start gap-2 text-xs text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">SMS Confirmation Sent: </span>
                Token #{confirmedBooking.tokenNumber} confirmed for {confirmedBooking.timeWindow}. Check live wait time anytime on the AgriQueue app.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="primary"
                className="flex-1"
                icon={<Clock className="w-4 h-4" />}
                onClick={() => navigate('/farmer/queue')}
              >
                View in Live Virtual Queue
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/farmer/dashboard')}
              >
                Return to Farmer Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
