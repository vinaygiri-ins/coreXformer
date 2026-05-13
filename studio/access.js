const EDITOR_ROLES = ["owner", "editor"];

const dom = {
  adminLoginForm: document.getElementById("adminLoginForm"),
  adminFullNameInput: document.getElementById("adminFullNameInput"),
  adminEmailInput: document.getElementById("adminEmailInput"),
  adminPasswordInput: document.getElementById("adminPasswordInput"),
  adminSignInButton: document.getElementById("adminSignInButton"),
  adminSignUpButton: document.getElementById("adminSignUpButton"),
  adminAuthMessage: document.getElementById("adminAuthMessage"),
  adminAuthState: document.getElementById("adminAuthState"),
  facilitatorLoginForm: document.getElementById("facilitatorLoginForm"),
  facilitatorEmailInput: document.getElementById("facilitatorEmailInput"),
  facilitatorPasswordInput: document.getElementById("facilitatorPasswordInput"),
  facilitatorSignInButton: document.getElementById("facilitatorSignInButton"),
  facilitatorAuthMessage: document.getElementById("facilitatorAuthMessage"),
  facilitatorAuthState: document.getElementById("facilitatorAuthState")
};

const state = {
  supabase: null,
  busy: false
};

document.addEventListener("DOMContentLoaded", () => {
  void initAccess();
});

async function initAccess() {
  bindEvents();

  const config = window.COREXFORMER_STUDIO_CONFIG;
  const supabaseLib = window.supabase;

  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !supabaseLib?.createClient) {
    showMessage(dom.adminAuthMessage, "Supabase configuration is missing. Add your project URL and publishable key to studio/config.js.", "error");
    showMessage(dom.facilitatorAuthMessage, "Supabase configuration is missing. Add your project URL and publishable key to studio/config.js.", "error");
    setAuthState(dom.adminAuthState, "Configuration missing. Add Supabase details to continue.");
    setAuthState(dom.facilitatorAuthState, "Configuration missing. Add Supabase details to continue.");
    return;
  }

  state.supabase = supabaseLib.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  setAuthState(dom.adminAuthState, "Checking private studio session...");
  setAuthState(dom.facilitatorAuthState, "Checking private studio session...");

  const {
    data: { session },
    error
  } = await state.supabase.auth.getSession();

  if (error) {
    showMessage(dom.adminAuthMessage, error.message, "error");
    showMessage(dom.facilitatorAuthMessage, error.message, "error");
    return;
  }

  if (session) {
    await routeByCredential(session, "session");
  }

  state.supabase.auth.onAuthStateChange((_event, sessionUpdate) => {
    if (sessionUpdate) {
      void routeByCredential(sessionUpdate, "session");
    }
  });
}

function bindEvents() {
  dom.adminLoginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void signIn("admin");
  });

  dom.facilitatorLoginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void signIn("facilitator");
  });

  dom.adminSignUpButton?.addEventListener("click", () => {
    void signUpOwner();
  });
}

async function signIn(mode) {
  const isAdmin = mode === "admin";
  const email = isAdmin ? dom.adminEmailInput.value.trim() : dom.facilitatorEmailInput.value.trim();
  const password = isAdmin ? dom.adminPasswordInput.value : dom.facilitatorPasswordInput.value;
  const messageNode = isAdmin ? dom.adminAuthMessage : dom.facilitatorAuthMessage;
  const stateNode = isAdmin ? dom.adminAuthState : dom.facilitatorAuthState;

  if (!email || !password) {
    showMessage(messageNode, "Enter both email and password to sign in.", "error");
    return;
  }

  setBusy(true);
  clearMessage(dom.adminAuthMessage);
  clearMessage(dom.facilitatorAuthMessage);
  showMessage(messageNode, isAdmin ? "Signing you into the admin workspace..." : "Signing you into the facilitator workspace...");
  setAuthState(stateNode, "Authenticating your private access...");

  const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });

  setBusy(false);

  if (error) {
    showMessage(messageNode, error.message, "error");
    setAuthState(stateNode, "Sign-in failed. Check the credentials and try again.");
    return;
  }

  await routeByCredential(data.session, mode);
}

async function signUpOwner() {
  const email = dom.adminEmailInput.value.trim();
  const password = dom.adminPasswordInput.value;
  const fullName = dom.adminFullNameInput.value.trim();

  if (!email || !password) {
    showMessage(dom.adminAuthMessage, "Enter an email and password before creating the first owner account.", "error");
    return;
  }

  setBusy(true);
  showMessage(dom.adminAuthMessage, "Creating the first owner account...");
  setAuthState(dom.adminAuthState, "Creating the admin account...");

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
    showMessage(dom.adminAuthMessage, error.message, "error");
    setAuthState(dom.adminAuthState, "Owner account creation failed.");
    return;
  }

  if (data.session) {
    await routeByCredential(data.session, "admin-signup");
    return;
  }

  showMessage(dom.adminAuthMessage, "Account created. If email confirmation is enabled, confirm the email first and then sign in.");
  setAuthState(dom.adminAuthState, "Owner account created. Confirm the email if your project requires it.");
}

async function routeByCredential(session, source) {
  const config = window.COREXFORMER_STUDIO_CONFIG;
  const profile = await waitForProfile(session.user.id);
  const isAdmin = Boolean(
    (profile && EDITOR_ROLES.includes(profile.role))
    || (!profile && source === "admin-signup")
  );

  if (isAdmin) {
    showMessage(dom.adminAuthMessage, source === "facilitator"
      ? "These credentials belong to admin access. Redirecting to the admin workspace..."
      : "Admin access confirmed. Redirecting to the admin workspace...");
    setAuthState(dom.adminAuthState, "Admin access confirmed.");
    window.location.replace(config.adminWorkspacePath || "/studio/admin.html");
    return;
  }

  showMessage(dom.facilitatorAuthMessage, source === "admin"
    ? "These credentials belong to the facilitator side. Redirecting to the facilitator workspace..."
    : "Facilitator access confirmed. Redirecting to the facilitator workspace...");
  setAuthState(dom.facilitatorAuthState, "Facilitator access confirmed.");
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

  dom.adminFullNameInput.disabled = isBusy;
  dom.adminEmailInput.disabled = isBusy;
  dom.adminPasswordInput.disabled = isBusy;
  dom.adminSignInButton.disabled = isBusy;
  dom.adminSignUpButton.disabled = isBusy;
  dom.facilitatorEmailInput.disabled = isBusy;
  dom.facilitatorPasswordInput.disabled = isBusy;
  dom.facilitatorSignInButton.disabled = isBusy;
}

function setAuthState(element, text) {
  element.querySelector("span").textContent = text;
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
