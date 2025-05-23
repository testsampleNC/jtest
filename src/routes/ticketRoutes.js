const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticate } = require('../middleware/auth'); // Assuming auth middleware is in src/middleware

// POST /api/tickets - Issues a new ticket
router.post('/', authenticate, ticketController.issueTicket);

// GET /api/tickets/my-ticket - Gets the active ticket for the authenticated user
router.get('/my-ticket', authenticate, ticketController.getMyTicket);

// GET /api/tickets/called - Gets the currently called ticket numbers
router.get('/called', authenticate, ticketController.getCalledNumbers);


// Note: The task mentioned `/api/tickets` for the POST route.
// If the base path in app.js is already `/api`, then this route will be `/tickets`.
// If the base path in app.js is `/`, then this route will be `/api/tickets`.
// For clarity, I'm assuming app.js will mount this as app.use('/api/tickets', ticketRoutes);

module.exports = router;
