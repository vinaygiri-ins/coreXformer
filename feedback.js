function initCoreXformerFeedback() {
  const config = window.COREXFORMER_PUBLIC_CONFIG;
  const supabaseLib = window.supabase;
  const supabase =
    config?.supabaseUrl && config?.supabaseAnonKey && supabaseLib?.createClient
      ? supabaseLib.createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        })
      : null;

  const feedbackContext = getFeedbackContext();
  const feedbackState = {
    rows: [],
    activeView: "library",
    activeAudience: feedbackContext.audienceValue || "school",
    loaded: false
  };

  applyFeedbackContext(feedbackContext);
  setupFeedbackAudienceHint();
  setupShareToggle();
  setupFeedbackViewTabs(feedbackState, feedbackContext);
  setupLibraryJumpToSubmit(feedbackState);

  const feedbackForm = document.querySelector("[data-feedback-form]");

  if (feedbackForm) {
    feedbackForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!supabase) {
        showFeedbackMessage(
          feedbackForm.querySelector("[data-feedback-message]"),
          "The feedback service is not available right now. Please try again in a moment.",
          "error"
        );
        return;
      }

      void submitFeedback(supabase, feedbackForm, feedbackContext, feedbackState);
    });
  }

  const hasLibrary = Boolean(document.querySelector("[data-feedback-library-grid]"));

  if (hasLibrary) {
    if (isLocalPreviewHost()) {
      feedbackState.rows = getLocalPreviewRows();
      feedbackState.loaded = true;
      renderFeedbackLibrary(feedbackState);
    }

    if (supabase) {
      void loadFeedbackInsights(supabase, feedbackState);
    } else {
      feedbackState.rows = getLocalPreviewRows();
      feedbackState.loaded = true;
      renderFeedbackLibrary(feedbackState);
    }
  }
}

const FEEDBACK_AUDIENCE_LIBRARY = {
  school: {
    label: "Schools",
    title: "Reflections from school sessions.",
    summary:
      "Responses shared by school participants after CoreXformer sessions.",
    pageHref: "products-schools.html",
    pageLabel: "Explore school experiences"
  },
  college: {
    label: "Colleges",
    title: "Reflections from college sessions.",
    summary:
      "Responses shared by college participants around belonging, behavior, goals, and group life.",
    pageHref: "products-colleges.html",
    pageLabel: "Explore college experiences"
  },
  corporate: {
    label: "Corporates",
    title: "Reflections from corporate sessions.",
    summary:
      "Responses shared by workplace teams around communication, ownership, collaboration, and leadership.",
    pageHref: "products-corporates.html",
    pageLabel: "Explore corporate experiences"
  },
  teacher: {
    label: "Teachers",
    title: "Reflections from teacher groups.",
    summary:
      "Responses shared by teacher groups around classroom presence, connection, and shared educational purpose.",
    pageHref: "products-teachers.html",
    pageLabel: "Explore teacher experiences"
  },
  community: {
    label: "Communities",
    title: "Reflections from community sessions.",
    summary:
      "Responses shared by community groups around trust, dialogue, belonging, and participation.",
    pageHref: "products-communities.html",
    pageLabel: "Explore community experiences"
  },
  government: {
    label: "Government",
    title: "Reflections from government teams.",
    summary:
      "Responses shared by public teams around collaboration, responsibility, coordination, and human response inside institutions.",
    pageHref: "products-government.html",
    pageLabel: "Explore government experiences"
  },
  all: {
    label: "All reflections",
    title: "Reflections across CoreXformer audiences.",
    summary:
      "Responses shared across schools, colleges, corporates, teachers, communities, and government teams.",
    pageHref: "",
    pageLabel: ""
  }
};

const FEEDBACK_SELECT_FIELDS_BASE = [
  "id",
  "organization_name",
  "audience_type",
  "product_slug",
  "product_name",
  "session_title",
  "facilitator_name",
  "safe_space_rating",
  "activity_meaning_rating",
  "reflection_value_rating",
  "lasting_moment",
  "teamwork_insight",
  "future_takeaway",
  "share_publicly",
  "display_name",
  "created_at"
];

