// JoqniX Cookie Sync
// Popup Controller
// Version: 0.5.0


/* =========================================================
   CONSTANTS
   ========================================================= */

const SUPPORTED_DOMAINS = [
  "youtube.com",
  "google.com",
  "twitch.tv",
  "kick.com",
  "meldstudio.co",
  "casterlabs.co"
];

const DEFAULT_PROFILE =
  "default";


/* =========================================================
   ELEMENTS
   ========================================================= */

/* General status */

const statusElement =
  document.getElementById(
    "status"
  );

const cookieCountElement =
  document.getElementById(
    "cookie-count"
  );

const lastSyncElement =
  document.getElementById(
    "last-sync"
  );

const lastCloudSyncElement =
  document.getElementById(
    "last-cloud-sync"
  );


/* =========================================================
   PROFILE
   ========================================================= */

const syncProfileInput =
  document.getElementById(
    "sync-profile"
  );

const profileDisplay =
  document.getElementById(
    "profile-display"
  );


/* =========================================================
   SERVICE ELEMENTS
   ========================================================= */

const serviceElements = {

  "youtube.com": {

    status:
      document.getElementById(
        "youtube-status"
      ),

    count:
      document.getElementById(
        "youtube-count"
      )

  },


  "google.com": {

    status:
      document.getElementById(
        "google-status"
      ),

    count:
      document.getElementById(
        "google-count"
      )

  },


  "twitch.tv": {

    status:
      document.getElementById(
        "twitch-status"
      ),

    count:
      document.getElementById(
        "twitch-count"
      )

  },


  "kick.com": {

    status:
      document.getElementById(
        "kick-status"
      ),

    count:
      document.getElementById(
        "kick-count"
      )

  },


  "meldstudio.co": {

    status:
      document.getElementById(
        "meldstudio-status"
      ),

    count:
      document.getElementById(
        "meldstudio-count"
      )

  },


  "casterlabs.co": {

    status:
      document.getElementById(
        "casterlabs-status"
      ),

    count:
      document.getElementById(
        "casterlabs-count"
      )

  }

};


/* Service selection */

const serviceCheckboxes =
  document.querySelectorAll(
    ".service-checkbox"
  );

const selectedCountElement =
  document.getElementById(
    "selected-count"
  );

const selectAllButton =
  document.getElementById(
    "select-all-button"
  );

const clearAllButton =
  document.getElementById(
    "clear-all-button"
  );


/* =========================================================
   CLOUDFLARE
   ========================================================= */

const cloudStatus =
  document.getElementById(
    "cloud-status"
  );

const workerDisplay =
  document.getElementById(
    "worker-display"
  );

const healthDisplay =
  document.getElementById(
    "health-display"
  );

const cloudSyncDisplay =
  document.getElementById(
    "cloud-sync-display"
  );

const cloudProfileDisplay =
  document.getElementById(
    "cloud-profile-display"
  );

const cloudSelectedDisplay =
  document.getElementById(
    "cloud-selected-display"
  );

const cloudSyncButton =
  document.getElementById(
    "cloud-sync-button"
  );

const cloudSyncAllButton =
  document.getElementById(
    "cloud-sync-all-button"
  );

const automaticSync =
  document.getElementById(
    "automatic-sync"
  );

const workerUrlInput =
  document.getElementById(
    "worker-url"
  );

const workerTokenInput =
  document.getElementById(
    "worker-token"
  );

const tokenStatus =
  document.getElementById(
    "token-status"
  );

const saveConfigButton =
  document.getElementById(
    "save-config-button"
  );


/* =========================================================
   GENERAL
   ========================================================= */

const syncButton =
  document.getElementById(
    "sync-button"
  );

const messageElement =
  document.getElementById(
    "message"
  );


/* =========================================================
   VIEWER
   ========================================================= */

const cookieViewer =
  document.getElementById(
    "cookie-viewer"
  );

const viewerTitle =
  document.getElementById(
    "viewer-title"
  );

const viewerCount =
  document.getElementById(
    "viewer-count"
  );

const cookieOutput =
  document.getElementById(
    "cookie-output"
  );

const closeViewerButton =
  document.getElementById(
    "close-viewer"
  );

