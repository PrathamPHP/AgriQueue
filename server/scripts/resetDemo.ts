import { PrismaClient } from '@prisma/client';
import {
  SEED_STATES,
  SEED_DISTRICTS,
  SEED_CENTRES,
  SEED_CROPS,
  SEED_OFFICERS,
  SEED_ADMINS,
} from '../../src/services/seedData';

const prisma = new PrismaClient();

const DEFAULT_WINDOWS = [
  { id: 'slot-0900', startTime: '09:00 AM', endTime: '09:30 AM', timeWindow: '09:00 AM – 09:30 AM' },
  { id: 'slot-0930', startTime: '09:30 AM', endTime: '10:00 AM', timeWindow: '09:30 AM – 10:00 AM' },
  { id: 'slot-1000', startTime: '10:00 AM', endTime: '10:30 AM', timeWindow: '10:00 AM – 10:30 AM' },
  { id: 'slot-1030', startTime: '10:30 AM', endTime: '11:00 AM', timeWindow: '10:30 AM – 11:00 AM' },
  { id: 'slot-1100', startTime: '11:00 AM', endTime: '11:30 AM', timeWindow: '11:00 AM – 11:30 AM' },
  { id: 'slot-1130', startTime: '11:30 AM', endTime: '12:00 PM', timeWindow: '11:30 AM – 12:00 PM' },
  { id: 'slot-0130', startTime: '01:30 PM', endTime: '02:00 PM', timeWindow: '01:30 PM – 02:00 PM' },
  { id: 'slot-0200', startTime: '02:00 PM', endTime: '02:30 PM', timeWindow: '02:00 PM – 02:30 PM' },
  { id: 'slot-0300', startTime: '03:00 PM', endTime: '03:30 PM', timeWindow: '03:00 PM – 03:30 PM' },
];

