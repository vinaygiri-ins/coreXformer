(function attachStudioAuthHelpers() {
  const SESSION_STORAGE_KEY = "corexformer-studio-auth";
  const LAST_ACTIVITY_KEY = "corexformer-studio-last-activity";
  const FLASH_NOTICE_KEY = "corexformer-studio-auth-notice";
  const PENDING_HANDOFF_KEY = "corexformer-studio-pending-handoff";
  const MAX_IDLE_MS = 30 * 60 * 1000;
  const MAX_HANDOFF_MS = 20 * 1000;

  const memoryStore = new Map();

  function getSessionStorage() {
    try {
      if (window.sessionStorage) {
        return window.sessionStorage;
      }
    } catch (_error) {
      // Fall back to in-memory storage if sessionStorage is blocked.
    }

    return {
      getItem(key) {
        return memoryStore.has(key) ? memoryStore.get(key) : null;
      },
      setItem(key, value) {
        memoryStore.set(key, String(value));
      },
      removeItem(key) {
        memoryStore.delete(key);
      }
    };
  }

  const backingStore = getSessionStorage();

  const storageAdapter = {
    getItem(key) {
      return backingStore.getItem(key);
    },
    setItem(key, value) {
      backingStore.setItem(key, value);
    },
    removeItem(key) {
      backingStore.removeItem(key);
    }
  };

  function readLastActivity() {
    const raw = storageAdapter.getItem(LAST_ACTIVITY_KEY);
    const value = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(value) ? value : 0;
  }

  function markActivity() {
    storageAdapter.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }

  function clearActivity() {
    storageAdapter.removeItem(LAST_ACTIVITY_KEY);
  }

  function setNotice(message) {
    storageAdapter.setItem(FLASH_NOTICE_KEY, message);
  }

  function consumeNotice() {
    const message = storageAdapter.getItem(FLASH_NOTICE_KEY);

    if (message) {
      storageAdapter.removeItem(FLASH_NOTICE_KEY);
    }

    return message || "";
  }

  function getPendingWorkspaceHandoff(workspace = "") {
    const raw = storageAdapter.getItem(PENDING_HANDOFF_KEY);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      const normalizedWorkspace = String(parsed?.workspace || "").trim().toLowerCase();
      const expiresAt = Number(parsed?.expiresAt || 0);
      const url = String(parsed?.url || "").trim();

      if (!normalizedWorkspace || !url || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
        storageAdapter.removeItem(PENDING_HANDOFF_KEY);
        return null;
      }

      if (workspace && normalizedWorkspace !== String(workspace).trim().toLowerCase()) {
        return null;
      }

      return {
        workspace: normalizedWorkspace,
        url,
        createdAt: Number(parsed?.createdAt || 0),
        expiresAt
      };
    } catch (_error) {
      storageAdapter.removeItem(PENDING_HANDOFF_KEY);
      return null;
    }
  }

  function setPendingWorkspaceHandoff(payload = {}) {
    const workspace = String(payload?.workspace || "").trim().toLowerCase();
    const url = String(payload?.url || "").trim();

    if (!workspace || !url) {
      storageAdapter.removeItem(PENDING_HANDOFF_KEY);
      return null;
    }

    const ttlMs = Number(payload?.ttlMs || 0);
    const now = Date.now();
    const handoff = {
      workspace,
      url,
      createdAt: now,
      expiresAt: now + (Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : MAX_HANDOFF_MS)
    };

    storageAdapter.setItem(PENDING_HANDOFF_KEY, JSON.stringify(handoff));
    return handoff;
  }

  function clearPendingWorkspaceHandoff(workspace = "") {
    const pending = getPendingWorkspaceHandoff();

    if (!pending) {
      storageAdapter.removeItem(PENDING_HANDOFF_KEY);
      return;
    }

    if (workspace && pending.workspace !== String(workspace).trim().toLowerCase()) {
      return;
    }

    storageAdapter.removeItem(PENDING_HANDOFF_KEY);
  }

  function isSessionExpired() {
    const lastActivity = readLastActivity();

    if (!lastActivity) {
      return false;
    }

    return Date.now() - lastActivity > MAX_IDLE_MS;
  }

  let sharedClient = null;
  let activityMonitorBound = false;
  let monitorTimerId = null;
  let signOutInFlight = false;

  async function signOutForExpiry(reason = "expired") {
    if (!sharedClient || signOutInFlight) {
      return;
    }

    signOutInFlight = true;
    setNotice("Your studio session ended. Please enter your password again.");
    clearActivity();

    try {
      await sharedClient.auth.signOut({ scope: "local" });
    } catch (_error) {
      // Even if Supabase sign-out fails, we still clear local session state.
      storageAdapter.removeItem(SESSION_STORAGE_KEY);
    } finally {
      signOutInFlight = false;
      window.dispatchEvent(
        new CustomEvent("corexformer:studio-session-expired", {
          detail: { reason }
        })
      );
    }
  }

  function startActivityMonitor() {
    if (activityMonitorBound) {
      return;
    }

    activityMonitorBound = true;

    const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"];

    const handleActivity = () => {
      markActivity();
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (isSessionExpired()) {
          void signOutForExpiry("idle");
          return;
        }

        markActivity();
      }
    });

    monitorTimerId = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      if (isSessionExpired()) {
        void signOutForExpiry("idle");
      }
    }, 60 * 1000);
  }

  function createStudioSupabaseClient(config) {
    if (!window.supabase?.createClient || !config?.supabaseUrl || !config?.supabaseAnonKey) {
      return null;
    }

    if (!sharedClient) {
      sharedClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          storage: storageAdapter,
          storageKey: SESSION_STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }

    startActivityMonitor();
    return sharedClient;
  }

  async function prepareStudioSession(client) {
    if (!client) {
      return;
    }

    if (isSessionExpired()) {
      await signOutForExpiry("idle");
      return;
    }

    markActivity();
  }

  function clearStudioSessionArtifacts() {
    clearActivity();
    storageAdapter.removeItem(FLASH_NOTICE_KEY);
    storageAdapter.removeItem(PENDING_HANDOFF_KEY);
  }

  window.COREXFORMER_STUDIO_AUTH = {
    createClient: createStudioSupabaseClient,
    prepareSession: prepareStudioSession,
    consumeNotice,
    setNotice,
    clearSessionArtifacts: clearStudioSessionArtifacts,
    getPendingWorkspaceHandoff,
    setPendingWorkspaceHandoff,
    clearPendingWorkspaceHandoff,
    markActivity,
    idleMinutes: Math.round(MAX_IDLE_MS / 60000)
  };
})();
