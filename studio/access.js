const ADMIN_ROLES = ["owner", "editor"];
const FACILITATOR_ROLES = ["candidate", "facilitator", "facilitator_lead"];
const ACCESS_COPY = {
  admin: {
    label: "Admin access",
    heading: "Admin sign in",
    note: "Sign in with your private CoreXformer credentials. If this is the first time, create the first owner account here and the profile will become the master admin for the studio.",
    emailPlaceholder: "admin@corexformer.com",
    state: "Signed out. Use your email and password to enter the private studio.",
    progress: "Signing you into the admin workspace...",
    checking: "Checking private studio session...",
    authing: "Authenticating your private access...",
    success: "Admin access confirmed. Redirecting to the admin workspace...",
    mismatch: "These credentials belong to the facilitator side. Redirecting to the facilitator workspace..."
  },
  facilitator: {
    label: "Facilitator access",
    heading: "Facilitator sign in",
    note: "Sign in with your facilitator credentials to enter the private workspace for onboarding, assigned products, sessions, and collaboration.",
    emailPlaceholder: "facilitator@corexformer.com",
    state: "Signed out. Use your email and password to enter the private studio.",
    progress: "Signing you into the facilitator workspace...",
    checking: "Checking private studio session...",
    authing: "Authenticating your private access...",
    success: "Facilitator access confirmed. Redirecting to the facilitator workspace...",
    mismatch: "These credentials belong to admin access. Redirecting to the admin workspace..."
  }
};

const dom = {
  accessLoginForm: document.getElementById("accessLoginForm"),
  adminModeButton: document.getElementById("adminModeButton"),
  facilitatorModeButton: document.getElementById("facilitatorModeButton"),
  accessCardLabel: document.getElementById("accessCardLabel"),
  accessHeading: document.getElementById("accessHeading"),
  accessNote: document.getElementById("accessNote"),
  accessFullNameRow: document.getElementById("accessFullNameRow"),
  accessFullNameInput: document.getElementById("accessFullNameInput"),
  accessEmailInput: document.getElementById("accessEmailInput"),
  accessPasswordInput: document.getElementById("accessPasswordInput"),
  accessSignInButton: document.getElementById("accessSignInButton"),
  accessSignUpButton: document.getElementById("accessSignUpButton"),
  accessAuthMessage: document.getElementById("accessAuthMessage"),
  accessAuthState: document.getElementById("accessAuthState")
};

const state = {
  supabase: null,
  busy: false,
  mode: "admin"
};

document.addEventListener("DOMContentLoaded", () => {
  void initAccess();
});

async function initAccess() {
  bindEvents();
  applyMode();

  const config = window.COREXFORMER_STUDIO_CONFIG;
  const supabaseLib = window.supabase;

  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !supabaseLib?.createClient) {
    showMessage(dom.accessAuthMessage, "Supabase configuration is missing. Add your project URL and publishable key to studio/config.js.", "error");
    setAuthState("Configuration missing. Add Supabase details to continue.");
    return;
  }

  state.supabase = supabaseLib.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  setAuthState(ACCESS_COPY[state.mode].checking);

  const {
    data: { session },
    error
  } = await state.supabase.auth.getSession();

  if (error) {
    showMessage(dom.accessAuthMessage, error.message, "error");
    return;
  }

  if (session) {
    await routeByCredential(session, "session", state.mode);
  } else {
    setAuthState(ACCESS_COPY[state.mode].state);
  }

  state.supabase.auth.onAuthStateChange((_event, sessionUpdate) => {
    if (sessionUpdate) {
      void routeByCredential(sessionUpdate, "session", state.mode);
    }
  });
}

function bindEvents() {
  dom.accessLoginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void signIn();
  });

  dom.adminModeButton?.addEventListener("click", () => {
    setMode("admin");
  });

  dom.facilitatorModeButton?.addEventListener("click", () => {
    setMode("facilitator");
  });

  dom.accessSignUpButton?.addEventListener("click", () => {
    void signUpOwner();
  });
}

function setMode(mode) {
  if (!ACCESS_COPY[mode] || state.mode === mode) {
    return;
  }

  state.mode = mode;
  clearMessage(dom.accessAuthMessage);
  applyMode();
}

function applyMode() {
  const copy = ACCESS_COPY[state.mode];
  const isAdmin = state.mode === "admin";

  dom.accessCardLabel.textContent = copy.label;
  dom.accessHeading.textContent = copy.heading;
  dom.accessNote.textContent = copy.note;
  dom.accessEmailInput.placeholder = copy.emailPlaceholder;
  dom.accessFullNameRow.classList.toggle("hidden", !isAdmin);
  dom.accessSignUpButton.classList.toggle("hidden", !isAdmin);
  dom.accessSignInButton.textContent = "Sign in";

  dom.adminModeButton.classList.toggle("is-active", isAdmin);
  dom.adminModeButton.setAttribute("aria-pressed", String(isAdmin));
  dom.facilitatorModeButton.classList.toggle("is-active", !isAdmin);
  dom.facilitatorModeButton.setAttribute("aria-pressed", String(!isAdmin));

  if (!state.busy) {
    setAuthState(copy.state);
  }
}

