// JoqniX Cookie Sync
// Background Service Worker
// Version: 0.5.0


/* =========================================================
   CONFIGURATION
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

const DEFAULT_SELECTED_DOMAINS = [
  ...SUPPORTED_DOMAINS
];

const DEFAULT_CONFIG = {
  workerUrl:
    "https://api.joqnix.space/cookies",

  syncAutomatically:
    false,

  syncProfile:
    DEFAULT_PROFILE,

  selectedDomains:
    DEFAULT_SELECTED_DOMAINS
};


/*
 * Automatic sync settings.
 *
 * The cookie-change listener uses a short debounce.
 * The alarm provides a periodic backup sync in case
 * cookies changed while the service worker was inactive.
 */

const AUTOMATIC_SYNC_ALARM =
  "joqnix-cookie-sync";

const AUTOMATIC_SYNC_PERIOD_MINUTES =
  30;

const COOKIE_CHANGE_DEBOUNCE_MS =
  5000;


let syncTimer = null;


/* =========================================================
   DOMAIN HELPERS
   ========================================================= */

function normalizeDomain(
  domain
) {
  if (
    typeof domain !==
    "string"
  ) {
    return "";
  }

  return domain
    .replace(
      /^\./,
      ""
    )
    .toLowerCase();
}


function isSupportedCookie(
  cookie
) {
  if (
    !cookie ||
    typeof cookie.domain !==
      "string"
  ) {
    return false;
  }

  const domain =
    normalizeDomain(
      cookie.domain
    );

  return SUPPORTED_DOMAINS.some(
    supportedDomain =>
      domain ===
        supportedDomain ||
      domain.endsWith(
        `.${supportedDomain}`
      )
  );
}


function getCookieService(
  cookie
) {
  if (
    !cookie ||
    typeof cookie.domain !==
      "string"
  ) {
    return null;
  }

  const domain =
    normalizeDomain(
      cookie.domain
    );

  return (
    SUPPORTED_DOMAINS.find(
      supportedDomain =>
        domain ===
          supportedDomain ||
        domain.endsWith(
          `.${supportedDomain}`
        )
    ) || null
  );
}


/* =========================================================
   PROFILE HELPERS
   ========================================================= */

function normalizeProfile(
  profile
) {
  if (
    typeof profile !==
    "string"
  ) {
    return "";
  }

  return profile
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
}


function getProfile(
  profile
) {
  const normalized =
    normalizeProfile(
      profile
    );

  return (
    normalized ||
    DEFAULT_PROFILE
  );
}


function normalizeSelectedDomains(
  selectedDomains
) {
  if (
    !Array.isArray(
      selectedDomains
    )
  ) {
    return [
      ...DEFAULT_SELECTED_DOMAINS
    ];
  }

  return [
    ...new Set(
      selectedDomains
        .map(
          domain =>
            normalizeDomain(
              domain
            )
        )
        .filter(
          domain =>
            SUPPORTED_DOMAINS.includes(
              domain
            )
        )
    )
  ];
}


function getSelectedDomains(
  selectedDomains
) {
  const normalized =
    normalizeSelectedDomains(
      selectedDomains
    );

  /*
   * Never allow an empty selection to
   * accidentally perform a cloud sync.
   */

  return normalized;
}


/* =========================================================
   COOKIE COLLECTION
   ========================================================= */

/**
 * Get the COMPLETE browser cookie jar accessible
 * to the extension.
 *
 * There is intentionally NO cookie-name allowlist.
 *
 * We collect every accessible cookie belonging to:
 *
 * - youtube.com
 * - google.com
 * - twitch.tv
 * - kick.com
 * - meldstudio.co
 * - casterlabs.co
 *
 * This includes supported subdomains.
 */

async function getSupportedCookies() {
  try {
    const cookies =
      await chrome.cookies.getAll({});

    return cookies.filter(
      isSupportedCookie
    );

  } catch (error) {

    console.error(
      "[Cookie Sync] Failed to read browser cookies:",
      error
    );

    throw error;
  }
}


/* =========================================================
   STRUCTURED COOKIE SERIALIZATION
   ========================================================= */

function serializeCookie(
  cookie
) {
  return {
    name:
      cookie.name,

    value:
      cookie.value,

    domain:
      cookie.domain,

    path:
      cookie.path,

    secure:
      cookie.secure,

    httpOnly:
      cookie.httpOnly,

    sameSite:
      cookie.sameSite,

    expirationDate:
      cookie.expirationDate ??
      null,

    session:
      cookie.session,

    hostOnly:
      !cookie.domain.startsWith(
        "."
      )
  };
}


