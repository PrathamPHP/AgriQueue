import { PrismaClient } from '@prisma/client';
import { SEED_STATES, SEED_DISTRICTS, SEED_CENTRES, SEED_CROPS, SEED_OFFICERS, SEED_ADMINS } from '../../src/services/seedData';

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

async function main() {
  console.log('Seeding PostgreSQL database with AgriQueue master data...');

  // 1. States & UTs
  for (const s of SEED_STATES) {
    await prisma.state.upsert({
      where: { id: s.id },
      update: { code: s.code, name: s.name, type: s.type || 'STATE', isActive: s.isActive ?? true },
      create: { id: s.id, code: s.code, name: s.name, type: s.type || 'STATE', isActive: s.isActive ?? true },
    });
  }
  console.log(`Seeded ${SEED_STATES.length} States & UTs.`);

  // 2. Districts
  for (const d of SEED_DISTRICTS) {
    await prisma.district.upsert({
      where: { id: d.id },
      update: { stateId: d.stateId, code: d.code, name: d.name, isActive: d.isActive ?? true },
      create: { id: d.id, stateId: d.stateId, code: d.code, name: d.name, isActive: d.isActive ?? true },
    });
  }
  console.log(`Seeded ${SEED_DISTRICTS.length} Districts.`);

  // 3. Procurement Centres
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
        operationalStatus: c.operationalStatus || 'OPEN',
        currentDelayMinutes: c.currentDelayMinutes || 0,
        avgWaitTimeMin: c.avgWaitTimeMin || 15,
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
        operationalStatus: c.operationalStatus || 'OPEN',
        currentDelayMinutes: c.currentDelayMinutes || 0,
        avgWaitTimeMin: c.avgWaitTimeMin || 15,
        isActive: c.isActive ?? true,
      },
    });
  }
  console.log(`Seeded ${SEED_CENTRES.length} Procurement Centres.`);

  // 4. Crops
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
  console.log(`Seeded ${SEED_CROPS.length} Crops.`);

  // 5. Officers
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
  console.log(`Seeded ${SEED_OFFICERS.length} Officers.`);

  // 6. Admin Personas
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
  console.log(`Seeded ${SEED_ADMINS.length} Admin Users.`);

  // 7. Base Slots for each Centre (bounded to Today and Tomorrow)
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dates = [today, tomorrow];

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
  console.log(`Seeded ${slotCount} operational slots across all centres (${dates.join(', ')}).`);

  console.log('Database master seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
