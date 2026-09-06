import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    AgroIndiaMap?: any;
    AGRO_MAP_EMBEDDED?: any;
    AGRO_PROCUREMENT_DATA?: any;
  }
}

export interface DistrictProcurementData {
  name: string;
  centralized?: number;
  mcpc?: number;
  fpo?: number;
  shg?: number;
  society?: number;
  paddyProcuredMT?: string;
  farmersBenefitted?: string;
  season?: string;
}

export interface AgroIndiaMapComponentProps {
  initialState?: string;
  selectedState?: string | null;
  width?: number;
  height?: number;
  onSelectState?: (stateName: string) => void;
  onSelectDistrict?: (districtData: DistrictProcurementData) => void;
  onBackToIndia?: () => void;
  className?: string;
}

export const AgroIndiaMapComponent: React.FC<AgroIndiaMapComponentProps> = ({
  initialState,
  selectedState,
  width = 960,
  height = 720,
  onSelectState,
  onSelectDistrict,
  onBackToIndia,
  className = '',
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  // Keep latest callbacks in refs so changing their identities never triggers re-init
  const onSelectStateRef = useRef(onSelectState);
  onSelectStateRef.current = onSelectState;

  const onSelectDistrictRef = useRef(onSelectDistrict);
  onSelectDistrictRef.current = onSelectDistrict;

  const onBackToIndiaRef = useRef(onBackToIndia);
  onBackToIndiaRef.current = onBackToIndia;

  // Poll until window.AgroIndiaMap is available
  useEffect(() => {
    let timer: any = null;
    const checkReady = () => {
      if (typeof window !== 'undefined' && window.AgroIndiaMap) {
        setIsReady(true);
      } else {
        timer = setTimeout(checkReady, 100);
      }
    };
    checkReady();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  // 1. One-time Map Initialization on Mount
  useEffect(() => {
    if (!isReady || !mapRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    const targetInitialState = selectedState || initialState;

    try {
      mapRef.current.innerHTML = '';

      mapInstanceRef.current = new window.AgroIndiaMap(mapRef.current, {
        width,
        height,
        initialState: targetInitialState,
        onStateSelect: (stateName: string) => {
          if (onSelectStateRef.current) onSelectStateRef.current(stateName);
        },
        onDistrictSelect: (data: DistrictProcurementData) => {
          if (onSelectDistrictRef.current) onSelectDistrictRef.current(data);
        },
        onBackToIndia: () => {
          if (onBackToIndiaRef.current) onBackToIndiaRef.current();
        },
      });
    } catch (err) {
      console.error('Failed to initialize AgroIndiaMap:', err);
    }

    return () => {
      if (mapInstanceRef.current && typeof mapInstanceRef.current.destroy === 'function') {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      } else if (mapRef.current) {
        mapRef.current.innerHTML = '';
      }
    };
  }, [isReady]);

  // 2. Imperative State Selection Updates (Smooth Camera Transitions)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedState) {
      // If the map is not already focused on this state, zoom in smoothly
      const current = map.getCurrentState ? map.getCurrentState() : null;
      if (current !== selectedState) {
        map.selectStateByName(selectedState, false);
      }
    } else if (selectedState === null || (selectedState === undefined && !initialState)) {
      // If selectedState is explicitly null (or cleared), zoom out smoothly to full India
      const isZoomed = map.isStateZoomed ? map.isStateZoomed() : false;
      const current = map.getCurrentState ? map.getCurrentState() : null;
      if (isZoomed || current) {
        map.zoomOutToIndia(false);
      }
    }
  }, [selectedState]);

  return (
    <div className={`w-full max-w-[1200px] mx-auto overflow-hidden rounded-card border border-slate-200 bg-white shadow-card ${className}`}>
      <div ref={mapRef} id="agro-map-container" />
    </div>
  );
};

export default AgroIndiaMapComponent;
