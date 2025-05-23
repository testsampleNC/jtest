const { db, admin } = require('./firestoreService'); // Assuming firestoreService.js is in the same directory

/**
 * Generates a new ticket number.
 * Queries Firestore for the ticket with the highest 'number' and increments it.
 * If no tickets exist, starts from 1.
 * Note: For high concurrency, a more robust method (e.g., Firestore transactions
 * or a dedicated counter) would be needed.
 * @returns {Promise<number>} The next ticket number.
 */
async function generateTicketNumber() {
  const ticketsRef = db.collection('tickets');
  const snapshot = await ticketsRef.orderBy('number', 'desc').limit(1).get();

  if (snapshot.empty) {
    return 1; // Start from 1 if no tickets exist
  }

  const highestTicket = snapshot.docs[0].data();
  return highestTicket.number + 1;
}

/**
 * Creates a new ticket for a user.
 * @param {string} userId - The ID of the user.
 * @param {object|null} location - Optional location object with lat and lng.
 * @returns {Promise<object>} The created ticket data.
 */
async function createTicket(userId, location = null) {
  const ticketNumber = await generateTicketNumber();
  const newTicket = {
    number: ticketNumber,
    userId: userId,
    status: "waiting", // Initial status
    createdAt: admin.firestore.FieldValue.serverTimestamp(), // Firestore server timestamp
    calledAt: null, // Not set at creation
    location: location, // Can be { lat: number, lng: number } or null
  };

  const ticketRef = await db.collection('tickets').add(newTicket);
  
  // Return the newly created ticket data along with its ID
  return { id: ticketRef.id, ...newTicket };
}

/**
 * Gets the active ticket for a user.
 * An active ticket is one that is not in "done" or "called_purchase" status.
 * It should return the most recent active ticket if multiple somehow exist.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object|null>} The active ticket data or null if not found.
 */
async function getActiveTicketByUser(userId) {
  const ticketsRef = db.collection('tickets');
  const activeStatuses = ["waiting", "called_assessment", "waiting_purchase"]; // Define active statuses
  
  const snapshot = await ticketsRef
    .where('userId', '==', userId)
    .where('status', 'in', activeStatuses)
    .orderBy('createdAt', 'desc') // Get the most recent one first
    .limit(1) // A user should ideally have only one active ticket
    .get();

  if (snapshot.empty) {
    return null;
  }

  const ticketDoc = snapshot.docs[0];
  return { id: ticketDoc.id, ...ticketDoc.data() };
}

module.exports = {
  generateTicketNumber,
  createTicket,
  getActiveTicketByUser,
  getCurrentlyCalledTickets,
  getWaitingForAssessmentTickets,
  callNextForAssessment,
  markAssessmentComplete,
  getWaitingForPurchaseTickets,
  callForPurchase,
  markTicketAsDone,             // Added new function
};

/**
 * Retrieves tickets that are currently called for assessment or purchase.
 * Orders them by their ticket number in ascending order.
 * @returns {Promise<{assessment: Array<object>, purchase: Array<object>}>} 
 *          An object containing arrays of tickets for assessment and purchase.
 */
