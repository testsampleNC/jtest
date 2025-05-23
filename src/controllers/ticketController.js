const ticketService = require('../services/ticketService');

/**
 * Issues a new ticket for the authenticated user.
 * Checks if the user already has an active ticket before creating a new one.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function issueTicket(req, res) {
  try {
    const userId = req.user.userId; // Assuming authenticate middleware sets req.user
    const location = req.body.location || null; // Optional location from request body

    // Check if the user already has an active ticket
    const existingTicket = await ticketService.getActiveTicketByUser(userId);
    if (existingTicket) {
      return res.status(400).json({ 
        message: 'User already has an active ticket.', 
        ticket: existingTicket 
      });
    }

    // If no active ticket, create a new one
    const newTicket = await ticketService.createTicket(userId, location);
    return res.status(201).json(newTicket);

  } catch (error) {
    console.error('Error issuing ticket:', error);
    // Check if the error is a known type or has a specific message to return
    if (error.message.includes("simulated Firestore error")) { // Example for specific error handling
        return res.status(500).json({ message: "Failed to create ticket due to a database issue." });
    }
    return res.status(500).json({ message: 'Failed to issue ticket. Please try again later.' });
  }
}

/**
 * Gets the active ticket for the authenticated user.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function getMyTicket(req, res) {
  try {
    const userId = req.user.userId; // Assuming authenticate middleware sets req.user

    const activeTicket = await ticketService.getActiveTicketByUser(userId);

    if (activeTicket) {
      return res.status(200).json(activeTicket);
    } else {
      return res.status(404).json({ message: 'No active ticket found for this user.' });
    }

  } catch (error) {
    console.error('Error fetching user ticket:', error);
    return res.status(500).json({ message: 'Failed to retrieve ticket. Please try again later.' });
  }
}

module.exports = {
  issueTicket,
  getMyTicket,
  getCalledNumbers, // Added new function
};

/**
 * Gets the list of currently called ticket numbers for assessment and purchase.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function getCalledNumbers(req, res) {
  try {
    const calledTickets = await ticketService.getCurrentlyCalledTickets();
    return res.status(200).json(calledTickets);
  } catch (error) {
    console.error('Error fetching currently called numbers:', error);
    return res.status(500).json({ message: 'Failed to retrieve currently called numbers.' });
  }
}
