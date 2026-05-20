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
    sign_in: {
      label: "Facilitator access",
      heading: "Facilitator sign in",
      note: "Sign in with your facilitator credentials to enter the private workspace for onboarding, assigned products, sessions, and collaboration.",
      emailPlaceholder: "facilitator@corexformer.com",
      state: "Signed out. Use your email and password to enter the private studio.",
      progress: "Signing you into the facilitator workspace...",
      checking: "Checking private studio session...",
      authing: "Authenticating your private access...",
      success: "Facilitator access confirmed. Redirecting to the facilitator workspace...",
      mismatch: "These credentials belong to admin access. Redirecting to the admin workspace...",
      primaryButton: "Sign in"
    },
    activate: {
      label: "Facilitator onboarding access",
      heading: "Activate your invited account",
      note: "Use this only after CoreXformer has reviewed your application and invited you into onboarding. This step creates your candidate-side login for the private facilitator workspace.",
      emailPlaceholder: "invited.facilitator@corexformer.com",
      state: "Waiting for an invited facilitator to activate access.",
      progress: "Activating your invited facilitator access...",
      checking: "Checking private studio session...",
      authing: "Preparing your candidate-side access...",
      success: "Candidate access confirmed. Redirecting to the facilitator workspace...",
      mismatch: "These credentials already belong to the admin side. Redirecting to the admin workspace...",
      primaryButton: "Activate access"
    }
  }
};

const dom = {
  accessLoginForm: document.getElementById("accessLoginForm"),
  adminModeButton: document.getElementById("adminModeButton"),
  facilitatorModeButton: document.getElementById("facilitatorModeButton"),
  facilitatorActionSwitch: document.getElementById("facilitatorActionSwitch"),
  facilitatorSignInModeButton: document.getElementById("facilitatorSignInModeButton"),
  facilitatorActivateModeButton: document.getElementById("facilitatorActivateModeButton"),
  accessCardLabel: document.getElementById("accessCardLabel"),
  accessHeading: document.getElementById("accessHeading"),
  accessNote: document.getElementById("accessNote"),
  accessFullNameRow: document.getElementById("accessFullNameRow"),
  accessFullNameInput: document.getElementById("accessFullNameInput"),
  accessEmailInput: document.getElementById("accessEmailInput"),
  accessPasswordInput: document.getElementById("accessPasswordInput"),
  accessConfirmPasswordRow: document.getElementById("accessConfirmPasswordRow"),
  accessConfirmPasswordInput: document.getElementById("accessConfirmPasswordInput"),
  accessSignInButton: document.getElementById("accessSignInButton"),
  accessSignUpButton: document.getElementById("accessSignUpButton"),
  accessAuthMessage: document.getElementById("accessAuthMessage"),
  accessAuthState: document.getElementById("accessAuthState")
};

const state = {
  supabase: null,
  busy: false,
  mode: "admin",
  facilitatorAction: "sign_in"
};

document.addEventListener("DOMContentLoaded", () => {
  void initAccess();
});

