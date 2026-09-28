
// JoqniX Cookie Sync
// Background Service Worker
// Version: 0.1.0

const SUPPORTED_DOMAINS = [
  "youtube.com",
  "twitch.tv",
  "kick.com"
];

const COOKIE_ALLOWLIST = {
  youtube: [],
  twitch: [],
  kick: []
};

/**
 * Check whether a cookie belongs to one of our supported domains.
 */
function isSupportedCookie(cookie) {
  const domain = cookie.domain.replace(/^\./, "");

  return SUPPORTED_DOMAINS.some(
    supportedDomain =>
      domain === supportedDomain ||
      domain.endsWith(`.${supportedDomain}`)
  );
}

/**
 * Get all cookies currently stored for supported services.
 */
async function getSupportedCookies() {
  const allCookies = [];

  for (const domain of SUPPORTED_DOMAINS) {
    try {
      const cookies = await chrome.cookies.getAll({
        domain
      });

      allCookies.push(...cookies);
    } catch (error) {
      console.error(
        `[Cookie Sync] Failed to read cookies for ${domain}:`,
        error
      );
    }
  }

  return allCookies.filter(isSupportedCookie);
}

/**
 * Create a safe representation of a cookie.
 *
 * We deliberately keep the cookie structure simple so that we
 * can later decide exactly what should be sent to the Worker.
 */
function serializeCookie(cookie) {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    expirationDate: cookie.expirationDate ?? null,
    session: cookie.session
  };
}

/**
 * Save the current cookie snapshot locally.
 */
async function saveCookieSnapshot() {
  try {
    const cookies = await getSupportedCookies();

    const snapshot = cookies.map(serializeCookie);

    await chrome.storage.local.set({
      cookieSnapshot: snapshot,
      lastLocalSync: Date.now()
    });

    console.log(
      `[Cookie Sync] Local snapshot updated: ${snapshot.length} cookies`
    );

    return snapshot;
  } catch (error) {
    console.error(
      "[Cookie Sync] Failed to save cookie snapshot:",
      error
    );

    throw error;
  }
}

/**
 * Handle cookie changes.
 */
chrome.cookies.onChanged.addListener(async changeInfo => {
  const cookie = changeInfo.cookie;

  if (!isSupportedCookie(cookie)) {
    return;
  }

  console.log("[Cookie Sync] Cookie changed:", {
    cause: changeInfo.cause,
    removed: changeInfo.removed,
    name: cookie.name,
    domain: cookie.domain
  });

  // Rebuild the local snapshot after the change.
  await saveCookieSnapshot();
});

/**
 * Messages from popup.js or other extension pages.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return;
  }

  if (message.type === "GET_COOKIES") {
    getSupportedCookies()
      .then(cookies => {
        sendResponse({
          success: true,
          cookies: cookies.map(serializeCookie)
        });
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: error.message
        });
      });

    return true;
  }

  if (message.type === "SYNC_LOCAL") {
    saveCookieSnapshot()
      .then(snapshot => {
        sendResponse({
          success: true,
          count: snapshot.length,
          timestamp: Date.now()
        });
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: error.message
        });
      });

    return true;
  }

  if (message.type === "GET_STATUS") {
    chrome.storage.local
      .get([
        "cookieSnapshot",
        "lastLocalSync"
      ])
      .then(data => {
        sendResponse({
          success: true,
          cookieCount: data.cookieSnapshot?.length ?? 0,
          lastLocalSync: data.lastLocalSync ?? null
        });
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: error.message
        });
      });

    return true;
  }
});

/**
 * Initialize the local snapshot when the extension starts.
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log("[Cookie Sync] Extension startup");

  await saveCookieSnapshot();
});

/**
 * Also initialize when the extension is installed or updated.
 */
chrome.runtime.onInstalled.addListener(async details => {
  console.log(
    `[Cookie Sync] Extension ${details.reason}`
  );

  await saveCookieSnapshot();
});

console.log("[Cookie Sync] Background service worker loaded.");