const copyButton =
  document.getElementById(
    "copy-button"
  );

const viewerDownloadButton =
  document.getElementById(
    "viewer-download-button"
  );


/* =========================================================
   STATE
   ========================================================= */

let currentFiles = {};

let currentService = null;

let currentProfile =
  DEFAULT_PROFILE;

let currentSelectedDomains = [
  ...SUPPORTED_DOMAINS
];


/* =========================================================
   MESSAGE HELPER
   ========================================================= */

function sendMessage(
  message
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      chrome.runtime.sendMessage(
        message,
        response => {

          if (
            chrome.runtime.lastError
          ) {

            reject(
              new Error(
                chrome.runtime
                  .lastError
                  .message
              )
            );

            return;
          }


          resolve(
            response
          );

        }
      );

    }
  );
}


/* =========================================================
   FORMATTING
   ========================================================= */

function formatTimestamp(
  timestamp
) {

  if (
    !timestamp
  ) {
    return "Never";
  }


  return new Date(
    timestamp
  ).toLocaleString();
}


function shortenUrl(
  url
) {

  if (
    !url
  ) {
    return "Not configured";
  }


  try {

    const parsed =
      new URL(url);


    return (
      parsed.origin +
      parsed.pathname
    );

  } catch {

    return url;

  }
}


function normalizeProfile(
  profile
) {

  if (
    typeof profile !==
    "string"
  ) {
    return DEFAULT_PROFILE;
  }


  const normalized =
    profile
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9_-]+/g,
        "-"
      )
      .replace(
        /^[-_]+|[-_]+$/g,
        ""
      )
      .slice(
        0,
        64
      );


  return (
    normalized ||
    DEFAULT_PROFILE
  );
}


/* =========================================================
   INDICATORS
   ========================================================= */

function updateIndicator(
  element,
  connected
) {

  if (
    !element
  ) {
    return;
  }


  element.classList.remove(
    "connected",
    "disconnected"
  );


  if (
    connected
  ) {

    element.textContent =
      "Detected";


    element.classList.add(
      "connected"
    );

  } else {

    element.textContent =
      "Not detected";


    element.classList.add(
      "disconnected"
    );

  }
}


/* =========================================================
   SERVICE STATUS
   ========================================================= */

function updateServiceStatus(
  cookieCounts
) {

  for (
    const [
      service,
      elements
    ]
    of Object.entries(
      serviceElements
    )
  ) {

    const count =
      cookieCounts?.[
        service
      ] || 0;


    if (
      elements.count
    ) {

      elements.count.textContent =
        count;

    }


    if (
      elements.status
    ) {

      updateIndicator(
        elements.status,
        count > 0
      );

    }

  }
}


/* =========================================================
   SERVICE SELECTION
   ========================================================= */

function getSelectedDomainsFromUI() {

  return [
    ...serviceCheckboxes
  ]
    .filter(
      checkbox =>
        checkbox.checked
    )
    .map(
      checkbox =>
        checkbox.dataset.service
    )
    .filter(
      service =>
        SUPPORTED_DOMAINS.includes(
          service
        )
    );
}


function updateSelectedCount() {

  const selected =
    getSelectedDomainsFromUI();

  const count =
    selected.length;


  currentSelectedDomains =
    selected;


  if (
    selectedCountElement
  ) {

    selectedCountElement.textContent =
      `${count} of ${SUPPORTED_DOMAINS.length} selected`;

  }


  if (
    cloudSelectedDisplay
  ) {

    cloudSelectedDisplay.textContent =
      String(count);

  }


  if (
    cloudSyncButton
  ) {

    cloudSyncButton.disabled =
      count === 0;

  }


  updateSelectionButtonStates();
}


function updateSelectionButtonStates() {

  const selectedCount =
    getSelectedDomainsFromUI().length;


  if (
    selectAllButton
  ) {

    selectAllButton.disabled =
      selectedCount ===
      SUPPORTED_DOMAINS.length;

  }


  if (
    clearAllButton
  ) {

    clearAllButton.disabled =
      selectedCount === 0;

  }
}