/* =========================================================
   NETSCAPE EXPORT
   ========================================================= */

function cookieToNetscape(
  cookie
) {
  let domain =
    cookie.domain;

  /*
   * Netscape cookie files represent
   * HttpOnly cookies using:
   *
   * #HttpOnly_<domain>
   */

  if (
    cookie.httpOnly
  ) {
    domain =
      `#HttpOnly_${domain}`;
  }

  /*
   * Chrome normally exposes a leading dot
   * for domain cookies.
   */

  const includeSubdomains =
    cookie.domain.startsWith(".")
      ? "TRUE"
      : "FALSE";

  const path =
    cookie.path || "/";

  const secure =
    cookie.secure
      ? "TRUE"
      : "FALSE";

  /*
   * Session cookies use expiration 0.
   */

  const expiration =
    cookie.session
      ? "0"
      : Math.floor(
          cookie.expirationDate ||
          0
        );

  const name =
    cookie.name || "";

  const value =
    cookie.value || "";

  return [
    domain,
    includeSubdomains,
    path,
    secure,
    expiration,
    name,
    value
  ].join("\t");
}


function cookiesToNetscape(
  cookies,
  domainName
) {
  const header = [
    "# Netscape HTTP Cookie File",
    "# This file was generated by JoqniX Cookie Sync",
    `# Domain: ${domainName}`,
    ""
  ].join("\n");

  /*
   * Stable ordering makes exports
   * easier to compare.
   */

  const sortedCookies =
    [...cookies].sort(
      (a, b) => {

        const domainCompare =
          a.domain.localeCompare(
            b.domain
          );

        if (
          domainCompare !== 0
        ) {
          return domainCompare;
        }

        const pathCompare =
          a.path.localeCompare(
            b.path
          );

        if (
          pathCompare !== 0
        ) {
          return pathCompare;
        }

        return a.name.localeCompare(
          b.name
        );
      }
    );

  const lines =
    sortedCookies.map(
      cookieToNetscape
    );

  return (
    `${header}\n` +
    `${lines.join("\n")}\n`
  );
}


function generateNetscapeFiles(
  cookies
) {
  const files = {};

  for (
    const domain
    of SUPPORTED_DOMAINS
  ) {

    const domainCookies =
      cookies.filter(
        cookie =>
          getCookieService(
            cookie
          ) === domain
      );

    files[domain] =
      cookiesToNetscape(
        domainCookies,
        domain
      );
  }

  return files;
}


/* =========================================================
   COOKIE COUNTS
   ========================================================= */

function generateCookieCounts(
  cookies
) {
  const counts = {};

  for (
    const domain
    of SUPPORTED_DOMAINS
  ) {

    counts[domain] =
      cookies.filter(
        cookie =>
          getCookieService(
            cookie
          ) === domain
      ).length;
  }

  return counts;
}


/* =========================================================
   SNAPSHOT CREATION
   ========================================================= */

async function buildSnapshot() {
  const cookies =
    await getSupportedCookies();

  /*
   * Keep the complete browser cookie
   * representation.
   */

  const serializedCookies =
    cookies.map(
      serializeCookie
    );

  /*
   * Generate Netscape representations
   * separately for compatibility.
   */

  const netscapeFiles =
    generateNetscapeFiles(
      cookies
    );

  const cookieCounts =
    generateCookieCounts(
      cookies
    );

  return {
    cookies:
      serializedCookies,

    netscapeFiles,

    cookieCounts,

    totalCookies:
      serializedCookies.length,

    timestamp:
      Date.now()
  };
}


/* =========================================================
   FILTER SNAPSHOT FOR SELECTED DOMAINS
   ========================================================= */

function filterSnapshotForDomains(
  snapshot,
  selectedDomains
) {
  const selectedSet =
    new Set(
      selectedDomains
    );

  const cookies =
    snapshot.cookies.filter(
      cookie =>
        selectedSet.has(
          getCookieService(
            cookie
          )
        )
    );

  const netscapeFiles = {};

  const cookieCounts = {};

  for (
    const domain
    of selectedDomains
  ) {
    netscapeFiles[domain] =
      snapshot.netscapeFiles?.[
        domain
      ] || "";

    cookieCounts[domain] =
      snapshot.cookieCounts?.[
        domain
      ] || 0;
  }

  return {
    cookies,

    netscapeFiles,

    cookieCounts,

    totalCookies:
      cookies.length,

    timestamp:
      snapshot.timestamp,

    selectedDomains
  };
}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

