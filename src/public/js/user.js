// DOM Elements
const userIdSpan = document.getElementById('userId');
const displayNameSpan = document.getElementById('displayName');
const ticketNumberSpan = document.getElementById('ticketNumber');
const ticketStatusSpan = document.getElementById('ticketStatus');
const ticketLocationSpan = document.getElementById('ticketLocation');
const ticketCreatedAtSpan = document.getElementById('ticketCreatedAt');
const issueTicketBtn = document.getElementById('issueTicketBtn');
// const fetchActiveTicketBtn = document.getElementById('fetchActiveTicketBtn'); // Removed as it was unused
const messagesDiv = document.getElementById('messages');
const calledAssessmentNumbersSpan = document.getElementById('calledAssessmentNumbers');
const calledPurchaseNumbersSpan = document.getElementById('calledPurchaseNumbers');
const userCallNotificationP = document.getElementById('userCallNotification');


let liffIdToken = null;
let liffUserProfile = null;
let currentUserTicket = null; // To store the user's active ticket details
let pollingIntervalId = null;
const POLLING_INTERVAL = 10000; // 10 seconds for polling

const LIFF_ID = "YOUR_LIFF_ID_PLACEHOLDER"; // Replace with your actual LIFF ID from LINE Developer Console

async function initializeLiff() {
  try {
    console.log("Initializing LIFF...");
    await liff.init({ liffId: LIFF_ID });
    console.log("LIFF initialized.");

    if (!liff.isLoggedIn()) {
      console.log("User not logged in, redirecting to login...");
      liff.login(); // This will redirect, so code below might not execute until page reloads
      return;
    }

    console.log("User is logged in.");
    liffIdToken = liff.getIDToken();
    liffUserProfile = await liff.getProfile();

    console.log("ID Token:", liffIdToken ? "Retrieved" : "Not retrieved");
    console.log("User Profile:", liffUserProfile);

    if (userIdSpan) userIdSpan.textContent = liffUserProfile.userId;
    if (displayNameSpan) displayNameSpan.textContent = liffUserProfile.displayName;

    // After LIFF is initialized and user is logged in, try to fetch their active ticket
    await fetchActiveTicket();
    // Then fetch currently called numbers and start polling
    await fetchCalledNumbers();
    if (pollingIntervalId) clearInterval(pollingIntervalId); // Clear existing interval if any
    pollingIntervalId = setInterval(fetchCalledNumbers, POLLING_INTERVAL);


  } catch (error) {
    console.error("LIFF Initialization failed:", error);
    displayMessage(`LIFF Initialization failed: ${error.message}`, 'error');
  }
}

function displayMessage(message, type = 'info') {
  if (messagesDiv) {
    messagesDiv.innerHTML = `<p class="${type}">${message}</p>`;
  } else {
    console.log(`Message (${type}): ${message}`);
  }
}

function updateTicketDisplay(ticket) {
  currentUserTicket = ticket; // Store the current user's ticket details globally

  if (ticket && ticket.id) { // Check if ticket object is valid and has an id
    ticketNumberSpan.textContent = ticket.number || 'N/A';
    ticketStatusSpan.textContent = ticket.status || 'N/A';
    ticketLocationSpan.textContent = ticket.location ? `Lat: ${ticket.location.lat}, Lng: ${ticket.location.lng}` : 'Not provided';
    // Ensure createdAt is handled correctly, whether it's a Firestore Timestamp object or a string
    let createdAtDate = 'N/A';
    if (ticket.createdAt) {
      if (ticket.createdAt.seconds) { // Firestore Timestamp object
        createdAtDate = new Date(ticket.createdAt.seconds * 1000).toLocaleString();
      } else if (typeof ticket.createdAt === 'string') { // ISO string, for example
        createdAtDate = new Date(ticket.createdAt).toLocaleString();
      }
    }
    ticketCreatedAtSpan.textContent = createdAtDate;
    
    issueTicketBtn.disabled = true;
    issueTicketBtn.textContent = 'Ticket Already Issued';
  } else {
    ticketNumberSpan.textContent = 'No active ticket';
    ticketStatusSpan.textContent = 'N/A';
    ticketLocationSpan.textContent = 'N/A';
    ticketCreatedAtSpan.textContent = 'N/A';
    issueTicketBtn.disabled = false;
    issueTicketBtn.textContent = 'Issue New Ticket';
  }
  // After updating ticket display, check if user's ticket is called
  checkAndNotifyUserCall(); 
}

