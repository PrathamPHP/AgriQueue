import React, { useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { LanguageCode } from '@/types';
import { TopNavigation } from '@/components/navigation/TopNavigation';
import { MobileBottomNavigation } from '@/components/navigation/MobileBottomNavigation';
import { FarmerDashboard } from '@/components/farmer/FarmerDashboard';
import { BookSlotWizard } from '@/components/farmer/BookSlotWizard';
import { LiveQueueScreen } from '@/components/farmer/LiveQueueScreen';
import { FarmerBookingsList } from '@/components/farmer/FarmerBookingsList';
import { ProcurementDetailScreen } from '@/components/farmer/ProcurementDetailScreen';
import { PaymentDetailScreen } from '@/components/farmer/PaymentDetailScreen';
import { OfficerDashboard } from '@/components/officer/OfficerDashboard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { NationalAdminDashboard } from '@/components/admin/NationalAdminDashboard';
import { StateDashboard } from '@/components/admin/StateDashboard';
import { DistrictDashboard } from '@/components/admin/DistrictDashboard';
import { CentreDashboard } from '@/components/admin/CentreDashboard';
import { DemoControls } from '@/components/demo/DemoControls';
import { LoginPage } from '@/components/auth/LoginPage';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { NotFoundPage } from '@/components/common/NotFoundPage';
import { dataStore } from '@/services/dataStore';

const RootRedirect: React.FC = () => {
  const isFarmerAuth = dataStore.isFarmerAuthenticated();
  return <Navigate to={isFarmerAuth ? '/farmer/dashboard' : '/login'} replace />;
};

const ProtectedFarmerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuth = dataStore.isFarmerAuthenticated();
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const ProtectedOfficerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuth = dataStore.isOfficerAuthenticated();
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuth = dataStore.isAdminAuthenticated();
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function AppContent() {
  const location = useLocation();
  const { language, setLanguage } = useLanguage();

  const isFarmerRoute = location.pathname.startsWith('/farmer');

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col pb-20 sm:pb-8">
      {/* 1. Official Government Top Navigation */}
      <TopNavigation
        currentLanguage={language}
        onLanguageChange={setLanguage}
      />

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5">
        <Routes>
          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />

          {/* Farmer Journey Routes (Protected) */}
          <Route
            path="/farmer/dashboard"
            element={
              <ProtectedFarmerRoute>
                <FarmerDashboard currentLanguage={language} />
              </ProtectedFarmerRoute>
            }
          />
          <Route
            path="/farmer/book-slot"
            element={
              <ProtectedFarmerRoute>
                <BookSlotWizard currentLanguage={language} />
              </ProtectedFarmerRoute>
            }
          />
          <Route
            path="/farmer/book-slot/centre"
            element={
              <ProtectedFarmerRoute>
                <BookSlotWizard currentLanguage={language} />
              </ProtectedFarmerRoute>
            }
          />
          <Route
            path="/farmer/book-slot/slots"
            element={
              <ProtectedFarmerRoute>
                <BookSlotWizard currentLanguage={language} />
              </ProtectedFarmerRoute>
            }
          />
          <Route
            path="/farmer/book-slot/confirmation"
            element={
              <ProtectedFarmerRoute>
                <BookSlotWizard currentLanguage={language} />
              </ProtectedFarmerRoute>
            }
          />
          <Route
            path="/farmer/queue"
            element={
              <ProtectedFarmerRoute>
                <LiveQueueScreen currentLanguage={language} />
              </ProtectedFarmerRoute>
            }
          />
          <Route
            path="/farmer/bookings"
            element={
              <ProtectedFarmerRoute>
                <FarmerBookingsList currentLanguage={language} />
              </ProtectedFarmerRoute>
            }
          />
          <Route
            path="/farmer/procurement/:id"
            element={
              <ProtectedFarmerRoute>
                <ProcurementDetailScreen currentLanguage={language} />
              </ProtectedFarmerRoute>
            }
          />
          <Route
            path="/farmer/payment/:id"
            element={
              <ProtectedFarmerRoute>
                <PaymentDetailScreen currentLanguage={language} />
              </ProtectedFarmerRoute>
            }
          />

          {/* Officer Dashboard & Operations Routes (Protected) */}
          <Route path="/officer" element={<Navigate to="/officer/dashboard" replace />} />
          <Route
            path="/officer/dashboard"
            element={
              <ProtectedOfficerRoute>
                <OfficerDashboard />
              </ProtectedOfficerRoute>
            }
          />
          <Route
            path="/officer/queue"
            element={
              <ProtectedOfficerRoute>
                <OfficerDashboard />
              </ProtectedOfficerRoute>
            }
          />
          <Route
            path="/officer/bookings"
            element={
              <ProtectedOfficerRoute>
                <OfficerDashboard />
              </ProtectedOfficerRoute>
            }
          />
          <Route
            path="/officer/procurements"
            element={
              <ProtectedOfficerRoute>
                <OfficerDashboard />
              </ProtectedOfficerRoute>
            }
          />
          <Route
            path="/officer/procurement/:id"
            element={
              <ProtectedOfficerRoute>
                <ProcurementDetailScreen currentLanguage={language} />
              </ProtectedOfficerRoute>
            }
          />
          <Route
            path="/officer/payments"
            element={
              <ProtectedOfficerRoute>
                <OfficerDashboard />
              </ProtectedOfficerRoute>
            }
          />
          <Route
            path="/officer/analytics"
            element={
              <ProtectedOfficerRoute>
                <OfficerDashboard />
              </ProtectedOfficerRoute>
            }
          />
          <Route
            path="/officer/settings"
            element={
              <ProtectedOfficerRoute>
                <OfficerDashboard />
              </ProtectedOfficerRoute>
            }
          />

          {/* Multi-Tier Nationwide Administrative Hierarchy (Protected with Persistent Map Layout) */}
          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="national" element={<NationalAdminDashboard />} />
            <Route path="state/:stateId" element={<StateDashboard />} />
            <Route path="district/:districtId" element={<DistrictDashboard />} />
            <Route path="centre/:centreId" element={<CentreDashboard />} />
          </Route>

          {/* Evaluator / Jury Demo Controls */}
          <Route path="/demo-controls" element={<DemoControls />} />

          {/* Catch-all Fallback (Official 404 Page) */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      {/* 3. Mobile Bottom Navigation (Shown only for Farmer Experience on small screens) */}
      {isFarmerRoute && <MobileBottomNavigation />}
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
