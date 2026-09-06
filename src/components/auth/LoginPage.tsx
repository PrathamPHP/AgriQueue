import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataStore } from '@/services/dataStore';
import { farmerService } from '@/services/farmerService';
import { Farmer, LanguageCode } from '@/types';
import { Card, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { InputField } from '@/components/forms/InputField';
import {
  Wheat,
  ShieldCheck,
  Building2,
  UserPlus,
  LogIn,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { validateAadhaar, validateMobile, validateName } from '@/lib/validation';
import { useTranslation } from '@/i18n/LanguageContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<'farmer' | 'officer' | 'admin'>('farmer');

  const farmers = dataStore.getFarmers();
  const [isRegistering, setIsRegistering] = useState<boolean>(farmers.length === 0);

  const states = dataStore.getStates();
  const [selectedStateId, setSelectedStateId] = useState<string>(states[0]?.id || '');
  const districts = dataStore.getDistricts(selectedStateId);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(districts[0]?.id || '');

  // Registration Form State with touched/error tracking
  const [name, setName] = useState<string>('');
  const [nameTouched, setNameTouched] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string>('');

  const [mobile, setMobile] = useState<string>('');
  const [mobileTouched, setMobileTouched] = useState<boolean>(false);
  const [mobileError, setMobileError] = useState<string>('');

  const [aadhaar, setAadhaar] = useState<string>('');
  const [aadhaarTouched, setAadhaarTouched] = useState<boolean>(false);
  const [aadhaarError, setAadhaarError] = useState<string>('');

  const [village, setVillage] = useState<string>('');
  const [languagePref, setLanguagePref] = useState<LanguageCode>(language || 'en');
  const [landArea, setLandArea] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [regError, setRegError] = useState<string>('');

  // Existing Farmer Login State
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>(farmers[0]?.id || '');

  // Officer Login State
  const officers = dataStore.getOfficers();
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>(dataStore.getCurrentOfficer()?.id || officers[0]?.id || '');

  // Admin Login State
  const adminUsers = dataStore.getAdminUsers();
  const [selectedAdminId, setSelectedAdminId] = useState<string>(dataStore.getCurrentAdmin()?.id || adminUsers[0]?.id || '');

  const handleStateChange = (stId: string) => {
    setSelectedStateId(stId);
    const newDistricts = dataStore.getDistricts(stId);
    if (newDistricts.length > 0) {
      setSelectedDistrictId(newDistricts[0].id);
    } else {
      setSelectedDistrictId('');
    }
  };

  const [isRegisteringLoading, setIsRegisteringLoading] = useState<boolean>(false);

  const handleRegisterFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    setNameTouched(true);
    setMobileTouched(true);
    setAadhaarTouched(true);

    const nameRes = validateName(name);
    if (!nameRes.isValid) {
      setNameError(nameRes.error);
    }
    const mobileRes = validateMobile(mobile);
    if (!mobileRes.isValid) {
      setMobileError(mobileRes.error);
    }
    const aadhaarRes = validateAadhaar(aadhaar);
    if (!aadhaarRes.isValid) {
      setAadhaarError(aadhaarRes.error);
    }

    if (!nameRes.isValid || !mobileRes.isValid || !aadhaarRes.isValid) {
      setRegError(nameRes.error || mobileRes.error || aadhaarRes.error);
      return;
    }

    const stateObj = dataStore.getStateById(selectedStateId);
    if (!selectedStateId || !stateObj) {
      setRegError('Please select a valid State.');
      return;
    }
    const districtObj = dataStore.getDistrictById(selectedDistrictId);
    if (!selectedDistrictId || !districtObj) {
      setRegError('Please select a valid District.');
      return;
    }

    const newFarmer: Farmer = {
      id: `farmer-${Date.now().toString().slice(-6)}`,
      name: name.trim(),
      mobileNumber: `+91 ${mobileRes.cleanDigits}`,
      aadhaarNumber: aadhaarRes.cleanDigits,
      languagePref,
      address: village.trim()
        ? `${village.trim()}, ${districtObj.name}`
        : `${districtObj.name}, ${stateObj.name}`,
      village: village.trim() || undefined,
      stateId: stateObj.id,
      districtId: districtObj.id,
      district: districtObj.name,
      state: stateObj.name,
      landAreaAcres: landArea ? parseFloat(landArea) : undefined,
      bankAccountMasked: bankAccount.trim() ? bankAccount.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    setIsRegisteringLoading(true);
    try {
      const savedFarmer = await farmerService.registerFarmer(newFarmer);
      dataStore.setCurrentFarmerId(savedFarmer.id);
      navigate('/farmer/dashboard');
    } catch (err: any) {
      console.error('Registration error:', err);
      setRegError(err?.message || 'Failed to register farmer. Please try again.');
    } finally {
      setIsRegisteringLoading(false);
    }
  };

  const handleExistingFarmerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFarmerId) {
      dataStore.setCurrentFarmerId(selectedFarmerId);
      navigate('/farmer/dashboard');
    }
  };

  const handleOfficerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    dataStore.setCurrentOfficerId(selectedOfficerId);
    navigate('/officer/dashboard');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    dataStore.setCurrentAdminId(selectedAdminId);
    const admin = dataStore.getCurrentAdmin();
    const scopeVal = admin.scopeId || admin.scopeValue;
    if (admin.scopeType === 'STATE' && scopeVal) {
      navigate(`/admin/state/${scopeVal}`);
    } else if (admin.scopeType === 'DISTRICT' && scopeVal) {
      navigate(`/admin/district/${scopeVal}`);
    } else {
      navigate('/admin/national');
    }
  };

  return (
    <div className="max-w-md mx-auto my-6 p-4 animate-fade-in">
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-[#DCFCE7] text-[#166534] rounded-card flex items-center justify-center mx-auto mb-3 border border-emerald-200 shadow-subtle">
          <Wheat className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#111827]">AgriQueue Portal</h1>
        <p className="text-xs text-slate-500 mt-1">
          Smart Procurement Scheduling & Virtual Queue Platform
        </p>
      </div>

      <Card className="p-6 bg-white border border-slate-200 shadow-card">
        {/* Role Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-card mb-5">
          <button
            type="button"
            onClick={() => setSelectedRole('farmer')}
            className={`text-xs font-bold py-2 rounded-button transition-colors ${
              selectedRole === 'farmer'
                ? 'bg-white text-[#166534] shadow-subtle'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Farmer Portal
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole('officer')}
            className={`text-xs font-bold py-2 rounded-button transition-colors ${
              selectedRole === 'officer'
                ? 'bg-white text-[#166534] shadow-subtle'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mandi Officer
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole('admin')}
            className={`text-xs font-bold py-2 rounded-button transition-colors ${
              selectedRole === 'admin'
                ? 'bg-white text-[#166534] shadow-subtle'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            State Admin
          </button>
        </div>

        {/* 1. FARMER PORTAL VIEW */}
        {selectedRole === 'farmer' && (
          <div>
            {/* Toggle between Register and Existing Login if farmers exist */}
            {farmers.length > 0 && (
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 text-xs">
                <span className="text-slate-500">
                  {isRegistering ? 'Have an existing profile?' : 'Registering a new farmer?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setRegError('');
                  }}
                  className="font-bold text-[#166534] hover:underline"
                >
                  {isRegistering ? 'Sign In' : '+ New Farmer Registration'}
                </button>
              </div>
            )}

            {isRegistering ? (
              /* REAL FARMER REGISTRATION FORM */
              <form onSubmit={handleRegisterFarmer} noValidate className="space-y-3.5 text-xs">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-[#166534]" />
                    {t('register', 'New Farmer Registration')}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Register with your real details to book congestion-free MSP mandi slots.
                  </p>
                </div>

                {regError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-input text-red-700 font-semibold text-xs">
                    {regError}
                  </div>
                )}

                <InputField
                  label={`${t('name', 'Full Name')} *`}
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setName(val);
                    if (val.trim()) {
                      setNameError('');
                      setRegError('');
                    }
                  }}
                  onBlur={() => {
                    setNameTouched(true);
                    if (!name.trim()) {
                      setNameError('Please enter your full name.');
                    } else {
                      setNameError('');
                    }
                  }}
                  error={(hasSubmitted || nameTouched) ? nameError : undefined}
                />

                <InputField
                  label={`${t('mobileNumber', 'Mobile Number')} *`}
                  placeholder="10-digit mobile number"
                  type="tel"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setMobile(val);
                    if (val.length === 10) {
                      setMobileError('');
                      setRegError('');
                    }
                  }}
                  onBlur={() => {
                    setMobileTouched(true);
                    const res = validateMobile(mobile);
                    if (!res.isValid) {
                      setMobileError(res.error);
                    } else {
                      setMobileError('');
                    }
                  }}
                  error={(hasSubmitted || mobileTouched) ? mobileError : undefined}
                />

                {/* Aadhaar Number Field */}
                <div>
                  <InputField
                    label={`${t('aadhaarNumber', 'Aadhaar Number')} *`}
                    placeholder="12-digit Aadhaar number (e.g. 123412341234)"
                    type="text"
                    maxLength={14}
                    value={aadhaar}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAadhaar(val);
                      const res = validateAadhaar(val);
                      if (res.isValid) {
                        setAadhaarError('');
                        setRegError('');
                      }
                    }}
                    onBlur={() => {
                      setAadhaarTouched(true);
                      const res = validateAadhaar(aadhaar);
                      if (!res.isValid) {
                        setAadhaarError(res.error);
                      } else {
                        setAadhaarError('');
                      }
                    }}
                    error={(hasSubmitted || aadhaarTouched) ? aadhaarError : undefined}
                  />
                  {validateAadhaar(aadhaar).isValid && (
                    <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{t('aadhaarFormatValid', 'Aadhaar format valid')}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <InputField
                    label={`${t('village', 'Village / City')} - ${t('optional', 'Optional')}`}
                    placeholder="e.g. Indri or Samrala"
                    value={village}
                    onChange={(e) => {
                      setVillage(e.target.value);
                      setRegError('');
                    }}
                  />

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t('state', 'State')} *</label>
                    <select
                      value={selectedStateId}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-input p-2 focus:outline-hidden focus:ring-1 focus:ring-[#166534] cursor-pointer"
                    >
                      {states.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t('district', 'District')} *</label>
                    <select
                      value={selectedDistrictId}
                      onChange={(e) => setSelectedDistrictId(e.target.value)}
                      className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-input p-2 focus:outline-hidden focus:ring-1 focus:ring-[#166534] cursor-pointer"
                    >
                      {districts.map((dst) => (
                        <option key={dst.id} value={dst.id}>
                          {dst.name} ({dst.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t('language', 'Language')}</label>
                    <select
                      value={languagePref}
                      onChange={(e) => {
                        const newLang = e.target.value as LanguageCode;
                        setLanguagePref(newLang);
                        setLanguage(newLang);
                      }}
                      className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-input p-2 focus:outline-hidden focus:ring-1 focus:ring-[#166534] cursor-pointer"
                    >
                      <option value="en">English</option>
                      <option value="hi">हिंदी (Hindi)</option>
                      <option value="kn">ಕನ್ನಡ (Kannada)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <InputField
                    label={`Land Area (Acres) - ${t('optional', 'Optional')}`}
                    placeholder="e.g. 4.0"
                    type="number"
                    step="0.1"
                    value={landArea}
                    onChange={(e) => setLandArea(e.target.value)}
                  />

                  <InputField
                    label={`Bank Account - ${t('optional', 'Optional')}`}
                    placeholder="e.g. SBI •••• 4921"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2"
                  isLoading={isRegisteringLoading}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('continue', 'Register & Access Farmer Dashboard')}
                </Button>
              </form>
            ) : (
              /* EXISTING FARMER SIGN IN */
              <form onSubmit={handleExistingFarmerLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Registered Farmer Profile
                  </label>
                  <select
                    value={selectedFarmerId}
                    onChange={(e) => setSelectedFarmerId(e.target.value)}
                    className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-input p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#166534]"
                  >
                    {farmers.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} • {f.village}, {f.district} ({f.mobileNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2"
                  icon={<LogIn className="w-4 h-4" />}
                >
                  Sign In to Farmer Dashboard
                </Button>
              </form>
            )}
          </div>
        )}

        {/* 2. OFFICER LOGIN */}
        {selectedRole === 'officer' && (
          <form onSubmit={handleOfficerLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Procurement Officer Persona
              </label>
              <select
                value={selectedOfficerId}
                onChange={(e) => setSelectedOfficerId(e.target.value)}
                className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-input p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#166534] cursor-pointer"
              >
                {officers.map((off) => {
                  const c = dataStore.getCentreById(off.centreId);
                  const d = c && c.districtId ? dataStore.getDistrictById(c.districtId) : undefined;
                  return (
                    <option key={off.id} value={off.id}>
                      {off.name} ({off.role}) — {c?.name || 'Mandi'}, {d?.name || ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {(() => {
              const off = officers.find((o) => o.id === selectedOfficerId) || officers[0];
              const c = off ? dataStore.getCentreById(off.centreId) : undefined;
              const d = c && c.districtId ? dataStore.getDistrictById(c.districtId) : undefined;
              const s = d ? dataStore.getStateById(d.stateId) : undefined;

              return (
                <div className="p-3 bg-emerald-50 rounded-card border border-emerald-200 text-xs text-slate-700 space-y-1.5">
                  <div className="font-bold text-[#166534] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    {off?.role || 'Procurement Inspector'}
                  </div>
                  <div className="font-bold text-slate-900">{off?.name}</div>
                  <div className="text-slate-600">
                    Depot: <span className="font-semibold text-slate-800">{c?.name}</span> ({c?.code})
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Jurisdiction: {d?.name}, {s?.name}
                  </div>
                </div>
              );
            })()}

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Access Officer Command Center
            </Button>
          </form>
        )}

        {/* 3. ADMIN LOGIN */}
        {selectedRole === 'admin' && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Administrative Authority & Scope
              </label>
              <select
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
                className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-input p-2.5 focus:outline-hidden focus:ring-2 focus:ring-purple-700 cursor-pointer"
              >
                {adminUsers.map((adm) => (
                  <option key={adm.id} value={adm.id}>
                    {adm.name} — {adm.scopeName} ({adm.scopeType})
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const adm = adminUsers.find((a) => a.id === selectedAdminId) || adminUsers[0];
              return (
                <div className="p-3 bg-purple-50 rounded-card border border-purple-200 text-xs text-slate-700 space-y-1.5">
                  <div className="font-bold text-purple-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    Administrative Oversight Level
                  </div>
                  <div className="font-bold text-slate-900">{adm?.name}</div>
                  <div className="text-slate-600">
                    Jurisdiction: <span className="font-semibold text-slate-800">{adm?.scopeName}</span> ({adm?.scopeType})
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {adm?.scopeType === 'NATIONAL'
                      ? 'National-wide command oversight across all Indian states'
                      : adm?.scopeType === 'STATE'
                      ? 'State Directorate telemetry & inter-district load rebalancing'
                      : 'District-level mandi capacity & gate inspection'}
                  </div>
                </div>
              );
            })()}

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Access Administrative Dashboard
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default LoginPage;
