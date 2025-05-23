// DOM Elements
const adminAuthStatusDiv = document.getElementById('adminAuthStatus');
const adminControlsDiv = document.getElementById('adminControls');
const assessmentQueueListUl = document.getElementById('assessmentQueueList');
const callNextAssessmentBtn = document.getElementById('callNextAssessmentBtn');
const lastCalledTicketDetailsDiv = document.getElementById('lastCalledTicketDetails');
const markAssessmentCompleteBtn = document.getElementById('markAssessmentCompleteBtn');
const adminMessagesDiv = document.getElementById('adminMessages');

// Purchase Call Section Elements
const purchaseQueueListUl = document.getElementById('purchaseQueueList');
const lastCalledPurchaseTicketDetailsDiv = document.getElementById('lastCalledPurchaseTicketDetails');
const markTicketDoneBtn = document.getElementById('markTicketDoneBtn'); // Added button


let liffIdToken = null;
const LIFF_ID = "YOUR_LIFF_ID_PLACEHOLDER"; // Replace with your actual LIFF ID
let currentAssessmentTicketId = null; // To store the ID of the ticket in #lastCalledTicketDetails
let currentPurchaseTicketId = null; // Added: To store the ID of the ticket in #lastCalledPurchaseTicketDetails
let pollingIntervalId = null;
let purchaseQueuePollingIntervalId = null; // Separate polling for purchase queue
const POLLING_INTERVAL = 15000; // 15 seconds for polling

async function initializeLiffAndCheckAdmin() {
  try {
    console.log("Initializing LIFF for Admin...");
    await liff.init({ liffId: LIFF_ID });
    console.log("LIFF Admin initialized.");

    if (!liff.isLoggedIn()) {
      console.log("Admin not logged in, redirecting to login...");
      adminAuthStatusDiv.innerHTML = '<p>Please log in.</p>';
      liff.login();
      return;
    }

    liffIdToken = liff.getIDToken();
    if (!liffIdToken) {
      showAdminMessage('Could not retrieve ID token. Admin features disabled.', true);
      adminAuthStatusDiv.innerHTML = '<p>Could not get ID token. Please try again.</p>';
      return;
    }

    // Verify admin status by calling a protected admin route
    const response = await fetch('/api/admin/dashboard', { // Use the test dashboard route
      headers: { 'Authorization': `Bearer ${liffIdToken}` }
    });

    if (response.ok) {
      adminAuthStatusDiv.innerHTML = '<p>Admin access verified.</p>';
      adminControlsDiv.style.display = 'block';
      await fetchAssessmentQueue(); // Initial fetch for assessment
      if (pollingIntervalId) clearInterval(pollingIntervalId);
      pollingIntervalId = setInterval(fetchAssessmentQueue, POLLING_INTERVAL);

      await fetchPurchaseQueue(); // Initial fetch for purchase
      if (purchaseQueuePollingIntervalId) clearInterval(purchaseQueuePollingIntervalId);
      purchaseQueuePollingIntervalId = setInterval(fetchPurchaseQueue, POLLING_INTERVAL + 5000); // Slightly different interval
    } else {
      const errorData = await response.json();
      console.error("Admin access denied:", response.status, errorData.message);
      adminAuthStatusDiv.innerHTML = `<p>Admin access denied: ${errorData.message || 'You do not have permission to view this page.'}</p>`;
      showAdminMessage('You are not authorized as an admin.', true);
      adminControlsDiv.style.display = 'none';
    }
  } catch (error) {
    console.error("LIFF Initialization or Admin Check failed:", error);
    adminAuthStatusDiv.innerHTML = '<p>Error during LIFF initialization or admin check. See console.</p>';
    showAdminMessage(`Error: ${error.message}`, true);
    adminControlsDiv.style.display = 'none';
  }
}

function showAdminMessage(message, isError = false) {
  if (adminMessagesDiv) {
    adminMessagesDiv.innerHTML = `<p class="${isError ? 'error' : 'success'}">${message}</p>`;
  } else {
    console.log(`Admin Message (${isError ? 'Error' : 'Info'}): ${message}`);
  }
}