async function saveCookieSnapshot() {
  const snapshot =
    await buildSnapshot();

  await chrome.storage.local.set({

    cookieSnapshot:
      snapshot.cookies,

    netscapeFiles:
      snapshot.netscapeFiles,

    cookieCounts:
      snapshot.cookieCounts,

    totalCookies:
      snapshot.totalCookies,

    lastLocalSync:
      snapshot.timestamp
  });

  console.log(
    `[Cookie Sync] Local snapshot updated: ${snapshot.totalCookies} cookies`
  );

  return snapshot;
}


/* =========================================================
   CLOUDFLARE CONFIGURATION
   ========================================================= */

async function getConfig() {
  const data =
    await chrome.storage.local.get([
      "workerUrl",
      "workerToken",
      "syncAutomatically",
      "syncProfile",
      "selectedDomains"
    ]);

  return {

    workerUrl:
      data.workerUrl ||
      DEFAULT_CONFIG.workerUrl,

    workerToken:
      data.workerToken ||
      "",

    syncAutomatically:
      data.syncAutomatically ??
      DEFAULT_CONFIG.syncAutomatically,

    syncProfile:
      getProfile(
        data.syncProfile ||
        DEFAULT_CONFIG.syncProfile
      ),

    selectedDomains:
      getSelectedDomains(
        data.selectedDomains ??
        DEFAULT_CONFIG.selectedDomains
      )
  };
}


/* =========================================================
   CLOUDFLARE HEALTH CHECK
   ========================================================= */

async function checkCloudflareHealth() {
  const config =
    await getConfig();

  if (
    !config.workerUrl
  ) {
    throw new Error(
      "Cloudflare Worker URL is not configured."
    );
  }

  if (
    !config.workerToken
  ) {
    throw new Error(
      "Cloudflare sync token is not configured."
    );
  }

  /*
   * workerUrl is expected to be:
   *
   * https://api.joqnix.space/cookies
   *
   * Therefore this becomes:
   *
   * https://api.joqnix.space/cookies/health
   */

  const healthUrl =
    config.workerUrl
      .replace(
        /\/+$/,
        ""
      ) +
      "/health";

  const response =
    await fetch(
      healthUrl,
      {
        method:
          "GET",

        headers: {
          "Authorization":
            `Bearer ${config.workerToken}`
        }
      }
    );

  if (
    !response.ok
  ) {
    const text =
      await response.text();

    throw new Error(
      `Cloudflare health check failed (${response.status}): ${text}`
    );
  }

  const result =
    await response.json();

  return result;
}


/* =========================================================
   CLOUDFLARE SYNC
   ========================================================= */

