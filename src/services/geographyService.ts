/**
 * AgriQueue Geography Service
 * Dedicated service responsible strictly for geographic entity queries:
 * States, Districts, and Procurement Centres (Mandis).
 */

import { State, District, ProcurementCentre } from '@/types';
import { dataStore } from './dataStore';
import { apiClient } from './apiClient';

class GeographyService {
  /**
   * Returns all States and Union Territories.
   */
  public getStates(filterActive: boolean = false): State[] {
    const states = dataStore.getStates();
    if (filterActive) {
      return states.filter((s) => s.isActive !== false);
    }
    return states;
  }

  /**
   * Retrieves a State or UT by its unique identifier (e.g. 'state-haryana', 'ut-delhi').
   */
  public getStateById(stateId: string): State | undefined {
    return dataStore.getStateById(stateId);
  }

  /**
   * Retrieves a State or UT by exact, code, or normalized name (handling &, Islands, etc.).
   */
  public getStateByName(name: string): State | undefined {
    if (!name) return undefined;
    const trimmed = name.trim().toLowerCase();
    const states = dataStore.getStates();

    // 1. Direct match by name, id, or code
    const direct = states.find(
      (s) =>
        s.name.toLowerCase() === trimmed ||
        s.id.toLowerCase() === trimmed ||
        s.code.toLowerCase() === trimmed
    );
    if (direct) return direct;

    // 2. Normalized match (e.g. 'Jammu & Kashmir' <-> 'Jammu and Kashmir', 'Andaman & Nicobar' <-> 'Andaman and Nicobar Islands')
    const norm = (str: string) =>
      str.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
    const normTarget = norm(trimmed);

    return states.find((s) => {
      const normState = norm(s.name);
      return (
        normState === normTarget ||
        normState.includes(normTarget) ||
        normTarget.includes(normState)
      );
    });
  }

  /**
   * Returns all districts, optionally filtered by stateId.
   */
  public getDistricts(stateId?: string, filterActive: boolean = false): District[] {
    const districts = dataStore.getDistricts(stateId);
    if (filterActive) {
      return districts.filter((d) => d.isActive !== false);
    }
    return districts;
  }

  /**
   * Returns all districts belonging to a given state.
   */
  public getDistrictsByState(stateId: string, filterActive: boolean = false): District[] {
    return this.getDistricts(stateId, filterActive);
  }

  /**
   * Retrieves a District by its unique identifier.
   */
  public getDistrictById(districtId: string): District | undefined {
    return dataStore.getDistrictById(districtId);
  }

  /**
   * Normalizes a centre object ensuring guaranteed workingHours.start and workingHours.end
   */
  public normalizeCentre(c: ProcurementCentre): ProcurementCentre {
    if (!c) return c;
    const raw = c as any;
    const start = c.workingHours?.start || raw.openingTime || raw.opening_time || '08:00 AM';
    const end = c.workingHours?.end || raw.closingTime || raw.closing_time || '05:00 PM';
    return {
      ...c,
      workingHours: {
        start,
        end,
      },
    };
  }

  /**
   * Returns all accredited procurement centres across all districts.
   */
  public getCentres(filterActive: boolean = false): ProcurementCentre[] {
    const centres = dataStore.getCentres();
    const filtered = filterActive
      ? centres.filter(
          (c) =>
            c.isActive !== false &&
            c.operationalStatus !== 'CLOSED' &&
            c.operationalStatus !== 'INACTIVE'
        )
      : centres;
    return filtered.map((c) => this.normalizeCentre(c));
  }

  /**
   * Returns all accredited procurement centres in a given district.
   */
  public getCentresByDistrict(districtId: string, filterActive: boolean = false): ProcurementCentre[] {
    const centres = dataStore.getCentresByDistrict(districtId);
    const filtered = filterActive
      ? centres.filter(
          (c) =>
            c.isActive !== false &&
            c.operationalStatus !== 'CLOSED' &&
            c.operationalStatus !== 'INACTIVE'
        )
      : centres;
    return filtered.map((c) => this.normalizeCentre(c));
  }

  /**
   * Asynchronously fetches procurement centres for a district from the REST API with store fallback.
   */
  public async fetchCentresByDistrict(districtId: string): Promise<ProcurementCentre[]> {
    try {
      const res = await apiClient.get<ProcurementCentre[]>(`/districts/${districtId}/centres`);
      if (Array.isArray(res)) {
        return res.map((c) => this.normalizeCentre(c));
      }
    } catch (e) {
      console.warn(`[GeographyService] fetchCentresByDistrict failed for ${districtId}:`, e);
    }
    return this.getCentresByDistrict(districtId);
  }

  /**
   * Returns all procurement centres in a given state across all its districts.
   */
  public getCentresByState(stateId: string, filterActive: boolean = false): ProcurementCentre[] {
    const centres = dataStore.getCentresByState(stateId);
    const filtered = filterActive
      ? centres.filter(
          (c) =>
            c.isActive !== false &&
            c.operationalStatus !== 'CLOSED' &&
            c.operationalStatus !== 'INACTIVE'
        )
      : centres;
    return filtered.map((c) => this.normalizeCentre(c));
  }

  /**
   * Retrieves a specific procurement centre by its ID.
   */
  public getCentreById(centreId: string): ProcurementCentre | undefined {
    const centre = dataStore.getCentreById(centreId);
    return centre ? this.normalizeCentre(centre) : undefined;
  }

  /**
   * Resolves the entire geographic chain: Centre -> District -> State.
   */
  public getGeographicHierarchy(centreId: string): {
    state?: State;
    district?: District;
    centre?: ProcurementCentre;
  } {
    const centre = this.getCentreById(centreId);
    if (!centre) return {};

    const district = centre.districtId ? this.getDistrictById(centre.districtId) : undefined;
    const stateId = centre.stateId || (district ? district.stateId : undefined);
    const state = stateId ? this.getStateById(stateId) : undefined;

    return { state, district, centre };
  }
}

export const geographyService = new GeographyService();
