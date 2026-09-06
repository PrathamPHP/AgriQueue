import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';

export async function getCrops(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const crops = await prisma.crop.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, count: crops.length, data: crops });
  } catch (error) {
    next(error);
  }
}

export async function getCropById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const crop = await prisma.crop.findUnique({
      where: { id },
    });
    if (!crop) {
      throw new AppError(`Crop with ID ${id} not found`, 404);
    }
    res.json({ success: true, data: crop });
  } catch (error) {
    next(error);
  }
}