function displayAssessmentQueue(tickets) {
  if (!assessmentQueueListUl) return;
  assessmentQueueListUl.innerHTML = ''; // Clear existing list

  if (!tickets || tickets.length === 0) {
    assessmentQueueListUl.innerHTML = '<li>No tickets waiting for assessment.</li>';
    return;
  }

  tickets.forEach(ticket => {
    const listItem = document.createElement('li');
    let createdAt = 'N/A';
    if (ticket.createdAt && ticket.createdAt.seconds) {
        createdAt = new Date(ticket.createdAt.seconds * 1000).toLocaleString();
    } else if (ticket.createdAt) {
        createdAt = new Date(ticket.createdAt).toLocaleString();
    }
    listItem.textContent = `Ticket #${ticket.number} (User: ${ticket.userId.substring(0,10)}...) - Created: ${createdAt}`;
    assessmentQueueListUl.appendChild(listItem);
  });
}

function displayLastCalled(ticket) {
  if (!lastCalledTicketDetailsDiv || !markAssessmentCompleteBtn) return;
  
  currentAssessmentTicketId = null; // Reset
  markAssessmentCompleteBtn.style.display = 'none'; // Hide button by default

  if (ticket && ticket.id) {
    let calledAt = 'N/A';
    if (ticket.calledAt && ticket.calledAt.seconds) {
        calledAt = new Date(ticket.calledAt.seconds * 1000).toLocaleString();
    } else if (ticket.calledAt) { // If it's already a string or number timestamp
        calledAt = new Date(ticket.calledAt).toLocaleString();
    }
    lastCalledTicketDetailsDiv.innerHTML = `
      <p><strong>Ticket Number:</strong> ${ticket.number}</p>
      <p><strong>User ID:</strong> ${ticket.userId}</p>
      <p><strong>Status:</strong> ${ticket.status}</p>
      <p><strong>Called At:</strong> ${calledAt}</p>
    `;

    if (ticket.status === 'called_assessment') {
      currentAssessmentTicketId = ticket.id;
      markAssessmentCompleteBtn.style.display = 'block'; // Show the button
      markAssessmentCompleteBtn.disabled = false;
    }
  } else {
    lastCalledTicketDetailsDiv.innerHTML = '<p>No ticket currently called for assessment.</p>';
  }
}

async function fetchAssessmentQueue() {
  if (!liffIdToken) {
    showAdminMessage('Authentication token not available. Cannot fetch queue.', true);
    return;
  }
  try {
    const response = await fetch('/api/admin/assessment-queue', {
      headers: { 'Authorization': `Bearer ${liffIdToken}` }
    });
    if (response.ok) {
      const tickets = await response.json();
      displayAssessmentQueue(tickets);
    } else {
      const errorData = await response.json();
      showAdminMessage(`Failed to load assessment queue: ${errorData.message || response.statusText}`, true);
      displayAssessmentQueue([]); // Show empty list on error
    }
  } catch (error) {
    console.error('Error fetching assessment queue:', error);
    showAdminMessage(`Client-side error fetching queue: ${error.message}`, true);
    displayAssessmentQueue([]); // Show empty list on error
  }
}

async function handleCallNextAssessment() {
  if (!liffIdToken) {
    showAdminMessage('Authentication token not available. Cannot call next ticket.', true);
    return;
  }
  callNextAssessmentBtn.disabled = true;
  showAdminMessage('Calling next ticket...', false);

  try {
    const response = await fetch('/api/admin/call/assessment', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${liffIdToken}` }
    });

    const responseData = await response.json(); // Try to parse JSON regardless of status for error messages

    if (response.ok) {
      displayLastCalled(responseData);
      showAdminMessage(`Successfully called Ticket #${responseData.number}.`, false);
      await fetchAssessmentQueue(); // Refresh the queue
    } else {
      showAdminMessage(`Error calling next ticket: ${responseData.message || response.statusText}`, true);
      displayLastCalled(null); // Clear last called details on error
    }
  } catch (error) {
    console.error('Client-side error calling next assessment:', error);
    showAdminMessage(`Client-side error: ${error.message}`, true);
    displayLastCalled(null); // Clear last called details on error
  } finally {
    callNextAssessmentBtn.disabled = false;
  }
}

