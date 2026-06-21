const ADMIN_ALLOWED_ROLES = ["owner", "editor"];
const FACILITATOR_SIDE_ROLES = ["candidate", "facilitator", "facilitator_lead"];
const OWNER_ONLY_MODULES = new Set(["lead-map"]);
const ADMIN_MODULE_VIEWS = {
  facilitator: new Set(["facilitator-requests", "facilitator-links"]),
  insights: new Set(["insights-overview", "insights-pages", "insights-sources", "insights-journeys", "insights-forms"]),
  feedback: new Set(["feedback-sessions"]),
  "lead-map": new Set(["lead-map-scanner", "lead-map-saved"])
};
const ADMIN_DEFAULT_VIEWS = {
  facilitator: "facilitator-requests",
  insights: "insights-overview",
  feedback: "feedback-sessions",
  "lead-map": "lead-map-scanner"
};
const ADMIN_HANDOFF_WAIT_MS = 12 * 1000;
const initialAdminRoute = getRequestedAdminRoute();

const adminDom = {
  signOutButton: document.getElementById("signOutButton"),
  goBackButton: document.getElementById("adminGoBackButton"),
  workspaceContent: document.getElementById("workspaceContent"),
  authMessage: document.getElementById("authMessage"),
  authState: document.getElementById("authState"),
  adminIdentity: document.getElementById("adminIdentity"),
  adminIdentityText: document.getElementById("adminIdentityText"),
  moduleTabs: Array.from(document.querySelectorAll("[data-admin-module]")),
  modulePanels: Array.from(document.querySelectorAll("[data-admin-module-panel]")),
  viewTabs: Array.from(document.querySelectorAll("[data-admin-view]")),
  viewPanels: Array.from(document.querySelectorAll("[data-admin-view-panel]")),
  ownerOnlyModules: Array.from(document.querySelectorAll("[data-owner-only='true']"))
};

const adminState = {
  supabase: null,
  session: null,
  profile: null,
  activeModule: initialAdminRoute.module,
  activeView: initialAdminRoute.view,
  authBooting: true
};

document.addEventListener("DOMContentLoaded", () => {
  void initAdminWorkspace();
});

async function initAdminWorkspace() {
  if (!window.COREXFORMER_STUDIO_CONFIG || !window.supabase?.createClient) {
    return;
  }

  adminState.supabase = window.COREXFORMER_STUDIO_AUTH?.createClient(window.COREXFORMER_STUDIO_CONFIG)
    || window.supabase.createClient(
      window.COREXFORMER_STUDIO_CONFIG.supabaseUrl,
      window.COREXFORMER_STUDIO_CONFIG.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

  await window.COREXFORMER_STUDIO_AUTH?.prepareSession(adminState.supabase);

  bindAdminEvents();

  adminState.supabase.auth.onAuthStateChange((_event, sessionUpdate) => {
    if (adminState.authBooting && !sessionUpdate) {
      return;
    }

    void handleAdminSession(sessionUpdate);
  });

  const {
    data: { session }
  } = await adminState.supabase.auth.getSession();

  await handleAdminSession(await recoverAdminHandoffSession(session));
  adminState.authBooting = false;
}

function bindAdminEvents() {
  adminDom.signOutButton?.addEventListener("click", async () => {
    if (!adminState.supabase) {
      return;
    }

    adminDom.signOutButton.disabled = true;
    setAdminMessage("Signing out of the admin workspace...", "info");

    window.COREXFORMER_STUDIO_AUTH?.clearSessionArtifacts();
    await adminState.supabase.auth.signOut();
    window.location.replace(buildAdminAccessPath());
  });

  adminDom.goBackButton?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign(buildStudioUrl("./index.html"));
  });

  adminDom.moduleTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const nextModule = button.dataset.adminModule;

      if (!nextModule || button.disabled) {
        return;
      }

      setActiveModule(nextModule, { historyMode: "push", scrollBehavior: "smooth" });
    });
  });

  adminDom.viewTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.adminView;

      if (!nextView) {
        return;
      }

      setActiveView(nextView, { historyMode: "push", scrollBehavior: "smooth" });
    });
  });

  window.addEventListener("popstate", () => {
    const requestedRoute = getRequestedAdminRoute();

    adminState.activeModule = requestedRoute.module;
    adminState.activeView = requestedRoute.view;
    ensureAdminViewMatchesModule();
    syncAdminShell({ historyMode: "none", scrollBehavior: "auto" });
  });
}