async function signIn() {
  const email = dom.accessEmailInput.value.trim();
  const password = dom.accessPasswordInput.value;

  if (!email || !password) {
    showMessage(dom.accessAuthMessage, "Enter both email and password to sign in.", "error");
    return;
  }

  setBusy(true);
  clearMessage(dom.accessAuthMessage);
  showMessage(dom.accessAuthMessage, ACCESS_COPY[state.mode].progress);
  setAuthState(ACCESS_COPY[state.mode].authing);

  const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });

  setBusy(false);

  if (error) {
    showMessage(dom.accessAuthMessage, error.message, "error");
    setAuthState("Sign-in failed. Check the credentials and try again.");
    return;
  }

  await routeByCredential(data.session, state.mode, state.mode);
}

async function signUpOwner() {
  if (state.mode !== "admin") {
    setMode("admin");
    showMessage(dom.accessAuthMessage, "Owner account creation is only available under admin access.", "error");
    return;
  }

  const email = dom.accessEmailInput.value.trim();
  const password = dom.accessPasswordInput.value;
  const fullName = dom.accessFullNameInput.value.trim();

  if (!email || !password) {
    showMessage(dom.accessAuthMessage, "Enter an email and password before creating the first owner account.", "error");
    return;
  }

  setBusy(true);
  showMessage(dom.accessAuthMessage, "Creating the first owner account...");
  setAuthState("Creating the admin account...");

  const { data, error } = await state.supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  setBusy(false);

  if (error) {
    showMessage(dom.accessAuthMessage, error.message, "error");
    setAuthState("Owner account creation failed.");
    return;
  }

  if (data.session) {
    await routeByCredential(data.session, "admin-signup", "admin");
    return;
  }

  showMessage(dom.accessAuthMessage, "Account created. If email confirmation is enabled, confirm the email first and then sign in.");
  setAuthState("Owner account created. Confirm the email if your project requires it.");
}

async function routeByCredential(session, source, attemptedMode = state.mode) {
  const config = window.COREXFORMER_STUDIO_CONFIG;
  const profile = await waitForProfile(session.user.id);
  const isAdmin = Boolean((profile && ADMIN_ROLES.includes(profile.role)) || (!profile && source === "admin-signup"));
  const isFacilitator = Boolean(profile && FACILITATOR_ROLES.includes(profile.role));

  if (isAdmin) {
    showMessage(
      dom.accessAuthMessage,
      attemptedMode === "facilitator" ? ACCESS_COPY.facilitator.mismatch : ACCESS_COPY.admin.success
    );
    setAuthState("Admin access confirmed.");
    window.location.replace(config.adminWorkspacePath || "/studio/admin.html");
    return;
  }

  if (!isFacilitator) {
    showMessage(
      dom.accessAuthMessage,
      "This account is not approved for private studio access yet. CoreXformer will first review and activate facilitator-side accounts through onboarding.",
      "error"
    );
    setAuthState("Signed in, but this account is not activated for admin or facilitator access yet.");
    return;
  }

  showMessage(
    dom.accessAuthMessage,
    attemptedMode === "admin" ? ACCESS_COPY.admin.mismatch : ACCESS_COPY.facilitator.success
  );
  setAuthState("Facilitator access confirmed.");
  window.location.replace(config.facilitatorWorkspacePath || "/studio/facilitator.html");
}

async function waitForProfile(userId, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await state.supabase
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

    await sleep(900);
  }

  return null;
}

function setBusy(isBusy) {
  state.busy = isBusy;
  dom.adminModeButton.disabled = isBusy;
  dom.facilitatorModeButton.disabled = isBusy;
  dom.accessFullNameInput.disabled = isBusy;
  dom.accessEmailInput.disabled = isBusy;
  dom.accessPasswordInput.disabled = isBusy;
  dom.accessSignInButton.disabled = isBusy;
  dom.accessSignUpButton.disabled = isBusy || state.mode !== "admin";
}

function setAuthState(text) {
  dom.accessAuthState.querySelector("span").textContent = text;
}

function showMessage(element, message, tone = "info") {
  element.textContent = message;
  element.classList.remove("hidden", "is-error", "is-success");

  if (tone === "error") {
    element.classList.add("is-error");
  } else if (tone === "success") {
    element.classList.add("is-success");
  }
}

function clearMessage(element) {
  element.textContent = "";
  element.classList.add("hidden");
  element.classList.remove("is-error", "is-success");
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
