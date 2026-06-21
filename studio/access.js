const ADMIN_ROLES = ["owner", "editor"];
const FACILITATOR_ROLES = ["candidate", "facilitator", "facilitator_lead"];
const ACCESS_COPY = {
  admin: {
    label: "Admin access",
    heading: "Admin sign in",
    note: "Sign in with your private CoreXformer credentials. If this is the first time, create the first owner account here and the profile will become the master admin for the studio. For privacy, studio access now ends after inactivity or when the browser tab is closed, so password entry is required again.",
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
      note: "Sign in with your facilitator credentials to enter the private workspace for onboarding, assigned products, sessions, and collaboration. For privacy, studio access now ends after inactivity or when the browser tab is closed, so password entry is required again.",
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
      note: "Use this only after CoreXformer has reviewed your application and invited you into onboarding. This step creates your candidate-side login for the private facilitator workspace. For privacy, studio access now ends after inactivity or when the browser tab is closed, so password entry is required again.",
      emailPlaceholder: "invited.facilitator@corexformer.com",
      state: "Waiting for an invited facilitator to activate access.",
      progress: "Activating your invited facilitator access...",
      checking: "Checking private studio session...",
      authing: "Preparing your candidate-side access...",
      success: "Candidate access confirmed. Redirecting to the facilitator workspace...",
      mismatch: "These credentials already belong to the admin side. Redirecting to the admin workspace...",
      primaryButton: "Activate access"
    }
  },
  recovery: {
    label: "Password recovery",
    heading: "Set a new password",
    note: "Open the secure recovery link from your email, then create a new password for this private studio account. When the password is updated, you will return to sign in with the new one.",
    state: "Recovery link ready. Enter a new password to continue.",
    progress: "Saving your new password...",
    success: "Password updated. Redirecting you to studio sign in...",
    invalid: "This recovery link is missing or has expired. Request a fresh password reset email below.",
    primaryButton: "Save new password"
  }
};

const dom = {
  accessLoginForm: document.getElementById("accessLoginForm"),
  accessPrimaryModeSwitch: document.getElementById("accessPrimaryModeSwitch"),
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
  accessEmailRow: document.getElementById("accessEmailRow"),
  accessEmailInput: document.getElementById("accessEmailInput"),
  accessPasswordRow: document.getElementById("accessPasswordRow"),
  accessPasswordInput: document.getElementById("accessPasswordInput"),
  accessConfirmPasswordRow: document.getElementById("accessConfirmPasswordRow"),
  accessConfirmPasswordInput: document.getElementById("accessConfirmPasswordInput"),
  accessSignInButton: document.getElementById("accessSignInButton"),
  accessSignUpButton: document.getElementById("accessSignUpButton"),
  accessForgotPasswordButton: document.getElementById("accessForgotPasswordButton"),
  accessCancelRecoveryButton: document.getElementById("accessCancelRecoveryButton"),
  accessAuthMessage: document.getElementById("accessAuthMessage"),
  accessAuthState: document.getElementById("accessAuthState"),
  accessSessionActionButton: document.getElementById("accessSessionActionButton")
};