export async function resetDemo() {
  console.log('--- RESETTING AGRIQUEUE DEMO ENVIRONMENT ---');

  // 1. Purge transactional records in safe relational order
  console.log('Clearing payments...');
  await prisma.payment.deleteMany();

  console.log('Clearing procurement records...');
  await prisma.procurementRecord.deleteMany();

  console.log('Clearing queue entries...');
  await prisma.queueEntry.deleteMany();

  console.log('Clearing bookings...');
  await prisma.booking.deleteMany();

  console.log('Clearing notifications...');
  await prisma.notification.deleteMany();

  console.log('Clearing non-seed farmers...');
  await prisma.farmer.deleteMany();

  console.log('Clearing legacy slots...');
  await prisma.slot.deleteMany();

  // 2. Ensure Master Reference Data is present and pristine
  console.log('Syncing States & UTs (36)...');
  for (const s of SEED_STATES) {
    await prisma.state.upsert({
      where: { id: s.id },
      update: { code: s.code, name: s.name, type: s.type || 'STATE', isActive: s.isActive ?? true },
      create: { id: s.id, code: s.code, name: s.name, type: s.type || 'STATE', isActive: s.isActive ?? true },
    });
  }

  console.log('Syncing Districts (64)...');
  for (const d of SEED_DISTRICTS) {
    await prisma.district.upsert({
      where: { id: d.id },
      update: { stateId: d.stateId, code: d.code, name: d.name, isActive: d.isActive ?? true },
      create: { id: d.id, stateId: d.stateId, code: d.code, name: d.name, isActive: d.isActive ?? true },
    });
  }

  console.log('Syncing Procurement Centres / Mandis (21)...');
  for (const c of SEED_CENTRES) {
    await prisma.procurementCentre.upsert({
      where: { id: c.id },
      update: {
        stateId: c.stateId || '',
        districtId: c.districtId,
        code: c.code || c.id.toUpperCase(),
        name: c.name,
        address: c.address,
        district: c.district,
        state: c.state,
        latitude: c.latitude,
        longitude: c.longitude,
        dailyCapacityMT: c.dailyCapacityMT || 100,
        capacityPerHourKg: c.capacityPerHourKg || 2800,
        activeGates: c.activeGates || 2,
        activeWeighbridges: c.activeWeighbridges || 2,
        operationalStatus: 'OPEN',
        currentDelayMinutes: 0,
        avgWaitTimeMin: 15,
        isActive: c.isActive ?? true,
      },
      create: {
        id: c.id,
        stateId: c.stateId || '',
        districtId: c.districtId,
        code: c.code || c.id.toUpperCase(),
        name: c.name,
        address: c.address,
        district: c.district,
        state: c.state,
        latitude: c.latitude,
        longitude: c.longitude,
        dailyCapacityMT: c.dailyCapacityMT || 100,
        capacityPerHourKg: c.capacityPerHourKg || 2800,
        activeGates: c.activeGates || 2,
        activeWeighbridges: c.activeWeighbridges || 2,
        operationalStatus: 'OPEN',
        currentDelayMinutes: 0,
        avgWaitTimeMin: 15,
        isActive: c.isActive ?? true,
      },
    });
  }

  console.log('Syncing Crops (6)...');
  for (const cr of SEED_CROPS) {
    await prisma.crop.upsert({
      where: { id: cr.id },
      update: {
        name: cr.name,
        nameHindi: cr.nameHindi,
        baseProcessingTimeMin: cr.baseProcessingTimeMin,
        throughputRateKgPerMin: cr.throughputRateKgPerMin,
        mspPerQuintal: cr.mspPerQuintal,
        isActive: true,
      },
      create: {
        id: cr.id,
        name: cr.name,
        nameHindi: cr.nameHindi,
        baseProcessingTimeMin: cr.baseProcessingTimeMin,
        throughputRateKgPerMin: cr.throughputRateKgPerMin,
        mspPerQuintal: cr.mspPerQuintal,
        isActive: true,
      },
    });
  }

  console.log('Syncing Officers (9)...');
  for (const o of SEED_OFFICERS) {
    await prisma.officer.upsert({
      where: { id: o.id },
      update: {
        name: o.name,
        email: o.email,
        mobile: o.mobile,
        stateId: o.stateId,
        districtId: o.districtId,
        centreId: o.centreId,
        centreName: o.centreName,
        deskNumber: o.deskNumber,
        role: o.role,
      },
      create: {
        id: o.id,
        name: o.name,
        email: o.email,
        mobile: o.mobile,
        stateId: o.stateId,
        districtId: o.districtId,
        centreId: o.centreId,
        centreName: o.centreName,
        deskNumber: o.deskNumber,
        role: o.role,
      },
    });
  }

  console.log('Syncing Admins (4)...');
  for (const a of SEED_ADMINS) {
    await prisma.user.upsert({
      where: { id: a.id },
      update: {
        name: a.name,
        email: a.email,
        role: a.role,
        scopeType: a.scopeType,
        scopeId: a.scopeId,
        scopeName: a.scopeName,
        stateId: a.stateId,
        districtId: a.districtId,
        centreId: a.centreId,
      },
      create: {
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        scopeType: a.scopeType,
        scopeId: a.scopeId,
        scopeName: a.scopeName,
        stateId: a.stateId,
        districtId: a.districtId,
        centreId: a.centreId,
      },
    });
  }

  // 3. Seed deterministic bounded slots for Today & Tomorrow (21 centres * 2 dates * 9 slots = 378 slots)
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dates = [today, tomorrow];

  console.log(`Generating bounded operational slots for dates: ${dates.join(', ')}...`);
  let slotCount = 0;
  for (const centre of SEED_CENTRES) {
    for (const d of dates) {
      for (const w of DEFAULT_WINDOWS) {
        const slotId = `${w.id}-${centre.id}-${d}`;
        await prisma.slot.upsert({
          where: { id: slotId },
          update: {
            centreId: centre.id,
            date: d,
            startTime: w.startTime,
            endTime: w.endTime,
            timeWindow: w.timeWindow,
            capacity: 15,
            status: 'AVAILABLE',
          },
          create: {
            id: slotId,
            centreId: centre.id,
            date: d,
            startTime: w.startTime,
            endTime: w.endTime,
            timeWindow: w.timeWindow,
            capacity: 15,
            status: 'AVAILABLE',
          },
        });
        slotCount++;
      }
    }
  }

  const counts = {
    states: await prisma.state.count(),
    districts: await prisma.district.count(),
    centres: await prisma.procurementCentre.count(),
    crops: await prisma.crop.count(),
    officers: await prisma.officer.count(),
    admins: await prisma.user.count(),
    slots: await prisma.slot.count(),
    farmers: await prisma.farmer.count(),
    bookings: await prisma.booking.count(),
    queue: await prisma.queueEntry.count(),
    procurements: await prisma.procurementRecord.count(),
    payments: await prisma.payment.count(),
  };

  console.log('--- RESET COMPLETE: VERIFIED COUNTS ---');
  console.log(counts);
}

if (process.argv[1]?.includes('resetDemo')) {
  resetDemo()
    .catch((e) => {
      console.error('Reset error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