// Event Listeners
window.addEventListener('load', initializeLiffAndCheckAdmin);
if (callNextAssessmentBtn) {
  callNextAssessmentBtn.addEventListener('click', handleCallNextAssessment);
}
if (markAssessmentCompleteBtn) {
  markAssessmentCompleteBtn.addEventListener('click', handleMarkAssessmentComplete);
}


async function handleMarkAssessmentComplete() {
  if (!currentAssessmentTicketId) {
    showAdminMessage('No ticket selected or ID missing to mark as complete.', true);
    return;
  }
  if (!liffIdToken) {
    showAdminMessage('Authentication token not available.', true);
    return;
  }

  markAssessmentCompleteBtn.disabled = true;
  showAdminMessage(`Marking ticket ${currentAssessmentTicketId} assessment complete...`, false);

  try {
    const response = await fetch(`/api/admin/assessment-complete/${currentAssessmentTicketId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${liffIdToken}` }
    });

    const responseData = await response.json();

    if (response.ok) {
      showAdminMessage(`Ticket #${responseData.number} status updated to ${responseData.status}.`, false);
      // Clear the last called details as this ticket is processed
      displayLastCalled(null); 
      // The assessment queue is polled, so it will refresh.
      // If there was a "Waiting for Purchase" list, we'd update it here.
      currentAssessmentTicketId = null; // Clear the ID
      markAssessmentCompleteBtn.style.display = 'none';
    } else {
      showAdminMessage(`Error: ${responseData.message || response.statusText}`, true);
      markAssessmentCompleteBtn.disabled = false; // Re-enable on error
    }
  } catch (error) {
    console.error('Client-side error marking assessment complete:', error);
    showAdminMessage(`Client-side error: ${error.message}`, true);
    markAssessmentCompleteBtn.disabled = false; // Re-enable on error
  }
}


window.addEventListener('beforeunload', () => {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    console.log("Polling for assessment queue stopped.");
  }
  if (purchaseQueuePollingIntervalId) {
    clearInterval(purchaseQueuePollingIntervalId);
    console.log("Polling for purchase queue stopped.");
  }
});

// Add event listener for the new button
if (markTicketDoneBtn) {
  markTicketDoneBtn.addEventListener('click', handleMarkTicketDone);
}

async function handleMarkTicketDone() {
  if (!currentPurchaseTicketId) {
    showAdminMessage('No ticket selected to mark as done.', true);
    return;
  }
  if (!liffIdToken) {
    showAdminMessage('Authentication token not available.', true);
    return;
  }

  markTicketDoneBtn.disabled = true;
  showAdminMessage(`Marking ticket ${currentPurchaseTicketId} as done...`, false);

  try {
    const response = await fetch(`/api/admin/ticket/complete/${currentPurchaseTicketId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${liffIdToken}` }
    });
    const responseData = await response.json();

    if (response.ok) {
      showAdminMessage(`Ticket #${responseData.number} marked as DONE. Status: ${responseData.status}.`, false);
      displayLastCalledPurchase(null); // Clear the last called purchase section
      await fetchPurchaseQueue(); // Refresh the purchase queue (ticket should be gone)
    } else {
      showAdminMessage(`Error marking ticket done: ${responseData.message || response.statusText}`, true);
      markTicketDoneBtn.disabled = false; // Re-enable on error
    }
  } catch (error) {
    console.error('Client-side error marking ticket done:', error);
    showAdminMessage(`Client-side error: ${error.message}`, true);
    markTicketDoneBtn.disabled = false; // Re-enable on error
  }
}


// --- Purchase Call Feature Functions ---