async function getCurrentlyCalledTickets() {
  const ticketsRef = db.collection('tickets');
  const assessmentTickets = [];
  const purchaseTickets = [];

  try {
    // Get tickets called for assessment
    const assessmentSnapshot = await ticketsRef
      .where('status', '==', 'called_assessment')
      .orderBy('number', 'asc') // Order by ticket number
      .get();
    assessmentSnapshot.forEach(doc => {
      assessmentTickets.push({ id: doc.id, ...doc.data() });
    });

    // Get tickets called for purchase
    const purchaseSnapshot = await ticketsRef
      .where('status', '==', 'called_purchase')
      .orderBy('number', 'asc') // Order by ticket number
      .get();
    purchaseSnapshot.forEach(doc => {
      purchaseTickets.push({ id: doc.id, ...doc.data() });
    });

    return {
      assessment: assessmentTickets,
      purchase: purchaseTickets,
    };
  } catch (error) {
    console.error("Error fetching currently called tickets:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

// Conceptual Note for Real-time Backend Firestore Listener:
// A Firestore listener (onSnapshot) would be placed here or in a dedicated realtimeService.js.
// This listener would monitor the 'tickets' collection for changes, specifically:
// - When a ticket's 'status' changes to 'called_assessment' or 'called_purchase'.
// - When a ticket's 'status' changes FROM 'called_assessment' or 'called_purchase' to something else (e.g., 'done').
// Upon detecting such changes, the backend would then use Socket.IO to emit an event
// (e.g., 'calledNumbersUpdated') to all connected clients, pushing the new list of
// currently called tickets. This would replace the need for client-side polling.
//
// Example (Conceptual):
// db.collection('tickets').where('status', 'in', ['called_assessment', 'called_purchase'])
//   .onSnapshot(snapshot => {
//     const updatedCalledTickets = processSnapshot(snapshot); // Helper to format data
//     io.emit('calledNumbersUpdated', updatedCalledTickets); // io is the Socket.IO server instance
//   }, err => {
//     console.error('Error on snapshot listener:', err);
//   });

/**
 * Retrieves tickets with status "waiting", ordered by number (ascending).
 * @returns {Promise<Array<object>>} An array of tickets waiting for assessment.
 */
async function getWaitingForAssessmentTickets() {
  const ticketsRef = db.collection('tickets');
  try {
    const snapshot = await ticketsRef
      .where('status', '==', 'waiting')
      .orderBy('number', 'asc')
      .get();
    
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching tickets waiting for assessment:", error);
    throw error;
  }
}

/**
 * Calls the next ticket in the "waiting" queue for assessment.
 * Updates its status to "called_assessment" and sets calledAt.
 * @returns {Promise<object>} The updated ticket data.
 * @throws {Error} if no tickets are waiting or if an update fails.
 */
async function callNextForAssessment() {
  const waitingTickets = await getWaitingForAssessmentTickets();

  if (waitingTickets.length === 0) {
    const error = new Error("No tickets waiting for assessment.");
    error.status = 404; // Custom property to indicate resource not found
    throw error;
  }

  const nextTicket = waitingTickets[0];
  const ticketRef = db.collection('tickets').doc(nextTicket.id);

  try {
    await ticketRef.update({
      status: 'called_assessment',
      calledAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Fetch the updated document to return it
    const updatedDoc = await ticketRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    console.error(`Error updating ticket ${nextTicket.id} to called_assessment:`, error);
    throw error; // Re-throw to be handled by controller
  }
}

/**
 * Marks a ticket's assessment as complete.
 * Updates status from "called_assessment" to "waiting_purchase".
 * @param {string} ticketId - The ID of the ticket to update.
 * @returns {Promise<object>} The updated ticket data.
 * @throws {Error} if ticket not found, not in correct status, or update fails.
 */
async function markAssessmentComplete(ticketId) {
  const ticketRef = db.collection('tickets').doc(ticketId);

  try {
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      const error = new Error(`Ticket ${ticketId} not found.`);
      error.status = 404;
      throw error;
    }

    const ticketData = ticketDoc.data();

    if (ticketData.status !== 'called_assessment') {
      const error = new Error(`Ticket ${ticketId} is not in 'called_assessment' state. Current status: ${ticketData.status}.`);
      error.status = 400; // Bad request, as the ticket is not in the correct state for this action
      throw error;
    }

    await ticketRef.update({
      status: 'waiting_purchase',
      assessmentCompletedAt: admin.firestore.FieldValue.serverTimestamp(), // Optional: track completion time
    });

    const updatedDoc = await ticketRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() };

  } catch (error) {
    console.error(`Error marking assessment complete for ticket ${ticketId}:`, error);
    // Re-throw if status is already set, otherwise it's a generic error
    if (error.status) throw error; 
    const newError = new Error(`Failed to mark assessment complete for ticket ${ticketId}.`);
    newError.cause = error; // Preserve original error if needed
    throw newError;
  }
}

/**
 * Marks a ticket as "done".
 * Updates status from "called_purchase" to "done".
 * @param {string} ticketId - The ID of the ticket to update.
 * @returns {Promise<object>} The updated ticket data.
 * @throws {Error} if ticket not found, not in correct status, or update fails.
 */
async function markTicketAsDone(ticketId) {
  const ticketRef = db.collection('tickets').doc(ticketId);

  try {
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      const error = new Error(`Ticket ${ticketId} not found.`);
      error.status = 404;
      throw error;
    }

    const ticketData = ticketDoc.data();

    // A ticket can only be marked "done" if it was called for purchase.
    // Other statuses like 'waiting' or 'called_assessment' should not directly jump to 'done'.
    if (ticketData.status !== 'called_purchase') {
      const error = new Error(`Ticket ${ticketId} is not in 'called_purchase' state. Current status: ${ticketData.status}.`);
      error.status = 400; // Bad request
      throw error;
    }

    await ticketRef.update({
      status: 'done',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updatedDoc = await ticketRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() };

  } catch (error) {
    console.error(`Error marking ticket ${ticketId} as done:`, error);
    if (error.status) throw error;
    const newError = new Error(`Failed to mark ticket ${ticketId} as done.`);
    newError.cause = error;
    throw newError;
  }
}

/**
 * Retrieves tickets with status "waiting_purchase".
 * Orders them by assessmentCompletedAt (ascending) or another suitable field.
 * @returns {Promise<Array<object>>} An array of tickets waiting for purchase.
 */
async function getWaitingForPurchaseTickets() {
  const ticketsRef = db.collection('tickets');
  try {
    // Order by 'assessmentCompletedAt' if available, otherwise 'calledAt' or 'number' as fallback.
    // Firestore requires the field to exist for ordering, so choose one that's reliably present.
    // Assuming 'assessmentCompletedAt' is set when a ticket moves to 'waiting_purchase'.
    const snapshot = await ticketsRef
      .where('status', '==', 'waiting_purchase')
      .orderBy('assessmentCompletedAt', 'asc') // Or 'number' if assessmentCompletedAt is not guaranteed
      .get();
    
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching tickets waiting for purchase:", error);
    throw error;
  }
}

/**
 * Calls a specific ticket for purchase.
 * Updates its status from "waiting_purchase" to "called_purchase" and updates calledAt.
 * @param {string} ticketId - The ID of the ticket to call.
 * @returns {Promise<object>} The updated ticket data.
 * @throws {Error} if ticket not found, not in correct status, or update fails.
 */
async function callForPurchase(ticketId) {
  const ticketRef = db.collection('tickets').doc(ticketId);

  try {
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      const error = new Error(`Ticket ${ticketId} not found.`);
      error.status = 404;
      throw error;
    }

    const ticketData = ticketDoc.data();

    if (ticketData.status !== 'waiting_purchase') {
      const error = new Error(`Ticket ${ticketId} is not in 'waiting_purchase' state. Current status: ${ticketData.status}.`);
      error.status = 400; // Bad request
      throw error;
    }

    await ticketRef.update({
      status: 'called_purchase',
      calledAt: admin.firestore.FieldValue.serverTimestamp(), // Reusing calledAt for simplicity
      // purchaseCalledAt: admin.firestore.FieldValue.serverTimestamp(), // Alternative if distinct timestamp needed
    });

    const updatedDoc = await ticketRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() };

  } catch (error) {
    console.error(`Error calling ticket ${ticketId} for purchase:`, error);
    if (error.status) throw error;
    const newError = new Error(`Failed to call ticket ${ticketId} for purchase.`);
    newError.cause = error;
    throw newError;
  }
}
