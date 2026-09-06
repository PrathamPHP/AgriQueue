import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';

export async function getFarmers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { mobile, districtId, stateId } = req.query;
    const whereClause: any = {};
    if (mobile) {
      whereClause.mobileNumber = String(mobile);
    }
    if (districtId) {
      whereClause.districtId = String(districtId);
    }
    if (stateId) {
      whereClause.stateId = String(stateId);
    }

    const farmers = await prisma.farmer.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, count: farmers.length, data: farmers });
  } catch (error) {
    next(error);
  }
}

export async function getFarmerById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const farmer = await prisma.farmer.findUnique({
      where: { id },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
        },
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!farmer) {
      throw new AppError(`Farmer with ID ${id} not found`, 404);
    }
    res.json({ success: true, data: farmer });
  } catch (error) {
    next(error);
  }
}

export async function registerFarmer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      name,
      mobileNumber,
      aadhaarNumber,
      languagePref = 'en',
      address,
      village,
      state,
      district,
      stateId,
      districtId,
      landAreaAcres = 2.5,
      bankAccountNumber,
      ifscCode,
      bankName,
    } = req.body;

    if (!name || !mobileNumber) {
      throw new AppError('Name and mobileNumber are required', 400);
    }

    // Resolve stateId/districtId if not provided directly
    let targetDistrictId = districtId;
    let targetStateId = stateId;
    let districtName = district;
    let stateName = state;

    if (targetDistrictId) {
      const d = await prisma.district.findUnique({
        where: { id: targetDistrictId },
        include: { state: true },
      });
      if (d) {
        targetStateId = d.stateId;
        if (!districtName) districtName = d.name;
        if (!stateName) stateName = d.state.name;
      }
    } else if (district) {
      const foundDist = await prisma.district.findFirst({
        where: { name: { contains: district, mode: 'insensitive' } },
        include: { state: true },
      });
      if (foundDist) {
        targetDistrictId = foundDist.id;
        targetStateId = foundDist.stateId;
        if (!districtName) districtName = foundDist.name;
        if (!stateName) stateName = foundDist.state.name;
      }
    }

    if (!targetDistrictId) {
      const defaultDist = await prisma.district.findFirst({ include: { state: true } });
      targetDistrictId = defaultDist?.id || 'dist-karnal';
      targetStateId = defaultDist?.stateId || 'state-haryana';
      if (!districtName) districtName = defaultDist?.name || 'Karnal';
      if (!stateName) stateName = defaultDist?.state?.name || 'Haryana';
    }

    // Check if farmer with this mobile exists
    let farmer = await prisma.farmer.findFirst({
      where: { mobileNumber },
    });

    if (farmer) {
      farmer = await prisma.farmer.update({
        where: { id: farmer.id },
        data: {
          name,
          aadhaarNumber: aadhaarNumber || farmer.aadhaarNumber,
          languagePref: languagePref || farmer.languagePref,
          address: address || farmer.address,
          village: village || farmer.village,
          state: state || farmer.state,
          district: district || farmer.district,
          stateId: targetStateId,
          districtId: targetDistrictId,
          landAreaAcres: Number(landAreaAcres) || farmer.landAreaAcres,
          bankAccountNumber: bankAccountNumber || farmer.bankAccountNumber,
          ifscCode: ifscCode || farmer.ifscCode,
          bankName: bankName || farmer.bankName,
        },
      });
    } else {
      const farmerId = `farmer-${Date.now().toString().slice(-6)}`;
      farmer = await prisma.farmer.create({
        data: {
          id: farmerId,
          name,
          mobileNumber,
          aadhaarNumber: aadhaarNumber || `XXXX-XXXX-${Date.now().toString().slice(-4)}`,
          languagePref,
          address: address || `${village || 'Village'}, ${district || 'District'}`,
          village: village || 'Village',
          state: state || 'State',
          district: district || 'District',
          stateId: targetStateId,
          districtId: targetDistrictId,
          landAreaAcres: Number(landAreaAcres) || 2.5,
          bankAccountNumber: bankAccountNumber || `SBI${Date.now().toString().slice(-8)}`,
          ifscCode: ifscCode || 'SBIN0001234',
          bankName: bankName || 'State Bank of India',
        },
      });
    }

    res.json({ success: true, data: farmer });
  } catch (error) {
    next(error);
  }
}

export async function loginFarmer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) {
      throw new AppError('mobileNumber is required', 400);
    }
    const farmer = await prisma.farmer.findFirst({
      where: { mobileNumber },
    });
    if (!farmer) {
      throw new AppError('Farmer not found with this mobile number. Please register first.', 404);
    }
    res.json({ success: true, data: farmer });
  } catch (error) {
    next(error);
  }
}

export async function getFarmerBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { page, pageSize, status } = req.query;

    const whereClause: any = { farmerId: id };
    if (status === 'ACTIVE') {
      whereClause.status = 'confirmed';
      whereClause.currentStage = { not: 'COMPLETED' };
    } else if (status === 'COMPLETED') {
      whereClause.currentStage = 'COMPLETED';
    } else if (status && status !== 'ALL') {
      whereClause.status = String(status);
    }

    if (page !== undefined || pageSize !== undefined) {
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const sizeNum = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 10));

      const [totalItems, bookings] = await Promise.all([
        prisma.booking.count({ where: whereClause }),
        prisma.booking.findMany({
          where: whereClause,
          orderBy: { tokenNumber: 'desc' },
          skip: (pageNum - 1) * sizeNum,
          take: sizeNum,
          include: {
            queueEntry: true,
            procurement: true,
          },
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(totalItems / sizeNum));

      res.json({
        success: true,
        count: bookings.length,
        data: bookings.map((b) => ({ ...b, date: b.bookingDate })),
        pagination: {
          page: pageNum,
          pageSize: sizeNum,
          totalItems,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
      return;
    }

    // Default backward compatible (unpaginated list)
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: { tokenNumber: 'desc' },
      include: {
        queueEntry: true,
        procurement: true,
      },
    });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings.map((b) => ({ ...b, date: b.bookingDate })),
      pagination: {
        page: 1,
        pageSize: bookings.length,
        totalItems: bookings.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getFarmerNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const notifications = await prisma.notification.findMany({
      where: { farmerId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, count: notifications.length, data: notifications });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { notifId } = req.params;
    const updated = await prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}
