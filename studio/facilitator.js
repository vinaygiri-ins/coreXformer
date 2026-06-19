const ADMIN_ROLES = ["owner", "editor"];
const FACILITATOR_SIDE_ROLES = ["candidate", "facilitator", "facilitator_lead"];
const JOURNEY_STEPS = [
  {
    key: "profile",
    title: "Profile and identity",
    summary: "The facilitator completes their basic profile, location, and availability so the organization knows how to place them."
  },
  {
    key: "foundations",
    title: "CoreXformer foundations",
    summary: "The facilitator understands safe space, reflection language, and what responsible facilitation means here."
  },
  {
    key: "product_path",
    title: "Product familiarization",
    summary: "The facilitator starts mapping which products they are interested in, shadowing, or approved for."
  },
  {
    key: "shadowing",
    title: "Shadowing and guided practice",
    summary: "The facilitator begins learning through supported observation, co-facilitation, or supervised delivery."
  },
  {
    key: "approval",
    title: "Approval into live work",
    summary: "The facilitator becomes approved and then active for selected products and real session assignments."
  }
];

const FOUNDATION_POINTS = [
  "Hold a safe, non-judgmental space before trying to extract learning.",
  "Let reflection grow from the participant's own experience rather than forcing conclusions.",
  "Notice emotions, behavior, and group patterns without shaming or rushing people.",
  "Treat every product as a living practice that can deepen through field learning.",
  "Care for the objective, the people, and the integrity of the process at the same time."
];

const dom = {
  signOutButton: document.getElementById("signOutButton"),
  authMessage: document.getElementById("authMessage"),
  authState: document.getElementById("authState"),
  workspaceContent: document.getElementById("facilitatorWorkspaceContent"),
  facilitatorContextWrap: document.getElementById("facilitatorContextWrap"),
  facilitatorContextSelect: document.getElementById("facilitatorContextSelect"),
  facilitatorIdentity: document.getElementById("facilitatorIdentity"),
  candidateWelcomeSection: document.getElementById("candidateWelcomeSection"),
  candidateWelcomeCard: document.getElementById("candidateWelcomeCard"),
  candidateAccessMap: document.getElementById("candidateAccessMap"),
  journeyTabButton: document.getElementById("journeyTabButton"),
  workTabButton: document.getElementById("workTabButton"),
  journeySection: document.getElementById("journeySection"),
  workSection: document.getElementById("workSection"),
  journeyStats: document.getElementById("journeyStats"),
  profileDetails: document.getElementById("profileDetails"),
  onboardingChecklist: document.getElementById("onboardingChecklist"),
  productPathGrid: document.getElementById("productPathGrid"),
  journeyNextStep: document.getElementById("journeyNextStep"),
  candidateActionPlanPanel: document.getElementById("candidateActionPlanPanel"),
  candidateActionPlan: document.getElementById("candidateActionPlan"),
  workStats: document.getElementById("workStats"),
  sessionBriefCard: document.getElementById("sessionBriefCard"),
  sessionBriefEmptyState: document.getElementById("sessionBriefEmptyState"),
  sessionList: document.getElementById("sessionList"),
  sessionListEmptyState: document.getElementById("sessionListEmptyState"),
  productNotesList: document.getElementById("productNotesList"),
  productNotesEmptyState: document.getElementById("productNotesEmptyState"),
  collaborationStatusNote: document.getElementById("collaborationStatusNote"),
  collaborationSummary: document.getElementById("collaborationSummary"),
  collaborationSummaryEmptyState: document.getElementById("collaborationSummaryEmptyState"),
  commonsList: document.getElementById("commonsList"),
  commonsEmptyState: document.getElementById("commonsEmptyState"),
  workspaceMessage: document.getElementById("workspaceMessage")
};

const state = {
  supabase: null,
  session: null,
  profile: null,
  facilitatorProfiles: [],
  selectedFacilitatorId: "",
  activeFacilitator: null,
  productLinks: [],
  sessionAssignments: [],
  sessionRuns: [],
  productNotes: [],
  productThreads: [],
  sessionPosts: [],
  commonsPosts: [],
  collaboration: {
    isAvailable: true,
    availabilityMessage: ""
  },
  view: "journey",
  busy: {
    auth: false,
    data: false
  }
};

document.addEventListener("DOMContentLoaded", () => {
  void initWorkspace();
});

async function initWorkspace() {
  bindEvents();

  const config = window.COREXFORMER_STUDIO_CONFIG;
  const supabaseLib = window.supabase;

  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !supabaseLib?.createClient) {
    showMessage(dom.authMessage, "Supabase configuration is missing. Add your project URL and publishable key to studio/config.js.", "error");
    setAuthState("Configuration missing. Add Supabase details to continue.");
    renderWorkspace();
    return;
  }

  state.supabase = window.COREXFORMER_STUDIO_AUTH?.createClient(config) || supabaseLib.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  await window.COREXFORMER_STUDIO_AUTH?.prepareSession(state.supabase);

  setAuthState("Connecting to Supabase...");

  const {
    data: { session },
    error
  } = await state.supabase.auth.getSession();

  if (error) {
    showMessage(dom.authMessage, error.message, "error");
    setAuthState("Supabase connected, but the session could not be loaded.");
  }

  await handleSession(session);

  state.supabase.auth.onAuthStateChange((_event, sessionUpdate) => {
    void handleSession(sessionUpdate);
  });
}

function bindEvents() {
  dom.signOutButton?.addEventListener("click", () => {
    void signOut();
  });

  dom.journeyTabButton?.addEventListener("click", () => {
    state.view = "journey";
    renderWorkspace();
  });

  dom.workTabButton?.addEventListener("click", () => {
    state.view = "work";
    renderWorkspace();
  });

  dom.facilitatorContextSelect?.addEventListener("change", () => {
    state.selectedFacilitatorId = dom.facilitatorContextSelect.value;
    clearMessage(dom.workspaceMessage);
    void loadWorkspaceData();
  });

  dom.sessionBriefCard?.addEventListener("click", (event) => {
    void handleSessionFeedbackCardAction(event);
  });

  dom.sessionList?.addEventListener("click", (event) => {
    void handleSessionFeedbackCardAction(event);
  });
}