function applySelectedDomains(
  selectedDomains
) {

  const selectedSet =
    new Set(
      selectedDomains
    );


  serviceCheckboxes.forEach(
    checkbox => {

      checkbox.checked =
        selectedSet.has(
          checkbox.dataset.service
        );

    }
  );


  currentSelectedDomains =
    [
      ...selectedDomains
    ];


  updateSelectedCount();
}


async function saveSelectedDomains(
  selectedDomains
) {

  const response =
    await sendMessage({

      type:
        "SET_SELECTED_DOMAINS",

      selectedDomains

    });


  if (
    !response?.success
  ) {

    throw new Error(
      response?.error ||
      "Failed to save selected services."
    );

  }


  applySelectedDomains(
    response.selectedDomains ||
    []
  );


  return response.selectedDomains ||
    [];
}


async function selectAllServices() {

  try {

    clearMessage();


    selectAllButton.disabled =
      true;


    const response =
      await sendMessage({

        type:
          "SELECT_ALL_DOMAINS"

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Failed to select all services."
      );

    }


    applySelectedDomains(
      response.selectedDomains ||
      SUPPORTED_DOMAINS
    );


    showMessage(
      "All cookie services selected.",
      "success"
    );

  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Select all failed:",
      error
    );


    showMessage(
      error.message,
      "error"
    );

  } finally {

    updateSelectionButtonStates();

  }
}


async function clearAllServices() {

  try {

    clearMessage();


    clearAllButton.disabled =
      true;


    const response =
      await sendMessage({

        type:
          "CLEAR_SELECTED_DOMAINS"

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Failed to clear service selection."
      );

    }


    applySelectedDomains(
      []
    );


    showMessage(
      "All cookie services deselected.",
      "success"
    );

  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Clear all failed:",
      error
    );


    showMessage(
      error.message,
      "error"
    );

  } finally {

    updateSelectionButtonStates();

  }
}


async function handleServiceSelectionChange(
  checkbox
) {

  const previousSelection =
    [
      ...currentSelectedDomains
    ];


  const selectedDomains =
    getSelectedDomainsFromUI();


  try {

    clearMessage();


    /*
     * An empty selection is allowed in the UI.
     * It simply means Sync Selected is disabled.
     *
     * Use CLEAR_SELECTED_DOMAINS because
     * SET_SELECTED_DOMAINS intentionally
     * rejects an empty list.
     */

    let response;


    if (
      selectedDomains.length ===
      0
    ) {

      response =
        await sendMessage({

          type:
            "CLEAR_SELECTED_DOMAINS"

        });

    } else {

      response =
        await sendMessage({

          type:
            "SET_SELECTED_DOMAINS",

          selectedDomains

        });

    }


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Failed to update selected services."
      );

    }


    applySelectedDomains(
      response.selectedDomains ||
      selectedDomains
    );


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Service selection update failed:",
      error
    );


    /*
     * Restore previous selection.
     */

    applySelectedDomains(
      previousSelection
    );


    showMessage(
      error.message,
      "error"
    );

  }
}


/* =========================================================
   PROFILE UI
   ========================================================= */

function updateProfileUI(
  profile
) {

  const normalized =
    normalizeProfile(
      profile
    );


  currentProfile =
    normalized;


  if (
    syncProfileInput
  ) {

    syncProfileInput.value =
      normalized;

  }


  if (
    profileDisplay
  ) {

    profileDisplay.textContent =
      `Profile: ${normalized}`;

  }


  if (
    cloudProfileDisplay
  ) {

    cloudProfileDisplay.textContent =
      normalized;

  }
}


async function saveProfile(
  showSuccess = false
) {

  const profile =
    normalizeProfile(
      syncProfileInput?.value ||
      DEFAULT_PROFILE
    );


  try {

    const response =
      await sendMessage({

        type:
          "SET_SYNC_PROFILE",

        profile

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Failed to save sync profile."
      );

    }


    updateProfileUI(
      response.syncProfile ||
      profile
    );


    if (
      showSuccess
    ) {

      showMessage(
        `Sync profile set to "${currentProfile}".`,
        "success"
      );

    }


    return currentProfile;

  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Failed to save profile:",
      error
    );


    showMessage(
      error.message,
      "error"
    );


    return null;

  }
}


/* =========================================================
   LOCAL STATUS
   ========================================================= */

