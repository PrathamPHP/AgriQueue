import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';

export async function getOfficers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { centreId } = req.query;
    const whereClause: any = {};
    if (centreId) whereClause.centreId = String(centreId);

    const officers = await prisma.officer.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, count: officers.length, data: officers });
  } catch (error) {
    next(error);
  }
}

export async function getOfficerById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const officer = await prisma.officer.findUnique({
      where: { id },
      include: { centre: true },
    });
    if (!officer) {
      throw new AppError(`Officer ${id} not found`, 404);
    }
    res.json({ success: true, data: officer });
  } catch (error) {
    next(error);
  }
}

export async function getAdminUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { scopeType } = req.query;
    const whereClause: any = {};
    if (scopeType) whereClause.scopeType = String(scopeType);

    const admins = await prisma.user.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, count: admins.length, data: admins });
  } catch (error) {
    next(error);
  }
}

export async function getAdminUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const admin = await prisma.user.findUnique({
      where: { id },
    });
    if (!admin) {
      throw new AppError(`Admin User ${id} not found`, 404);
    }
    res.json({ success: true, data: admin });
  } catch (error) {
    next(error);
  }
}
