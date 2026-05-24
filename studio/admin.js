const ADMIN_ALLOWED_ROLES = ["owner", "editor"];
const FACILITATOR_SIDE_ROLES = ["candidate", "facilitator", "facilitator_lead"];

const adminDom = {
  signOutButton: document.getElementById("signOutButton"),
  workspaceContent: document.getElementById("workspaceContent"),
  authMessage: document.getElementById("authMessage"),
  authState: document.getElementById("authState"),
  adminIdentity: document.getElementById("adminIdentity"),
  adminIdentityText: document.getElementById("adminIdentityText")
};

const adminState = {
  supabase: null,
  session: null,
  profile: null
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
}

async function handleAdminSession(session) {
  adminState.session = session ?? null;
  adminState.profile = null;

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