async function handleAdminSession(session) {
  adminState.session = session ?? null;
  adminState.profile = null;
  publishAdminContext();

  if (!adminState.session) {
    hideAdminWorkspace();
    setAdminStateText("Signed out. Use the studio access page to enter the private admin workspace.");
    window.location.replace(buildAdminAccessPath());
    return;
  }

  try {
    const profile = await waitForAdminProfile(adminState.session.user.id);
    adminState.profile = profile;

    if (!profile) {
      hideAdminWorkspace();
      setAdminMessage("The admin profile could not be loaded yet. Please sign in again from studio access.", "error");
      setAdminStateText("Admin profile unavailable.");
      return;
    }

    if (ADMIN_ALLOWED_ROLES.includes(profile.role)) {
      showAdminWorkspace();
      clearAdminMessage();
      setAdminStateText(`Signed in as ${profile.email}.`);
      updateAdminIdentity(profile);
      enforceAdminModuleAccess();
      syncAdminShell({ historyMode: "replace", scrollBehavior: "auto" });
      clearAdminHandoffArtifacts();
      publishAdminContext();
      return;
    }

    hideAdminWorkspace();

    if (FACILITATOR_SIDE_ROLES.includes(profile.role)) {
      setAdminMessage("This account belongs to the facilitator side. Redirecting to the facilitator workspace.", "error");
      setAdminStateText("This session does not have admin access.");
      window.setTimeout(() => {
        window.location.replace(buildFacilitatorWorkspacePath());
      }, 800);
      return;
    }

    setAdminMessage("This account does not have permission to open the admin workspace.", "error");
    setAdminStateText("Admin permission required.");
    window.setTimeout(() => {
      window.location.replace(buildAdminAccessPath());
    }, 800);
  } catch (error) {
    hideAdminWorkspace();
    setAdminMessage(error.message || "The admin workspace could not be loaded.", "error");
    setAdminStateText("Admin workspace unavailable.");
    publishAdminContext();
  }
}

async function recoverAdminHandoffSession(session) {
  if (session || (!isAdminHandoffRequest() && !hasPendingAdminHandoff()) || !adminState.supabase) {
    return session;
  }

  setAdminStateText("Finishing private admin sign-in...");

  const startedAt = Date.now();

  while (Date.now() - startedAt < ADMIN_HANDOFF_WAIT_MS) {
    await delay(300);

    const {
      data: { session: recoveredSession }
    } = await adminState.supabase.auth.getSession();

    if (recoveredSession) {
      clearAdminHandoffArtifacts();
      return recoveredSession;
    }
  }

  clearAdminHandoffArtifacts();
  return session;
}

async function waitForAdminProfile(userId, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await adminState.supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }

    await delay(700);
  }

  return null;
}

function showAdminWorkspace() {
  adminDom.workspaceContent?.classList.remove("hidden");
  adminDom.signOutButton?.classList.remove("hidden");
}

function hideAdminWorkspace() {
  adminDom.workspaceContent?.classList.add("hidden");
  adminDom.signOutButton?.classList.add("hidden");
  adminDom.adminIdentity?.classList.add("hidden");
}

function updateAdminIdentity(profile) {
  if (!adminDom.adminIdentity || !adminDom.adminIdentityText) {
    return;
  }

  const name = profile.full_name || "Admin";
  const role = humanizeAdminRole(profile.role);
  adminDom.adminIdentityText.textContent = `${name} · ${profile.email} · ${role}`;
  adminDom.adminIdentity.classList.remove("hidden");
}