async function loadStatus() {

  try {

    statusElement.textContent =
      "Checking...";


    const response =
      await sendMessage({

        type:
          "GET_STATUS"

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Failed to retrieve status."
      );

    }


    cookieCountElement.textContent =
      response.cookieCount ||
      0;


    lastSyncElement.textContent =
      formatTimestamp(
        response.lastLocalSync
      );


    lastCloudSyncElement.textContent =
      formatTimestamp(
        response.lastCloudSync
      );


    cloudSyncDisplay.textContent =
      formatTimestamp(
        response.lastCloudSync
      );


    updateServiceStatus(
      response.cookieCounts ||
      {}
    );


    automaticSync.checked =
      Boolean(
        response.syncAutomatically
      );


    updateProfileUI(
      response.syncProfile ||
      DEFAULT_PROFILE
    );


    applySelectedDomains(
      Array.isArray(
        response.selectedDomains
      )
        ? response.selectedDomains
        : SUPPORTED_DOMAINS
    );


    if (
      response.lastCloudSyncProfile
    ) {

      cloudProfileDisplay.textContent =
        response.lastCloudSyncProfile;

    }


    if (
      Array.isArray(
        response.lastCloudSyncSelectedDomains
      )
    ) {

      /*
       * Don't overwrite the current
       * selection here.
       *
       * This only informs the status display.
       */

      cloudSelectedDisplay.textContent =
        String(
          response.lastCloudSyncSelectedDomains.length
        );

    }


    statusElement.textContent =
      "Ready";


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Failed to load status:",
      error
    );


    statusElement.textContent =
      "Error";


    showMessage(
      error.message,
      "error"
    );

  }
}


/* =========================================================
   LOCAL SNAPSHOT
   ========================================================= */

async function syncLocally() {

  try {

    syncButton.disabled =
      true;


    syncButton.textContent =
      "Refreshing...";


    clearMessage();


    const response =
      await sendMessage({

        type:
          "SYNC_LOCAL"

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Local sync failed."
      );

    }


    cookieCountElement.textContent =
      response.count ||
      0;


    lastSyncElement.textContent =
      formatTimestamp(
        response.timestamp
      );


    updateServiceStatus(
      response.cookieCounts ||
      {}
    );


    currentFiles = {};


    showMessage(
      `Snapshot updated: ${response.count} cookies`,
      "success"
    );


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Local sync failed:",
      error
    );


    showMessage(
      error.message,
      "error"
    );


  } finally {

    syncButton.disabled =
      false;


    syncButton.textContent =
      "Refresh Cookie Snapshot";

  }
}


/* =========================================================
   NETSCAPE FILES
   ========================================================= */

async function loadNetscapeFiles() {

  const response =
    await sendMessage({

      type:
        "GET_NETSCAPE"

    });


  if (
    !response?.success
  ) {

    throw new Error(
      response?.error ||
      "Failed to retrieve Netscape files."
    );

  }


  currentFiles =
    response.files ||
    {};


  return currentFiles;
}


/* =========================================================
   COOKIE VIEWER
   ========================================================= */

async function openCookieViewer(
  service
) {

  try {

    clearMessage();


    if (
      !currentFiles ||
      !currentFiles[service]
    ) {

      await loadNetscapeFiles();

    }


    const content =
      currentFiles[service];


    if (
      !content
    ) {

      throw new Error(
        `No cookie file available for ${service}.`
      );

    }


    currentService =
      service;


    viewerTitle.textContent =
      `${getDisplayName(service)} Cookies`;


    cookieOutput.value =
      content;


    const cookieLines =
      content
        .split("\n")
        .filter(
          line =>
            line &&
            !line.startsWith("#")
        );


    viewerCount.textContent =
      `${cookieLines.length} cookies`;


    cookieViewer.classList.remove(
      "hidden"
    );


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Failed to open cookie viewer:",
      error
    );


    showMessage(
      error.message,
      "error"
    );

  }
}


function getDisplayName(
  service
) {

  const names = {

    "youtube.com":
      "YouTube",

    "google.com":
      "Google",

    "twitch.tv":
      "Twitch",

    "kick.com":
      "Kick",

    "meldstudio.co":
      "Meld Studio",

    "casterlabs.co":
      "Casterlabs"

  };


  return (
    names[service] ||
    service
  );
}


