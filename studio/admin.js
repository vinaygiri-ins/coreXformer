const ADMIN_ALLOWED_ROLES = ["owner", "editor"];
const FACILITATOR_SIDE_ROLES = ["candidate", "facilitator", "facilitator_lead"];
const OWNER_ONLY_MODULES = new Set(["lead-map"]);

const adminDom = {
  signOutButton: document.getElementById("signOutButton"),
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
  activeModule: "facilitator",
  activeView: "facilitator-overview"
};

document.addEventListener("DOMContentLoaded", () => {
  void initAdminWorkspace();
});

async function initAdminWorkspace() {
  if (!window.COREXFORMER_STUDIO_CONFIG || !window.supabase?.createClient) {
    return;
  }

  adminState.supabase = window.supabase.createClient(
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

  bindAdminEvents();

  const {
    data: { session }
  } = await adminState.supabase.auth.getSession();

  await handleAdminSession(session);

  adminState.supabase.auth.onAuthStateChange((_event, sessionUpdate) => {
    void handleAdminSession(sessionUpdate);
  });
}

function bindAdminEvents() {
  adminDom.signOutButton?.addEventListener("click", async () => {
    if (!adminState.supabase) {
      return;
    }

    adminDom.signOutButton.disabled = true;
    setAdminMessage("Signing out of the admin workspace...", "info");

    await adminState.supabase.auth.signOut();
    window.location.replace("/studio/?mode=admin");
  });

  adminDom.moduleTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const nextModule = button.dataset.adminModule;

      if (!nextModule || button.disabled) {
        return;
      }

      setActiveModule(nextModule);
    });
  });

  adminDom.viewTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.adminView;

      if (!nextView) {
        return;
      }

      setActiveView(nextView);
    });
  });
}

async function handleAdminSession(session) {
  adminState.session = session ?? null;
  adminState.profile = null;
  publishAdminContext();

  if (!adminState.session) {
    hideAdminWorkspace();
    setAdminStateText("Signed out. Use the studio access page to enter the private admin workspace.");
    window.location.replace("/studio/?mode=admin");
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
      syncAdminShell();
      publishAdminContext();
      return;
    }

    hideAdminWorkspace();

    if (FACILITATOR_SIDE_ROLES.includes(profile.role)) {
      setAdminMessage("This account belongs to the facilitator side. Redirecting to the facilitator workspace.", "error");
      setAdminStateText("This session does not have admin access.");
      window.setTimeout(() => {
        window.location.replace("/studio/facilitator");
      }, 800);
      return;
    }

    setAdminMessage("This account does not have permission to open the admin workspace.", "error");
    setAdminStateText("Admin permission required.");
    window.setTimeout(() => {
      window.location.replace("/studio/?mode=admin");
    }, 800);
  } catch (error) {
    hideAdminWorkspace();
    setAdminMessage(error.message || "The admin workspace could not be loaded.", "error");
    setAdminStateText("Admin workspace unavailable.");
    publishAdminContext();
  }
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

function setActiveModule(moduleKey) {
  adminState.activeModule = moduleKey;

  if (moduleKey === "facilitator" && !adminState.activeView.startsWith("facilitator-")) {
    adminState.activeView = "facilitator-overview";
  }

  if (moduleKey === "insights" && !adminState.activeView.startsWith("insights-")) {
    adminState.activeView = "insights-overview";
  }

  if (moduleKey === "lead-map" && !adminState.activeView.startsWith("lead-map-")) {
    adminState.activeView = "lead-map-overview";
  }

  syncAdminShell();
}

function setActiveView(viewKey) {
  adminState.activeView = viewKey;
  syncAdminShell();
}

function syncAdminShell() {
  enforceAdminModuleAccess();

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

  if (adminState.activeModule === "facilitator" && !adminState.activeView.startsWith("facilitator-")) {
    adminState.activeView = "facilitator-overview";
  }

  if (adminState.activeModule === "insights" && !adminState.activeView.startsWith("insights-")) {
    adminState.activeView = "insights-overview";
  }

  if (adminState.activeModule === "lead-map" && !adminState.activeView.startsWith("lead-map-")) {
    adminState.activeView = "lead-map-overview";
  }
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
