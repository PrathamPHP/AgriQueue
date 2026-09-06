import React from 'react';
import { Navigate } from 'react-router-dom';
import { dataStore } from '@/services/dataStore';
import { NationalAdminDashboard } from './NationalAdminDashboard';

export const AdminDashboard: React.FC = () => {
  const currentAdmin = dataStore.getCurrentAdmin();

  const scopeVal = currentAdmin.scopeId || currentAdmin.scopeValue;

  if (currentAdmin.scopeType === 'STATE' && scopeVal) {
    return <Navigate to={`/admin/state/${scopeVal}`} replace />;
  }

  if (currentAdmin.scopeType === 'DISTRICT' && scopeVal) {
    return <Navigate to={`/admin/district/${scopeVal}`} replace />;
  }

  if (currentAdmin.scopeType === 'CENTRE' && scopeVal) {
    return <Navigate to={`/admin/centre/${scopeVal}`} replace />;
  }

  return <NationalAdminDashboard />;
};

export default AdminDashboard;