const state = {
  supabase: null,
  busy: false,
  mode: "admin",
  facilitatorAction: "sign_in",
  recoveryRequested: false,
  recoveryMode: false,
  session: null,
  sessionProfile: null,
  ignoreEmptySessionUntil: 0,
  pendingWorkspaceUrl: "",
  pendingWorkspaceLabel: ""
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
  const studioAuth = window.COREXFORMER_STUDIO_AUTH;

  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !supabaseLib?.createClient) {
    showMessage(dom.accessAuthMessage, "Supabase configuration is missing. Add your project URL and publishable key to studio/config.js.", "error");
    setAuthState("Configuration missing. Add Supabase details to continue.");
    return;
  }

  state.supabase = studioAuth?.createClient(config) || supabaseLib.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  state.supabase.auth.onAuthStateChange((event, sessionUpdate) => {
    if (event === "PASSWORD_RECOVERY" || (state.recoveryRequested && sessionUpdate)) {
      void enterRecoveryMode(sessionUpdate);
      return;
    }

    if (sessionUpdate) {
      state.session = sessionUpdate;
      return;
    }

    if (Date.now() < state.ignoreEmptySessionUntil) {
      return;
    }

    state.session = null;
    state.sessionProfile = null;
    if (!state.recoveryMode) {
      const notice = studioAuth?.consumeNotice();
      if (notice) {
        showMessage(dom.accessAuthMessage, notice, "info");
      } else {
        clearMessage(dom.accessAuthMessage);
      }
      setAuthState(getActiveCopy().state);
    }
    renderSessionActionButton();
  });

  await studioAuth?.prepareSession(state.supabase);

  setAuthState(getActiveCopy().checking);

  const {
    data: { session },
    error
  } = await state.supabase.auth.getSession();

  if (error) {
    showMessage(dom.accessAuthMessage, error.message, "error");
    return;
  }

  const accessNotice = studioAuth?.consumeNotice();
  const resolvedSession = session || state.session;

  if (resolvedSession && state.recoveryRequested) {
    await enterRecoveryMode(resolvedSession);
  } else if (resolvedSession) {
    await handleExistingSession(resolvedSession);
  } else {
    if (accessNotice) {
      showMessage(dom.accessAuthMessage, accessNotice, "info");
    }
    if (state.recoveryRequested) {
      showMessage(dom.accessAuthMessage, ACCESS_COPY.recovery.invalid, "error");
      state.recoveryRequested = false;
      clearRecoveryFlagFromUrl();
    }
    setAuthState(getActiveCopy().state);
  }
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

  dom.accessForgotPasswordButton?.addEventListener("click", () => {
    void sendPasswordReset();
  });

  dom.accessCancelRecoveryButton?.addEventListener("click", () => {
    void exitRecoveryMode();
  });

  dom.accessSessionActionButton?.addEventListener("click", () => {
    if (state.pendingWorkspaceUrl) {
      redirectToWorkspace(state.pendingWorkspaceUrl);
      return;
    }

    void signOutCurrentSession();
  });
}

function setMode(mode) {
  if (!["admin", "facilitator"].includes(mode) || state.mode === mode || state.recoveryMode) {
    return;
  }

  clearPendingWorkspaceAction(true);
  state.mode = mode;
  if (mode === "admin") {
    state.facilitatorAction = "sign_in";
  }
  clearMessage(dom.accessAuthMessage);
  applyMode();

  if (state.session && state.sessionProfile && getSessionSide() === state.mode) {
    void routeByCredential(state.session, "session", state.mode);
  }
}

function setFacilitatorAction(action) {
  if (state.mode !== "facilitator" || !["sign_in", "activate"].includes(action) || state.facilitatorAction === action || state.recoveryMode) {
    return;
  }

  clearPendingWorkspaceAction(true);
  state.facilitatorAction = action;
  clearMessage(dom.accessAuthMessage);
  applyMode();

  if (state.session && state.sessionProfile && getSessionSide() === "facilitator") {
    void routeByCredential(state.session, "session", "facilitator");
  }
}

function applyMode() {
  const copy = getActiveCopy();
  const isAdmin = state.mode === "admin";
  const isFacilitatorActivation = state.mode === "facilitator" && state.facilitatorAction === "activate";
  const isRecoveryMode = state.recoveryMode;
  const shouldShowFullName = !isRecoveryMode && (isAdmin || isFacilitatorActivation);
  const shouldShowConfirmPassword = isRecoveryMode || isFacilitatorActivation;

  dom.accessCardLabel.textContent = copy.label;
  dom.accessHeading.textContent = copy.heading;
  dom.accessNote.textContent = copy.note;
  dom.accessEmailInput.placeholder = copy.emailPlaceholder || "name@corexformer.com";
  dom.accessPrimaryModeSwitch?.classList.toggle("hidden", isRecoveryMode);
  dom.accessFullNameRow.classList.toggle("hidden", !shouldShowFullName);
  dom.accessPasswordRow.classList.toggle("hidden", false);
  dom.accessConfirmPasswordRow.classList.toggle("hidden", !shouldShowConfirmPassword);
  dom.facilitatorActionSwitch.classList.toggle("hidden", isRecoveryMode || state.mode !== "facilitator");
  dom.accessSignUpButton.classList.toggle("hidden", !isAdmin || isRecoveryMode);
  dom.accessForgotPasswordButton.classList.toggle(
    "hidden",
    isRecoveryMode || isFacilitatorActivation || Boolean(state.session && state.sessionProfile)
  );
  dom.accessCancelRecoveryButton.classList.toggle("hidden", !isRecoveryMode);
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
    if (isRecoveryMode) {
      setAuthState(copy.state);
    } else if (hasRoleMismatchSession()) {
      setAuthState(buildSessionMismatchState());
    } else if (state.session && state.sessionProfile) {
      setAuthState(buildSignedInState());
    } else {
      setAuthState(copy.state);
    }
  }

  setBusy(state.busy);
  renderSessionActionButton();
}

