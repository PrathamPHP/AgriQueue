import React, { createContext, useContext } from 'react';

export interface AdminMapContextType {
  isSharedMapActive: boolean;
  viewMode: 'map' | 'table';
  setViewMode: (mode: 'map' | 'table') => void;
  selectedStateName: string | null;
  isRefreshing?: boolean;
  triggerRefresh?: () => void;
}

const AdminMapContext = createContext<AdminMapContextType>({
  isSharedMapActive: false,
  viewMode: 'map',
  setViewMode: () => {},
  selectedStateName: null,
});

export const AdminMapProvider: React.FC<{
  value: AdminMapContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <AdminMapContext.Provider value={value}>
      {children}
    </AdminMapContext.Provider>
  );
};

export const useAdminMap = (): AdminMapContextType => {
  return useContext(AdminMapContext);
};