async function fetchActiveTicket() {
  if (!liffIdToken) {
    displayMessage("Cannot fetch ticket: User not authenticated (LIFF ID Token not available).", "error");
    updateTicketDisplay(null); // Ensure UI reflects no ticket state
    return;
  }
  
  displayMessage("Checking for active ticket...", "info");

  try {
    const response = await fetch('/api/tickets/my-ticket', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${liffIdToken}`,
        'Content-Type': 'application/json' // Good practice, though not strictly needed for GET
      },
    });

    if (response.ok) { // Status 200
      const ticket = await response.json();
      updateTicketDisplay(ticket); // This will also call checkAndNotifyUserCall
      displayMessage("Active ticket loaded successfully.", "success");
    } else if (response.status === 404) {
      updateTicketDisplay(null); // No active ticket found
      displayMessage("You don't have an active ticket.", "info");
    } else { // Other errors (e.g., 500)
      const errorData = await response.json();
      updateTicketDisplay(null); // Clear ticket display on error
      displayMessage(`Error fetching ticket: ${errorData.message || response.statusText}`, 'error');
    }
  } catch (error) {
    console.error('Client-side error fetching active ticket:', error);
    updateTicketDisplay(null); // Clear ticket display on client-side error
    displayMessage(`Client-side error fetching ticket: ${error.message}. Check console.`, 'error');
  }
}


async function handleIssueTicket() {
  if (!liffIdToken) {
    displayMessage("Cannot issue ticket: User not authenticated (no ID Token). Please ensure LIFF is initialized and you are logged in.", "error");
    return;
  }

  displayMessage("Issuing ticket...", "info");
  issueTicketBtn.disabled = true;

  let userLocation = null;
  try {
    // Optional: Get user's current location
    if (navigator.geolocation) {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      console.log("User location obtained:", userLocation);
    }
  } catch (geoError) {
    console.warn("Could not get user location:", geoError.message);
    displayMessage("Could not get location. Proceeding without it.", "info");
  }

  try {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${liffIdToken}`,
      },
      body: JSON.stringify({ location: userLocation }),
    });

    // Regardless of outcome, try to fetch the latest ticket status to ensure UI consistency
    // This simplifies logic as fetchActiveTicket will handle UI updates for success, existing ticket, or errors.
    await fetchActiveTicket(); 

    // Optionally, display a specific message based on the POST response before fetchActiveTicket updates the UI
    if (response.ok) {
        // The fetchActiveTicket called above will update the display.
        // We can add a brief success message here if desired, or rely on fetchActiveTicket's messages.
        console.log("Ticket issuance request successful, UI will be updated by fetchActiveTicket.");
    } else if (response.status === 400) { // Already has a ticket
        console.log("Ticket issuance failed (likely already has one), UI updated by fetchActiveTicket.");
    } else { // Other errors
        const errorData = await response.json();
        // fetchActiveTicket will likely show "no active ticket" or an error.
        // This specific error might be useful for logging or a more detailed message.
        displayMessage(`Ticket issuance request failed: ${errorData.message || response.statusText}`, 'error');
    }

  } catch (error) {
    console.error('Client-side error issuing ticket:', error);
    displayMessage(`Client-side error during ticket issuance: ${error.message}. Check console.`, 'error');
    // Attempt to refresh ticket status even on client-side error during issuance
    await fetchActiveTicket(); 
  }
}

