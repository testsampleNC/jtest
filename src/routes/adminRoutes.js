const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, isAdmin } = require('../middleware/auth'); // Path to auth middleware

// GET /api/admin/assessment-queue - Retrieves the list of tickets waiting for assessment
router.get(
  '/assessment-queue',
  authenticate,
  isAdmin,
  adminController.getAssessmentQueue
);

// POST /api/admin/call/assessment - Calls the next ticket for assessment
router.post(
  '/call/assessment',
  authenticate,
  isAdmin,
  adminController.callNextAssessment
);

// POST /api/admin/assessment-complete/:ticketId - Marks a ticket's assessment as complete
router.post(
  '/assessment-complete/:ticketId',
  authenticate,
  isAdmin,
  adminController.assessmentComplete
);

// GET /api/admin/purchase-queue - Retrieves the list of tickets waiting for purchase
router.get(
  '/purchase-queue',
  authenticate,
  isAdmin,
  adminController.getPurchaseQueue
);

// POST /api/admin/call/purchase/:ticketId - Calls a specific ticket for purchase
router.post(
  '/call/purchase/:ticketId',
  authenticate,
  isAdmin,
  adminController.callTicketForPurchase
);

// POST /api/admin/ticket/complete/:ticketId - Marks a ticket as "done"
router.post(
  '/ticket/complete/:ticketId',
  authenticate,
  isAdmin,
  adminController.completeTicket
);

module.exports = router;