function closeCookieViewer() {

  cookieViewer.classList.add(
    "hidden"
  );


  currentService =
    null;


  cookieOutput.value =
    "";
}


/* =========================================================
   COPY
   ========================================================= */

async function copyCookieFile() {

  try {

    if (
      !cookieOutput.value
    ) {

      throw new Error(
        "There is no cookie file to copy."
      );

    }


    await navigator.clipboard.writeText(
      cookieOutput.value
    );


    copyButton.textContent =
      "Copied!";


    showMessage(
      "Netscape cookie file copied to clipboard.",
      "success"
    );


    setTimeout(
      () => {

        copyButton.textContent =
          "Copy Netscape File";

      },
      1500
    );


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Copy failed:",
      error
    );


    showMessage(
      "Failed to copy cookie file.",
      "error"
    );

  }
}


/* =========================================================
   DOWNLOAD
   ========================================================= */

async function downloadCookieFile(
  service
) {

  try {

    if (
      !service
    ) {

      throw new Error(
        "No cookie service selected."
      );

    }


    const response =
      await sendMessage({

        type:
          "DOWNLOAD_NETSCAPE",

        service

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Failed to retrieve cookie file."
      );

    }


    /*
     * The popup runs in a normal extension
     * document, so createObjectURL()
     * is available here.
     */

    const blob =
      new Blob(
        [
          response.content
        ],
        {
          type:
            "text/plain;charset=utf-8"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const anchor =
      document.createElement(
        "a"
      );


    anchor.href =
      url;


    anchor.download =
      response.filename ||
      `${service}.txt`;


    document.body.appendChild(
      anchor
    );


    anchor.click();


    anchor.remove();


    setTimeout(
      () => {

        URL.revokeObjectURL(
          url
        );

      },
      1000
    );


    showMessage(
      `${getDisplayName(service)} Netscape file download started.`,
      "success"
    );


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Download failed:",
      error
    );


    showMessage(
      error.message,
      "error"
    );

  }
}


/* =========================================================
   CLOUDFLARE CONFIG
   ========================================================= */

async function loadCloudConfig() {

  try {

    const response =
      await sendMessage({

        type:
          "GET_CONFIG"

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Failed to load Cloudflare configuration."
      );

    }


    workerUrlInput.value =
      response.workerUrl ||
      "";


    automaticSync.checked =
      Boolean(
        response.syncAutomatically
      );


    updateProfileUI(
      response.syncProfile ||
      DEFAULT_PROFILE
    );


    applySelectedDomains(
      Array.isArray(
        response.selectedDomains
      )
        ? response.selectedDomains
        : SUPPORTED_DOMAINS
    );


    updateTokenStatus(
      response.hasToken
    );


    updateCloudStatus(
      response.hasToken,
      response.workerUrl
    );


    if (
      response.hasToken &&
      response.workerUrl
    ) {

      await checkCloudflareHealth();

    } else {

      updateHealthStatus(
        "Not configured",
        false
      );

    }


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Failed to load cloud config:",
      error
    );


    updateCloudStatus(
      false,
      ""
    );


    updateTokenStatus(
      false
    );


    updateHealthStatus(
      "Not configured",
      false
    );

  }
}


/* =========================================================
   CLOUD STATUS
   ========================================================= */

function updateCloudStatus(
  hasToken,
  workerUrl
) {

  cloudStatus.classList.remove(
    "connected",
    "disconnected"
  );


  if (
    hasToken &&
    workerUrl
  ) {

    cloudStatus.textContent =
      "Configured";


    cloudStatus.classList.add(
      "connected"
    );


    workerDisplay.textContent =
      shortenUrl(
        workerUrl
      );


  } else {

    cloudStatus.textContent =
      "Not configured";


    cloudStatus.classList.add(
      "disconnected"
    );


    workerDisplay.textContent =
      workerUrl
        ? shortenUrl(
            workerUrl
          )
        : "Not configured";

  }
}