async function syncToCloudflare(
  options = {}
) {
  const config =
    await getConfig();

  if (
    !config.workerUrl
  ) {
    throw new Error(
      "Cloudflare Worker URL is not configured."
    );
  }

  if (
    !config.workerToken
  ) {
    throw new Error(
      "Cloudflare sync token is not configured."
    );
  }

  /*
   * Always build a fresh complete snapshot
   * immediately before uploading.
   */

  const snapshot =
    await buildSnapshot();


  /*
   * Sync All overrides the configured
   * service selection.
   */

  const syncAll =
    Boolean(
      options.syncAll
    );

  const selectedDomains =
    syncAll
      ? [
          ...SUPPORTED_DOMAINS
        ]
      : getSelectedDomains(
          config.selectedDomains
        );


  if (
    selectedDomains.length ===
    0
  ) {
    throw new Error(
      "No cookie services are selected for synchronization."
    );
  }


  /*
   * Only send the selected services
   * to Cloudflare.
   */

  const selectedSnapshot =
    filterSnapshotForDomains(
      snapshot,
      selectedDomains
    );


  const payload = {

    version:
      2,

    source:
      "joqnix-cookie-sync",

    timestamp:
      snapshot.timestamp,

    profile:
      config.syncProfile,

    selectedDomains,

    totalCookies:
      selectedSnapshot.totalCookies,

    cookieCounts:
      selectedSnapshot.cookieCounts,

    /*
     * COMPLETE structured browser cookies
     * for the selected services.
     */

    cookies:
      selectedSnapshot.cookies,

    /*
     * COMPLETE Netscape representations
     * for the selected services.
     */

    netscapeFiles:
      selectedSnapshot.netscapeFiles
  };


  const response =
    await fetch(
      config.workerUrl,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${config.workerToken}`
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );


  if (
    !response.ok
  ) {
    const text =
      await response.text();

    throw new Error(
      `Cloudflare sync failed (${response.status}): ${text}`
    );
  }


  const result =
    await response.json();


  await chrome.storage.local.set({

    lastCloudSync:
      snapshot.timestamp,

    lastCloudSyncResult:
      result,

    lastCloudSyncProfile:
      config.syncProfile,

    lastCloudSyncSelectedDomains:
      selectedDomains
  });


  console.log(
    `[Cookie Sync] Cloudflare sync completed: profile=${config.syncProfile}, domains=${selectedDomains.join(", ")}`
  );


  return {

    snapshot,

    selectedSnapshot,

    selectedDomains,

    profile:
      config.syncProfile,

    result
  };
}


/* =========================================================
   AUTOMATIC SYNC
   ========================================================= */

/**
 * Configure the periodic Chrome alarm.
 *
 * The alarm survives service-worker suspension and
 * browser restarts better than setTimeout().
 */

async function configureAutomaticSyncAlarm() {
  const config =
    await getConfig();

  await chrome.alarms.clear(
    AUTOMATIC_SYNC_ALARM
  );


  if (
    !config.syncAutomatically
  ) {
    return;
  }


  chrome.alarms.create(
    AUTOMATIC_SYNC_ALARM,
    {
      periodInMinutes:
        AUTOMATIC_SYNC_PERIOD_MINUTES
    }
  );


  console.log(
    `[Cookie Sync] Automatic sync alarm enabled (${AUTOMATIC_SYNC_PERIOD_MINUTES} minutes).`
  );
}


/**
 * Debounce cookie-triggered cloud synchronization.
 *
 * Cookie changes can happen in bursts.
 * We wait 5 seconds after the latest change.
 */

function scheduleAutomaticCloudSync() {
  if (
    syncTimer
  ) {
    clearTimeout(
      syncTimer
    );
  }


  syncTimer =
    setTimeout(
      async () => {

        syncTimer = null;

        try {

          const config =
            await getConfig();


          if (
            !config.syncAutomatically
          ) {
            return;
          }


          await syncToCloudflare();

        } catch (error) {

          console.error(
            "[Cookie Sync] Automatic cloud sync failed:",
            error
          );
        }

      },
      COOKIE_CHANGE_DEBOUNCE_MS
    );
}


/* =========================================================
   ALARM HANDLER
   ========================================================= */

chrome.alarms.onAlarm.addListener(
  async alarm => {

    if (
      alarm.name !==
      AUTOMATIC_SYNC_ALARM
    ) {
      return;
    }


    try {

      const config =
        await getConfig();


      if (
        !config.syncAutomatically
      ) {

        await chrome.alarms.clear(
          AUTOMATIC_SYNC_ALARM
        );

        return;
      }


      await syncToCloudflare();


    } catch (error) {

      console.error(
        "[Cookie Sync] Scheduled cloud sync failed:",
        error
      );
    }
  }
);


/* =========================================================
   COOKIE CHANGE HANDLER
   ========================================================= */

chrome.cookies.onChanged.addListener(
  async changeInfo => {

    const cookie =
      changeInfo.cookie;


    if (
      !isSupportedCookie(
        cookie
      )
    ) {
      return;
    }


    /*
     * Never log cookie values.
     */

    console.log(
      "[Cookie Sync] Supported cookie changed:",
      {
        cause:
          changeInfo.cause,

        removed:
          changeInfo.removed,

        name:
          cookie.name,

        domain:
          cookie.domain,

        path:
          cookie.path
      }
    );


    try {

      /*
       * Always update local state.
       */

      await saveCookieSnapshot();


      /*
       * Cloud sync only happens when
       * automatic sync is enabled.
       */

      const config =
        await getConfig();


      if (
        config.syncAutomatically
      ) {
        scheduleAutomaticCloudSync();
      }


    } catch (error) {

      console.error(
        "[Cookie Sync] Cookie change processing failed:",
        error
      );
    }

  }
);


/* =========================================================
   MESSAGE API
   ========================================================= */

chrome.runtime.onMessage.addListener(
  (
    message,
    sender,
    sendResponse
  ) => {

    if (
      !message ||
      typeof message.type !==
        "string"
    ) {
      return;
    }


    /* =====================================================
       GET COOKIES
       ===================================================== */

    if (
      message.type ===
      "GET_COOKIES"
    ) {

      getSupportedCookies()

        .then(
          cookies => {

            sendResponse({

              success:
                true,

              cookies:
                cookies.map(
                  serializeCookie
                )

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       SYNC LOCAL
       ===================================================== */

    if (
      message.type ===
      "SYNC_LOCAL"
    ) {

      saveCookieSnapshot()

        .then(
          snapshot => {

            sendResponse({

              success:
                true,

              count:
                snapshot.totalCookies,

              cookieCounts:
                snapshot.cookieCounts,

              timestamp:
                snapshot.timestamp

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       GET STATUS
       ===================================================== */

    if (
      message.type ===
      "GET_STATUS"
    ) {

      chrome.storage.local
        .get([
          "cookieSnapshot",
          "cookieCounts",
          "totalCookies",
          "lastLocalSync",
          "lastCloudSync",
          "lastCloudSyncResult",
          "lastCloudSyncProfile",
          "lastCloudSyncSelectedDomains",
          "syncAutomatically",
          "syncProfile",
          "selectedDomains"
        ])

        .then(
          data => {

            sendResponse({

              success:
                true,

              cookieCount:
                data.totalCookies ??
                data.cookieSnapshot?.length ??
                0,

              cookieCounts:
                data.cookieCounts ??
                {},

              lastLocalSync:
                data.lastLocalSync ??
                null,

              lastCloudSync:
                data.lastCloudSync ??
                null,

              lastCloudSyncResult:
                data.lastCloudSyncResult ??
                null,

              lastCloudSyncProfile:
                data.lastCloudSyncProfile ??
                data.syncProfile ??
                DEFAULT_PROFILE,

              lastCloudSyncSelectedDomains:
                data.lastCloudSyncSelectedDomains ??
                data.selectedDomains ??
                DEFAULT_SELECTED_DOMAINS,

              syncAutomatically:
                data.syncAutomatically ??
                false,

              syncProfile:
                getProfile(
                  data.syncProfile ||
                  DEFAULT_PROFILE
                ),

              selectedDomains:
                getSelectedDomains(
                  data.selectedDomains ??
                  DEFAULT_SELECTED_DOMAINS
                )

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       GET NETSCAPE
       ===================================================== */

    if (
      message.type ===
      "GET_NETSCAPE"
    ) {

      chrome.storage.local
        .get([
          "netscapeFiles",
          "lastLocalSync"
        ])

        .then(
          async data => {

            if (
              !data.netscapeFiles
            ) {

              const snapshot =
                await saveCookieSnapshot();


              sendResponse({

                success:
                  true,

                files:
                  snapshot.netscapeFiles,

                timestamp:
                  snapshot.timestamp

              });


              return;
            }


            sendResponse({

              success:
                true,

              files:
                data.netscapeFiles,

              timestamp:
                data.lastLocalSync ??
                null

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       EXPORT NETSCAPE
       ===================================================== */

    if (
      message.type ===
      "EXPORT_NETSCAPE"
    ) {

      getSupportedCookies()

        .then(
          cookies => {

            const files =
              generateNetscapeFiles(
                cookies
              );


            sendResponse({

              success:
                true,

              files,

              cookieCount:
                cookies.length

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       SYNC TO CLOUDFLARE
       ===================================================== */

    if (
      message.type ===
      "SYNC_CLOUD"
    ) {

      syncToCloudflare({
        syncAll:
          Boolean(
            message.syncAll
          )
      })

        .then(
          result => {

            sendResponse({

              success:
                true,

              count:
                result.selectedSnapshot
                  .totalCookies,

              cookieCounts:
                result.selectedSnapshot
                  .cookieCounts,

              selectedDomains:
                result.selectedDomains,

              profile:
                result.profile,

              timestamp:
                result.snapshot
                  .timestamp,

              result:
                result.result

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       SYNC SELECTED
       ===================================================== */

    if (
      message.type ===
      "SYNC_SELECTED"
    ) {

      syncToCloudflare({
        syncAll:
          false
      })

        .then(
          result => {

            sendResponse({

              success:
                true,

              count:
                result.selectedSnapshot
                  .totalCookies,

              cookieCounts:
                result.selectedSnapshot
                  .cookieCounts,

              selectedDomains:
                result.selectedDomains,

              profile:
                result.profile,

              timestamp:
                result.snapshot
                  .timestamp,

              result:
                result.result

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       SYNC ALL
       ===================================================== */

    if (
      message.type ===
      "SYNC_ALL"
    ) {

      syncToCloudflare({
        syncAll:
          true
      })

        .then(
          result => {

            sendResponse({

              success:
                true,

              count:
                result.selectedSnapshot
                  .totalCookies,

              cookieCounts:
                result.selectedSnapshot
                  .cookieCounts,

              selectedDomains:
                result.selectedDomains,

              profile:
                result.profile,

              timestamp:
                result.snapshot
                  .timestamp,

              result:
                result.result

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       CHECK CLOUDFLARE HEALTH
       ===================================================== */

    if (
      message.type ===
      "CHECK_CLOUDFLARE_HEALTH"
    ) {

      checkCloudflareHealth()

        .then(
          result => {

            sendResponse({

              success:
                true,

              result

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       GET CONFIG
       ===================================================== */

    if (
      message.type ===
      "GET_CONFIG"
    ) {

      getConfig()

        .then(
          config => {

            sendResponse({

              success:
                true,

              workerUrl:
                config.workerUrl,

              hasToken:
                Boolean(
                  config.workerToken
                ),

              syncAutomatically:
                config.syncAutomatically,

              syncProfile:
                config.syncProfile,

              selectedDomains:
                config.selectedDomains

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       SAVE CONFIG
       ===================================================== */

    if (
      message.type ===
      "SAVE_CONFIG"
    ) {

      chrome.storage.local
        .get([
          "workerUrl",
          "workerToken",
          "syncAutomatically",
          "syncProfile",
          "selectedDomains"
        ])

        .then(
          async existing => {

            /*
             * Preserve existing values when
             * the popup intentionally leaves
             * a field unchanged.
             */

            const workerUrl =
              typeof message.workerUrl ===
                "string" &&
              message.workerUrl.trim()
                ? message.workerUrl.trim()
                : (
                    existing.workerUrl ||
                    DEFAULT_CONFIG.workerUrl
                  );


            const workerToken =
              typeof message.workerToken ===
                "string" &&
              message.workerToken.trim()
                ? message.workerToken.trim()
                : (
                    existing.workerToken ||
                    ""
                  );


            const syncAutomatically =
              typeof message.syncAutomatically ===
                "boolean"
                ? message.syncAutomatically
                : (
                    existing.syncAutomatically ??
                    DEFAULT_CONFIG.syncAutomatically
                  );


            const syncProfile =
              getProfile(
                typeof message.syncProfile ===
                  "string"
                  ? message.syncProfile
                  : (
                      existing.syncProfile ||
                      DEFAULT_CONFIG.syncProfile
                    )
              );


            const selectedDomains =
              message.selectedDomains !==
                undefined
                ? getSelectedDomains(
                    message.selectedDomains
                  )
                : getSelectedDomains(
                    existing.selectedDomains ??
                    DEFAULT_CONFIG.selectedDomains
                  );


            await chrome.storage.local.set({

              workerUrl,

              workerToken,

              syncAutomatically,

              syncProfile,

              selectedDomains

            });


            /*
             * Keep the Chrome alarm synchronized
             * with the newly saved setting.
             */

            await configureAutomaticSyncAlarm();


            sendResponse({

              success:
                true,

              workerUrl,

              hasToken:
                Boolean(
                  workerToken
                ),

              syncAutomatically,

              syncProfile,

              selectedDomains

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       SET AUTOMATIC SYNC
       ===================================================== */

    if (
      message.type ===
      "SET_AUTOMATIC_SYNC"
    ) {

      const enabled =
        Boolean(
          message.enabled
        );


      chrome.storage.local
        .set({
          syncAutomatically:
            enabled
        })

        .then(
          async () => {

            await configureAutomaticSyncAlarm();


            sendResponse({

              success:
                true,

              syncAutomatically:
                enabled

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       SET SYNC PROFILE
       ===================================================== */

    if (
      message.type ===
      "SET_SYNC_PROFILE"
    ) {

      const syncProfile =
        getProfile(
          message.profile
        );


      chrome.storage.local
        .set({
          syncProfile
        })

        .then(
          () => {

            sendResponse({

              success:
                true,

              syncProfile

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       SET SELECTED DOMAINS
       ===================================================== */

    if (
      message.type ===
      "SET_SELECTED_DOMAINS"
    ) {

      const selectedDomains =
        getSelectedDomains(
          message.selectedDomains
        );


      if (
        selectedDomains.length ===
        0
      ) {

        sendResponse({

          success:
            false,

          error:
            "At least one cookie service must be selected."

        });

        return true;
      }


      chrome.storage.local
        .set({
          selectedDomains
        })

        .then(
          () => {

            sendResponse({

              success:
                true,

              selectedDomains

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       SELECT ALL DOMAINS
       ===================================================== */

    if (
      message.type ===
      "SELECT_ALL_DOMAINS"
    ) {

      const selectedDomains =
        [
          ...SUPPORTED_DOMAINS
        ];


      chrome.storage.local
        .set({
          selectedDomains
        })

        .then(
          () => {

            sendResponse({

              success:
                true,

              selectedDomains

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       CLEAR SELECTED DOMAINS
       ===================================================== */

    if (
      message.type ===
      "CLEAR_SELECTED_DOMAINS"
    ) {

      chrome.storage.local
        .set({
          selectedDomains:
            []
        })

        .then(
          () => {

            sendResponse({

              success:
                true,

              selectedDomains:
                []

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       DOWNLOAD NETSCAPE
       ===================================================== */

    if (
      message.type ===
      "DOWNLOAD_NETSCAPE"
    ) {

      const service =
        message.service;


      if (
        !SUPPORTED_DOMAINS.includes(
          service
        )
      ) {

        sendResponse({

          success:
            false,

          error:
            "Unsupported cookie service."

        });

        return true;
      }


      chrome.storage.local
        .get([
          "netscapeFiles"
        ])

        .then(
          async data => {

            let files =
              data.netscapeFiles;


            /*
             * Generate a fresh snapshot if
             * no local Netscape snapshot exists.
             */

            if (
              !files
            ) {

              const snapshot =
                await saveCookieSnapshot();


              files =
                snapshot.netscapeFiles;
            }


            const content =
              files?.[
                service
              ];


            if (
              !content
            ) {
              throw new Error(
                `No cookie file exists for ${service}.`
              );
            }


            /*
             * The popup creates the Blob URL
             * because URL.createObjectURL()
             * is not available inside the
             * MV3 service worker.
             */

            sendResponse({

              success:
                true,

              service,

              content,

              filename:
                `${service}.txt`

            });

          }
        )

        .catch(
          error => {

            sendResponse({

              success:
                false,

              error:
                error.message

            });

          }
        );


      return true;
    }


    /* =====================================================
       UNKNOWN MESSAGE
       ===================================================== */

    sendResponse({

      success:
        false,

      error:
        `Unknown message type: ${message.type}`

    });


    return true;
  }
);


/* =========================================================
   STARTUP
   ========================================================= */

chrome.runtime.onStartup.addListener(
  async () => {

    console.log(
      "[Cookie Sync] Extension startup."
    );


    try {

      await saveCookieSnapshot();

      await configureAutomaticSyncAlarm();


    } catch (error) {

      console.error(
        "[Cookie Sync] Startup initialization failed:",
        error
      );
    }

  }
);


/* =========================================================
   INSTALL / UPDATE
   ========================================================= */

chrome.runtime.onInstalled.addListener(
  async details => {

    console.log(
      `[Cookie Sync] Extension ${details.reason}`
    );


    try {

      /*
       * Initialize new configuration values
       * without overwriting existing settings.
       */

      const existing =
        await chrome.storage.local.get([
          "syncProfile",
          "selectedDomains"
        ]);


      const syncProfile =
        getProfile(
          existing.syncProfile ||
          DEFAULT_PROFILE
        );


      const selectedDomains =
        existing.selectedDomains !==
          undefined
          ? getSelectedDomains(
              existing.selectedDomains
            )
          : [
              ...DEFAULT_SELECTED_DOMAINS
            ];


      await chrome.storage.local.set({

        syncProfile,

        selectedDomains

      });


      await saveCookieSnapshot();

      await configureAutomaticSyncAlarm();


    } catch (error) {

      console.error(
        "[Cookie Sync] Installation initialization failed:",
        error
      );
    }

  }
);


/* =========================================================
   SERVICE WORKER LOADED
   ========================================================= */

console.log(
  "[Cookie Sync] Background service worker loaded."
);
