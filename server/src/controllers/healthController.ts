import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dbCheck = await prisma.$queryRaw`SELECT 1 as healthy`;
    res.json({
      success: true,
      status: 'ok',
      service: 'AgriQueue Backend API',
      version: '2.0.0',
      database: 'PostgreSQL 18 (Connected)',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