async function handleSession(session) {
  state.session = session ?? null;
  state.profile = null;
  resetWorkspaceData();

  if (!state.session) {
    clearMessage(dom.workspaceMessage);
    clearMessage(dom.authMessage);
    setAuthState("Signed out. Redirecting you to private studio access...");
    if (!shouldStayOnFacilitatorWorkspace()) {
      window.location.replace(buildAccessPath());
      return;
    }
    renderWorkspace();
    return;
  }

  setAuthState(`Signed in as ${state.session.user.email}. Loading the facilitator workspace...`);

  try {
    state.profile = await waitForProfile(state.session.user.id);

    if (!state.profile) {
      showMessage(dom.authMessage, "Your account exists, but the private workspace profile has not been created yet.", "error");
      setAuthState("Signed in, but the workspace profile is not ready yet.");
      renderWorkspace();
      return;
    }

    if (canAdminPreview() && !shouldStayOnFacilitatorWorkspace()) {
      setAuthState("This account belongs to the admin side. Redirecting to the admin workspace...");
      window.location.replace(window.COREXFORMER_STUDIO_CONFIG?.adminWorkspacePath || "/studio/admin.html");
      return;
    }

    if (!canAdminPreview() && !isFacilitatorSideRole()) {
      showMessage(dom.authMessage, "This account is not activated for the facilitator workspace yet. CoreXformer first moves people through review and onboarding before live facilitator access begins.", "error");
      setAuthState("Signed in, but facilitator access is not active for this account yet.");
      renderWorkspace();
      return;
    }

    await loadWorkspaceData();
    clearMessage(dom.authMessage);
    setAuthState(buildAuthSummary());
  } catch (error) {
    if (isFacilitatorWorkspaceActivationError(error)) {
      showMessage(
        dom.authMessage,
        "The facilitator-side backend access is not fully activated yet. CoreXformer still needs the facilitator access migration before this account can load its private records properly.",
        "error"
      );
      setAuthState("Signed in, but facilitator-side database access is still being activated.");
    } else {
      showMessage(dom.authMessage, error.message || "The facilitator workspace could not load its data yet.", "error");
      setAuthState("Signed in, but the facilitator workspace could not be loaded.");
    }
  }

  renderWorkspace();
}