async function initAccess() {
  bindEvents();
  applyRequestedMode();
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

  dom.facilitatorSignInModeButton?.addEventListener("click", () => {
    setFacilitatorAction("sign_in");
  });

  dom.facilitatorActivateModeButton?.addEventListener("click", () => {
    setFacilitatorAction("activate");
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
  if (mode === "admin") {
    state.facilitatorAction = "sign_in";
  }
  clearMessage(dom.accessAuthMessage);
  applyMode();
}

function setFacilitatorAction(action) {
  if (state.mode !== "facilitator" || !["sign_in", "activate"].includes(action) || state.facilitatorAction === action) {
    return;
  }

  state.facilitatorAction = action;
  clearMessage(dom.accessAuthMessage);
  applyMode();
}

function applyMode() {
  const copy = getActiveCopy();
  const isAdmin = state.mode === "admin";
  const isFacilitatorActivation = state.mode === "facilitator" && state.facilitatorAction === "activate";

  dom.accessCardLabel.textContent = copy.label;
  dom.accessHeading.textContent = copy.heading;
  dom.accessNote.textContent = copy.note;
  dom.accessEmailInput.placeholder = copy.emailPlaceholder;
  dom.accessFullNameRow.classList.toggle("hidden", !(isAdmin || isFacilitatorActivation));
  dom.accessConfirmPasswordRow.classList.toggle("hidden", !isFacilitatorActivation);
  dom.facilitatorActionSwitch.classList.toggle("hidden", state.mode !== "facilitator");
  dom.accessSignUpButton.classList.toggle("hidden", !isAdmin);
  dom.accessSignInButton.textContent = copy.primaryButton || "Sign in";

  dom.adminModeButton.classList.toggle("is-active", isAdmin);
  dom.adminModeButton.setAttribute("aria-pressed", String(isAdmin));
  dom.facilitatorModeButton.classList.toggle("is-active", !isAdmin);
  dom.facilitatorModeButton.setAttribute("aria-pressed", String(!isAdmin));
  dom.facilitatorSignInModeButton?.classList.toggle("is-active", state.facilitatorAction === "sign_in");
  dom.facilitatorSignInModeButton?.setAttribute("aria-pressed", String(state.facilitatorAction === "sign_in"));
  dom.facilitatorActivateModeButton?.classList.toggle("is-active", state.facilitatorAction === "activate");
  dom.facilitatorActivateModeButton?.setAttribute("aria-pressed", String(state.facilitatorAction === "activate"));

  if (!state.busy) {
    setAuthState(copy.state);
  }
}

async function signIn() {
  if (state.mode === "facilitator" && state.facilitatorAction === "activate") {
    await activateFacilitatorAccount();
    return;
  }

  const email = dom.accessEmailInput.value.trim();
  const password = dom.accessPasswordInput.value;

  if (!email || !password) {
    showMessage(dom.accessAuthMessage, "Enter both email and password to sign in.", "error");
    return;
  }

  setBusy(true);
  clearMessage(dom.accessAuthMessage);
  showMessage(dom.accessAuthMessage, getActiveCopy().progress);
  setAuthState(getActiveCopy().authing);

  const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });

  setBusy(false);

  if (error) {
    if (isEmailNotConfirmedError(error)) {
      showMessage(
        dom.accessAuthMessage,
        state.mode === "facilitator"
          ? "Your facilitator account exists, but the email is still waiting for confirmation. Open the confirmation email first, then return here and sign in."
          : "This account exists, but the email is still waiting for confirmation. Confirm the email first, then sign in again.",
        "error"
      );
      setAuthState("Email confirmation is still pending.");
      return;
    }

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

async function activateFacilitatorAccount() {
  const email = dom.accessEmailInput.value.trim().toLowerCase();
  const password = dom.accessPasswordInput.value;
  const confirmPassword = dom.accessConfirmPasswordInput.value;
  const fullName = dom.accessFullNameInput.value.trim();

  if (!fullName || !email || !password || !confirmPassword) {
    showMessage(dom.accessAuthMessage, "Complete your full name, email, password, and password confirmation before activating access.", "error");
    return;
  }

  if (password.length < 8) {
    showMessage(dom.accessAuthMessage, "Use a password with at least 8 characters for your facilitator access.", "error");
    return;
  }

  if (password !== confirmPassword) {
    showMessage(dom.accessAuthMessage, "The password confirmation does not match yet.", "error");
    return;
  }

  setBusy(true);
  clearMessage(dom.accessAuthMessage);
  showMessage(dom.accessAuthMessage, ACCESS_COPY.facilitator.activate.progress);
  setAuthState(ACCESS_COPY.facilitator.activate.authing);

  const invitationCheck = await state.supabase.rpc("check_facilitator_invitation", {
    invite_email: email
  });

  if (invitationCheck.error) {
    setBusy(false);
    showMessage(
      dom.accessAuthMessage,
      "Facilitator activation is not fully enabled in the backend yet. CoreXformer needs to apply the invitation-activation setup before invited accounts can be created here.",
      "error"
    );
    setAuthState("Activation is staged, but the backend invitation check is not live yet.");
    console.warn("CoreXformer facilitator invitation check failed.", invitationCheck.error);
    return;
  }

  const invitationRow = Array.isArray(invitationCheck.data) ? invitationCheck.data[0] : invitationCheck.data;

  if (!invitationRow?.is_invited) {
    const existingAccessResult = await tryExistingFacilitatorAccess(email, password);

    if (existingAccessResult.type === "confirmed-email-pending") {
      setBusy(false);
      showMessage(
        dom.accessAuthMessage,
        "Your invited account has already been created. Confirm the facilitator email first, then return to Facilitator sign in.",
        "success"
      );
      setAuthState("Invited account already created. Waiting for email confirmation.");
      return;
    }

    if (existingAccessResult.type === "signed-in") {
      setBusy(false);
      await routeByCredential(existingAccessResult.session, "facilitator-existing", "facilitator");
      return;
    }

    setBusy(false);
    showMessage(
      dom.accessAuthMessage,
      "This email is not currently marked as invited to onboarding. If you already activated once, switch to Facilitator sign in. Otherwise, ask CoreXformer to review your application and send the onboarding invitation first.",
      "error"
    );
    setAuthState("Waiting for an onboarding invitation from CoreXformer.");
    return;
  }

  const { data, error } = await state.supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        facilitator_invitation: true
      }
    }
  });

  setBusy(false);

  if (error) {
    if (isEmailNotConfirmedError(error)) {
      showMessage(
        dom.accessAuthMessage,
        "Your invited account already exists and is waiting for email confirmation. Confirm the email first, then return to Facilitator sign in.",
        "success"
      );
      setAuthState("Invited account already created. Waiting for email confirmation.");
      return;
    }

    showMessage(dom.accessAuthMessage, error.message, "error");
    setAuthState("The invited account could not be activated yet.");
    return;
  }

  if (data.session) {
    await routeByCredential(data.session, "facilitator-activation", "facilitator");
    return;
  }

  showMessage(
    dom.accessAuthMessage,
    "Your invited account has been created. If email confirmation is enabled, confirm your email first and then sign in as a facilitator.",
    "success"
  );
  setAuthState("Invited account created. Confirm your email if required, then sign in.");
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
      source === "facilitator-activation"
        ? "The account was created, but the facilitator invitation is not fully activated yet. CoreXformer may still need to finish the onboarding-side backend setup or review this invite again."
        : "This account is not approved for private studio access yet. CoreXformer will first review and activate facilitator-side accounts through onboarding.",
      "error"
    );
    setAuthState(
      source === "facilitator-activation"
        ? "Signed in, but this account is not yet activated as a facilitator-side candidate."
        : "Signed in, but this account is not activated for admin or facilitator access yet."
    );
    return;
  }

  showMessage(
    dom.accessAuthMessage,
    attemptedMode === "admin" ? ACCESS_COPY.admin.mismatch : ACCESS_COPY.facilitator.success
  );
  setAuthState("Facilitator access confirmed.");
  window.location.replace(config.facilitatorWorkspacePath || "/studio/facilitator.html");
}