function updateTokenStatus(
  hasToken
) {

  tokenStatus.classList.remove(
    "connected",
    "disconnected"
  );


  if (
    hasToken
  ) {

    tokenStatus.textContent =
      "Saved token is configured";


    tokenStatus.classList.add(
      "connected"
    );


  } else {

    tokenStatus.textContent =
      "No saved token";


    tokenStatus.classList.add(
      "disconnected"
    );

  }
}


function updateHealthStatus(
  text,
  connected
) {

  healthDisplay.textContent =
    text;


  healthDisplay.classList.remove(
    "connected",
    "disconnected"
  );


  healthDisplay.classList.add(
    connected
      ? "connected"
      : "disconnected"
  );
}


/* =========================================================
   CLOUDFLARE HEALTH
   ========================================================= */

async function checkCloudflareHealth(
  showErrors = false
) {

  updateHealthStatus(
    "Checking...",
    false
  );


  try {

    const response =
      await sendMessage({

        type:
          "CHECK_CLOUDFLARE_HEALTH"

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Cloudflare health check failed."
      );

    }


    const result =
      response.result;


    updateHealthStatus(
      "Connected",
      true
    );


    cloudStatus.textContent =
      "Connected";


    cloudStatus.classList.remove(
      "disconnected"
    );


    cloudStatus.classList.add(
      "connected"
    );


    /*
     * If the Worker reports a profile,
     * show it as informational state.
     */

    if (
      result?.lastProfile
    ) {

      cloudProfileDisplay.textContent =
        result.lastProfile;

    }


    return result;


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Cloudflare health check failed:",
      error
    );


    updateHealthStatus(
      getHealthErrorLabel(
        error.message
      ),
      false
    );


    if (
      showErrors
    ) {

      showMessage(
        error.message,
        "error"
      );

    }


    return null;
  }
}


function getHealthErrorLabel(
  errorMessage
) {

  const message =
    String(
      errorMessage ||
      ""
    ).toLowerCase();


  if (
    message.includes(
      "401"
    ) ||
    message.includes(
      "unauthorized"
    )
  ) {

    return "Unauthorized";
  }


  if (
    message.includes(
      "failed to fetch"
    ) ||
    message.includes(
      "network"
    )
  ) {

    return "Unreachable";
  }


  return "Unavailable";
}


/* =========================================================
   SAVE CONFIG
   ========================================================= */

async function saveCloudConfig() {

  try {

    saveConfigButton.disabled =
      true;


    saveConfigButton.textContent =
      "Saving...";


    clearMessage();


    const workerUrl =
      workerUrlInput.value.trim();


    const workerToken =
      workerTokenInput.value.trim();


    const syncProfile =
      normalizeProfile(
        syncProfileInput.value
      );


    const selectedDomains =
      getSelectedDomainsFromUI();


    if (
      !workerUrl
    ) {

      throw new Error(
        "Worker URL is required."
      );

    }


    /*
     * A blank token means:
     * keep the existing saved token.
     */

    const response =
      await sendMessage({

        type:
          "SAVE_CONFIG",

        workerUrl,

        ...(workerToken
          ? {
              workerToken
            }
          : {}),

        syncAutomatically:
          automaticSync.checked,

        syncProfile,

        selectedDomains

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Failed to save configuration."
      );

    }


    workerTokenInput.value =
      "";


    updateCloudStatus(
      response.hasToken,
      response.workerUrl
    );


    updateTokenStatus(
      response.hasToken
    );


    updateProfileUI(
      response.syncProfile ||
      syncProfile
    );


    applySelectedDomains(
      response.selectedDomains ||
      selectedDomains
    );


    showMessage(
      "Cloudflare configuration saved.",
      "success"
    );


    await checkCloudflareHealth(
      true
    );


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Failed to save config:",
      error
    );


    showMessage(
      error.message,
      "error"
    );


  } finally {

    saveConfigButton.disabled =
      false;


    saveConfigButton.textContent =
      "Save Configuration";

  }
}


/* =========================================================
   CLOUD SYNC
   ========================================================= */

