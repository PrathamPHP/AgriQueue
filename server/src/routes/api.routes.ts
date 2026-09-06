import { Router } from 'express';
import * as healthController from '../controllers/healthController';
import * as geographyController from '../controllers/geographyController';
import * as cropsController from '../controllers/cropsController';
import * as farmersController from '../controllers/farmersController';
import * as slotsController from '../controllers/slotsController';
import * as bookingsController from '../controllers/bookingsController';
import * as queueController from '../controllers/queueController';
import * as procurementController from '../controllers/procurementController';
import * as paymentsController from '../controllers/paymentsController';
import * as analyticsController from '../controllers/analyticsController';
import * as personasController from '../controllers/personasController';

const router = Router();

// API Root Index & Catalog
router.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'AgriQueue REST API',
    version: '2.0.0',
    status: 'online',
    database: 'PostgreSQL 18',
    endpoints: {
      health: '/api/v1/health',
      states: '/api/v1/states',
      districts: '/api/v1/districts',
      centres: '/api/v1/centres',
      crops: '/api/v1/crops',
      farmers: '/api/v1/farmers',
      slots: '/api/v1/slots',
      bookings: '/api/v1/bookings',
      queue: '/api/v1/centres/:centreId/queue',
      procurements: '/api/v1/centres/:centreId/procurements',
      payments: '/api/v1/payments',
      analytics: {
        national: '/api/v1/analytics/national',
        state: '/api/v1/analytics/states/:stateId',
        district: '/api/v1/analytics/districts/:districtId',
        centre: '/api/v1/analytics/centres/:centreId',
        admin: '/api/v1/analytics/admin',
      },
      personas: {
        officers: '/api/v1/officers',
        admins: '/api/v1/admins',
      },
    },
  });
});

// Health
router.get('/health', healthController.getHealth);

// Geography
router.get('/states', geographyController.getStates);
router.get('/states/:id', geographyController.getStateById);
router.get('/states/:stateId/districts', geographyController.getDistrictsByState);
router.get('/districts', geographyController.getDistricts);
router.get('/districts/:id', geographyController.getDistrictById);
router.get('/districts/:districtId/centres', geographyController.getCentresByDistrict);
router.get('/centres', geographyController.getCentres);
router.get('/centres/:id', geographyController.getCentreById);
router.patch('/centres/:id', geographyController.updateCentre);

// Crops
router.get('/crops', cropsController.getCrops);
router.get('/crops/:id', cropsController.getCropById);

// Farmers
router.get('/farmers', farmersController.getFarmers);
router.post('/farmers', farmersController.registerFarmer);
router.post('/farmers/login', farmersController.loginFarmer);
router.get('/farmers/:id', farmersController.getFarmerById);
router.get('/farmers/:id/bookings', farmersController.getFarmerBookings);
router.get('/farmers/:id/notifications', farmersController.getFarmerNotifications);
router.patch('/farmers/:id/notifications/:notifId/read', farmersController.markNotificationRead);

// Slots & Recommendation
router.get('/slots', slotsController.getSlots);
router.get('/centres/:centreId/slots', slotsController.getCentreSlots);
router.post('/slots/recommend', slotsController.recommendSlots);

// Bookings
router.get('/bookings', bookingsController.getBookings);
router.post('/bookings', bookingsController.createBooking);
router.get('/bookings/:id', bookingsController.getBookingById);
router.get('/centres/:centreId/bookings', bookingsController.getCentreBookings);
router.patch('/bookings/:id/cancel', bookingsController.cancelBooking);

// Queue
router.get('/centres/:centreId/queue', queueController.getCentreQueue);
router.post('/centres/:centreId/queue/call-next', queueController.callNext);
router.post('/centres/:centreId/delay', queueController.updateCentreDelay);
router.get('/queue/live/:farmerId', queueController.getLiveQueueForFarmer);

// Procurement Workflow
router.post('/procurement/check-in', procurementController.checkIn);
router.post('/procurement/qc', procurementController.qualityCheck);
router.post('/procurement/weighbridge', procurementController.recordWeighbridge);
router.get('/procurements/:id', procurementController.getProcurementById);
router.get('/centres/:centreId/procurements', procurementController.getCentreProcurements);

// Payments (PFMS / DBT)
router.patch('/procurements/:procurementId/payment', paymentsController.updatePaymentStatus);
router.patch('/payments/:procurementId', paymentsController.updatePaymentStatus);
router.get('/payments/:id', paymentsController.getPaymentById);
router.get('/payments', paymentsController.getPayments);

// Analytics & KPIs
router.get('/analytics/national', analyticsController.getNationalStats);
router.get('/analytics/states/:stateId', analyticsController.getStateStats);
router.get('/analytics/districts/:districtId', analyticsController.getDistrictStats);
router.get('/analytics/centres/:centreId', analyticsController.getCentreStats);
router.get('/analytics/admin', analyticsController.getAdminAnalytics);

// Personas & Staff
router.get('/officers', personasController.getOfficers);
router.get('/officers/:id', personasController.getOfficerById);
router.get('/admins', personasController.getAdminUsers);
router.get('/admins/:id', personasController.getAdminUserById);

export default router;