function displayPurchaseQueue(tickets) {
  if (!purchaseQueueListUl) return;
  purchaseQueueListUl.innerHTML = ''; // Clear existing list

  if (!tickets || tickets.length === 0) {
    purchaseQueueListUl.innerHTML = '<li>No tickets waiting for purchase.</li>';
    return;
  }

  tickets.forEach(ticket => {
    const listItem = document.createElement('li');
    let completedAt = 'N/A';
    if (ticket.assessmentCompletedAt && ticket.assessmentCompletedAt.seconds) {
        completedAt = new Date(ticket.assessmentCompletedAt.seconds * 1000).toLocaleTimeString();
    } else if (ticket.assessmentCompletedAt) {
        completedAt = new Date(ticket.assessmentCompletedAt).toLocaleTimeString();
    }
    
    listItem.innerHTML = `
      Ticket #<strong>${ticket.number}</strong> 
      (User: ${ticket.userId.substring(0,10)}...) 
      - Assessment Completed: ${completedAt}
      <button class="callForPurchaseBtn" data-ticket-id="${ticket.id}">Call for Purchase</button>
    `;
    purchaseQueueListUl.appendChild(listItem);
  });

  // Add event listeners to newly created buttons
  document.querySelectorAll('.callForPurchaseBtn').forEach(button => {
    button.addEventListener('click', handleCallForPurchase);
  });
}

function displayLastCalledPurchase(ticket) {
  if (!lastCalledPurchaseTicketDetailsDiv) return;
  if (ticket && ticket.id) {
    let calledAt = 'N/A';
    if (ticket.calledAt && ticket.calledAt.seconds) {
        calledAt = new Date(ticket.calledAt.seconds * 1000).toLocaleString();
    } else if (ticket.calledAt) { // If it's already a string or number timestamp
        calledAt = new Date(ticket.calledAt).toLocaleString();
    }
    lastCalledPurchaseTicketDetailsDiv.innerHTML = `
      <p><strong>Ticket Number:</strong> ${ticket.number}</p>
      <p><strong>User ID:</strong> ${ticket.userId}</p>
      <p><strong>Status:</strong> ${ticket.status}</p>
      <p><strong>Called At:</strong> ${calledAt}</p>
    `;
  } else {
    lastCalledPurchaseTicketDetailsDiv.innerHTML = '<p>No ticket recently called for purchase.</p>';
  }
}


async function fetchPurchaseQueue() {
  if (!liffIdToken) {
    // This message is more for console, not for primary admin message div
    console.log('Authentication token not available. Cannot fetch purchase queue.');
    return;
  }
  try {
    const response = await fetch('/api/admin/purchase-queue', {
      headers: { 'Authorization': `Bearer ${liffIdToken}` }
    });
    if (response.ok) {
      const tickets = await response.json();
      displayPurchaseQueue(tickets);
    } else {
      const errorData = await response.json();
      showAdminMessage(`Failed to load purchase queue: ${errorData.message || response.statusText}`, true);
      displayPurchaseQueue([]); // Show empty list on error
    }
  } catch (error) {
    console.error('Error fetching purchase queue:', error);
    showAdminMessage(`Client-side error fetching purchase queue: ${error.message}`, true);
    displayPurchaseQueue([]);
  }
}

async function handleCallForPurchase(event) {
  const ticketId = event.target.dataset.ticketId;
  if (!ticketId) {
    showAdminMessage('Ticket ID missing.', true);
    return;
  }
  if (!liffIdToken) {
    showAdminMessage('Authentication token not available.', true);
    return;
  }

  event.target.disabled = true; // Disable button during API call
  showAdminMessage(`Calling ticket ${ticketId} for purchase...`, false);

  try {
    const response = await fetch(`/api/admin/call/purchase/${ticketId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${liffIdToken}` }
    });
    const responseData = await response.json();

    if (response.ok) {
      showAdminMessage(`Ticket #${responseData.number} called for purchase. Status: ${responseData.status}.`, false);
      displayLastCalledPurchase(responseData);
      await fetchPurchaseQueue(); // Refresh the purchase queue
    } else {
      showAdminMessage(`Error calling for purchase: ${responseData.message || response.statusText}`, true);
      event.target.disabled = false; // Re-enable button on error
    }
  } catch (error) {
    console.error('Client-side error calling for purchase:', error);
    showAdminMessage(`Client-side error: ${error.message}`, true);
    event.target.disabled = false; // Re-enable button on error
  }
}
