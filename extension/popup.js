
// JoqniX Cookie Sync
// Popup Controller
// Version: 0.1.0

const statusElement = document.getElementById("status");
const cookieCountElement = document.getElementById("cookie-count");
const lastSyncElement = document.getElementById("last-sync");

const youtubeStatus = document.getElementById("youtube-status");
const twitchStatus = document.getElementById("twitch-status");
const kickStatus = document.getElementById("kick-status");

const syncButton = document.getElementById("sync-button");
const messageElement = document.getElementById("message");


/**
 * Send a message to the background service worker.
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}


/**
 * Format a timestamp into a readable local time.
 */
function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "Never";
  }

  return new Date(timestamp).toLocaleString();
}


/**
 * Update the service indicators based on detected cookies.
 */
function updateServiceStatus(cookies) {
  const services = {
    youtube: false,
    twitch: false,
    kick: false
  };

  for (const cookie of cookies) {
    const domain = cookie.domain
      .replace(/^\./, "")
      .toLowerCase();

    if (
      domain === "youtube.com" ||
      domain.endsWith(".youtube.com")
    ) {
      services.youtube = true;
    }

    if (
      domain === "twitch.tv" ||
      domain.endsWith(".twitch.tv")
    ) {
      services.twitch = true;
    }

    if (
      domain === "kick.com" ||
      domain.endsWith(".kick.com")
    ) {
      services.kick = true;
    }
  }

  updateIndicator(youtubeStatus, services.youtube);
  updateIndicator(twitchStatus, services.twitch);
  updateIndicator(kickStatus, services.kick);
}


/**
 * Update an individual service indicator.
 */
function updateIndicator(element, connected) {
  element.classList.remove(
    "connected",
    "disconnected"
  );

  if (connected) {
    element.textContent = "Detected";
    element.classList.add("connected");
  } else {
    element.textContent = "Not detected";
    element.classList.add("disconnected");
  }
}


/**
 * Load the current cookie information.
 */
async function loadStatus() {
  try {
    statusElement.textContent = "Checking...";

    const [cookieResponse, statusResponse] = await Promise.all([
      sendMessage({
        type: "GET_COOKIES"
      }),

      sendMessage({
        type: "GET_STATUS"
      })
    ]);

    if (!cookieResponse?.success) {
      throw new Error(
        cookieResponse?.error ||
        "Failed to retrieve cookies."
      );
    }

    if (!statusResponse?.success) {
      throw new Error(
        statusResponse?.error ||
        "Failed to retrieve status."
      );
    }

    const cookies = cookieResponse.cookies || [];

    cookieCountElement.textContent = cookies.length;

    lastSyncElement.textContent =
      formatTimestamp(statusResponse.lastLocalSync);

    updateServiceStatus(cookies);

    statusElement.textContent = "Ready";

  } catch (error) {
    console.error(
      "[Cookie Sync] Failed to load status:",
      error
    );

    statusElement.textContent = "Error";
    messageElement.textContent = error.message;
    messageElement.className = "message error";
  }
}


/**
 * Perform a local cookie snapshot.
 */
async function syncLocally() {
  try {
    syncButton.disabled = true;
    syncButton.textContent = "Syncing...";

    messageElement.textContent = "";
    messageElement.className = "message";

    const response = await sendMessage({
      type: "SYNC_LOCAL"
    });

    if (!response?.success) {
      throw new Error(
        response?.error ||
        "Local sync failed."
      );
    }

    cookieCountElement.textContent = response.count;
    lastSyncElement.textContent =
      formatTimestamp(response.timestamp);

    messageElement.textContent =
      `Local snapshot updated: ${response.count} cookies`;

    messageElement.className = "message success";

    await loadStatus();

  } catch (error) {
    console.error(
      "[Cookie Sync] Local sync failed:",
      error
    );

    messageElement.textContent =
      error.message;

    messageElement.className =
      "message error";

  } finally {
    syncButton.disabled = false;
    syncButton.textContent = "Sync Locally";
  }
}


/**
 * Button event.
 */
syncButton.addEventListener(
  "click",
  syncLocally
);


/**
 * Initialize popup.
 */
document.addEventListener(
  "DOMContentLoaded",
  loadStatus
);