// Event Listeners
window.addEventListener('load', initializeLiff);
if (issueTicketBtn) {
  issueTicketBtn.addEventListener('click', handleIssueTicket);
}

// No need for fetchActiveTicketBtn as it's called on load and after issuance.
// If a manual refresh is desired, the button can be added back with an event listener to call fetchActiveTicket().

// --- Functions for "Currently Called" Feature ---

function updateCalledNumbersDisplay(calledData) {
  if (!calledAssessmentNumbersSpan || !calledPurchaseNumbersSpan) return;

  if (calledData && calledData.assessment) {
    calledAssessmentNumbersSpan.textContent = calledData.assessment.map(t => t.number).join(', ') || 'None';
  } else {
    calledAssessmentNumbersSpan.textContent = 'Error loading';
  }

  if (calledData && calledData.purchase) {
    calledPurchaseNumbersSpan.textContent = calledData.purchase.map(t => t.number).join(', ') || 'None';
  } else {
    calledPurchaseNumbersSpan.textContent = 'Error loading';
  }
  // After updating called numbers, check if user's ticket is among them
  checkAndNotifyUserCall(calledData);
}

function checkAndNotifyUserCall(calledData) {
  if (!userCallNotificationP) return;
  userCallNotificationP.textContent = ''; // Clear previous notification

  if (currentUserTicket && currentUserTicket.number && calledData) {
    let notification = '';
    if (calledData.assessment && calledData.assessment.some(t => t.number === currentUserTicket.number)) {
      notification = `Your ticket #${currentUserTicket.number} is now called for ASSESSMENT!`;
      // Also check if ticket status in currentUserTicket matches, e.g. 'called_assessment'
      // This ensures the notification is relevant to the current state.
      if(currentUserTicket.status === 'called_assessment'){
         userCallNotificationP.style.color = 'green';
      } else {
         userCallNotificationP.style.color = 'orange'; // Status mismatch, maybe it was called and then changed
      }
    } else if (calledData.purchase && calledData.purchase.some(t => t.number === currentUserTicket.number)) {
      notification = `Your ticket #${currentUserTicket.number} is now called for PURCHASE!`;
      if(currentUserTicket.status === 'called_purchase'){
         userCallNotificationP.style.color = 'green';
      } else {
         userCallNotificationP.style.color = 'orange';
      }
    }
    userCallNotificationP.textContent = notification;
  }
}

async function fetchCalledNumbers() {
  if (!liffIdToken) {
    // Not necessarily an error for public display, but good to know for debugging
    console.log("Cannot fetch called numbers: User not authenticated (no ID Token)."); 
    updateCalledNumbersDisplay({ assessment: [], purchase: [] }); // Show 'None' or 'Error'
    return;
  }

  try {
    const response = await fetch('/api/tickets/called', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${liffIdToken}`, // Protected endpoint
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) { // Status 200
      const calledData = await response.json();
      updateCalledNumbersDisplay(calledData);
    } else {
      console.error(`Error fetching called numbers: ${response.status} ${response.statusText}`);
      const errorData = await response.json();
      displayMessage(`Error fetching called numbers: ${errorData.message || response.statusText}`, 'error');
      updateCalledNumbersDisplay({ assessment: [], purchase: [] }); // Show 'None' or 'Error'
    }
  } catch (error) {
    console.error('Client-side error fetching called numbers:', error);
    displayMessage(`Client-side error fetching called numbers: ${error.message}. Check console.`, 'error');
    updateCalledNumbersDisplay({ assessment: [], purchase: [] }); // Show 'None' or 'Error'
  }
}

// Clear polling interval on page unload (though LIFF might not always trigger this as expected in SPAs)
window.addEventListener('beforeunload', () => {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    console.log("Polling for called numbers stopped.");
  }
});