const FEEDBACK_SELECT_FIELDS_V2 = FEEDBACK_SELECT_FIELDS_BASE.concat([
  "session_experience_rating",
  "facilitator_impact_rating",
  "participant_role",
  "facilitator_impact_note",
  "improvement_note",
  "session_date"
]);

const LOCAL_PREVIEW_FEEDBACK_ROWS = [];

initCoreXformerFeedback();

async function submitFeedback(supabase, feedbackForm, feedbackContext, feedbackState) {
  const submitButton = feedbackForm.querySelector("[data-feedback-submit]");
  const messageElement = feedbackForm.querySelector("[data-feedback-message]");
  const shareToggle = feedbackForm.querySelector("[data-share-toggle]");
  const formData = new FormData(feedbackForm);

  const participantName = normalizeValue(formData.get("participantName"));
  const basePayload = {
    organization_name: normalizeValue(formData.get("organizationName")) || feedbackContext.organizationName || null,
    audience_type: normalizeValue(formData.get("audienceType")) || feedbackContext.audienceValue || null,
    product_slug: feedbackContext.productSlug || null,
    product_name: feedbackContext.productName || null,
    session_title: normalizeValue(formData.get("sessionTitle")) || feedbackContext.sessionTitle || feedbackContext.productName || null,
    facilitator_name: normalizeValue(formData.get("facilitatorName")) || feedbackContext.facilitatorName || null,
    safe_space_rating: Number(formData.get("safeSpaceRating")),
    activity_meaning_rating: Number(formData.get("activityMeaningRating")),
    reflection_value_rating: Number(formData.get("reflectionValueRating")),
    lasting_moment: normalizeValue(formData.get("lastingMoment")),
    teamwork_insight: normalizeValue(formData.get("teamworkInsight")),
    future_takeaway: normalizeValue(formData.get("futureTakeaway")),
    share_publicly: Boolean(shareToggle?.checked),
    display_name: participantName || null
  };

  const enhancedPayload = {
    ...basePayload,
    session_run_id: feedbackContext.sessionRunId || null,
    session_experience_rating: Number(formData.get("overallExperienceRating")),
    facilitator_impact_rating: Number(formData.get("facilitatorImpactRating")),
    participant_role: normalizeValue(formData.get("participantRole")) || null,
    facilitator_impact_note: normalizeValue(formData.get("facilitatorImpactNote")),
    improvement_note: normalizeValue(formData.get("improvementNote")) || null,
    session_date: normalizeDateValue(formData.get("sessionDate")) || feedbackContext.sessionDate || null
  };

  if (!basePayload.audience_type || !basePayload.organization_name) {
    showFeedbackMessage(
      messageElement,
      "Please complete the audience and organization details before submitting.",
      "error"
    );
    return;
  }

  if (
    !enhancedPayload.session_experience_rating ||
    !basePayload.safe_space_rating ||
    !basePayload.activity_meaning_rating ||
    !enhancedPayload.facilitator_impact_rating ||
    !basePayload.reflection_value_rating
  ) {
    showFeedbackMessage(
      messageElement,
      "Please complete all five rating questions before submitting.",
      "error"
    );
    return;
  }

  if (
    !basePayload.lasting_moment ||
    !basePayload.teamwork_insight ||
    !enhancedPayload.facilitator_impact_note ||
    !basePayload.future_takeaway
  ) {
    showFeedbackMessage(
      messageElement,
      "Please complete the main written reflection questions before submitting.",
      "error"
    );
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sharing feedback...";
  }

  showFeedbackMessage(messageElement, "Saving your feedback...", "info");

  const { error } = await insertFeedbackWithCompatibility(supabase, enhancedPayload, basePayload);

  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = "Share feedback";
  }

  if (error) {
    showFeedbackMessage(
      messageElement,
      "Your feedback could not be saved yet. Please try once more in a moment.",
      "error"
    );
    console.warn("CoreXformer feedback submission failed.", error);
    return;
  }

  await window.COREXFORMER_ANALYTICS?.trackFormSuccess("session_feedback", {
    formContext: basePayload.product_slug || basePayload.product_name || basePayload.session_title || "feedback",
    metadata: {
      audienceType: basePayload.audience_type || null,
      productSlug: basePayload.product_slug || null,
      sharePublicly: basePayload.share_publicly
    }
  });

  feedbackForm.reset();
  applyFeedbackContext(feedbackContext);
  setupFeedbackAudienceHint();

  const successMessage = feedbackContext.productName
    ? `Thank you. Your reflection for ${feedbackContext.productName} has been received.`
    : "Thank you. Your reflection has been received.";

  showFeedbackMessage(
    messageElement,
    successMessage,
    "success"
  );

  await loadFeedbackInsights(supabase, feedbackState);
}

