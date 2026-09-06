import React, { Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { TopNavigation } from '@/components/navigation/TopNavigation';
import { MobileBottomNavigation } from '@/components/navigation/MobileBottomNavigation';
import { LanguageProvider, useLanguage } from '@/i18n/LanguageContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { dataStore } from '@/services/dataStore';
import { RefreshCw } from 'lucide-react';

import { lazyWithRetry } from '@/lib/lazyWithRetry';

// Route-level code splitting via resilient lazyWithRetry
const LoginPage = lazyWithRetry(() => import('@/components/auth/LoginPage'), 'LoginPage');

// Farmer screens
const FarmerDashboard = lazyWithRetry(
  () => import('@/components/farmer/FarmerDashboard'),
  'FarmerDashboard'
);
const BookSlotWizard = lazyWithRetry(
  () => import('@/components/farmer/BookSlotWizard'),
  'BookSlotWizard'
);
const LiveQueueScreen = lazyWithRetry(
  () => import('@/components/farmer/LiveQueueScreen'),
  'LiveQueueScreen'
);
const FarmerBookingsList = lazyWithRetry(
  () => import('@/components/farmer/FarmerBookingsList'),
  'FarmerBookingsList'
);
const ProcurementDetailScreen = lazyWithRetry(
  () => import('@/components/farmer/ProcurementDetailScreen'),
  'ProcurementDetailScreen'
);
const PaymentDetailScreen = lazyWithRetry(
  () => import('@/components/farmer/PaymentDetailScreen'),
  'PaymentDetailScreen'
);

// Officer Terminal
const OfficerDashboard = lazyWithRetry(
  () => import('@/components/officer/OfficerDashboard'),
  'OfficerDashboard'
);

// Administrative Hierarchy
const AdminLayout = lazyWithRetry(
  () => import('@/components/admin/AdminLayout'),
  'AdminLayout'
);
const AdminDashboard = lazyWithRetry(
  () => import('@/components/admin/AdminDashboard'),
  'AdminDashboard'
);
const NationalAdminDashboard = lazyWithRetry(
  () => import('@/components/admin/NationalAdminDashboard'),
  'NationalAdminDashboard'
);
const StateDashboard = lazyWithRetry(
  () => import('@/components/admin/StateDashboard'),
  'StateDashboard'
);
const DistrictDashboard = lazyWithRetry(
  () => import('@/components/admin/DistrictDashboard'),
  'DistrictDashboard'
);
const CentreDashboard = lazyWithRetry(
  () => import('@/components/admin/CentreDashboard'),
  'CentreDashboard'
);

// Utilities
const DemoControls = lazyWithRetry(
  () => import('@/components/demo/DemoControls'),
  'DemoControls'
);
const NotFoundPage = lazyWithRetry(
  () => import('@/components/common/NotFoundPage'),
  'NotFoundPage'
);

// Non-disruptive, government-styled loading fallback for lazy-loaded route boundaries
const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[450px] flex flex-col items-center justify-center p-8 text-center animate-fade-in">
    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-[#166534] mb-3">
      <RefreshCw className="w-6 h-6 animate-spin" />
    </div>
    <span className="text-sm font-bold text-slate-800">Loading screen...</span>
    <span className="text-xs text-slate-500 mt-1">Connecting to AgriQueue operations network</span>
  </div>
);

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
        <ErrorBoundary resetKeys={[location.pathname]}>
          <Suspense fallback={<RouteLoadingFallback />}>
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
        </Suspense>
      </ErrorBoundary>
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