async function signIn() {
  if (state.recoveryMode) {
    await completePasswordRecovery();
    return;
  }

  if (state.mode === "facilitator" && state.facilitatorAction === "activate") {
    await activateFacilitatorAccount();
    return;
  }

  const email = dom.accessEmailInput.value.trim();
  const password = dom.accessPasswordInput.value;

  clearPendingWorkspaceAction(true);

  if (!email || !password) {
    showMessage(dom.accessAuthMessage, "Enter both email and password to sign in.", "error");
    return;
  }

  setBusy(true);
  clearMessage(dom.accessAuthMessage);
  showMessage(dom.accessAuthMessage, getActiveCopy().progress);
  setAuthState(getActiveCopy().authing);

  if (state.session) {
    window.COREXFORMER_STUDIO_AUTH?.clearSessionArtifacts();
    await state.supabase.auth.signOut();
    state.session = null;
    state.sessionProfile = null;
  }

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

async function sendPasswordReset() {
  const email = dom.accessEmailInput.value.trim().toLowerCase();

  clearPendingWorkspaceAction(true);

  if (!email) {
    showMessage(dom.accessAuthMessage, "Enter the studio email first, then use Forgot password.", "error");
    setAuthState("Waiting for the email address needed for password recovery.");
    return;
  }

  setBusy(true);
  showMessage(dom.accessAuthMessage, "Sending a secure password reset email...");
  setAuthState("Preparing your password reset link...");

  const { error } = await state.supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildRecoveryRedirectUrl()
  });

  setBusy(false);

  if (error) {
    if (isPasswordResetRateLimited(error)) {
      showMessage(
        dom.accessAuthMessage,
        "Too many password reset emails were requested recently. Use the newest reset email you already received, or wait a little before requesting another one.",
        "error"
      );
      setAuthState("Password reset email is temporarily paused because too many requests were sent.");
      return;
    }

    showMessage(dom.accessAuthMessage, error.message, "error");
    setAuthState("Password reset email could not be sent.");
    return;
  }

  showMessage(
    dom.accessAuthMessage,
    `If ${email} is approved for studio access, a secure password reset link has been sent there. Open the email and return through that link to set a new password.`,
    "success"
  );
  setAuthState("Password reset email sent. Open the secure link from your inbox.");
}

async function enterRecoveryMode(session) {
  clearPendingWorkspaceAction(true);
  state.recoveryRequested = true;
  state.recoveryMode = true;
  state.session = session || null;
  state.sessionProfile = null;

  if (session?.user?.email) {
    dom.accessEmailInput.value = session.user.email;
  }

  dom.accessFullNameInput.value = "";
  dom.accessPasswordInput.value = "";
  dom.accessConfirmPasswordInput.value = "";

  applyMode();
  clearMessage(dom.accessAuthMessage);
  showMessage(
    dom.accessAuthMessage,
    "Recovery link confirmed. Enter a new password below, then save it and sign in again.",
    "success"
  );
  setAuthState(ACCESS_COPY.recovery.state);
  renderSessionActionButton();
}

async function exitRecoveryMode() {
  clearPendingWorkspaceAction(true);
  state.recoveryRequested = false;
  state.recoveryMode = false;
  clearRecoveryFlagFromUrl();

  if (state.session) {
    window.COREXFORMER_STUDIO_AUTH?.clearSessionArtifacts();
    await state.supabase.auth.signOut({ scope: "local" });
  }

  state.session = null;
  state.sessionProfile = null;
  dom.accessPasswordInput.value = "";
  dom.accessConfirmPasswordInput.value = "";
  clearMessage(dom.accessAuthMessage);
  applyRequestedMode();
  applyMode();
  setAuthState(getActiveCopy().state);
}