async function insertFeedbackWithCompatibility(supabase, enhancedPayload, legacyPayload) {
  let { error } = await supabase.from("session_feedback").insert([enhancedPayload]);

  if (!error) {
    return { error: null, usedLegacyFallback: false };
  }

  if (!isSchemaCompatibilityError(error)) {
    return { error, usedLegacyFallback: false };
  }

  const legacyInsert = await supabase.from("session_feedback").insert([legacyPayload]);

  return {
    error: legacyInsert.error || null,
    usedLegacyFallback: !legacyInsert.error
  };
}

async function loadFeedbackInsights(supabase, feedbackState) {
  const rows = await fetchFeedbackRows(supabase);

  feedbackState.rows = rows.length > 0 || !isLocalPreviewHost() ? rows : getLocalPreviewRows();
  feedbackState.loaded = true;
  renderFeedbackLibrary(feedbackState);
}

async function fetchFeedbackRows(supabase) {
  let query = supabase
    .from("session_feedback")
    .select(FEEDBACK_SELECT_FIELDS_V2.join(","))
    .order("created_at", { ascending: false })
    .limit(180);

  let result = await query;

  if (result.error && isSchemaCompatibilityError(result.error)) {
    result = await supabase
      .from("session_feedback")
      .select(FEEDBACK_SELECT_FIELDS_BASE.join(","))
      .order("created_at", { ascending: false })
      .limit(180);
  }

  if (result.error) {
    console.warn("CoreXformer feedback insights could not be loaded.", result.error);
    return [];
  }

  return Array.isArray(result.data) ? result.data.filter((row) => !isSmokeFeedbackRow(row)) : [];
}

function isSmokeFeedbackRow(row) {
  const searchableText = [
    row?.organization_name,
    row?.display_name,
    row?.session_title,
    row?.facilitator_name
  ].filter(Boolean).join(" ").toLowerCase();

  return /\bsmoke\s*test\b/.test(searchableText)
    || /\bsmoke\s*participant\b/.test(searchableText)
    || /\bcodex\s*smoke\b/.test(searchableText);
}

