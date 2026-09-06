import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';

export async function getStates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type } = req.query;
    const whereClause: any = { isActive: true };
    if (type) {
      whereClause.type = String(type);
    }
    const states = await prisma.state.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, count: states.length, data: states });
  } catch (error) {
    next(error);
  }
}

export async function getStateById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const state = await prisma.state.findUnique({
      where: { id },
      include: {
        districts: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!state) {
      throw new AppError(`State with ID ${id} not found`, 404);
    }
    res.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function getDistricts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { stateId } = req.query;
    const whereClause: any = { isActive: true };
    if (stateId) {
      whereClause.stateId = String(stateId);
    }
    const districts = await prisma.district.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, count: districts.length, data: districts });
  } catch (error) {
    next(error);
  }
}

export async function getDistrictsByState(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { stateId } = req.params;
    const districts = await prisma.district.findMany({
      where: { stateId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, count: districts.length, data: districts });
  } catch (error) {
    next(error);
  }
}

function formatCentreResponse(c: any) {
  const start = '08:00 AM';
  const end = '05:00 PM';
  return {
    ...c,
    openingTime: start,
    closingTime: end,
    workingHours: {
      start,
      end,
    },
  };
}

export async function getCentresByDistrict(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { districtId } = req.params;
    const centres = await prisma.procurementCentre.findMany({
      where: { districtId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, count: centres.length, data: centres.map(formatCentreResponse) });
  } catch (error) {
    next(error);
  }
}

export async function getDistrictById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const district = await prisma.district.findUnique({
      where: { id },
      include: {
        centres: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!district) {
      throw new AppError(`District with ID ${id} not found`, 404);
    }
    res.json({ success: true, data: district });
  } catch (error) {
    next(error);
  }
}

export async function getCentres(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { districtId, stateId } = req.query;
    const whereClause: any = { isActive: true };
    if (districtId) {
      whereClause.districtId = String(districtId);
    }
    if (stateId) {
      whereClause.stateId = String(stateId);
    }
    const centres = await prisma.procurementCentre.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, count: centres.length, data: centres.map(formatCentreResponse) });
  } catch (error) {
    next(error);
  }
}

export async function getCentreById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const centre = await prisma.procurementCentre.findUnique({
      where: { id },
      include: {
        officers: true,
      },
    });
    if (!centre) {
      throw new AppError(`Procurement Centre with ID ${id} not found`, 404);
    }
    res.json({ success: true, data: formatCentreResponse(centre) });
  } catch (error) {
    next(error);
  }
}

export async function updateCentre(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const {
      operationalStatus,
      currentDelayMinutes,
      activeGates,
      activeWeighbridges,
      dailyCapacityMT,
      capacityPerHourKg,
    } = req.body;

    const updated = await prisma.procurementCentre.update({
      where: { id },
      data: {
        ...(operationalStatus !== undefined && { operationalStatus }),
        ...(currentDelayMinutes !== undefined && { currentDelayMinutes: Number(currentDelayMinutes) }),
        ...(activeGates !== undefined && { activeGates: Number(activeGates) }),
        ...(activeWeighbridges !== undefined && { activeWeighbridges: Number(activeWeighbridges) }),
        ...(dailyCapacityMT !== undefined && { dailyCapacityMT: Number(dailyCapacityMT) }),
        ...(capacityPerHourKg !== undefined && { capacityPerHourKg: Number(capacityPerHourKg) }),
      },
    });

    res.json({ success: true, data: formatCentreResponse(updated) });
  } catch (error) {
    next(error);
  }
}
