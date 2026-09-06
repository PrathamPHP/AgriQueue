import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Globe, ArrowLeft } from 'lucide-react';

import { dataStore } from '@/services/dataStore';

export interface GeographicBreadcrumbsProps {
  stateId?: string;
  stateName?: string;
  districtId?: string;
  districtName?: string;
  centreId?: string;
  centreName?: string;
  showBack?: boolean;
}

export const GeographicBreadcrumbs: React.FC<GeographicBreadcrumbsProps> = ({
  stateId,
  stateName,
  districtId,
  districtName,
  centreId,
  centreName,
  showBack = true,
}) => {
  const navigate = useNavigate();
  const currentAdmin = dataStore.getCurrentAdmin();
  const isNational = currentAdmin.scopeType === 'NATIONAL';
  const isDistrict = currentAdmin.scopeType === 'DISTRICT';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 bg-white border border-slate-200 rounded-lg shadow-2xs mb-4 text-xs">
      <div className="flex items-center gap-1.5 flex-wrap text-slate-600">
        {/* National Level */}
        {isNational ? (
          <Link
            to="/admin/national"
            className="flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950 hover:underline transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>India (National)</span>
          </Link>
        ) : (
          <span className="flex items-center gap-1 font-medium text-slate-400">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>India</span>
          </span>
        )}

        {/* State Level */}
        {stateId && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {(districtId || centreId) && !isDistrict ? (
              <Link
                to={`/admin/state/${stateId}`}
                className="font-medium text-emerald-800 hover:text-emerald-950 hover:underline transition-colors"
              >
                {stateName || stateId}
              </Link>
            ) : (
              <span className={`font-bold px-2 py-0.5 rounded ${isDistrict ? 'text-slate-500 bg-slate-50' : 'text-slate-900 bg-slate-100'}`}>
                {stateName || stateId}
              </span>
            )}
          </>
        )}

        {/* District Level */}
        {districtId && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {centreId ? (
              <Link
                to={`/admin/district/${districtId}`}
                className="font-medium text-emerald-800 hover:text-emerald-950 hover:underline transition-colors"
              >
                {districtName || districtId}
              </Link>
            ) : (
              <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {districtName || districtId}
              </span>
            )}
          </>
        )}

        {/* Centre Level */}
        {centreId && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-bold text-slate-900 bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">
              {centreName || centreId}
            </span>
          </>
        )}
      </div>

      {showBack && (
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors font-medium cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      )}
    </div>
  );
};