function renderFeedbackLibrary(feedbackState) {
  const audienceKey = normalizeAudienceKey(feedbackState.activeAudience || "all");
  const config = FEEDBACK_AUDIENCE_LIBRARY[audienceKey] || FEEDBACK_AUDIENCE_LIBRARY.all;
  const allAudienceRows = filterRowsByAudience(feedbackState.rows, audienceKey);
  const publicRows = allAudienceRows.filter((row) => row.share_publicly);
  const audiencePhrase =
    audienceKey === "all" ? "across CoreXformer audiences" : `for ${config.label.toLowerCase()}`;

  const total = allAudienceRows.length;
  const safeAverage = average(allAudienceRows.map((row) => row.safe_space_rating));
  const activityAverage = average(allAudienceRows.map((row) => row.activity_meaning_rating));
  const reflectionAverage = average(allAudienceRows.map((row) => row.reflection_value_rating));

  setElementText("[data-feedback-library-kicker]", config.label);
  setElementText("[data-feedback-library-title]", config.title);
  setElementText("[data-feedback-library-summary]", config.summary);
  setElementText("[data-feedback-total]", total ? String(total) : "0");
  setElementText("[data-feedback-safe]", total ? `${safeAverage.toFixed(1)} / 5` : "—");
  setElementText("[data-feedback-activity]", total ? `${activityAverage.toFixed(1)} / 5` : "—");
  setElementText("[data-feedback-reflection]", total ? `${reflectionAverage.toFixed(1)} / 5` : "—");

  const publicSummary = document.querySelector("[data-feedback-public-summary]");
  if (publicSummary) {
    if (publicRows.length) {
      publicSummary.textContent = `${publicRows.length} reflection${publicRows.length === 1 ? "" : "s"} shared publicly ${audiencePhrase}.`;
    } else if (total) {
      publicSummary.textContent = `Reflections have been received ${audiencePhrase}. Public entries will appear here when participants choose to share them.`;
    } else {
      publicSummary.textContent = `Public reflections ${audiencePhrase} will appear here as responses are received.`;
    }
  }

  const audienceLink = document.querySelector("[data-feedback-audience-link]");
  if (audienceLink) {
    if (config.pageHref) {
      audienceLink.href = config.pageHref;
      audienceLink.textContent = config.pageLabel;
      audienceLink.classList.remove("hidden");
    } else {
      audienceLink.classList.add("hidden");
    }
  }

  renderFeedbackCards(publicRows, config, total);
}

function renderFeedbackCards(rows, config, totalCount) {
  const grid = document.querySelector("[data-feedback-library-grid]");

  if (!grid) {
    return;
  }

  grid.innerHTML = "";

  if (!rows.length) {
    const emptyCard = document.createElement("article");
    emptyCard.className = "reflection-card reflection-card-empty reflection-card-audience-empty";
    const isAllAudience = config.label === "All reflections";
    emptyCard.innerHTML = `
      <p class="eyebrow">${escapeHtml(config.label)}</p>
      <h3>${totalCount ? "Reflections have been received for this audience." : isAllAudience ? "Public reflections will appear here." : `Public reflections for ${escapeHtml(config.label.toLowerCase())} will appear here.`}</h3>
      <p>${totalCount ? "Public entries will appear here when participants choose to share them." : "Responses shared after sessions will appear here as they are received."}</p>
    `;
    grid.appendChild(emptyCard);
    return;
  }

  rows.forEach((row) => {
    const article = document.createElement("article");
    article.className = "reflection-card reflection-card-detailed";

    const stripMarkup = buildPublicStripMarkup(row);
    const sessionLabel = [
      normalizeValue(row.organization_name),
      normalizeValue(row.session_title || row.product_name),
      normalizeValue(row.facilitator_name) ? `Facilitator: ${normalizeValue(row.facilitator_name)}` : ""
    ]
      .filter(Boolean)
      .join(" · ");

    article.innerHTML = `
      <p class="eyebrow">${escapeHtml(`${formatAudienceLabel(row.audience_type)} · ${normalizeValue(row.organization_name) || "CoreXformer session"}`)}</p>
      <div class="reflection-strip-stack">
        <article class="reflection-strip reflection-strip-primary">
          <div class="reflection-strip-copy">
            <h3>${escapeHtml(normalizeValue(row.session_title || row.product_name) || "Participant reflection")}</h3>
            <p class="reflection-meta">${escapeHtml(sessionLabel || "Shared after a CoreXformer session")}</p>
          </div>
        </article>
        <article class="reflection-strip reflection-strip-ratings">
          <div class="reflection-rating-row">
            <span class="reflection-rating-pill">Safe: ${escapeHtml(formatRating(row.safe_space_rating))}</span>
            <span class="reflection-rating-pill">Meaning: ${escapeHtml(formatRating(row.activity_meaning_rating))}</span>
            <span class="reflection-rating-pill">Reflect: ${escapeHtml(formatRating(row.reflection_value_rating))}</span>
          </div>
        </article>
        ${stripMarkup}
      </div>
      <p class="reflection-credit">${escapeHtml(normalizeValue(row.display_name) || "Participant reflection")}</p>
    `;

    grid.appendChild(article);
  });
}

