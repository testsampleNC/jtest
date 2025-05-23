const ticketService = require('../services/ticketService');

/**
 * Retrieves the list of tickets waiting for assessment.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function getAssessmentQueue(req, res) {
  try {
    const waitingTickets = await ticketService.getWaitingForAssessmentTickets();
    return res.status(200).json(waitingTickets);
  } catch (error) {
    console.error('Error fetching assessment queue:', error);
    return res.status(500).json({ message: 'Failed to retrieve assessment queue.' });
  }
}

/**
 * Calls the next ticket for assessment.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function callNextAssessment(req, res) {
  try {
    const calledTicket = await ticketService.callNextForAssessment();
    return res.status(200).json(calledTicket);
  } catch (error) {
    console.error('Error calling next for assessment:', error);
    if (error.status === 404) { // Custom status set in service for "no tickets"
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to call next ticket for assessment.' });
  }
}

module.exports = {
  getAssessmentQueue,
  callNextAssessment,
  assessmentComplete,
  getPurchaseQueue,
  callTicketForPurchase,
  completeTicket,         // Added new function
};

/**
 * Marks a ticket's assessment as complete.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function assessmentComplete(req, res) {
  try {
    const { ticketId } = req.params;
    if (!ticketId) {
      return res.status(400).json({ message: "Ticket ID is required." });
    }

    const updatedTicket = await ticketService.markAssessmentComplete(ticketId);
    return res.status(200).json(updatedTicket);

  } catch (error) {
    console.error(`Error in assessmentComplete controller for ticket ${req.params.ticketId}:`, error);
    if (error.status) { // Errors from service with a specific status
      return res.status(error.status).json({ message: error.message });
    }
    // Generic server error
    return res.status(500).json({ message: 'Failed to mark assessment as complete.' });
  }
}

/**
 * Retrieves the list of tickets waiting for purchase.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function getPurchaseQueue(req, res) {
  try {
    const waitingTickets = await ticketService.getWaitingForPurchaseTickets();
    return res.status(200).json(waitingTickets);
  } catch (error) {
    console.error('Error fetching purchase queue:', error);
    return res.status(500).json({ message: 'Failed to retrieve purchase queue.' });
  }
}

/**
 * Calls a specific ticket for purchase.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function callTicketForPurchase(req, res) {
  try {
    const { ticketId } = req.params;
    if (!ticketId) {
      return res.status(400).json({ message: "Ticket ID is required." });
    }

    const updatedTicket = await ticketService.callForPurchase(ticketId);
    return res.status(200).json(updatedTicket);

  } catch (error) {
    console.error(`Error in callTicketForPurchase controller for ticket ${req.params.ticketId}:`, error);
    if (error.status) { // Errors from service with a specific status
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to call ticket for purchase.' });
  }
}

/**
 * Marks a ticket as complete (done).
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
async function completeTicket(req, res) {
  try {
    const { ticketId } = req.params;
    if (!ticketId) {
      return res.status(400).json({ message: "Ticket ID is required." });
    }

    const updatedTicket = await ticketService.markTicketAsDone(ticketId);
    return res.status(200).json(updatedTicket);

  } catch (error) {
    console.error(`Error in completeTicket controller for ticket ${req.params.ticketId}:`, error);
    if (error.status) { // Errors from service with a specific status
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to mark ticket as done.' });
  }
}