function getActiveCopy() {
  if (state.mode === "facilitator") {
    return ACCESS_COPY.facilitator[state.facilitatorAction] || ACCESS_COPY.facilitator.sign_in;
  }

  return ACCESS_COPY.admin;
}

function applyRequestedMode() {
  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get("mode");
  const requestedAction = params.get("action");

  if (requestedMode === "facilitator") {
    state.mode = "facilitator";
  } else if (requestedMode === "admin") {
    state.mode = "admin";
  }

  if (requestedAction === "activate") {
    state.mode = "facilitator";
    state.facilitatorAction = "activate";
  } else if (requestedAction === "signin") {
    state.mode = "facilitator";
    state.facilitatorAction = "sign_in";
  }
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
  dom.facilitatorSignInModeButton.disabled = isBusy;
  dom.facilitatorActivateModeButton.disabled = isBusy;
  dom.accessFullNameInput.disabled = isBusy;
  dom.accessEmailInput.disabled = isBusy;
  dom.accessPasswordInput.disabled = isBusy;
  dom.accessConfirmPasswordInput.disabled = isBusy;
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

async function tryExistingFacilitatorAccess(email, password) {
  const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });

  if (!error && data?.session) {
    return {
      type: "signed-in",
      session: data.session
    };
  }

  if (isEmailNotConfirmedError(error)) {
    return {
      type: "confirmed-email-pending"
    };
  }

  return {
    type: "no-match",
    error
  };
}

function isEmailNotConfirmedError(error) {
  if (!error) {
    return false;
  }

  return error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message || "");
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