function buildPublicStripMarkup(row) {
  const segments = [
    { label: "What stayed", value: normalizeValue(row.lasting_moment) },
    { label: "What it revealed", value: normalizeValue(row.teamwork_insight) },
    { label: "What moved forward", value: normalizeValue(row.future_takeaway) }
  ];

  if (normalizeValue(row.facilitator_impact_note)) {
    segments.push({ label: "Facilitator impact", value: normalizeValue(row.facilitator_impact_note) });
  }

  return segments
    .filter((segment) => segment.value)
    .map(
      (segment) => `
        <article class="reflection-strip">
          <span>${escapeHtml(segment.label)}</span>
          <p>${escapeHtml(segment.value)}</p>
        </article>
      `
    )
    .join("");
}

function setupFeedbackViewTabs(feedbackState, feedbackContext) {
  const buttons = document.querySelectorAll("[data-feedback-view-tab]");

  if (!buttons.length) {
    return;
  }

  const requestedView =
    feedbackContext.viewValue === "submit" || feedbackContext.viewValue === "library"
      ? feedbackContext.viewValue
      : "";
  const defaultView =
    requestedView ||
    (feedbackContext.productName || feedbackContext.sessionTitle || feedbackContext.audienceValue
      ? "submit"
      : "library");
  const defaultAudience = feedbackContext.audienceValue || "school";

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.feedbackView || "library";
      const audience =
        view === "submit"
          ? feedbackState.activeAudience || defaultAudience
          : normalizeAudienceKey(button.dataset.feedbackAudience || defaultAudience);

      activateFeedbackView(buttons, feedbackState, view, audience);
    });
  });

  activateFeedbackView(buttons, feedbackState, defaultView, defaultAudience);
}