async function syncSelectedToCloudflare() {

  const selectedDomains =
    getSelectedDomainsFromUI();


  if (
    selectedDomains.length ===
    0
  ) {

    showMessage(
      "Select at least one cookie service before syncing.",
      "error"
    );

    return;
  }


  try {

    cloudSyncButton.disabled =
      true;


    cloudSyncButton.textContent =
      "Syncing...";


    clearMessage();


    /*
     * Make sure the profile shown in the UI
     * is the profile actually stored in the
     * background worker before uploading.
     */

    const profile =
      await saveProfile();


    if (
      !profile
    ) {

      throw new Error(
        "Unable to save the sync profile."
      );

    }


    /*
     * Make sure the latest selection is
     * stored before the cloud upload.
     */

    await saveSelectedDomains(
      selectedDomains
    );


    const response =
      await sendMessage({

        type:
          "SYNC_SELECTED"

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Cloudflare sync failed."
      );

    }


    lastCloudSyncElement.textContent =
      formatTimestamp(
        response.timestamp
      );


    cloudSyncDisplay.textContent =
      formatTimestamp(
        response.timestamp
      );


    cloudProfileDisplay.textContent =
      response.profile ||
      profile;


    cloudSelectedDisplay.textContent =
      String(
        response.selectedDomains?.length ||
        selectedDomains.length
      );


    updateHealthStatus(
      "Connected",
      true
    );


    cloudStatus.textContent =
      "Connected";


    cloudStatus.classList.remove(
      "disconnected"
    );


    cloudStatus.classList.add(
      "connected"
    );


    showMessage(
      `Cloudflare sync completed: ${response.count} cookies across ${response.selectedDomains?.length || selectedDomains.length} services`,
      "success"
    );


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Cloudflare selected sync failed:",
      error
    );


    updateHealthStatus(
      getHealthErrorLabel(
        error.message
      ),
      false
    );


    showMessage(
      error.message,
      "error"
    );


  } finally {

    cloudSyncButton.disabled =
      getSelectedDomainsFromUI()
        .length === 0;


    cloudSyncButton.textContent =
      "Sync Selected";

  }
}


async function syncAllToCloudflare() {

  try {

    cloudSyncAllButton.disabled =
      true;


    cloudSyncButton.disabled =
      true;


    cloudSyncAllButton.textContent =
      "Syncing...";


    clearMessage();


    /*
     * Sync All still uses the currently
     * selected profile.
     */

    const profile =
      await saveProfile();


    if (
      !profile
    ) {

      throw new Error(
        "Unable to save the sync profile."
      );

    }


    const response =
      await sendMessage({

        type:
          "SYNC_ALL"

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Cloudflare sync failed."
      );

    }


    lastCloudSyncElement.textContent =
      formatTimestamp(
        response.timestamp
      );


    cloudSyncDisplay.textContent =
      formatTimestamp(
        response.timestamp
      );


    cloudProfileDisplay.textContent =
      response.profile ||
      profile;


    cloudSelectedDisplay.textContent =
      String(
        response.selectedDomains?.length ||
        SUPPORTED_DOMAINS.length
      );


    updateHealthStatus(
      "Connected",
      true
    );


    cloudStatus.textContent =
      "Connected";


    cloudStatus.classList.remove(
      "disconnected"
    );


    cloudStatus.classList.add(
      "connected"
    );


    showMessage(
      `Cloudflare sync completed: ${response.count} cookies across ${response.selectedDomains?.length || SUPPORTED_DOMAINS.length} services`,
      "success"
    );


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Cloudflare full sync failed:",
      error
    );


    updateHealthStatus(
      getHealthErrorLabel(
        error.message
      ),
      false
    );


    showMessage(
      error.message,
      "error"
    );


  } finally {

    cloudSyncAllButton.disabled =
      false;


    cloudSyncButton.disabled =
      getSelectedDomainsFromUI()
        .length === 0;


    cloudSyncAllButton.textContent =
      "Sync All";

  }
}


/* =========================================================
   AUTOMATIC SYNC
   ========================================================= */