function setAdminStateText(text) {
  if (!adminDom.authState) {
    return;
  }

  const detail = adminDom.authState.querySelector("span");

  if (detail) {
    detail.textContent = text;
  }
}

function setAdminMessage(message, tone = "info") {
  if (!adminDom.authMessage) {
    return;
  }

  adminDom.authMessage.textContent = message;
  adminDom.authMessage.classList.remove("hidden", "is-error", "is-success");

  if (tone === "error") {
    adminDom.authMessage.classList.add("is-error");
    return;
  }

  if (tone === "success") {
    adminDom.authMessage.classList.add("is-success");
  }
}

function clearAdminMessage() {
  if (!adminDom.authMessage) {
    return;
  }

  adminDom.authMessage.textContent = "";
  adminDom.authMessage.classList.add("hidden");
  adminDom.authMessage.classList.remove("is-error", "is-success");
}

function humanizeAdminRole(role) {
  return String(role || "admin")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function setActiveModule(moduleKey, options = {}) {
  if (!moduleKey || moduleKey === adminState.activeModule) {
    return;
  }

  adminState.activeModule = moduleKey;

  ensureAdminViewMatchesModule();

  syncAdminShell(options);
}

function setActiveView(viewKey, options = {}) {
  if (!viewKey || viewKey === adminState.activeView || !isValidAdminView(adminState.activeModule, viewKey)) {
    return;
  }

  adminState.activeView = viewKey;
  syncAdminShell(options);
}

function syncAdminShell(options = {}) {
  const historyMode = options.historyMode || "replace";
  const scrollBehavior = options.scrollBehavior || "smooth";
  enforceAdminModuleAccess();
  syncAdminUrl(historyMode);

  adminDom.moduleTabs.forEach((button) => {
    const isActive = button.dataset.adminModule === adminState.activeModule;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  adminDom.modulePanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminModulePanel !== adminState.activeModule);
  });

  adminDom.viewTabs.forEach((button) => {
    const isActive = button.dataset.adminView === adminState.activeView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  adminDom.viewPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminViewPanel !== adminState.activeView);
  });

  scrollActiveAdminTabsIntoView(scrollBehavior);
}

function scrollActiveAdminTabsIntoView(behavior = "smooth") {
  if (!window.matchMedia("(max-width: 980px)").matches) {
    return;
  }

  const activeButtons = [
    adminDom.moduleTabs.find((button) => button.dataset.adminModule === adminState.activeModule),
    adminDom.viewTabs.find((button) => button.dataset.adminView === adminState.activeView)
  ].filter(Boolean);

  activeButtons.forEach((button) => {
    button.scrollIntoView({
      behavior,
      block: "nearest",
      inline: "center"
    });
  });
}

function enforceAdminModuleAccess() {
  const isOwner = adminState.profile?.role === "owner";

  adminDom.ownerOnlyModules.forEach((button) => {
    const allowed = isOwner;
    button.disabled = !allowed;
    button.classList.toggle("hidden", !allowed);
    button.classList.toggle("is-disabled", !allowed);
  });

  adminDom.modulePanels.forEach((panel) => {
    const moduleKey = panel.dataset.adminModulePanel;
    const requiresOwner = OWNER_ONLY_MODULES.has(moduleKey);
    panel.classList.toggle("hidden", requiresOwner ? !isOwner || moduleKey !== adminState.activeModule : moduleKey !== adminState.activeModule);
  });

  if (OWNER_ONLY_MODULES.has(adminState.activeModule) && !isOwner) {
    adminState.activeModule = "facilitator";
  }

  ensureAdminViewMatchesModule();
}