async function waitForProfile(userId, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await state.supabase
      .from("profiles")
      .select("id, email, full_name, role, can_publish")
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

async function signOut() {
  window.COREXFORMER_STUDIO_AUTH?.clearSessionArtifacts();
  const { error } = await state.supabase.auth.signOut();

  if (error) {
    showMessage(dom.authMessage, error.message, "error");
    return;
  }

  showMessage(dom.authMessage, "Signed out successfully.");
  if (!shouldStayOnFacilitatorWorkspace()) {
    window.location.replace(buildAccessPath());
  }
}

async function loadWorkspaceData() {
  resetWorkspaceData();

  if (!state.session || !state.profile) {
    renderWorkspace();
    return;
  }

  setBusy("data", true);

  try {
    const facilitatorRows = await loadFacilitatorProfiles();
    state.facilitatorProfiles = facilitatorRows;
    state.selectedFacilitatorId = determineSelectedFacilitatorId();
    state.activeFacilitator = getSelectedFacilitator();

    if (!state.activeFacilitator) {
      showMessage(dom.workspaceMessage, canAdminPreview()
        ? "Create a facilitator record in the admin workspace to preview the facilitator side fully."
        : "No facilitator record is linked to this sign-in yet. An admin can connect or create one for this account.", "info");
      return;
    }

    const [linkResult, assignmentResult, noteResult] = await Promise.all([
      state.supabase
        .from("facilitator_product_links")
        .select("id, facilitator_id, product_slug, product_name, interest_status, delivery_role, can_lead_alone, can_cofacilitate, is_active_for_scheduling, internal_notes, updated_at")
        .eq("facilitator_id", state.activeFacilitator.id)
        .order("updated_at", { ascending: false }),
      state.supabase
        .from("session_facilitators")
        .select("id, session_run_id, facilitator_id, assignment_role, assignment_status, show_publicly, public_role_label, public_note, assigned_at")
        .eq("facilitator_id", state.activeFacilitator.id)
        .order("assigned_at", { ascending: false }),
      state.supabase
        .from("product_private_notes")
        .select("id, product_slug, product_name, note_title, note_body, note_scope")
        .eq("note_scope", "facilitator_and_admin")
    ]);

    if (linkResult.error) {
      throw linkResult.error;
    }

    if (assignmentResult.error) {
      throw assignmentResult.error;
    }

    if (noteResult.error) {
      throw noteResult.error;
    }

    state.productLinks = Array.isArray(linkResult.data) ? linkResult.data : [];

    const allowedProductSlugs = new Set(state.productLinks.map((link) => link.product_slug));
    state.productNotes = (Array.isArray(noteResult.data) ? noteResult.data : [])
      .filter((note) => allowedProductSlugs.has(note.product_slug));

    const assignments = Array.isArray(assignmentResult.data) ? assignmentResult.data : [];
    const sessionRunIds = assignments.map((row) => row.session_run_id).filter(Boolean);

    if (sessionRunIds.length) {
      const { data: sessionRunRows, error: sessionRunError } = await state.supabase
        .from("session_runs")
        .select("id, product_slug, product_name, organization_name, session_title, session_date, status")
        .in("id", sessionRunIds);

      if (sessionRunError) {
        throw sessionRunError;
      }

      state.sessionRuns = Array.isArray(sessionRunRows) ? sessionRunRows : [];
    }

    const sessionById = new Map(state.sessionRuns.map((sessionRun) => [sessionRun.id, sessionRun]));
    state.sessionAssignments = assignments
      .map((assignment) => ({
        ...assignment,
        sessionRun: sessionById.get(assignment.session_run_id) || null
      }))
      .sort(compareAssignments);

    await loadCollaborationSummaries(allowedProductSlugs, sessionRunIds);
    clearMessage(dom.workspaceMessage);
  } finally {
    setBusy("data", false);
  }
}

async function loadFacilitatorProfiles() {
  if (canAdminPreview()) {
    const { data, error } = await state.supabase
      .from("facilitators")
      .select("id, full_name, display_name, email, phone, base_location, public_bio_short, facilitator_status, availability_status")
      .order("full_name", { ascending: true });

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  const { data, error } = await state.supabase
    .from("facilitators")
    .select("id, full_name, display_name, email, phone, base_location, public_bio_short, facilitator_status, availability_status")
    .eq("email", state.session.user.email)
    .order("full_name", { ascending: true });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function loadCollaborationSummaries(allowedProductSlugs, sessionRunIds) {
  state.collaboration.isAvailable = true;
  state.collaboration.availabilityMessage = "";
  state.productThreads = [];
  state.sessionPosts = [];
  state.commonsPosts = [];

  const productSlugList = Array.from(allowedProductSlugs);

  try {
    const [threadResult, commonsResult, sessionPostResult] = await Promise.all([
      productSlugList.length
        ? state.supabase
          .from("product_discussion_threads")
          .select("id, product_slug, product_name, title, category, status, author_name, updated_at")
          .in("product_slug", productSlugList)
          .order("updated_at", { ascending: false })
          .limit(6)
        : Promise.resolve({ data: [], error: null }),
      state.supabase
        .from("facilitator_commons_posts")
        .select("id, post_type, title, body, is_pinned, author_name, updated_at")
        .eq("status", "active")
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(6),
      sessionRunIds.length
        ? state.supabase
          .from("session_room_posts")
          .select("id, session_run_id, post_type, title, body, author_name, updated_at")
          .in("session_run_id", sessionRunIds)
          .order("updated_at", { ascending: false })
          .limit(6)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (threadResult.error) {
      throw threadResult.error;
    }

    if (commonsResult.error) {
      throw commonsResult.error;
    }

    if (sessionPostResult.error) {
      throw sessionPostResult.error;
    }

    state.productThreads = Array.isArray(threadResult.data) ? threadResult.data : [];
    state.commonsPosts = Array.isArray(commonsResult.data) ? commonsResult.data : [];
    state.sessionPosts = Array.isArray(sessionPostResult.data) ? sessionPostResult.data : [];
  } catch (error) {
    if (isCollaborationWorkspaceMissingError(error)) {
      state.collaboration.isAvailable = false;
      state.collaboration.availabilityMessage = "The collaboration rooms are planned into the facilitator workspace, but the private collaboration database is not enabled yet.";
      return;
    }

    throw error;
  }
}

function renderWorkspace() {
  const signedIn = Boolean(state.session);
  const hasFacilitator = Boolean(state.activeFacilitator);
  const showJourney = state.view === "journey";
  const candidateView = isCandidateView();

  if (dom.workspaceContent) {
    dom.workspaceContent.classList.toggle("hidden", !signedIn);
  }

  dom.signOutButton.classList.toggle("hidden", !signedIn);
  dom.facilitatorContextWrap.classList.toggle("hidden", !signedIn || !canAdminPreview() || state.facilitatorProfiles.length <= 1);
  dom.candidateWelcomeSection.classList.toggle("hidden", !signedIn || !candidateView);
  dom.journeySection.classList.toggle("hidden", !showJourney);
  dom.workSection.classList.toggle("hidden", showJourney || candidateView);
  dom.journeyTabButton.classList.toggle("is-active", showJourney);
  dom.workTabButton.classList.toggle("is-active", !showJourney && !candidateView);
  dom.journeyTabButton.disabled = !signedIn;
  dom.workTabButton.disabled = !signedIn || candidateView;
  dom.workTabButton.textContent = candidateView ? "My Work (after approval)" : "My Work";

  renderFacilitatorContext();
  renderIdentity();
  renderCandidateWelcome();
  renderCandidateAccessMap();
  renderJourneyStats();
  renderProfileDetails();
  renderOnboardingChecklist();
  renderProductPath();
  renderJourneyNextStep();
  renderCandidateActionPlan();
  renderWorkStats();
  renderSessionBrief();
  renderSessionList();
  renderProductNotes();
  renderCollaborationSummary();
  renderCommonsFeed();

  if (!signedIn) {
    clearMessage(dom.workspaceMessage);
  } else if (signedIn && !hasFacilitator && !dom.workspaceMessage.textContent) {
    showMessage(dom.workspaceMessage, "Sign in complete. This workspace will become more useful once a facilitator record is connected to the account.", "info");
  }
}

function renderFacilitatorContext() {
  if (!dom.facilitatorContextSelect) {
    return;
  }

  const options = state.facilitatorProfiles.map((facilitator) => {
    const label = facilitator.display_name || facilitator.full_name || facilitator.email || "Unnamed facilitator";
    return `<option value="${facilitator.id}">${escapeHtml(label)}</option>`;
  });

  dom.facilitatorContextSelect.innerHTML = options.join("");
  dom.facilitatorContextSelect.value = state.selectedFacilitatorId || "";
}

function renderIdentity() {
  if (!state.session) {
    dom.facilitatorIdentity.innerHTML = `
      <h3>Private access only</h3>
      <p class="hero-text">Use the private studio access page first. This page becomes a workspace only after authentication succeeds.</p>
    `;
    return;
  }

  if (!state.activeFacilitator) {
    dom.facilitatorIdentity.innerHTML = `
      <h3>No facilitator record linked yet</h3>
      <p class="hero-text">This private account is signed in, but there is no matching facilitator record ready for preview or daily use yet.</p>
    `;
    return;
  }

  const name = escapeHtml(state.activeFacilitator.display_name || state.activeFacilitator.full_name || "Facilitator");
  const role = escapeHtml(humanizeFacilitatorStatus(state.activeFacilitator.facilitator_status));
  const location = escapeHtml(normalizeValue(state.activeFacilitator.base_location) || "Location not added yet");
  const email = escapeHtml(normalizeValue(state.activeFacilitator.email) || state.session.user.email || "Private email");
  const availability = escapeHtml(humanizeAvailability(state.activeFacilitator.availability_status));
  const bio = escapeHtml(normalizeValue(state.activeFacilitator.public_bio_short) || "No public-facing facilitator introduction has been written yet.");
  const rolePill = isCandidateView() ? "Candidate onboarding" : role;
  const bioCopy = isCandidateView()
    ? "This account is in the onboarding-side facilitator journey. The main focus right now is profile, foundations, and product-path readiness before live work expands."
    : bio;

  dom.facilitatorIdentity.innerHTML = `
    <div class="identity-stack">
      <p class="eyebrow">Active facilitator context</p>
      <h2>${name}</h2>
      <p class="identity-copy">${bioCopy}</p>
      <div class="identity-meta">
        <span class="status-pill">${rolePill}</span>
        <span class="status-pill">${availability}</span>
      </div>
      <div class="detail-list">
        <div class="detail-row"><strong>Email</strong><span>${email}</span></div>
        <div class="detail-row"><strong>Base</strong><span>${location}</span></div>
      </div>
    </div>
  `;
}

function renderCandidateWelcome() {
  if (!dom.candidateWelcomeCard) {
    return;
  }

  if (!state.session || !isCandidateView()) {
    dom.candidateWelcomeCard.innerHTML = "";
    return;
  }

  const name = escapeHtml(
    normalizeValue(state.activeFacilitator?.display_name)
    || normalizeValue(state.activeFacilitator?.full_name)
    || normalizeValue(state.profile?.full_name)
    || "Facilitator"
  );

  const nextStep = escapeHtml(getNextJourneyStepLabel());
  const actionCount = getCandidateActionItems().length;

  dom.candidateWelcomeCard.innerHTML = `
    <div class="candidate-welcome-copy">
      <p class="eyebrow">Welcome into onboarding</p>
      <h3>${name}, this stage is about readiness, not rush.</h3>
      <p>
        You are inside the private facilitator workspace as a candidate. Right now the goal is to complete your
        onboarding, understand how CoreXformer works, and begin a thoughtful product path before live delivery opens up.
      </p>
    </div>
    <div class="candidate-welcome-meta">
      <div class="candidate-mini-card">
        <span>Current role</span>
        <strong>Candidate</strong>
        <p>Private onboarding access is active.</p>
      </div>
      <div class="candidate-mini-card">
        <span>Next step</span>
        <strong>${nextStep}</strong>
        <p>The workspace is pointing you to the next most useful move.</p>
      </div>
      <div class="candidate-mini-card">
        <span>Action list</span>
        <strong>${escapeHtml(String(actionCount))} items</strong>
        <p>These are the clearest first actions for this stage.</p>
      </div>
    </div>
  `;
}

function renderCandidateAccessMap() {
  if (!dom.candidateAccessMap) {
    return;
  }

  if (!state.session || !isCandidateView()) {
    dom.candidateAccessMap.innerHTML = "";
    return;
  }

  const blocks = [
    {
      label: "Available now",
      state: "Open",
      copy: "My Journey, profile details, CoreXformer foundations, your first product path, and onboarding guidance."
    },
    {
      label: "Opens with shadowing",
      state: "Next",
      copy: "Product-specific notes, guided observation, product-room context, and supported learning from real sessions."
    },
    {
      label: "Opens after approval",
      state: "Later",
      copy: "My Work, session briefs, assignment timelines, delivery collaboration, and post-session reflection loops."
    }
  ];

  dom.candidateAccessMap.innerHTML = blocks.map((block) => `
    <article class="candidate-access-block">
      <div class="candidate-access-head">
        <h3>${escapeHtml(block.label)}</h3>
        <span class="status-pill">${escapeHtml(block.state)}</span>
      </div>
      <p>${escapeHtml(block.copy)}</p>
    </article>
  `).join("");
}

function renderJourneyStats() {
  const approvedCount = countLinksByStatus("approved");
  const shadowingCount = countLinksByStatus("shadowing");
  const nextStep = getNextJourneyStepLabel();
  const statusLabel = isCandidateView()
    ? "Candidate onboarding"
    : state.activeFacilitator
      ? humanizeFacilitatorStatus(state.activeFacilitator.facilitator_status)
      : "Waiting";

  dom.journeyStats.innerHTML = [
    renderMetricCard("Status", statusLabel, state.activeFacilitator ? "Current placement in the facilitator lifecycle." : "Sign in and connect a facilitator record first."),
    renderMetricCard("Availability", state.activeFacilitator ? humanizeAvailability(state.activeFacilitator.availability_status) : "Unknown", state.activeFacilitator ? "What scheduling currently looks like for this facilitator." : "Availability appears after the facilitator record is ready."),
    renderMetricCard("Approved products", String(approvedCount), approvedCount ? "Products this facilitator can currently hold with confidence." : "Approved product readiness will gather here."),
    renderMetricCard("Next step", nextStep, shadowingCount ? "The next growth move comes from current shadowing and approval signals." : "Use this to orient the facilitator toward their next development action.")
  ].join("");
}

function renderProfileDetails() {
  if (!state.activeFacilitator) {
    dom.profileDetails.innerHTML = `<div class="detail-row"><strong>Profile</strong><span>Waiting for facilitator record</span></div>`;
    return;
  }

  const details = [
    ["Full name", normalizeValue(state.activeFacilitator.full_name) || "Not added"],
    ["Display name", normalizeValue(state.activeFacilitator.display_name) || "Not added"],
    ["Email", normalizeValue(state.activeFacilitator.email) || "Not added"],
    ["Phone", normalizeValue(state.activeFacilitator.phone) || "Not added"],
    ["Base location", normalizeValue(state.activeFacilitator.base_location) || "Not added"],
    ["Availability", humanizeAvailability(state.activeFacilitator.availability_status)]
  ];

  dom.profileDetails.innerHTML = details
    .map(([label, value]) => `<div class="detail-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("");
}

function renderOnboardingChecklist() {
  const stepStates = buildJourneyStepStates();

  dom.onboardingChecklist.innerHTML = JOURNEY_STEPS.map((step) => {
    const stateLabel = stepStates[step.key];
    return `
      <article class="checklist-item checklist-item-${stateLabel}">
        <div class="checklist-head">
          <h3>${escapeHtml(step.title)}</h3>
          <span class="status-pill">${escapeHtml(humanizeChecklistState(stateLabel))}</span>
        </div>
        <p>${escapeHtml(step.summary)}</p>
      </article>
    `;
  }).concat(FOUNDATION_POINTS.map((point) => `
    <article class="foundation-item">
      <p>${escapeHtml(point)}</p>
    </article>
  `)).join("");
}

function renderProductPath() {
  const groups = [
    { key: "interested", label: "Interested" },
    { key: "shadowing", label: "Shadowing" },
    { key: "approved", label: "Approved" },
    { key: "lead-ready", label: "Lead-ready" }
  ];

  dom.productPathGrid.innerHTML = groups.map((group) => {
    const items = getProductPathItems(group.key);
    return `
      <div class="path-column">
        <div class="path-column-head">
          <h3>${escapeHtml(group.label)}</h3>
          <span>${items.length}</span>
        </div>
        ${items.length ? items.map((item) => `
          <article class="path-card">
            <h4>${escapeHtml(item.product_name || humanizeProductSlug(item.product_slug))}</h4>
            <p>${escapeHtml(buildProductPathMeta(item))}</p>
          </article>
        `).join("") : `<div class="empty-inline">Nothing in this lane yet.</div>`}
      </div>
    `;
  }).join("");
}

function renderJourneyNextStep() {
  dom.journeyNextStep.innerHTML = `
    <h3>Current next step</h3>
    <p>${escapeHtml(buildNextStepCopy())}</p>
  `;
}

function renderCandidateActionPlan() {
  if (!dom.candidateActionPlanPanel || !dom.candidateActionPlan) {
    return;
  }

  const candidateView = isCandidateView();
  dom.candidateActionPlanPanel.classList.toggle("hidden", !candidateView);

  if (!candidateView) {
    dom.candidateActionPlan.innerHTML = "";
    return;
  }

  const items = getCandidateActionItems();
  dom.candidateActionPlan.innerHTML = items.map((item) => `
    <article class="candidate-action-item">
      <div class="candidate-action-head">
        <h3>${escapeHtml(item.title)}</h3>
        <span class="status-pill">${escapeHtml(item.state)}</span>
      </div>
      <p>${escapeHtml(item.copy)}</p>
    </article>
  `).join("");
}

function renderWorkStats() {
  const upcoming = getUpcomingAssignments();
  const activeProducts = state.productLinks.filter((link) => link.is_active_for_scheduling).length;
  const leadRoles = state.productLinks.filter((link) => link.delivery_role === "lead_facilitator").length;
  const collaborationLabel = state.collaboration.isAvailable ? "Live" : "Staged";

  dom.workStats.innerHTML = [
    renderMetricCard("Upcoming sessions", String(upcoming.length), upcoming.length ? "Assigned work that still needs preparation or delivery attention." : "No live delivery work has been attached yet."),
    renderMetricCard("Active products", String(activeProducts), activeProducts ? "Products currently marked as schedulable for this facilitator." : "Scheduling-ready products will appear here."),
    renderMetricCard("Lead roles", String(leadRoles), leadRoles ? "Products this facilitator is positioned to hold as lead." : "Lead-ready roles will gather here over time."),
    renderMetricCard("Collaboration", collaborationLabel, state.collaboration.isAvailable ? "Private product and session collaboration can surface inside this workspace." : "The collaboration database still needs its live backend activation.")
  ].join("");
}

function renderSessionBrief() {
  const nextAssignment = getPrimaryAssignment();

  dom.sessionBriefCard.classList.toggle("hidden", !nextAssignment);
  dom.sessionBriefEmptyState.classList.toggle("hidden", Boolean(nextAssignment));

  if (!nextAssignment) {
    dom.sessionBriefCard.innerHTML = "";
    return;
  }

  const sessionRun = nextAssignment.sessionRun;
  const sessionTitle = normalizeValue(sessionRun?.session_title) || humanizeProductSlug(sessionRun?.product_slug || nextAssignment.product_slug);
  const organization = normalizeValue(sessionRun?.organization_name) || "Organization not added yet";
  const dateLabel = sessionRun?.session_date ? formatShortDateTime(new Date(sessionRun.session_date)) : "Date not added yet";

  dom.sessionBriefCard.innerHTML = `
    <div class="brief-head">
      <div>
        <p class="eyebrow">Closest session</p>
        <h3>${escapeHtml(sessionTitle)}</h3>
      </div>
      <span class="status-pill">${escapeHtml(humanizeAssignmentStatus(nextAssignment.assignment_status))}</span>
    </div>
    <div class="detail-list">
      <div class="detail-row"><strong>Product</strong><span>${escapeHtml(sessionRun?.product_name || humanizeProductSlug(sessionRun?.product_slug))}</span></div>
      <div class="detail-row"><strong>Organization</strong><span>${escapeHtml(organization)}</span></div>
      <div class="detail-row"><strong>Date and time</strong><span>${escapeHtml(dateLabel)}</span></div>
      <div class="detail-row"><strong>Role</strong><span>${escapeHtml(humanizeStudioRole(nextAssignment.assignment_role))}</span></div>
    </div>
    <p class="brief-copy">${escapeHtml(normalizeValue(nextAssignment.public_note) || "Once public or internal notes are added to this assignment, the session brief can start carrying them here.")}</p>
    ${renderSessionFeedbackActions(nextAssignment)}
  `;
}

function renderSessionList() {
  dom.sessionList.innerHTML = "";
  dom.sessionListEmptyState.classList.toggle("hidden", state.sessionAssignments.length > 0);

  state.sessionAssignments.forEach((assignment) => {
    const sessionRun = assignment.sessionRun;
    const article = document.createElement("article");
    article.className = "session-card";
    article.innerHTML = `
      <div class="session-card-head">
        <div>
          <h3>${escapeHtml(normalizeValue(sessionRun?.session_title) || humanizeProductSlug(sessionRun?.product_slug))}</h3>
          <p class="session-meta">${escapeHtml(buildSessionMeta(assignment))}</p>
        </div>
        <span class="status-pill">${escapeHtml(humanizeAssignmentStatus(assignment.assignment_status))}</span>
      </div>
      <p>${escapeHtml(normalizeValue(assignment.public_note) || "No facilitator-facing note has been attached to this assignment yet.")}</p>
      ${renderSessionFeedbackActions(assignment)}
    `;
    dom.sessionList.appendChild(article);
  });
}

function renderSessionFeedbackActions(assignment) {
  return `
    <div class="inline-action-group session-feedback-actions">
      <button type="button" class="button button-ghost" data-session-feedback-action="copy" data-assignment-id="${escapeHtml(assignment.id)}">Copy feedback link</button>
      <button type="button" class="button button-ghost" data-session-feedback-action="open" data-assignment-id="${escapeHtml(assignment.id)}">Open feedback form</button>
    </div>
    <p class="session-feedback-note">Use this after the session so participant responses stay attached to the correct batch.</p>
  `;
}

function renderProductNotes() {
  dom.productNotesList.innerHTML = "";
  dom.productNotesEmptyState.classList.toggle("hidden", state.productNotes.length > 0);

  state.productNotes.forEach((note) => {
    const article = document.createElement("article");
    article.className = "session-card";
    article.innerHTML = `
      <div class="session-card-head">
        <div>
          <h3>${escapeHtml(note.note_title || "Product note")}</h3>
          <p class="session-meta">${escapeHtml(note.product_name || humanizeProductSlug(note.product_slug))}</p>
        </div>
      </div>
      <p>${escapeHtml(note.note_body || "No note body yet.")}</p>
    `;
    dom.productNotesList.appendChild(article);
  });
}

function renderCollaborationSummary() {
  const cards = buildCollaborationCards();
  dom.collaborationSummary.innerHTML = "";
  dom.collaborationSummaryEmptyState.classList.toggle("hidden", cards.length > 0);
  dom.collaborationStatusNote.classList.toggle("hidden", state.collaboration.isAvailable);

  if (!state.collaboration.isAvailable) {
    dom.collaborationStatusNote.innerHTML = `
      <h3>Private collaboration is staged</h3>
      <p>${escapeHtml(state.collaboration.availabilityMessage)}</p>
    `;
  } else {
    dom.collaborationStatusNote.innerHTML = "";
  }

  cards.forEach((card) => {
    const article = document.createElement("article");
    article.className = "session-card";
    article.innerHTML = `
      <div class="session-card-head">
        <div>
          <h3>${escapeHtml(card.title)}</h3>
          <p class="session-meta">${escapeHtml(card.meta)}</p>
        </div>
        <span class="status-pill">${escapeHtml(card.tag)}</span>
      </div>
      <p>${escapeHtml(card.copy)}</p>
    `;
    dom.collaborationSummary.appendChild(article);
  });
}

function renderCommonsFeed() {
  dom.commonsList.innerHTML = "";
  dom.commonsEmptyState.classList.toggle("hidden", state.commonsPosts.length > 0);

  state.commonsPosts.forEach((post) => {
    const article = document.createElement("article");
    article.className = "session-card";
    article.innerHTML = `
      <div class="session-card-head">
        <div>
          <h3>${escapeHtml(post.title || "Facilitator update")}</h3>
          <p class="session-meta">${escapeHtml(buildCommonsMeta(post))}</p>
        </div>
        <span class="status-pill${post.is_pinned ? " status-live" : ""}">${escapeHtml(humanizeCommonsPostType(post.post_type))}</span>
      </div>
      <p>${escapeHtml(post.body || "No message yet.")}</p>
    `;
    dom.commonsList.appendChild(article);
  });
}

function resetWorkspaceData() {
  state.facilitatorProfiles = [];
  state.selectedFacilitatorId = "";
  state.activeFacilitator = null;
  state.productLinks = [];
  state.sessionAssignments = [];
  state.sessionRuns = [];
  state.productNotes = [];
  state.productThreads = [];
  state.sessionPosts = [];
  state.commonsPosts = [];
  state.collaboration.isAvailable = true;
  state.collaboration.availabilityMessage = "";
}

function determineSelectedFacilitatorId() {
  if (state.selectedFacilitatorId && state.facilitatorProfiles.some((facilitator) => facilitator.id === state.selectedFacilitatorId)) {
    return state.selectedFacilitatorId;
  }

  const emailMatch = state.facilitatorProfiles.find((facilitator) => normalizeValue(facilitator.email).toLowerCase() === normalizeValue(state.session?.user?.email).toLowerCase());

  if (emailMatch) {
    return emailMatch.id;
  }

  if (canAdminPreview()) {
    return state.facilitatorProfiles[0]?.id || "";
  }

  return "";
}

function getSelectedFacilitator() {
  if (!state.selectedFacilitatorId) {
    return null;
  }

  return state.facilitatorProfiles.find((facilitator) => facilitator.id === state.selectedFacilitatorId) || null;
}

function buildJourneyStepStates() {
  const hasProfile = Boolean(state.activeFacilitator && normalizeValue(state.activeFacilitator.full_name) && normalizeValue(state.activeFacilitator.email));
  const hasProductPath = state.productLinks.length > 0;
  const hasShadowing = countLinksByStatus("shadowing") > 0;
  const hasApproval = countLinksByStatus("approved") > 0;

  return {
    profile: hasProfile ? "done" : "current",
    foundations: hasProfile ? "current" : "upcoming",
    product_path: hasProductPath ? "done" : hasProfile ? "current" : "upcoming",
    shadowing: hasShadowing ? "done" : hasProductPath ? "current" : "upcoming",
    approval: hasApproval ? "done" : hasShadowing ? "current" : "upcoming"
  };
}

function getProductPathItems(groupKey) {
  switch (groupKey) {
    case "interested":
      return state.productLinks.filter((link) => link.interest_status === "interested" || link.interest_status === "under_review");
    case "shadowing":
      return state.productLinks.filter((link) => link.interest_status === "shadowing" || link.delivery_role === "shadow");
    case "approved":
      return state.productLinks.filter((link) => link.interest_status === "approved");
    case "lead-ready":
      return state.productLinks.filter((link) => link.interest_status === "approved" && link.can_lead_alone);
    default:
      return [];
  }
}

function countLinksByStatus(status) {
  return state.productLinks.filter((link) => link.interest_status === status).length;
}

function getNextJourneyStepLabel() {
  if (isCandidateView()) {
    return "Complete onboarding";
  }

  if (!state.activeFacilitator) {
    return "Create facilitator record";
  }

  if (!normalizeValue(state.activeFacilitator.base_location) || !normalizeValue(state.activeFacilitator.email)) {
    return "Complete profile";
  }

  if (!state.productLinks.length) {
    return "Choose products";
  }

  if (!countLinksByStatus("shadowing") && !countLinksByStatus("approved")) {
    return "Begin shadowing";
  }

  if (!countLinksByStatus("approved")) {
    return "Move into approval";
  }

  if (!getUpcomingAssignments().length) {
    return "Await assignment";
  }

  return "Prepare next session";
}

function buildNextStepCopy() {
  switch (getNextJourneyStepLabel()) {
    case "Complete onboarding":
      return "This account is in the candidate stage. The best use of the workspace right now is to complete profile details, understand CoreXformer foundations, and begin the first product path before live delivery expands.";
    case "Create facilitator record":
      return "An admin should first create the private facilitator record, because that is what anchors everything else in this workspace.";
    case "Complete profile":
      return "The next best move is to finish the personal record with location, contact, and availability so the organization can place this facilitator well.";
    case "Choose products":
      return "The facilitator now needs a first product path: what they are interested in, what they may shadow, and what might become their early area of strength.";
    case "Begin shadowing":
      return "The facilitator is ready to move from profile setup into supported product learning and field observation.";
    case "Move into approval":
      return "The facilitator already has product exposure. The next step is product-specific approval rather than one broad generic approval.";
    case "Await assignment":
      return "The facilitator has product approval in place. What comes next is the first clean session assignment with a structured brief.";
    default:
      return "The facilitator has live work ahead. This page should now help them prepare, collaborate, and learn from real delivery.";
  }
}

function getCandidateActionItems() {
  const items = [];
  const hasLocation = Boolean(normalizeValue(state.activeFacilitator?.base_location));
  const hasPhone = Boolean(normalizeValue(state.activeFacilitator?.phone));
  const hasProducts = state.productLinks.length > 0;
  const hasShadowing = countLinksByStatus("shadowing") > 0;
  const hasApproval = countLinksByStatus("approved") > 0;

  items.push({
    title: hasLocation && hasPhone ? "Profile basics are in place" : "Complete your personal record",
    state: hasLocation && hasPhone ? "In place" : "Current",
    copy: hasLocation && hasPhone
      ? "Your base location and contact details are already present, so the organization can place you more accurately."
      : "Make sure your location, phone, and availability details are complete. That gives CoreXformer enough context to place you well."
  });

  items.push({
    title: "Read the CoreXformer foundations closely",
    state: "Current",
    copy: "This is the right time to understand safe space, reflection language, and how facilitation here is meant to feel before you try to hold a group."
  });

  items.push({
    title: hasProducts ? "Deepen your first product lane" : "Choose your first product lane",
    state: hasProducts ? "In motion" : "Next",
    copy: hasProducts
      ? "You already have an early product path. Use this stage to understand where you are only interested, where you may shadow, and where you could grow into real readiness."
      : "Pick the first products you want to learn through. A clear first lane is more helpful than trying to hold every product at once."
  });

  items.push({
    title: hasShadowing ? "Shadowing has started" : "Move toward shadowing",
    state: hasShadowing ? "In place" : "Later",
    copy: hasShadowing
      ? "Once shadowing is visible here, this workspace can start connecting you to real delivery context in a guided way."
      : "After the first product path is clear, the next meaningful step is supported observation or co-facilitation rather than immediate full delivery."
  });

  items.push({
    title: hasApproval ? "Approval is beginning to open" : "Work access opens after approval",
    state: hasApproval ? "Emerging" : "Later",
    copy: hasApproval
      ? "As product approvals gather, the My Work side will start becoming more useful with live assignments and session preparation."
      : "Your operations side stays intentionally quiet until product-specific approval exists. That keeps the workspace calm and prevents premature overload."
  });

  return items;
}

function getUpcomingAssignments() {
  return state.sessionAssignments.filter((assignment) => {
    const date = assignment.sessionRun?.session_date ? new Date(assignment.sessionRun.session_date) : null;
    return date && !Number.isNaN(date.getTime()) && date.getTime() >= Date.now() && assignment.assignment_status !== "cancelled";
  });
}

function getPrimaryAssignment() {
  const upcoming = getUpcomingAssignments();

  if (upcoming.length) {
    return upcoming.sort(compareAssignments)[0];
  }

  return state.sessionAssignments[0] || null;
}

function buildProductPathMeta(item) {
  const role = humanizeStudioRole(item.delivery_role);
  const scheduling = item.is_active_for_scheduling ? "Scheduling active" : "Not active for scheduling";
  return `${role} · ${scheduling}`;
}

function buildSessionMeta(assignment) {
  const parts = [];
  const sessionRun = assignment.sessionRun;

  if (normalizeValue(sessionRun?.organization_name)) {
    parts.push(sessionRun.organization_name);
  }

  if (sessionRun?.session_date) {
    parts.push(formatShortDateTime(new Date(sessionRun.session_date)));
  }

  parts.push(humanizeStudioRole(assignment.assignment_role));
  return parts.join(" · ");
}

async function handleSessionFeedbackCardAction(event) {
  const actionButton = event.target.closest("[data-session-feedback-action]");

  if (!actionButton) {
    return;
  }

  const assignmentId = normalizeValue(actionButton.dataset.assignmentId);
  const action = normalizeValue(actionButton.dataset.sessionFeedbackAction);
  const assignment = state.sessionAssignments.find((item) => item.id === assignmentId);

  if (!assignment) {
    showMessage(dom.workspaceMessage, "This session could not be matched right now. Refresh the workspace and try again.", "error");
    return;
  }

  const feedbackUrl = buildSessionFeedbackUrl(assignment);

  if (!feedbackUrl) {
    showMessage(dom.workspaceMessage, "This session does not yet have enough detail to build a feedback route.", "error");
    return;
  }

  try {
    if (action === "open") {
      window.open(feedbackUrl, "_blank", "noopener,noreferrer");
      showMessage(dom.workspaceMessage, "The feedback form opened in a new tab for this session.", "success");
      return;
    }

    await copyTextForFacilitator(feedbackUrl);
    showMessage(dom.workspaceMessage, "The session feedback link is copied. Share it with participants after the batch ends.", "success");
  } catch (error) {
    showMessage(dom.workspaceMessage, "The feedback link could not be prepared right now. Please try again in a moment.", "error");
    console.warn("CoreXformer facilitator feedback link action failed.", error);
  }
}

function buildSessionFeedbackUrl(assignment) {
  const sessionRun = assignment.sessionRun;

  if (!sessionRun) {
    return "";
  }

  const url = new URL("feedback.html", ensureFacilitatorTrailingSlash(resolveFacilitatorPublicOrigin()));
  const sessionTitle = normalizeValue(sessionRun.session_title) || humanizeProductSlug(sessionRun.product_slug || assignment.product_slug);
  const organizationName = normalizeValue(sessionRun.organization_name);
  const facilitatorName = normalizeValue(state.activeFacilitator?.display_name)
    || normalizeValue(state.activeFacilitator?.full_name)
    || normalizeValue(state.profile?.full_name);

  url.searchParams.set("view", "submit");
  url.searchParams.set("sessionRunId", sessionRun.id);

  if (normalizeValue(sessionRun.product_slug || assignment.product_slug)) {
    url.searchParams.set("productSlug", normalizeValue(sessionRun.product_slug || assignment.product_slug));
  }

  if (normalizeValue(sessionRun.product_name || assignment.product_name)) {
    url.searchParams.set("productName", normalizeValue(sessionRun.product_name || assignment.product_name));
  }

  if (sessionTitle) {
    url.searchParams.set("sessionTitle", sessionTitle);
  }

  if (organizationName) {
    url.searchParams.set("organizationName", organizationName);
  }

  if (facilitatorName) {
    url.searchParams.set("facilitatorName", facilitatorName);
  }

  if (sessionRun.session_date) {
    url.searchParams.set("sessionDate", normalizeFacilitatorDateParam(sessionRun.session_date));
  }

  return url.toString();
}

function resolveFacilitatorPublicOrigin() {
  const configuredOrigin = window.COREXFORMER_STUDIO_CONFIG?.publicSiteUrl;
  const currentOrigin = window.location.origin;

  if (currentOrigin && currentOrigin !== "null" && !/\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(currentOrigin)) {
    return currentOrigin;
  }

  if (configuredOrigin) {
    return configuredOrigin;
  }

  return "https://corexformer.pages.dev";
}

function ensureFacilitatorTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeFacilitatorDateParam(value) {
  const normalized = normalizeValue(value);

  if (!normalized) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return date.toISOString().slice(0, 10);
}

function buildCollaborationCards() {
  const cards = [];

  state.productThreads.forEach((thread) => {
    cards.push({
      title: thread.title || thread.product_name || "Product discussion",
      meta: `${thread.product_name || humanizeProductSlug(thread.product_slug)} · ${humanizeProductThreadCategory(thread.category)} · ${formatShortDateTime(new Date(thread.updated_at))}`,
      tag: humanizeProductThreadStatus(thread.status),
      copy: normalizeValue(thread.author_name) ? `Latest update by ${thread.author_name}.` : "Latest update from the CoreXformer team."
    });
  });

  state.sessionPosts.forEach((post) => {
    const relatedAssignment = state.sessionAssignments.find((assignment) => assignment.session_run_id === post.session_run_id);
    const sessionLabel = normalizeValue(relatedAssignment?.sessionRun?.session_title) || "Session room";
    cards.push({
      title: post.title || sessionLabel,
      meta: `${sessionLabel} · ${humanizeSessionPostType(post.post_type)} · ${formatShortDateTime(new Date(post.updated_at))}`,
      tag: humanizeSessionPostType(post.post_type),
      copy: normalizeValue(post.body) || "Session-room note available."
    });
  });

  return cards.slice(0, 8);
}

function buildCommonsMeta(post) {
  const parts = [];

  if (post.is_pinned) {
    parts.push("Pinned");
  }

  if (normalizeValue(post.author_name)) {
    parts.push(post.author_name);
  }

  if (post.updated_at) {
    parts.push(formatShortDateTime(new Date(post.updated_at)));
  }

  return parts.join(" · ");
}

function compareAssignments(left, right) {
  const leftTime = left.sessionRun?.session_date ? new Date(left.sessionRun.session_date).getTime() : Number.POSITIVE_INFINITY;
  const rightTime = right.sessionRun?.session_date ? new Date(right.sessionRun.session_date).getTime() : Number.POSITIVE_INFINITY;
  return leftTime - rightTime;
}

function canAdminPreview() {
  return Boolean(state.session && state.profile && ADMIN_ROLES.includes(state.profile.role));
}

function isFacilitatorSideRole() {
  return Boolean(state.session && state.profile && FACILITATOR_SIDE_ROLES.includes(state.profile.role));
}

function isCandidateView() {
  return Boolean(state.session && state.profile && state.profile.role === "candidate");
}

function shouldStayOnFacilitatorWorkspace() {
  const params = new URLSearchParams(window.location.search);
  return params.get("preview") === "1";
}

function buildAccessPath() {
  const basePath = window.COREXFORMER_STUDIO_CONFIG?.studioAccessPath || "/studio/";
  return `${basePath}?mode=facilitator`;
}

function buildAuthSummary() {
  if (!state.profile) {
    return "Signed in, but the profile is still loading.";
  }

  const role = state.profile.role || "viewer";
  const preview = canAdminPreview() ? "Admin preview enabled." : "Facilitator-side view only.";
  const name = state.profile.full_name ? `${state.profile.full_name} · ` : "";
  return `${name}${state.profile.email} · ${role.toUpperCase()} · ${preview}`;
}

function setAuthState(text) {
  dom.authState.querySelector("span").textContent = text;
}

function setBusy(scope, isBusy) {
  state.busy[scope] = isBusy;
  renderWorkspace();
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

async function copyTextForFacilitator(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "true");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  helper.style.pointerEvents = "none";
  document.body.appendChild(helper);
  helper.select();
  helper.setSelectionRange(0, helper.value.length);

  const copied = document.execCommand("copy");
  document.body.removeChild(helper);

  if (!copied) {
    throw new Error("Clipboard copy failed.");
  }
}

function renderMetricCard(label, value, copy) {
  return `
    <div class="pipeline-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(copy)}</p>
    </div>
  `;
}

function humanizeChecklistState(stateKey) {
  switch (stateKey) {
    case "done":
      return "In place";
    case "current":
      return "Current";
    default:
      return "Next";
  }
}

function humanizeFacilitatorStatus(status) {
  switch (status) {
    case "applied":
      return "Applied";
    case "screening":
      return "Screening";
    case "shadowing":
      return "Shadowing";
    case "approved":
      return "Approved";
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    default:
      return "Waiting";
  }
}

function humanizeAvailability(status) {
  switch (status) {
    case "available":
      return "Available";
    case "limited":
      return "Limited";
    case "unavailable":
      return "Unavailable";
    default:
      return "Unknown";
  }
}

function humanizeStudioRole(role) {
  switch (role) {
    case "lead_facilitator":
      return "Lead facilitator";
    case "co_facilitator":
      return "Co-facilitator";
    case "shadow":
      return "Shadow facilitator";
    default:
      return "Facilitator";
  }
}

function humanizeAssignmentStatus(status) {
  switch (status) {
    case "assigned":
      return "Assigned";
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Assigned";
  }
}

function humanizeSessionPostType(type) {
  switch (type) {
    case "prep":
      return "Preparation";
    case "logistics":
      return "Logistics";
    case "delivery_note":
      return "Delivery note";
    case "debrief":
      return "Debrief";
    case "risk":
      return "Risk";
    default:
      return "Session note";
  }
}

function humanizeCommonsPostType(type) {
  switch (type) {
    case "announcement":
      return "Announcement";
    case "question":
      return "Question";
    case "resource":
      return "Resource";
    case "update":
      return "Update";
    default:
      return "Update";
  }
}

function humanizeProductThreadCategory(category) {
  switch (category) {
    case "field_learning":
      return "Field learning";
    case "adaptation":
      return "Adaptation";
    case "issue":
      return "Issue";
    case "change_request":
      return "Change request";
    case "question":
      return "Question";
    default:
      return "Discussion";
  }
}

function humanizeProductThreadStatus(status) {
  switch (status) {
    case "open":
      return "Open";
    case "trial_next_session":
      return "Trial next session";
    case "approved_practice":
      return "Approved practice";
    case "closed":
      return "Closed";
    default:
      return "Open";
  }
}

function humanizeProductSlug(slug) {
  if (!slug) {
    return "Product";
  }

  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatShortDateTime(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function normalizeValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed || "";
}

function isCollaborationWorkspaceMissingError(error) {
  if (!error) {
    return false;
  }

  const errorCode = normalizeValue(error.code);
  const errorText = [
    normalizeValue(error.message),
    normalizeValue(error.details),
    normalizeValue(error.hint)
  ].join(" ").toLowerCase();

  if (errorCode === "PGRST205") {
    return true;
  }

  return errorText.includes("could not find the table")
    || errorText.includes("schema cache")
    || errorText.includes("permission denied")
    || errorText.includes("row-level")
    || errorText.includes("product_discussion_threads")
    || errorText.includes("session_room_posts")
    || errorText.includes("facilitator_commons_posts");
}

function isFacilitatorWorkspaceActivationError(error) {
  if (!error) {
    return false;
  }

  const errorText = [
    normalizeValue(error.message),
    normalizeValue(error.details),
    normalizeValue(error.hint)
  ].join(" ").toLowerCase();

  return (errorText.includes("permission denied") || errorText.includes("row-level"))
    && (
      errorText.includes("facilitators")
      || errorText.includes("facilitator_product_links")
      || errorText.includes("session_runs")
      || errorText.includes("session_facilitators")
      || errorText.includes("product_private_notes")
    );
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