async function updateAutomaticSync() {

  const enabled =
    automaticSync.checked;


  try {

    automaticSync.disabled =
      true;


    const response =
      await sendMessage({

        type:
          "SET_AUTOMATIC_SYNC",

        enabled

      });


    if (
      !response?.success
    ) {

      throw new Error(
        response?.error ||
        "Failed to update automatic sync."
      );

    }


    showMessage(
      enabled
        ? "Automatic sync enabled."
        : "Automatic sync disabled.",
      "success"
    );


  } catch (
    error
  ) {

    console.error(
      "[Cookie Sync] Automatic sync update failed:",
      error
    );


    /*
     * Restore the previous state.
     */

    automaticSync.checked =
      !enabled;


    showMessage(
      error.message,
      "error"
    );


  } finally {

    automaticSync.disabled =
      false;

  }
}


/* =========================================================
   MESSAGE UI
   ========================================================= */

function showMessage(
  message,
  type = ""
) {

  messageElement.textContent =
    message;


  messageElement.className =
    `message ${type}`.trim();
}


function clearMessage() {

  messageElement.textContent =
    "";


  messageElement.className =
    "message";
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */


/* ---------------------------------------------------------
   View buttons
   --------------------------------------------------------- */

document
  .querySelectorAll(
    ".view-button"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          openCookieViewer(
            button.dataset.service
          );

        }
      );

    }
  );


/* ---------------------------------------------------------
   Download buttons
   --------------------------------------------------------- */

document
  .querySelectorAll(
    ".download-button"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          downloadCookieFile(
            button.dataset.service
          );

        }
      );

    }
  );


/* ---------------------------------------------------------
   Service checkboxes
   --------------------------------------------------------- */

serviceCheckboxes.forEach(
  checkbox => {

    checkbox.addEventListener(
      "change",
      () => {

        handleServiceSelectionChange(
          checkbox
        );

      }
    );

  }
);


/* ---------------------------------------------------------
   Select all
   --------------------------------------------------------- */

selectAllButton.addEventListener(
  "click",
  selectAllServices
);


/* ---------------------------------------------------------
   Clear all
   --------------------------------------------------------- */

clearAllButton.addEventListener(
  "click",
  clearAllServices
);


/* ---------------------------------------------------------
   Profile
   --------------------------------------------------------- */

syncProfileInput.addEventListener(
  "change",
  async () => {

    await saveProfile(
      true
    );

  }
);


/*
 * Save when the user leaves the profile
 * field as well, which makes editing
 * feel more natural.
 */

syncProfileInput.addEventListener(
  "blur",
  async () => {

    const normalized =
      normalizeProfile(
        syncProfileInput.value
      );


    if (
      normalized !==
      currentProfile
    ) {

      await saveProfile(
        false
      );

    }

  }
);


/* ---------------------------------------------------------
   Local refresh
   --------------------------------------------------------- */

syncButton.addEventListener(
  "click",
  syncLocally
);


/* ---------------------------------------------------------
   Cloud sync selected
   --------------------------------------------------------- */

cloudSyncButton.addEventListener(
  "click",
  syncSelectedToCloudflare
);


/* ---------------------------------------------------------
   Cloud sync all
   --------------------------------------------------------- */

cloudSyncAllButton.addEventListener(
  "click",
  syncAllToCloudflare
);


/* ---------------------------------------------------------
   Save configuration
   --------------------------------------------------------- */

saveConfigButton.addEventListener(
  "click",
  saveCloudConfig
);


/* ---------------------------------------------------------
   Automatic sync
   --------------------------------------------------------- */

automaticSync.addEventListener(
  "change",
  updateAutomaticSync
);


/* ---------------------------------------------------------
   Close viewer
   --------------------------------------------------------- */

closeViewerButton.addEventListener(
  "click",
  closeCookieViewer
);


/* ---------------------------------------------------------
   Copy
   --------------------------------------------------------- */

copyButton.addEventListener(
  "click",
  copyCookieFile
);


/* ---------------------------------------------------------
   Viewer download
   --------------------------------------------------------- */

viewerDownloadButton.addEventListener(
  "click",
  () => {

    if (
      !currentService
    ) {

      showMessage(
        "No cookie service selected.",
        "error"
      );

      return;
    }


    downloadCookieFile(
      currentService
    );

  }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    await loadStatus();

    await loadCloudConfig();


    try {

      await loadNetscapeFiles();

    } catch (
      error
    ) {

      console.error(
        "[Cookie Sync] Failed to preload Netscape files:",
        error
      );

    }


    updateSelectedCount();

  }
);