function publishAdminContext() {
  const detail = {
    session: adminState.session,
    profile: adminState.profile,
    supabase: adminState.supabase,
    isAdmin: Boolean(adminState.profile && ADMIN_ALLOWED_ROLES.includes(adminState.profile.role)),
    canUseLeadMap: adminState.profile?.role === "owner"
  };

  window.COREXFORMER_ADMIN_CONTEXT = detail;
  document.dispatchEvent(new CustomEvent("corexformer:admin-context", { detail }));
}

function ensureAdminViewMatchesModule() {
  const defaultView = ADMIN_DEFAULT_VIEWS[adminState.activeModule] || ADMIN_DEFAULT_VIEWS.facilitator;

  if (!isValidAdminView(adminState.activeModule, adminState.activeView)) {
    adminState.activeView = defaultView;
  }
}

function getRequestedAdminRoute() {
  const params = new URLSearchParams(window.location.search);
  const requestedModule = params.get("module");
  const moduleKey = Object.prototype.hasOwnProperty.call(ADMIN_DEFAULT_VIEWS, requestedModule)
    ? requestedModule
    : "facilitator";
  const requestedView = params.get("view") || "";
  const viewKey = isValidAdminView(moduleKey, requestedView)
    ? requestedView
    : ADMIN_DEFAULT_VIEWS[moduleKey];

  return {
    module: moduleKey,
    view: viewKey
  };
}

function isValidAdminView(moduleKey, viewKey) {
  const allowedViews = ADMIN_MODULE_VIEWS[moduleKey];
  return Boolean(allowedViews && allowedViews.has(String(viewKey || "")));
}

function syncAdminUrl(mode = "replace") {
  const url = new URL(window.location.href);
  url.searchParams.delete("handoff");
  url.searchParams.set("module", adminState.activeModule);
  url.searchParams.set("view", adminState.activeView);
  const nextUrl = url.toString();

  if (nextUrl === window.location.href || mode === "none") {
    return;
  }

  if (mode === "push") {
    window.history.pushState({}, "", nextUrl);
    return;
  }

  window.history.replaceState({}, "", nextUrl);
}

function buildAdminAccessPath() {
  return buildStudioUrl(
    (window.COREXFORMER_STUDIO_CONFIG?.studioAccessPath || "/studio/"),
    new URLSearchParams({
      mode: "admin",
      module: adminState.activeModule,
      view: adminState.activeView
    })
  );
}

function buildFacilitatorWorkspacePath() {
  return buildStudioUrl(window.COREXFORMER_STUDIO_CONFIG?.facilitatorWorkspacePath || "/studio/facilitator");
}

function buildStudioUrl(path, params = null) {
  const config = window.COREXFORMER_STUDIO_CONFIG || {};
  const runtimeOrigin = resolveAdminRuntimeOrigin(config.publicSiteUrl);
  const url = new URL(path || "/studio/", ensureTrailingSlash(runtimeOrigin));

  if (params && typeof params.forEach === "function") {
    params.forEach((value, key) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
  }

  return url.toString();
}

function resolveAdminRuntimeOrigin(configuredOrigin) {
  const currentOrigin = window.location.origin;

  if (currentOrigin && currentOrigin !== "null") {
    return currentOrigin;
  }

  if (configuredOrigin) {
    return configuredOrigin;
  }

  return "https://corexformer.pages.dev";
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function isAdminHandoffRequest() {
  return new URLSearchParams(window.location.search).get("handoff") === "1";
}

function hasPendingAdminHandoff() {
  return Boolean(window.COREXFORMER_STUDIO_AUTH?.getPendingWorkspaceHandoff?.("admin"));
}

function clearAdminHandoffArtifacts() {
  clearAdminHandoffFlag();
  window.COREXFORMER_STUDIO_AUTH?.clearPendingWorkspaceHandoff?.("admin");
}

function clearAdminHandoffFlag() {
  const url = new URL(window.location.href);

  if (!url.searchParams.has("handoff")) {
    return;
  }

  url.searchParams.delete("handoff");
  window.history.replaceState({}, "", url.toString());
}