async function completePasswordRecovery() {
  const password = dom.accessPasswordInput.value;
  const confirmPassword = dom.accessConfirmPasswordInput.value;

  if (!state.session) {
    clearPendingWorkspaceAction(true);
    showMessage(dom.accessAuthMessage, ACCESS_COPY.recovery.invalid, "error");
    setAuthState("Recovery session is no longer active. Request a fresh password reset email.");
    return;
  }

  if (!password || !confirmPassword) {
    showMessage(dom.accessAuthMessage, "Enter and confirm the new password before saving it.", "error");
    setAuthState("Waiting for the new password and confirmation.");
    return;
  }

  if (password.length < 8) {
    showMessage(dom.accessAuthMessage, "Use a password with at least 8 characters.", "error");
    setAuthState("The new password needs at least 8 characters.");
    return;
  }

  if (password !== confirmPassword) {
    showMessage(dom.accessAuthMessage, "The password confirmation does not match yet.", "error");
    setAuthState("The new password and confirmation need to match.");
    return;
  }

  setBusy(true);
  showMessage(dom.accessAuthMessage, ACCESS_COPY.recovery.progress);
  setAuthState("Saving the new password...");

  const { error } = await state.supabase.auth.updateUser({
    password
  });

  setBusy(false);

  if (error) {
    showMessage(dom.accessAuthMessage, error.message, "error");
    setAuthState("The new password could not be saved yet.");
    return;
  }

  window.COREXFORMER_STUDIO_AUTH?.setNotice?.("Password updated. Sign in with your new password.");
  window.COREXFORMER_STUDIO_AUTH?.clearSessionArtifacts();

  try {
    await state.supabase.auth.signOut({ scope: "local" });
  } catch (_error) {
    // Redirecting back to sign-in is still safe even if local sign-out throws.
  }

  state.recoveryRequested = false;
  state.recoveryMode = false;
  window.location.replace(buildPostRecoveryUrl());
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

  clearPendingWorkspaceAction(true);

  if (!email || !password) {
    showMessage(dom.accessAuthMessage, "Enter an email and password before creating the first owner account.", "error");
    return;
  }

  setBusy(true);
  showMessage(dom.accessAuthMessage, "Creating the first owner account...");
  setAuthState("Creating the admin account...");

  if (state.session) {
    window.COREXFORMER_STUDIO_AUTH?.clearSessionArtifacts();
    await state.supabase.auth.signOut();
    state.session = null;
    state.sessionProfile = null;
  }

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

  clearPendingWorkspaceAction(true);

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

  if (state.session) {
    window.COREXFORMER_STUDIO_AUTH?.clearSessionArtifacts();
    await state.supabase.auth.signOut();
    state.session = null;
    state.sessionProfile = null;
  }

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
  state.session = session;
  state.sessionProfile = profile;
  const isAdmin = Boolean((profile && ADMIN_ROLES.includes(profile.role)) || (!profile && source === "admin-signup"));
  const isFacilitator = Boolean(profile && FACILITATOR_ROLES.includes(profile.role));

  if (isAdmin) {
    if (attemptedMode === "facilitator") {
      await resolveRoleMismatch("admin");
      return;
    }

    showMessage(
      dom.accessAuthMessage,
      ACCESS_COPY.admin.success
    );
    presentWorkspaceEntry("admin");
    return;
  }

  if (!isFacilitator) {
    clearPendingWorkspaceAction(true);
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

  if (attemptedMode === "admin") {
    await resolveRoleMismatch("facilitator");
    return;
  }

  showMessage(
    dom.accessAuthMessage,
    getFacilitatorCopy().success
  );
  presentWorkspaceEntry("facilitator");
}

function getActiveCopy() {
  if (state.recoveryMode) {
    return ACCESS_COPY.recovery;
  }

  if (state.mode === "facilitator") {
    return getFacilitatorCopy();
  }

  return ACCESS_COPY.admin;
}

function getFacilitatorCopy() {
  return ACCESS_COPY.facilitator[state.facilitatorAction] || ACCESS_COPY.facilitator.sign_in;
}

function applyRequestedMode() {
  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get("mode");
  const requestedAction = params.get("action");
  state.recoveryRequested = isRecoveryRequestFromUrl();
  state.recoveryMode = false;

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

async function handleExistingSession(session) {
  clearPendingWorkspaceAction();
  state.session = session;
  state.sessionProfile = await waitForProfile(session.user.id);

  if (!state.sessionProfile) {
    showMessage(dom.accessAuthMessage, "A session exists, but the studio profile is not ready yet. Sign out and try again in a moment.", "error");
    setAuthState("Signed in, but the studio profile is not ready yet.");
    renderSessionActionButton();
    return;
  }

  const sessionSide = getSessionSide();

  if (sessionSide === state.mode) {
    presentWorkspaceEntry(sessionSide);
    return;
  }

  showMessage(
    dom.accessAuthMessage,
    `You are already signed in as ${state.sessionProfile.email} on the ${humanizeSessionSide(sessionSide)} side. Sign out current session to switch accounts, or use that side directly.`,
    "success"
  );
  setAuthState(buildSessionMismatchState());
  renderSessionActionButton();
}

function presentWorkspaceEntry(side) {
  const config = window.COREXFORMER_STUDIO_CONFIG || {};
  const workspace = side === "facilitator" ? "facilitator" : "admin";
  const facilitatorParams = new URLSearchParams();
  facilitatorParams.set("handoff", "1");
  const targetUrl = workspace === "facilitator"
    ? buildWorkspaceRedirectUrl(config.facilitatorWorkspacePath || "/studio/facilitator", facilitatorParams)
    : buildWorkspaceRedirectUrl(
      config.adminWorkspacePath || "/studio/admin",
      getRequestedAdminWorkspaceParams(true)
    );

  state.pendingWorkspaceUrl = targetUrl;
  state.pendingWorkspaceLabel = workspace;
  state.ignoreEmptySessionUntil = Date.now() + 15 * 1000;
  window.COREXFORMER_STUDIO_AUTH?.setPendingWorkspaceHandoff?.({
    workspace,
    url: targetUrl,
      ttlMs: 20 * 1000
  });
  renderSessionActionButton();
  showMessage(dom.accessAuthMessage, `Access confirmed. Opening the ${humanizeWorkspaceLabel(workspace)}...`, "success");
  setAuthState(`Signed in as ${state.sessionProfile?.email || "this user"}. Opening the ${humanizeWorkspaceLabel(workspace)}...`);
  void beginWorkspaceHandoff(workspace, targetUrl);
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
  dom.accessFullNameInput.disabled = isBusy || state.recoveryMode;
  dom.accessEmailInput.disabled = isBusy || state.recoveryMode;
  dom.accessPasswordInput.disabled = isBusy;
  dom.accessConfirmPasswordInput.disabled = isBusy || dom.accessConfirmPasswordRow.classList.contains("hidden");
  dom.accessSignInButton.disabled = isBusy;
  dom.accessSignUpButton.disabled = isBusy || state.mode !== "admin" || state.recoveryMode;
  dom.accessForgotPasswordButton.disabled = isBusy;
  dom.accessCancelRecoveryButton.disabled = isBusy;
  dom.accessSessionActionButton.disabled = isBusy;
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

async function signOutCurrentSession() {
  if (!state.session) {
    clearMessage(dom.accessAuthMessage);
    setAuthState(getActiveCopy().state);
    renderSessionActionButton();
    return;
  }

  setBusy(true);
  window.COREXFORMER_STUDIO_AUTH?.clearSessionArtifacts();
  const { error } = await state.supabase.auth.signOut();
  setBusy(false);

  if (error) {
    showMessage(dom.accessAuthMessage, error.message, "error");
    return;
  }

  state.session = null;
  state.sessionProfile = null;
  state.recoveryMode = false;
  state.recoveryRequested = false;
  dom.accessPasswordInput.value = "";
  dom.accessConfirmPasswordInput.value = "";
  clearRecoveryFlagFromUrl();
  clearMessage(dom.accessAuthMessage);
  applyRequestedMode();
  applyMode();
  setAuthState(getActiveCopy().state);
  renderSessionActionButton();
}

async function resolveRoleMismatch(correctSide) {
  if (state.session) {
    window.COREXFORMER_STUDIO_AUTH?.clearSessionArtifacts();
    await state.supabase.auth.signOut();
  }

  state.session = null;
  state.sessionProfile = null;
  dom.accessPasswordInput.value = "";

  if (correctSide === "admin") {
    state.mode = "admin";
    state.facilitatorAction = "sign_in";
    applyMode();
    showMessage(dom.accessAuthMessage, "These credentials belong to admin access. Use the Admin tab to continue.", "error");
    setAuthState("This account is for the admin side. Choose Admin and sign in there.");
    return;
  }

  state.mode = "facilitator";
  state.facilitatorAction = "sign_in";
  applyMode();
  showMessage(dom.accessAuthMessage, "These credentials belong to facilitator access. Use the Facilitator tab to continue.", "error");
  setAuthState("This account is for the facilitator side. Choose Facilitator and sign in there.");
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

function isPasswordResetRateLimited(error) {
  if (!error) {
    return false;
  }

  return error.status === 429 || /rate limit/i.test(error.message || "");
}

function getSessionSide() {
  if (!state.sessionProfile?.role) {
    return "unknown";
  }

  if (ADMIN_ROLES.includes(state.sessionProfile.role)) {
    return "admin";
  }

  if (FACILITATOR_ROLES.includes(state.sessionProfile.role)) {
    return "facilitator";
  }

  return "unknown";
}

function hasRoleMismatchSession() {
  return Boolean(state.session && state.sessionProfile && getSessionSide() !== "unknown" && getSessionSide() !== state.mode);
}

function buildSessionMismatchState() {
  return `Already signed in as ${state.sessionProfile?.email || "this user"} on the ${humanizeSessionSide(getSessionSide())} side. Sign out current session to switch roles or accounts.`;
}

function buildSignedInState() {
  return `Already signed in as ${state.sessionProfile?.email || "this user"}. Redirecting to the ${humanizeSessionSide(getSessionSide())} workspace...`;
}

function humanizeSessionSide(side) {
  if (side === "admin") {
    return "admin";
  }

  if (side === "facilitator") {
    return "facilitator";
  }

  return "private studio";
}

function renderSessionActionButton() {
  const hasSession = Boolean(state.session && state.sessionProfile) && !state.recoveryMode;
  const hasPendingWorkspace = Boolean(state.pendingWorkspaceUrl);
  dom.accessSessionActionButton.classList.toggle("hidden", !hasPendingWorkspace && !hasSession);

  if (hasPendingWorkspace) {
    dom.accessSessionActionButton.textContent = `Open ${humanizeWorkspaceLabel(state.pendingWorkspaceLabel)} now`;
    return;
  }

  dom.accessSessionActionButton.textContent = "Sign out current session";
}

function buildRecoveryRedirectUrl() {
  const config = window.COREXFORMER_STUDIO_CONFIG || {};
  const publicOrigin = resolvePublicStudioOrigin(config.publicSiteUrl);
  const url = new URL(resolveStudioAccessEntryPath(config.studioAccessPath), ensureTrailingSlash(publicOrigin));
  url.searchParams.set("mode", state.mode);
  url.searchParams.set("recovery", "1");
  return url.toString();
}

function buildPostRecoveryUrl() {
  const config = window.COREXFORMER_STUDIO_CONFIG || {};
  const requestedMode = state.mode === "facilitator" ? "facilitator" : "admin";
  const publicOrigin = resolvePublicStudioOrigin(config.publicSiteUrl);
  const url = new URL(resolveStudioAccessEntryPath(config.studioAccessPath), ensureTrailingSlash(publicOrigin));
  url.searchParams.set("mode", requestedMode);
  return url.toString();
}

function clearRecoveryFlagFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("recovery")) {
    return;
  }

  params.delete("recovery");
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function resolvePublicStudioOrigin(configuredOrigin) {
  const currentOrigin = window.location.origin;

  if (currentOrigin && currentOrigin !== "null" && !isLocalPreviewOrigin(currentOrigin)) {
    return currentOrigin;
  }

  if (configuredOrigin) {
    return configuredOrigin;
  }

  return "https://corexformer.pages.dev";
}

function resolveStudioAccessEntryPath(studioAccessPath) {
  const normalizedPath = studioAccessPath || "/studio/";

  if (/index\.html(?:$|\?)/i.test(normalizedPath)) {
    return normalizedPath;
  }

  return normalizedPath.endsWith("/") ? `${normalizedPath}index.html` : normalizedPath;
}

function getRequestedAdminWorkspaceParams(includeHandoff = false) {
  const params = new URLSearchParams(window.location.search);
  const nextParams = new URLSearchParams();
  const requestedModule = normalizeValue(params.get("module"));
  const requestedView = normalizeValue(params.get("view"));

  if (includeHandoff) {
    nextParams.set("handoff", "1");
  }

  if (requestedModule) {
    nextParams.set("module", requestedModule);
  }

  if (requestedView) {
    nextParams.set("view", requestedView);
  }

  return nextParams;
}

function buildWorkspaceRedirectUrl(workspacePath, extraParams = null) {
  const config = window.COREXFORMER_STUDIO_CONFIG || {};
  const runtimeOrigin = resolveRuntimeStudioOrigin(config.publicSiteUrl);
  const url = new URL(workspacePath || "/studio/", ensureTrailingSlash(runtimeOrigin));

  if (extraParams && typeof extraParams.forEach === "function") {
    extraParams.forEach((value, key) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
  }

  return url.toString();
}

async function beginWorkspaceHandoff(workspace, targetUrl) {
  if (!targetUrl) {
    return;
  }

  state.pendingWorkspaceUrl = String(targetUrl);
  state.pendingWorkspaceLabel = workspace;
  window.COREXFORMER_STUDIO_AUTH?.setPendingWorkspaceHandoff?.({
    workspace,
    url: state.pendingWorkspaceUrl,
    ttlMs: 20 * 1000
  });
  renderSessionActionButton();

  // Give the auth client a brief moment to flush the signed-in session before
  // we move into a new page that reads from the shared persisted session.
  await sleep(900);
  redirectToWorkspace(state.pendingWorkspaceUrl);

  window.setTimeout(() => {
    if (state.pendingWorkspaceUrl === targetUrl && isStudioAccessLocation()) {
      const workspaceLabel = humanizeWorkspaceLabel(workspace);
      showMessage(
        dom.accessAuthMessage,
        `Access confirmed. If this page does not move automatically, use Open ${workspaceLabel} now.`,
        "success"
      );
      setAuthState(`Access confirmed. Opening the ${workspaceLabel}...`);
      renderSessionActionButton();
    }
  }, 1400);
}

function redirectToWorkspace(url) {
  const targetUrl = String(url || "");

  if (!targetUrl) {
    return;
  }

  const attemptNavigation = (method = "replace") => {
    try {
      if (method === "assign" && typeof window.location.assign === "function") {
        window.location.assign(targetUrl);
        return true;
      }

      if (method === "open" && typeof window.open === "function") {
        window.open(targetUrl, "_self");
        return true;
      }

      if (typeof window.location.replace === "function") {
        window.location.replace(targetUrl);
        return true;
      }
    } catch (_error) {
      return false;
    }

    return false;
  };

  const stillOnStudioAccess = () => {
    try {
      const currentUrl = new URL(window.location.href);
      const target = new URL(targetUrl);

      if (currentUrl.href === target.href) {
        return false;
      }

      return /^\/studio\/?(?:index\.html)?$/i.test(currentUrl.pathname);
    } catch (_error) {
      return false;
    }
  };

  attemptNavigation("replace");

  window.setTimeout(() => {
    if (stillOnStudioAccess()) {
      attemptNavigation("assign");
    }
  }, 180);

  window.setTimeout(() => {
    if (stillOnStudioAccess()) {
      attemptNavigation("open");
    }
  }, 700);
}

function clearPendingWorkspaceAction(clearStored = false) {
  state.pendingWorkspaceUrl = "";
  state.pendingWorkspaceLabel = "";
  state.ignoreEmptySessionUntil = 0;

  if (clearStored) {
    window.COREXFORMER_STUDIO_AUTH?.clearPendingWorkspaceHandoff?.();
  }

  renderSessionActionButton();
}

function resolveRuntimeStudioOrigin(configuredOrigin) {
  const currentOrigin = window.location.origin;

  if (currentOrigin && currentOrigin !== "null") {
    return currentOrigin;
  }

  if (configuredOrigin) {
    return configuredOrigin;
  }

  return "https://corexformer.pages.dev";
}

function humanizeWorkspaceLabel(workspace) {
  return workspace === "facilitator" ? "facilitator workspace" : "admin workspace";
}

function isStudioAccessLocation() {
  try {
    return /^\/studio\/?(?:index\.html)?$/i.test(window.location.pathname);
  } catch (_error) {
    return false;
  }
}

function isRecoveryRequestFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return searchParams.get("recovery") === "1"
    || searchParams.get("type") === "recovery"
    || hashParams.get("type") === "recovery";
}

function normalizeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function isLocalPreviewOrigin(origin) {
  return /\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin);
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