function activateFeedbackView(buttons, feedbackState, view, audience) {
  const normalizedAudience = normalizeAudienceKey(audience || "school");
  const submitPanel = document.querySelector('[data-feedback-panel="submit"]');
  const libraryPanel = document.querySelector('[data-feedback-panel="library"]');

  feedbackState.activeView = view;
  feedbackState.activeAudience = normalizedAudience;

  buttons.forEach((button) => {
    const isActive =
      view === "submit"
        ? button.dataset.feedbackView === "submit"
        : button.dataset.feedbackView === "library" &&
          normalizeAudienceKey(button.dataset.feedbackAudience) === normalizedAudience;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  if (submitPanel) {
    submitPanel.classList.toggle("hidden", view !== "submit");
  }

  if (libraryPanel) {
    libraryPanel.classList.toggle("hidden", view !== "library");
  }

  if (view === "submit") {
    const audienceField = document.querySelector('[name="audienceType"]');
    if (audienceField && normalizedAudience !== "all" && !audienceField.value) {
      audienceField.value = normalizedAudience;
      setupFeedbackAudienceHint();
    }
    return;
  }

  renderFeedbackLibrary(feedbackState);
}

function setupLibraryJumpToSubmit(feedbackState) {
  const jumpButton = document.querySelector("[data-feedback-jump-submit]");

  if (!jumpButton) {
    return;
  }

  jumpButton.addEventListener("click", (event) => {
    event.preventDefault();
    const buttons = document.querySelectorAll("[data-feedback-view-tab]");
    const audienceField = document.querySelector('[name="audienceType"]');

    if (audienceField && feedbackState.activeAudience && feedbackState.activeAudience !== "all") {
      audienceField.value = feedbackState.activeAudience;
      setupFeedbackAudienceHint();
    }

    activateFeedbackView(buttons, feedbackState, "submit", feedbackState.activeAudience || "school");
    document.getElementById("give-feedback")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setupShareToggle() {
  const shareToggle = document.querySelector("[data-share-toggle]");
  const participantField = document.querySelector('[name="participantName"]');

  if (!shareToggle || !participantField) {
    return;
  }

  shareToggle.addEventListener("change", () => {
    participantField.placeholder = shareToggle.checked
      ? "Optional: first name, initials, or how you would like the reflection credited"
      : "Optional: first name, initials, or role";
  });
}

function setupFeedbackAudienceHint() {
  const audienceField = document.querySelector('[name="audienceType"]');
  const hint = document.querySelector("[data-feedback-audience-hint]");

  if (!audienceField || !hint) {
    return;
  }

  const renderHint = () => {
    const config = FEEDBACK_AUDIENCE_LIBRARY[normalizeAudienceKey(audienceField.value)] || null;

    if (!config) {
      hint.textContent =
        "Choose the audience first. The form will still stay common, but the page will interpret the reflection through the right context.";
      return;
    }

    hint.textContent = `This feedback will be understood in the context of ${config.label.toLowerCase()}. The public reflection wall for this audience will only show your words if you explicitly allow sharing.`;
  };

  renderHint();
  audienceField.addEventListener("change", renderHint);
}

function applyFeedbackContext(feedbackContext) {
  const banner = document.querySelector("[data-feedback-context-banner]");
  const titleElement = document.querySelector("[data-feedback-context-title]");
  const bodyElement = document.querySelector("[data-feedback-context-body]");
  const audienceField = document.querySelector('[name="audienceType"]');
  const organizationField = document.querySelector('[name="organizationName"]');
  const sessionTitleField = document.querySelector('[name="sessionTitle"]');
  const facilitatorField = document.querySelector('[name="facilitatorName"]');
  const sessionDateField = document.querySelector('[name="sessionDate"]');

  if (audienceField && feedbackContext.audienceValue && !audienceField.value) {
    audienceField.value = feedbackContext.audienceValue;
  }

  if (organizationField && feedbackContext.organizationName && !organizationField.value) {
    organizationField.value = feedbackContext.organizationName;
  }

  if (sessionTitleField && (feedbackContext.sessionTitle || feedbackContext.productName) && !sessionTitleField.value) {
    sessionTitleField.value = feedbackContext.sessionTitle || feedbackContext.productName;
  }

  if (facilitatorField && feedbackContext.facilitatorName && !facilitatorField.value) {
    facilitatorField.value = feedbackContext.facilitatorName;
  }

  if (sessionDateField && feedbackContext.sessionDate && !sessionDateField.value) {
    sessionDateField.value = feedbackContext.sessionDate;
  }

  if (!banner || !titleElement || !bodyElement || !(feedbackContext.productName || feedbackContext.sessionTitle)) {
    return;
  }

  const contextBits = [];

  if (feedbackContext.audienceValue) {
    contextBits.push(`audience: ${formatAudienceLabel(feedbackContext.audienceValue)}`);
  }

  if (feedbackContext.facilitatorName) {
    contextBits.push(`facilitator: ${feedbackContext.facilitatorName}`);
  }

  if (feedbackContext.organizationName) {
    contextBits.push(`organization: ${feedbackContext.organizationName}`);
  }

  if (feedbackContext.sessionDate) {
    contextBits.push(`date: ${formatFeedbackContextDate(feedbackContext.sessionDate)}`);
  }

  titleElement.textContent = feedbackContext.productName
    ? `Feedback for ${feedbackContext.productName}`
    : `Feedback for ${feedbackContext.sessionTitle}`;

  bodyElement.textContent = contextBits.length
    ? `You arrived here from a specific CoreXformer route. This reflection is already linked to ${feedbackContext.productName || feedbackContext.sessionTitle} (${contextBits.join(" · ")}).`
    : `You arrived here from a specific CoreXformer route. This reflection is already linked to ${feedbackContext.productName || feedbackContext.sessionTitle}.`;

  banner.classList.remove("hidden");
  document.title = feedbackContext.productName
    ? `CoreXformer | Feedback for ${feedbackContext.productName}`
    : `CoreXformer | Feedback`;
}

function getFeedbackContext() {
  const params = new URLSearchParams(window.location.search);
  const body = document.body;
  const rawAudience = normalizeValue(params.get("audience") || body?.dataset.feedbackAudience).toLowerCase();
  const audienceMap = {
    all: "all",
    schools: "school",
    school: "school",
    teachers: "teacher",
    teacher: "teacher",
    colleges: "college",
    college: "college",
    corporates: "corporate",
    corporate: "corporate",
    government: "government",
    communities: "community",
    community: "community",
    mixed: "mixed"
  };

  return {
    sessionRunId: normalizeValue(params.get("sessionRunId") || body?.dataset.feedbackSessionRunId),
    productSlug: normalizeValue(params.get("productSlug") || body?.dataset.feedbackProductSlug),
    productName: normalizeValue(params.get("productName") || body?.dataset.feedbackProductName),
    sessionTitle: normalizeValue(params.get("sessionTitle") || body?.dataset.feedbackSessionTitle),
    organizationName: normalizeValue(params.get("organizationName") || body?.dataset.feedbackOrganizationName),
    facilitatorName: normalizeValue(params.get("facilitatorName") || body?.dataset.feedbackFacilitatorName),
    sessionDate: normalizeDateValue(params.get("sessionDate") || body?.dataset.feedbackSessionDate),
    viewValue: normalizeValue(params.get("view")).toLowerCase(),
    rawAudience,
    audienceValue: audienceMap[rawAudience] || ""
  };
}

function filterRowsByAudience(rows, audienceKey) {
  if (audienceKey === "all") {
    return Array.isArray(rows) ? rows : [];
  }

  return (Array.isArray(rows) ? rows : []).filter((row) => normalizeAudienceKey(row.audience_type) === audienceKey);
}

function normalizeAudienceKey(value) {
  const normalized = normalizeValue(value).toLowerCase();

  switch (normalized) {
    case "schools":
    case "school":
      return "school";
    case "teachers":
    case "teacher":
      return "teacher";
    case "colleges":
    case "college":
      return "college";
    case "corporates":
    case "corporate":
      return "corporate";
    case "communities":
    case "community":
      return "community";
    case "government":
      return "government";
    case "all":
      return "all";
    default:
      return normalized || "all";
  }
}

function formatAudienceLabel(value) {
  const key = normalizeAudienceKey(value);
  return FEEDBACK_AUDIENCE_LIBRARY[key]?.label || "Mixed group";
}

function isSchemaCompatibilityError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();

  return (
    error?.code === "PGRST204" ||
    message.includes("session_run_id") ||
    message.includes("session_experience_rating") ||
    message.includes("facilitator_impact_rating") ||
    message.includes("participant_role") ||
    message.includes("facilitator_impact_note") ||
    message.includes("improvement_note") ||
    message.includes("session_date")
  );
}

function getLocalPreviewRows() {
  return isLocalPreviewHost() ? LOCAL_PREVIEW_FEEDBACK_ROWS.slice() : [];
}

function isLocalPreviewHost() {
  const host = window.location.hostname;
  return host === "127.0.0.1" || host === "localhost";
}

function normalizeDateValue(value) {
  const normalized = normalizeValue(value);
  return normalized || null;
}

function formatFeedbackContextDate(value) {
  const normalized = normalizeDateValue(value);

  if (!normalized) {
    return "";
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function showFeedbackMessage(element, text, tone) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.classList.remove("hidden", "is-error", "is-success", "is-info");
  element.classList.add(`is-${tone || "info"}`);
}

function average(values) {
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!numericValues.length) {
    return 0;
  }

  const total = numericValues.reduce((sum, value) => sum + value, 0);
  return total / numericValues.length;
}

function setElementText(selector, value) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = value;
  }
}

function formatRating(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric}/5` : "—";
}

function normalizeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
