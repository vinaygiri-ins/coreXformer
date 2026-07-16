const FEEDBACK_ADMIN_ROLES = ["owner", "editor"];
const FEEDBACK_ADMIN_SELECT_FIELDS_FULL = [
  "id",
  "session_run_id",
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
  "created_at",
  "session_experience_rating",
  "facilitator_impact_rating",
  "participant_role",
  "facilitator_impact_note",
  "improvement_note",
  "session_date"
];

const FEEDBACK_ADMIN_SELECT_FIELDS_V2 = FEEDBACK_ADMIN_SELECT_FIELDS_FULL.filter((field) => field !== "session_run_id");
const FEEDBACK_ADMIN_SELECT_FIELDS_BASE = [
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

const feedbackAdminDom = {
  message: document.getElementById("feedbackAdminMessage"),
  summaryCards: document.getElementById("feedbackAdminSummaryCards"),
  highlights: document.getElementById("feedbackAdminHighlights"),
  receivedFromInput: document.getElementById("feedbackAdminReceivedFrom"),
  receivedToInput: document.getElementById("feedbackAdminReceivedTo"),
  clearWindowButton: document.getElementById("feedbackAdminClearWindowButton"),
  downloadWindowPdfButton: document.getElementById("feedbackAdminDownloadWindowPdfButton"),
  windowSummary: document.getElementById("feedbackAdminWindowSummary"),
  filterInput: document.getElementById("feedbackAdminFilterInput"),
  scope: document.getElementById("feedbackAdminScope"),
  sessionsView: document.getElementById("feedbackAdminSessionsView"),
  groupPanel: document.getElementById("feedbackAdminGroupPanel"),
  groupList: document.getElementById("feedbackAdminGroupList"),
  groupEmptyState: document.getElementById("feedbackAdminGroupEmptyState"),
  detailPanel: document.getElementById("feedbackAdminDetailPanel"),
  sessionDetail: document.getElementById("feedbackAdminSessionDetail"),
  sessionEmptyState: document.getElementById("feedbackAdminSessionEmptyState"),
  backToGroupsButton: document.getElementById("feedbackAdminBackToGroupsButton"),
  copyLinkButton: document.getElementById("feedbackAdminCopyLinkButton"),
  downloadPdfButton: document.getElementById("feedbackAdminDownloadPdfButton")
};

const feedbackAdminState = {
  supabase: null,
  isAdmin: false,
  isLoading: false,
  isExporting: false,
  exportTarget: "",
  rows: [],
  groups: [],
  receivedFrom: "",
  receivedTo: "",
  filterText: "",
  selectedGroupKey: "",
  mobileStage: "groups",
  jsPdfLoader: null
};

document.addEventListener("DOMContentLoaded", () => {
  bindFeedbackAdminEvents();
  bindFeedbackAdminViewportEvents();

  if (window.COREXFORMER_ADMIN_CONTEXT) {
    void handleFeedbackAdminContext(window.COREXFORMER_ADMIN_CONTEXT);
  }
});

document.addEventListener("corexformer:admin-context", (event) => {
  void handleFeedbackAdminContext(event.detail);
});

function bindFeedbackAdminEvents() {
  feedbackAdminDom.receivedFromInput?.addEventListener("change", () => {
    feedbackAdminState.receivedFrom = normalizeFeedbackAdminValue(feedbackAdminDom.receivedFromInput.value);
    syncFeedbackAdminSelection();
    renderFeedbackAdmin();
  });

  feedbackAdminDom.receivedToInput?.addEventListener("change", () => {
    feedbackAdminState.receivedTo = normalizeFeedbackAdminValue(feedbackAdminDom.receivedToInput.value);
    syncFeedbackAdminSelection();
    renderFeedbackAdmin();
  });

  feedbackAdminDom.clearWindowButton?.addEventListener("click", () => {
    feedbackAdminState.receivedFrom = "";
    feedbackAdminState.receivedTo = "";

    if (feedbackAdminDom.receivedFromInput) {
      feedbackAdminDom.receivedFromInput.value = "";
    }

    if (feedbackAdminDom.receivedToInput) {
      feedbackAdminDom.receivedToInput.value = "";
    }

    syncFeedbackAdminSelection();
    renderFeedbackAdmin();
  });

  feedbackAdminDom.downloadWindowPdfButton?.addEventListener("click", () => {
    void downloadFilteredFeedbackAdminPdf();
  });

  feedbackAdminDom.filterInput?.addEventListener("input", () => {
    feedbackAdminState.filterText = normalizeFeedbackAdminValue(feedbackAdminDom.filterInput.value).toLowerCase();
    syncFeedbackAdminSelection();
    renderFeedbackAdmin();
  });

  feedbackAdminDom.groupList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-feedback-group-key]");

    if (!button) {
      return;
    }

    feedbackAdminState.selectedGroupKey = button.dataset.feedbackGroupKey || "";
    if (isFeedbackAdminMobileLayout()) {
      feedbackAdminState.mobileStage = "detail";
    }
    renderFeedbackAdmin();

    if (isFeedbackAdminMobileLayout()) {
      queueFeedbackAdminStageScroll("detail");
    }
  });

  feedbackAdminDom.copyLinkButton?.addEventListener("click", () => {
    void copyFeedbackAdminLink();
  });

  feedbackAdminDom.downloadPdfButton?.addEventListener("click", () => {
    void downloadFeedbackAdminPdf();
  });

  feedbackAdminDom.backToGroupsButton?.addEventListener("click", () => {
    feedbackAdminState.mobileStage = "groups";
    renderFeedbackAdmin();
    queueFeedbackAdminStageScroll("groups");
  });
}

function bindFeedbackAdminViewportEvents() {
  const mobileViewport = window.matchMedia("(max-width: 980px)");
  const syncViewport = () => {
    if (!mobileViewport.matches) {
      feedbackAdminState.mobileStage = "groups";
    }

    renderFeedbackAdmin();
  };

  if (typeof mobileViewport.addEventListener === "function") {
    mobileViewport.addEventListener("change", syncViewport);
    return;
  }

  if (typeof mobileViewport.addListener === "function") {
    mobileViewport.addListener(syncViewport);
  }
}

async function handleFeedbackAdminContext(detail) {
  feedbackAdminState.supabase = detail?.supabase ?? null;
  feedbackAdminState.isAdmin = Boolean(detail?.profile && FEEDBACK_ADMIN_ROLES.includes(detail.profile.role));

  if (!feedbackAdminState.isAdmin || !feedbackAdminState.supabase) {
    resetFeedbackAdminState();
    renderFeedbackAdmin();
    return;
  }

  await loadFeedbackAdminData();
}

function resetFeedbackAdminState() {
  feedbackAdminState.rows = [];
  feedbackAdminState.groups = [];
  feedbackAdminState.exportTarget = "";
  feedbackAdminState.receivedFrom = "";
  feedbackAdminState.receivedTo = "";
  feedbackAdminState.selectedGroupKey = "";
  feedbackAdminState.filterText = "";
  if (feedbackAdminDom.receivedFromInput) {
    feedbackAdminDom.receivedFromInput.value = "";
  }
  if (feedbackAdminDom.receivedToInput) {
    feedbackAdminDom.receivedToInput.value = "";
  }
  if (feedbackAdminDom.filterInput) {
    feedbackAdminDom.filterInput.value = "";
  }
  clearFeedbackAdminMessage();
}

async function loadFeedbackAdminData() {
  if (feedbackAdminState.isLoading || !feedbackAdminState.supabase) {
    return;
  }

  feedbackAdminState.isLoading = true;
  setFeedbackAdminMessage("Loading session feedback records...", "info");

  try {
    feedbackAdminState.rows = await fetchFeedbackAdminRows();
    feedbackAdminState.groups = buildFeedbackAdminGroups(feedbackAdminState.rows);
    syncFeedbackAdminSelection();
    clearFeedbackAdminMessage();
  } catch (error) {
    const errorText = String(error?.message || "");
    const backendNotReady = errorText.includes("session_feedback") && (
      errorText.includes("does not exist")
      || errorText.includes("schema cache")
      || errorText.includes("permission denied")
      || errorText.includes("row-level")
    );

    feedbackAdminState.rows = [];
    feedbackAdminState.groups = [];
    feedbackAdminState.selectedGroupKey = "";
    setFeedbackAdminMessage(
      backendNotReady
        ? "The session feedback backend is not fully enabled yet. Activate the `session_feedback` table in Supabase, then refresh this page."
        : "Session feedback could not be loaded right now. Please try again shortly.",
      "error"
    );
  } finally {
    feedbackAdminState.isLoading = false;
    renderFeedbackAdmin();
  }
}

async function fetchFeedbackAdminRows() {
  let result = await feedbackAdminState.supabase
    .from("session_feedback")
    .select(FEEDBACK_ADMIN_SELECT_FIELDS_FULL.join(","))
    .order("created_at", { ascending: false })
    .limit(2000);

  if (result.error && isFeedbackAdminSchemaCompatibilityError(result.error)) {
    result = await feedbackAdminState.supabase
      .from("session_feedback")
      .select(FEEDBACK_ADMIN_SELECT_FIELDS_V2.join(","))
      .order("created_at", { ascending: false })
      .limit(2000);
  }

  if (result.error && isFeedbackAdminSchemaCompatibilityError(result.error)) {
    result = await feedbackAdminState.supabase
      .from("session_feedback")
      .select(FEEDBACK_ADMIN_SELECT_FIELDS_BASE.join(","))
      .order("created_at", { ascending: false })
      .limit(2000);
  }

  if (result.error) {
    throw result.error;
  }

  return Array.isArray(result.data) ? result.data.filter((row) => !isFeedbackAdminSmokeRow(row)) : [];
}

function isFeedbackAdminSmokeRow(row) {
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

function buildFeedbackAdminGroups(rows) {
  const groupsByKey = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = buildFeedbackAdminGroupKey(row);
    const existing = groupsByKey.get(key) || createFeedbackAdminGroup(row, key);

    existing.rows.push(row);
    existing.lastSubmittedAt = maxDate(existing.lastSubmittedAt, row.created_at);
    existing.shareableCount += row.share_publicly ? 1 : 0;
    existing.title = existing.title || normalizeFeedbackAdminValue(row.session_title) || normalizeFeedbackAdminValue(row.product_name) || "CoreXformer session";
    existing.organizationName = existing.organizationName || normalizeFeedbackAdminValue(row.organization_name);
    existing.productName = existing.productName || normalizeFeedbackAdminValue(row.product_name);
    existing.productSlug = existing.productSlug || normalizeFeedbackAdminValue(row.product_slug);
    existing.audienceType = existing.audienceType || normalizeFeedbackAdminValue(row.audience_type);
    existing.facilitatorName = existing.facilitatorName || normalizeFeedbackAdminValue(row.facilitator_name);
    existing.sessionDate = existing.sessionDate || normalizeFeedbackAdminValue(row.session_date);
    existing.sessionRunId = existing.sessionRunId || normalizeFeedbackAdminValue(row.session_run_id);

    groupsByKey.set(key, existing);
  });

  return Array.from(groupsByKey.values())
    .map((group) => finalizeFeedbackAdminGroup(group))
    .sort((left, right) => {
      const leftTime = sortableFeedbackAdminTime(left);
      const rightTime = sortableFeedbackAdminTime(right);
      return rightTime - leftTime;
    });
}

function createFeedbackAdminGroup(row, key) {
  return {
    key,
    title: normalizeFeedbackAdminValue(row.session_title) || normalizeFeedbackAdminValue(row.product_name) || "CoreXformer session",
    organizationName: normalizeFeedbackAdminValue(row.organization_name),
    productName: normalizeFeedbackAdminValue(row.product_name),
    productSlug: normalizeFeedbackAdminValue(row.product_slug),
    audienceType: normalizeFeedbackAdminValue(row.audience_type),
    facilitatorName: normalizeFeedbackAdminValue(row.facilitator_name),
    sessionDate: normalizeFeedbackAdminValue(row.session_date),
    sessionRunId: normalizeFeedbackAdminValue(row.session_run_id),
    shareableCount: 0,
    lastSubmittedAt: row.created_at || "",
    rows: []
  };
}

function finalizeFeedbackAdminGroup(group) {
  const rows = [...group.rows].sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
  const averageOverall = averageFeedbackAdminMetric(rows.map((row) => row.session_experience_rating));
  const averageSafe = averageFeedbackAdminMetric(rows.map((row) => row.safe_space_rating));
  const averageMeaning = averageFeedbackAdminMetric(rows.map((row) => row.activity_meaning_rating));
  const averageFacilitator = averageFeedbackAdminMetric(rows.map((row) => row.facilitator_impact_rating));
  const averageReflection = averageFeedbackAdminMetric(rows.map((row) => row.reflection_value_rating));

  return {
    ...group,
    rows,
    responseCount: rows.length,
    averageOverall,
    averageSafe,
    averageMeaning,
    averageFacilitator,
    averageReflection,
    metaLine: buildFeedbackAdminGroupMeta({
      title: group.title,
      organizationName: group.organizationName,
      sessionDate: group.sessionDate,
      facilitatorName: group.facilitatorName,
      audienceType: group.audienceType,
      productName: group.productName
    })
  };
}

function buildFeedbackAdminGroupKey(row) {
  const sessionRunId = normalizeFeedbackAdminValue(row.session_run_id);

  if (sessionRunId) {
    return `session-run:${sessionRunId}`;
  }

  const compositeBits = [
    normalizeFeedbackAdminValue(row.session_date).toLowerCase(),
    normalizeFeedbackAdminValue(row.organization_name).toLowerCase(),
    normalizeFeedbackAdminValue(row.session_title).toLowerCase(),
    normalizeFeedbackAdminValue(row.product_slug).toLowerCase(),
    normalizeFeedbackAdminValue(row.audience_type).toLowerCase(),
    normalizeFeedbackAdminValue(row.facilitator_name).toLowerCase()
  ].filter(Boolean);

  if (!compositeBits.length) {
    return `feedback-entry:${row.id}`;
  }

  return `legacy:${compositeBits.join("||")}`;
}

function buildFeedbackAdminGroupMeta(group) {
  const parts = [];

  if (group.organizationName) {
    parts.push(group.organizationName);
  }

  if (group.sessionDate) {
    parts.push(formatFeedbackAdminDate(group.sessionDate));
  }

  if (group.facilitatorName) {
    parts.push(`Facilitator: ${group.facilitatorName}`);
  }

  if (group.audienceType) {
    parts.push(humanizeFeedbackAdminAudience(group.audienceType));
  }

  if (!parts.length && group.productName) {
    parts.push(group.productName);
  }

  return parts.join(" | ");
}

function syncFeedbackAdminSelection() {
  const visibleGroups = getVisibleFeedbackAdminGroups();
  const hasSelectedVisibleGroup = visibleGroups.some((group) => group.key === feedbackAdminState.selectedGroupKey);

  if (!hasSelectedVisibleGroup) {
    feedbackAdminState.selectedGroupKey = visibleGroups[0]?.key || "";
  }

  if (!feedbackAdminState.selectedGroupKey) {
    feedbackAdminState.mobileStage = "groups";
  }
}

function getFilteredFeedbackAdminRows() {
  const fromTimestamp = feedbackAdminState.receivedFrom
    ? parseFeedbackAdminDateTimeInput(feedbackAdminState.receivedFrom)
    : Number.NEGATIVE_INFINITY;
  const toTimestamp = feedbackAdminState.receivedTo
    ? parseFeedbackAdminDateTimeInput(feedbackAdminState.receivedTo)
    : Number.POSITIVE_INFINITY;

  if (hasInvalidFeedbackAdminTimeWindow()) {
    return [];
  }

  return feedbackAdminState.rows.filter((row) => {
    const rowTimestamp = sortableFeedbackAdminTime(row.created_at);

    if (!rowTimestamp) {
      return false;
    }

    return rowTimestamp >= fromTimestamp && rowTimestamp <= toTimestamp;
  });
}

function getFilteredFeedbackAdminGroups() {
  return buildFeedbackAdminGroups(getFilteredFeedbackAdminRows());
}

function getVisibleFeedbackAdminGroups() {
  const search = feedbackAdminState.filterText;
  const groups = getFilteredFeedbackAdminGroups();

  if (!search) {
    return groups;
  }

  return groups.filter((group) => {
    const haystack = [
      group.title,
      group.organizationName,
      group.productName,
      group.facilitatorName,
      group.audienceType,
      group.sessionDate
    ]
      .map((value) => normalizeFeedbackAdminValue(value).toLowerCase())
      .join(" ");

    return haystack.includes(search);
  });
}

function getSelectedFeedbackAdminGroup() {
  return getVisibleFeedbackAdminGroups().find((group) => group.key === feedbackAdminState.selectedGroupKey) || null;
}

function renderFeedbackAdmin() {
  renderFeedbackAdminWindowSummary();
  renderFeedbackAdminOverview();
  renderFeedbackAdminGroupList();
  renderFeedbackAdminSessionDetail();
  syncFeedbackAdminMobilePanels();
  syncFeedbackAdminButtons();
}

function renderFeedbackAdminWindowSummary() {
  if (!feedbackAdminDom.windowSummary) {
    return;
  }

  if (hasInvalidFeedbackAdminTimeWindow()) {
    feedbackAdminDom.windowSummary.textContent = "Choose a valid received window. The start date and time should be earlier than the end date and time.";
    return;
  }

  if (feedbackAdminState.receivedFrom && feedbackAdminState.receivedTo) {
    feedbackAdminDom.windowSummary.textContent = `Showing feedback received between ${formatFeedbackAdminInputDateTime(feedbackAdminState.receivedFrom)} and ${formatFeedbackAdminInputDateTime(feedbackAdminState.receivedTo)}.`;
    return;
  }

  if (feedbackAdminState.receivedFrom) {
    feedbackAdminDom.windowSummary.textContent = `Showing feedback received on or after ${formatFeedbackAdminInputDateTime(feedbackAdminState.receivedFrom)}.`;
    return;
  }

  if (feedbackAdminState.receivedTo) {
    feedbackAdminDom.windowSummary.textContent = `Showing feedback received up to ${formatFeedbackAdminInputDateTime(feedbackAdminState.receivedTo)}.`;
    return;
  }

  feedbackAdminDom.windowSummary.textContent = "Currently showing all feedback received so far.";
}

function renderFeedbackAdminOverview() {
  if (feedbackAdminDom.summaryCards) {
    const rows = getFilteredFeedbackAdminRows();
    const groups = getFilteredFeedbackAdminGroups();
    const shareableCount = rows.filter((row) => row.share_publicly).length;
    const latestDate = rows[0]?.created_at ? formatFeedbackAdminDateTime(rows[0].created_at) : "No responses yet";
    const timeWindowActive = hasFeedbackAdminTimeWindow();

    feedbackAdminDom.summaryCards.innerHTML = [
      renderFeedbackAdminMetricCard("Feedback records", String(rows.length), rows.length ? (timeWindowActive ? "Individual participant reflections received within the selected time window." : "Individual participant reflections currently stored in the private studio.") : (timeWindowActive ? "No responses fall inside the selected received window yet." : "Responses will appear here once sessions begin collecting feedback.")),
      renderFeedbackAdminMetricCard("Session groups", String(groups.length), groups.length ? (timeWindowActive ? "Distinct session or batch clusters that received feedback in the current time window." : "Distinct sessions or batches currently grouped for review and export.") : (timeWindowActive ? "No session or batch groups were active inside the selected received window." : "Session or batch groups will appear once there is enough context in the feedback records.")),
      renderFeedbackAdminMetricCard("Public share allowed", String(shareableCount), shareableCount ? "Entries where participants explicitly allowed public reflection sharing." : "No responses in the current view have opted into public reflection sharing yet."),
      renderFeedbackAdminMetricCard("Latest receipt", latestDate, rows.length ? "Most recent feedback submission in the current view." : "No feedback has been received in this view yet.")
    ].join("");
  }

  if (feedbackAdminDom.highlights) {
    const filteredGroups = getFilteredFeedbackAdminGroups();
    const selectedGroup = getSelectedFeedbackAdminGroup() || filteredGroups[0] || null;
    const items = [
      {
        title: "What the export captures",
        meta: "Full feedback form structure",
        copy: "Each PDF keeps the session context, all five ratings, each written reflection answer, public sharing choice, participant role, and the submission timestamp."
      },
      {
        title: "How groups are built",
        meta: "Session or batch clustering",
        copy: "Feedback responses are grouped by session run when available, or by the closest matching batch details such as session title, organization, facilitator, program, and date."
      },
      {
        title: "Current received window",
        meta: hasFeedbackAdminTimeWindow() ? "Time filter active" : "All time",
        copy: hasInvalidFeedbackAdminTimeWindow()
          ? "The selected received window is invalid right now. Set the start earlier than the end to review the right feedback records."
          : feedbackAdminDom.windowSummary?.textContent || "Currently showing all feedback received so far."
      },
      {
        title: selectedGroup ? `Current focus: ${selectedGroup.title}` : "Current focus",
        meta: selectedGroup ? selectedGroup.metaLine || "Session detail available" : "No session selected yet",
        copy: selectedGroup
          ? `${selectedGroup.responseCount} response${selectedGroup.responseCount === 1 ? "" : "s"} are grouped here. Download one clean PDF for private sharing, or copy the linked feedback form URL for future participants.`
          : "Once feedback records are available, you can select a session group and export all participant reflections as one file."
      }
    ];

    feedbackAdminDom.highlights.innerHTML = items.map((item) => `
      <article class="session-card">
        <div class="session-card-head">
          <div>
            <h3>${escapeHtmlFeedbackAdmin(item.title)}</h3>
            <p class="session-meta">${escapeHtmlFeedbackAdmin(item.meta)}</p>
          </div>
        </div>
        <p>${escapeHtmlFeedbackAdmin(item.copy)}</p>
      </article>
    `).join("");
  }
}

function renderFeedbackAdminGroupList() {
  if (!feedbackAdminDom.groupList || !feedbackAdminDom.scope || !feedbackAdminDom.groupEmptyState) {
    return;
  }

  const filteredRows = getFilteredFeedbackAdminRows();
  const visibleGroups = getVisibleFeedbackAdminGroups();
  const totalResponses = visibleGroups.reduce((sum, group) => sum + group.responseCount, 0);
  const hasSearch = Boolean(feedbackAdminState.filterText);

  if (hasInvalidFeedbackAdminTimeWindow()) {
    feedbackAdminDom.scope.textContent = "Choose a valid received window before reviewing grouped feedback.";
  } else if (visibleGroups.length) {
    feedbackAdminDom.scope.textContent = `${visibleGroups.length} session group${visibleGroups.length === 1 ? "" : "s"} and ${totalResponses} feedback response${totalResponses === 1 ? "" : "s"} match the current view.`;
  } else if (feedbackAdminState.rows.length) {
    feedbackAdminDom.scope.textContent = hasSearch && hasFeedbackAdminTimeWindow()
      ? "No session groups match the current search inside the selected received window."
      : hasSearch
        ? "No session groups match the current search."
        : hasFeedbackAdminTimeWindow()
          ? filteredRows.length
            ? "No grouped sessions match the current view."
            : "No feedback responses were received in the selected time window."
          : "No session groups match the current view.";
  } else {
    feedbackAdminDom.scope.textContent = "Feedback groups will appear here once the private feedback records are loaded.";
  }

  feedbackAdminDom.groupList.innerHTML = "";
  feedbackAdminDom.groupEmptyState.classList.toggle("hidden", visibleGroups.length > 0);

  visibleGroups.forEach((group) => {
    const button = document.createElement("button");
    const isActive = group.key === feedbackAdminState.selectedGroupKey;
    const averageLabel = Number.isFinite(group.averageOverall) ? `${group.averageOverall.toFixed(1)}/5 overall` : "Earlier form version";

    button.type = "button";
    button.className = `thread-card feedback-admin-group-card${isActive ? " is-active" : ""}`;
    button.dataset.feedbackGroupKey = group.key;
    button.setAttribute("aria-pressed", String(isActive));
    button.innerHTML = `
      <div class="thread-card-head">
        <div>
          <h3>${escapeHtmlFeedbackAdmin(group.title)}</h3>
          <p class="thread-card-meta">${escapeHtmlFeedbackAdmin(group.metaLine || group.productName || "CoreXformer session")}</p>
        </div>
        <span class="status-pill${group.shareableCount ? " status-live" : ""}">${group.responseCount} response${group.responseCount === 1 ? "" : "s"}</span>
      </div>
      <p class="thread-card-copy">${escapeHtmlFeedbackAdmin(`${averageLabel} | ${group.shareableCount} public-share allowed | latest ${formatFeedbackAdminDateTime(group.lastSubmittedAt)}`)}</p>
    `;

    feedbackAdminDom.groupList.appendChild(button);
  });
}

function renderFeedbackAdminSessionDetail() {
  if (!feedbackAdminDom.sessionDetail || !feedbackAdminDom.sessionEmptyState) {
    return;
  }

  const group = getSelectedFeedbackAdminGroup();

  feedbackAdminDom.sessionEmptyState.classList.toggle("hidden", Boolean(group));

  if (!group) {
    feedbackAdminDom.sessionDetail.innerHTML = "";
    return;
  }

  feedbackAdminDom.sessionDetail.innerHTML = `
    <div class="feedback-admin-session-summary">
      <div class="brief-head">
        <div>
          <p class="eyebrow">Selected session batch</p>
          <h3>${escapeHtmlFeedbackAdmin(group.title)}</h3>
        </div>
        <span class="status-pill">${escapeHtmlFeedbackAdmin(`${group.responseCount} feedback`)}</span>
      </div>

      <div class="detail-list feedback-admin-detail-list">
        ${renderFeedbackAdminDetailRow("Organization", group.organizationName || "Not added")}
        ${renderFeedbackAdminDetailRow("Audience", humanizeFeedbackAdminAudience(group.audienceType) || "Mixed group")}
        ${renderFeedbackAdminDetailRow("Program", group.productName || "Not linked")}
        ${renderFeedbackAdminDetailRow("Facilitator", group.facilitatorName || "Not added")}
        ${renderFeedbackAdminDetailRow("Session date", group.sessionDate ? formatFeedbackAdminDate(group.sessionDate) : "Not added")}
        ${renderFeedbackAdminDetailRow("Latest submission", formatFeedbackAdminDateTime(group.lastSubmittedAt))}
      </div>

      <div class="pipeline-grid feedback-admin-summary-grid">
        ${renderFeedbackAdminMetricCard("Overall", formatFeedbackAdminAverage(group.averageOverall), "Average overall session experience rating")}
        ${renderFeedbackAdminMetricCard("Safe space", formatFeedbackAdminAverage(group.averageSafe), "Average safe-space rating")}
        ${renderFeedbackAdminMetricCard("Facilitator impact", formatFeedbackAdminAverage(group.averageFacilitator), "Average facilitator-impact rating")}
        ${renderFeedbackAdminMetricCard("Public sharing", String(group.shareableCount), "Participants who allowed public sharing")}
      </div>
    </div>

    <div class="feedback-admin-response-list">
      ${group.rows.map((row, index) => renderFeedbackAdminResponseCard(row, index)).join("")}
    </div>
  `;
}

function syncFeedbackAdminMobilePanels() {
  const isMobile = isFeedbackAdminMobileLayout();
  const hasSelectedGroup = Boolean(getSelectedFeedbackAdminGroup());
  const showDetail = isMobile && feedbackAdminState.mobileStage === "detail" && hasSelectedGroup;

  feedbackAdminDom.sessionsView?.classList.toggle("feedback-admin-mobile-groups", isMobile && !showDetail);
  feedbackAdminDom.sessionsView?.classList.toggle("feedback-admin-mobile-detail", showDetail);

  if (!isMobile) {
    feedbackAdminDom.groupPanel?.classList.remove("hidden");
    feedbackAdminDom.detailPanel?.classList.remove("hidden");
    feedbackAdminDom.backToGroupsButton?.classList.add("hidden");
    return;
  }

  feedbackAdminDom.groupPanel?.classList.toggle("hidden", showDetail);
  feedbackAdminDom.detailPanel?.classList.toggle("hidden", !showDetail);
  feedbackAdminDom.backToGroupsButton?.classList.toggle("hidden", !showDetail);
}

function isFeedbackAdminMobileLayout() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function queueFeedbackAdminStageScroll(stage) {
  window.requestAnimationFrame(() => {
    const target = stage === "detail"
      ? feedbackAdminDom.detailPanel
      : feedbackAdminDom.groupPanel;

    target?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

function renderFeedbackAdminResponseCard(row, index) {
  const participantLabel = normalizeFeedbackAdminValue(row.display_name) || `Participant ${index + 1}`;
  const roleLabel = normalizeFeedbackAdminValue(row.participant_role) || "Role not captured";
  const overall = formatFeedbackAdminAverage(Number(row.session_experience_rating));
  const facilitator = formatFeedbackAdminAverage(Number(row.facilitator_impact_rating));
  const safe = formatFeedbackAdminAverage(Number(row.safe_space_rating));
  const meaning = formatFeedbackAdminAverage(Number(row.activity_meaning_rating));
  const reflection = formatFeedbackAdminAverage(Number(row.reflection_value_rating));

  return `
    <article class="session-card feedback-admin-response-card">
      <div class="session-card-head">
        <div>
          <h3>${escapeHtmlFeedbackAdmin(participantLabel)}</h3>
          <p class="session-meta">${escapeHtmlFeedbackAdmin(`${roleLabel} | ${formatFeedbackAdminDateTime(row.created_at)}`)}</p>
        </div>
        <span class="status-pill${row.share_publicly ? " status-live" : ""}">${row.share_publicly ? "Public allowed" : "Private only"}</span>
      </div>

      <div class="detail-list feedback-admin-detail-list">
        ${renderFeedbackAdminDetailRow("Participant name", participantLabel)}
        ${renderFeedbackAdminDetailRow("Participant role", roleLabel)}
        ${renderFeedbackAdminDetailRow("Public sharing", row.share_publicly ? "Allowed" : "No")}
        ${renderFeedbackAdminDetailRow("Submitted", formatFeedbackAdminDateTime(row.created_at))}
      </div>

      <div class="feedback-admin-ratings">
        ${renderFeedbackAdminRatingPill("Overall session experience", overall)}
        ${renderFeedbackAdminRatingPill("Safe space", safe)}
        ${renderFeedbackAdminRatingPill("Activity meaning", meaning)}
        ${renderFeedbackAdminRatingPill("Facilitator impact", facilitator)}
        ${renderFeedbackAdminRatingPill("Reflection value", reflection)}
      </div>

      <div class="feedback-admin-question-stack">
        ${renderFeedbackAdminQuestionBlock("1. What moment, realization, or emotional shift stayed with you most?", row.lasting_moment, "Not captured.")}
        ${renderFeedbackAdminQuestionBlock("2. What did this session help you see about your goals, behavior, or the way people work together?", row.teamwork_insight, "Not captured.")}
        ${renderFeedbackAdminQuestionBlock("3. How did the facilitator influence the energy, safety, or learning in the room?", row.facilitator_impact_note, "Not captured in this earlier version of the form.")}
        ${renderFeedbackAdminQuestionBlock("4. What is one behavior, action, or practice you want to carry forward from this session?", row.future_takeaway, "Not captured.")}
        ${renderFeedbackAdminQuestionBlock("5. What would make a future session stronger for your group?", row.improvement_note, "Not captured in this earlier version of the form.")}
      </div>
    </article>
  `;
}

function renderFeedbackAdminDetailRow(label, value) {
  return `
    <div class="detail-row">
      <strong>${escapeHtmlFeedbackAdmin(label)}</strong>
      <span>${escapeHtmlFeedbackAdmin(value)}</span>
    </div>
  `;
}

function renderFeedbackAdminQuestionBlock(label, value, fallbackText) {
  const copy = normalizeFeedbackAdminValue(value) || fallbackText;

  return `
    <article class="feedback-admin-question-block">
      <span>${escapeHtmlFeedbackAdmin(label)}</span>
      <p>${escapeHtmlFeedbackAdmin(copy)}</p>
    </article>
  `;
}

function renderFeedbackAdminRatingPill(label, value) {
  return `
    <article class="feedback-admin-rating-pill">
      <span>${escapeHtmlFeedbackAdmin(label)}</span>
      <strong>${escapeHtmlFeedbackAdmin(value)}</strong>
    </article>
  `;
}

function renderFeedbackAdminMetricCard(label, value, copy) {
  return `
    <div class="pipeline-card">
      <span>${escapeHtmlFeedbackAdmin(label)}</span>
      <strong>${escapeHtmlFeedbackAdmin(value)}</strong>
      <p>${escapeHtmlFeedbackAdmin(copy)}</p>
    </div>
  `;
}

function syncFeedbackAdminButtons() {
  const selectedGroup = getSelectedFeedbackAdminGroup();
  const filteredGroups = getFilteredFeedbackAdminGroups();
  const hasWindowExport = filteredGroups.length > 0 && !hasInvalidFeedbackAdminTimeWindow();
  const groupDisabled = !selectedGroup || feedbackAdminState.isLoading || feedbackAdminState.isExporting;
  const windowDisabled = !hasWindowExport || feedbackAdminState.isLoading || feedbackAdminState.isExporting;

  if (feedbackAdminDom.copyLinkButton) {
    feedbackAdminDom.copyLinkButton.disabled = groupDisabled;
  }

  if (feedbackAdminDom.downloadPdfButton) {
    feedbackAdminDom.downloadPdfButton.disabled = groupDisabled;
    feedbackAdminDom.downloadPdfButton.textContent = feedbackAdminState.isExporting && feedbackAdminState.exportTarget === "group"
      ? "Preparing PDF..."
      : "Download PDF";
  }

  if (feedbackAdminDom.downloadWindowPdfButton) {
    feedbackAdminDom.downloadWindowPdfButton.disabled = windowDisabled;
    feedbackAdminDom.downloadWindowPdfButton.textContent = feedbackAdminState.isExporting && feedbackAdminState.exportTarget === "window"
      ? "Preparing PDF..."
      : "Download window PDF";
  }
}

async function copyFeedbackAdminLink() {
  const selectedGroup = getSelectedFeedbackAdminGroup();

  if (!selectedGroup) {
    return;
  }

  try {
    await copyFeedbackAdminText(buildFeedbackAdminFormUrl(selectedGroup));
    setFeedbackAdminMessage("Session feedback link copied. Share this route after the session so responses stay grouped correctly.", "success");
  } catch (error) {
    setFeedbackAdminMessage("The feedback link could not be copied automatically. Try again in a moment.", "error");
    console.warn("CoreXformer feedback link copy failed.", error);
  }
}

async function downloadFeedbackAdminPdf() {
  const selectedGroup = getSelectedFeedbackAdminGroup();

  if (!selectedGroup) {
    return;
  }

  feedbackAdminState.isExporting = true;
  feedbackAdminState.exportTarget = "group";
  syncFeedbackAdminButtons();
  setFeedbackAdminMessage("Preparing the session feedback PDF...", "info");

  try {
    const jsPDFCtor = await loadFeedbackAdminPdfLibrary();
    const documentInstance = buildFeedbackAdminPdf(jsPDFCtor, selectedGroup);
    documentInstance.save(buildFeedbackAdminPdfFileName(selectedGroup));
    setFeedbackAdminMessage("Session feedback PDF is ready to download.", "success");
  } catch (error) {
    feedbackAdminState.jsPdfLoader = null;
    setFeedbackAdminMessage("The session feedback PDF could not be prepared right now. Please try again shortly.", "error");
    console.warn("CoreXformer feedback PDF export failed.", error);
  } finally {
    feedbackAdminState.isExporting = false;
    feedbackAdminState.exportTarget = "";
    syncFeedbackAdminButtons();
  }
}

async function downloadFilteredFeedbackAdminPdf() {
  const groups = getFilteredFeedbackAdminGroups();

  if (!groups.length || hasInvalidFeedbackAdminTimeWindow()) {
    return;
  }

  feedbackAdminState.isExporting = true;
  feedbackAdminState.exportTarget = "window";
  syncFeedbackAdminButtons();
  setFeedbackAdminMessage("Preparing one PDF for all feedback in the selected received window...", "info");

  try {
    const jsPDFCtor = await loadFeedbackAdminPdfLibrary();
    const documentInstance = buildFeedbackAdminCollectionPdf(jsPDFCtor, groups);
    documentInstance.save(buildFeedbackAdminCollectionPdfFileName(groups));
    setFeedbackAdminMessage("The combined feedback PDF for the selected time window is ready to download.", "success");
  } catch (error) {
    feedbackAdminState.jsPdfLoader = null;
    setFeedbackAdminMessage("The combined feedback PDF could not be prepared right now. Please try again shortly.", "error");
    console.warn("CoreXformer feedback window PDF export failed.", error);
  } finally {
    feedbackAdminState.isExporting = false;
    feedbackAdminState.exportTarget = "";
    syncFeedbackAdminButtons();
  }
}

function buildFeedbackAdminPdf(jsPDFCtor, group) {
  const doc = new jsPDFCtor({
    unit: "pt",
    format: "a4"
  });

  const state = createFeedbackAdminPdfState(doc);

  writeFeedbackAdminPdfTitle(state, "CoreXformer Session Feedback");
  writeFeedbackAdminPdfMeta(state, `Exported on ${formatFeedbackAdminDateTime(new Date().toISOString())}`);
  appendFeedbackAdminGroupPdf(state, group, { startOnNewPage: false, titleFontSize: 22 });

  finalizeFeedbackAdminPdf(doc, state);
  return doc;
}

function buildFeedbackAdminCollectionPdf(jsPDFCtor, groups) {
  const doc = new jsPDFCtor({
    unit: "pt",
    format: "a4"
  });

  const state = createFeedbackAdminPdfState(doc);
  const rows = groups.flatMap((group) => group.rows);
  const shareableCount = rows.filter((row) => row.share_publicly).length;
  const latestDate = rows[0]?.created_at ? formatFeedbackAdminDateTime(rows[0].created_at) : "No responses yet";
  const windowSummary = feedbackAdminDom.windowSummary?.textContent || "Currently showing all feedback received so far.";

  writeFeedbackAdminPdfTitle(state, "CoreXformer Feedback Window Export");
  writeFeedbackAdminPdfMeta(state, `Exported on ${formatFeedbackAdminDateTime(new Date().toISOString())}`);
  writeFeedbackAdminPdfParagraph(state, windowSummary);
  writeFeedbackAdminPdfSection(state, "Window summary");
  writeFeedbackAdminPdfBullet(state, `Session groups in this file: ${groups.length}`);
  writeFeedbackAdminPdfBullet(state, `Feedback responses in this file: ${rows.length}`);
  writeFeedbackAdminPdfBullet(state, `Public sharing allowed: ${shareableCount}`);
  writeFeedbackAdminPdfBullet(state, `Latest receipt in this file: ${latestDate}`);

  groups.forEach((group) => {
    appendFeedbackAdminGroupPdf(state, group, { startOnNewPage: true, titleFontSize: 20 });
  });

  finalizeFeedbackAdminPdf(doc, state);
  return doc;
}

function appendFeedbackAdminGroupPdf(state, group, options = {}) {
  if (options.startOnNewPage) {
    addFeedbackAdminPdfPage(state);
  }

  writeFeedbackAdminPdfTitle(state, group.title, { fontSize: options.titleFontSize || 22, gapAfter: 10 });
  writeFeedbackAdminPdfMeta(state, group.metaLine || "Session details linked through the CoreXformer feedback system.");

  writeFeedbackAdminPdfSection(state, "Session summary");
  writeFeedbackAdminPdfBullet(state, `Organization: ${group.organizationName || "Not added"}`);
  writeFeedbackAdminPdfBullet(state, `Audience: ${humanizeFeedbackAdminAudience(group.audienceType) || "Mixed group"}`);
  writeFeedbackAdminPdfBullet(state, `Program: ${group.productName || "Not linked"}`);
  writeFeedbackAdminPdfBullet(state, `Facilitator: ${group.facilitatorName || "Not added"}`);
  writeFeedbackAdminPdfBullet(state, `Session date: ${group.sessionDate ? formatFeedbackAdminDate(group.sessionDate) : "Not added"}`);
  writeFeedbackAdminPdfBullet(state, `Responses in this file: ${group.responseCount}`);
  writeFeedbackAdminPdfBullet(state, `Public sharing allowed: ${group.shareableCount}`);
  writeFeedbackAdminPdfBullet(state, `Average overall session experience: ${formatFeedbackAdminAverage(group.averageOverall)}`);
  writeFeedbackAdminPdfBullet(state, `Average safe space rating: ${formatFeedbackAdminAverage(group.averageSafe)}`);
  writeFeedbackAdminPdfBullet(state, `Average activity meaning rating: ${formatFeedbackAdminAverage(group.averageMeaning)}`);
  writeFeedbackAdminPdfBullet(state, `Average facilitator impact rating: ${formatFeedbackAdminAverage(group.averageFacilitator)}`);
  writeFeedbackAdminPdfBullet(state, `Average reflection value rating: ${formatFeedbackAdminAverage(group.averageReflection)}`);

  group.rows.forEach((row, index) => {
    addFeedbackAdminPdfPage(state);
    writeFeedbackAdminPdfParticipant(state, row, index, group);
  });
}

function writeFeedbackAdminPdfParticipant(state, row, index, group) {
  writeFeedbackAdminPdfTitle(state, `Participant ${index + 1} of ${group.rows.length}`, { fontSize: 20, gapAfter: 8 });
  writeFeedbackAdminPdfMeta(state, `${normalizeFeedbackAdminValue(row.display_name) || "Unnamed participant"} | ${formatFeedbackAdminDateTime(row.created_at)}`);

  writeFeedbackAdminPdfSection(state, "Context");
  writeFeedbackAdminPdfBullet(state, `Participant name: ${normalizeFeedbackAdminValue(row.display_name) || "Not provided"}`);
  writeFeedbackAdminPdfBullet(state, `Participant role: ${normalizeFeedbackAdminValue(row.participant_role) || "Not captured"}`);
  writeFeedbackAdminPdfBullet(state, `Organization: ${normalizeFeedbackAdminValue(row.organization_name) || group.organizationName || "Not added"}`);
  writeFeedbackAdminPdfBullet(state, `Audience: ${humanizeFeedbackAdminAudience(row.audience_type || group.audienceType) || "Mixed group"}`);
  writeFeedbackAdminPdfBullet(state, `Session title: ${normalizeFeedbackAdminValue(row.session_title) || group.title}`);
  writeFeedbackAdminPdfBullet(state, `Facilitator: ${normalizeFeedbackAdminValue(row.facilitator_name) || group.facilitatorName || "Not added"}`);
  writeFeedbackAdminPdfBullet(state, `Session date: ${normalizeFeedbackAdminValue(row.session_date) ? formatFeedbackAdminDate(row.session_date) : group.sessionDate ? formatFeedbackAdminDate(group.sessionDate) : "Not added"}`);
  writeFeedbackAdminPdfBullet(state, `Public sharing allowed: ${row.share_publicly ? "Yes" : "No"}`);

  writeFeedbackAdminPdfSection(state, "Ratings");
  writeFeedbackAdminPdfBullet(state, `Overall session experience: ${formatFeedbackAdminAverage(Number(row.session_experience_rating))}`);
  writeFeedbackAdminPdfBullet(state, `Safe space: ${formatFeedbackAdminAverage(Number(row.safe_space_rating))}`);
  writeFeedbackAdminPdfBullet(state, `Activity meaning: ${formatFeedbackAdminAverage(Number(row.activity_meaning_rating))}`);
  writeFeedbackAdminPdfBullet(state, `Facilitator impact: ${formatFeedbackAdminAverage(Number(row.facilitator_impact_rating))}`);
  writeFeedbackAdminPdfBullet(state, `Reflection value: ${formatFeedbackAdminAverage(Number(row.reflection_value_rating))}`);
  writeFeedbackAdminPdfParagraph(state, "Rating scale reference: 1 = Poor, 2 = Fair, 3 = Good, 4 = Very good, 5 = Excellent.");

  writeFeedbackAdminPdfSection(state, "Written reflections");
  writeFeedbackAdminPdfQuestion(state, "1. What moment, realization, or emotional shift stayed with you most?", row.lasting_moment, "Not captured.");
  writeFeedbackAdminPdfQuestion(state, "2. What did this session help you see about your goals, behavior, or the way people work together?", row.teamwork_insight, "Not captured.");
  writeFeedbackAdminPdfQuestion(state, "3. How did the facilitator influence the energy, safety, or learning in the room?", row.facilitator_impact_note, "Not captured in this earlier version of the form.");
  writeFeedbackAdminPdfQuestion(state, "4. What is one behavior, action, or practice you want to carry forward from this session?", row.future_takeaway, "Not captured.");
  writeFeedbackAdminPdfQuestion(state, "5. What would make a future session stronger for your group?", row.improvement_note, "Not captured in this earlier version of the form.");
}

function createFeedbackAdminPdfState(doc) {
  return {
    doc,
    margin: 48,
    footerHeight: 28,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    contentWidth: doc.internal.pageSize.getWidth() - 96,
    y: 56
  };
}

function addFeedbackAdminPdfPage(state) {
  state.doc.addPage();
  state.y = 56;
}

function writeFeedbackAdminPdfTitle(state, text, options = {}) {
  const fontSize = options.fontSize || 28;
  const gapAfter = options.gapAfter ?? 12;
  writeFeedbackAdminPdfLines(state, [text], {
    fontSize,
    fontStyle: "bold",
    lineHeight: fontSize + 4,
    gapAfter,
    color: [31, 43, 36]
  });
}

function writeFeedbackAdminPdfMeta(state, text) {
  writeFeedbackAdminPdfLines(state, splitFeedbackAdminPdfText(state, text, 11), {
    fontSize: 11,
    fontStyle: "normal",
    lineHeight: 15,
    gapAfter: 12,
    color: [91, 102, 95]
  });
}

function writeFeedbackAdminPdfSection(state, text) {
  writeFeedbackAdminPdfLines(state, [text], {
    fontSize: 14,
    fontStyle: "bold",
    lineHeight: 18,
    gapAfter: 8,
    color: [47, 107, 80]
  });
}

function writeFeedbackAdminPdfBullet(state, text) {
  writeFeedbackAdminPdfLines(state, splitFeedbackAdminPdfText(state, `- ${text}`, 11), {
    fontSize: 11,
    fontStyle: "normal",
    lineHeight: 15,
    gapAfter: 6,
    color: [31, 43, 36]
  });
}

function writeFeedbackAdminPdfParagraph(state, text) {
  writeFeedbackAdminPdfLines(state, splitFeedbackAdminPdfText(state, text, 11), {
    fontSize: 11,
    fontStyle: "normal",
    lineHeight: 15,
    gapAfter: 10,
    color: [31, 43, 36]
  });
}

function writeFeedbackAdminPdfQuestion(state, label, answer, fallback) {
  writeFeedbackAdminPdfLines(state, splitFeedbackAdminPdfText(state, label, 12), {
    fontSize: 12,
    fontStyle: "bold",
    lineHeight: 16,
    gapAfter: 4,
    color: [31, 43, 36]
  });

  writeFeedbackAdminPdfLines(state, splitFeedbackAdminPdfText(state, normalizeFeedbackAdminValue(answer) || fallback, 11), {
    fontSize: 11,
    fontStyle: "normal",
    lineHeight: 15,
    gapAfter: 10,
    color: [31, 43, 36]
  });
}

function writeFeedbackAdminPdfLines(state, lines, options = {}) {
  const fontSize = options.fontSize || 11;
  const fontStyle = options.fontStyle || "normal";
  const lineHeight = options.lineHeight || 15;
  const gapAfter = options.gapAfter ?? 8;
  const color = options.color || [31, 43, 36];
  const x = options.x || state.margin;
  const availableHeight = state.pageHeight - state.margin - state.footerHeight;
  const printableLines = Array.isArray(lines) ? lines : [String(lines)];
  let lineIndex = 0;

  state.doc.setFont("helvetica", fontStyle);
  state.doc.setFontSize(fontSize);
  state.doc.setTextColor(...color);

  while (lineIndex < printableLines.length) {
    const remainingHeight = availableHeight - state.y;
    const linesThatFit = Math.max(1, Math.floor(remainingHeight / lineHeight));
    const chunk = printableLines.slice(lineIndex, lineIndex + linesThatFit);

    state.doc.text(chunk, x, state.y);
    state.y += chunk.length * lineHeight;
    lineIndex += chunk.length;

    if (lineIndex < printableLines.length) {
      addFeedbackAdminPdfPage(state);
      state.doc.setFont("helvetica", fontStyle);
      state.doc.setFontSize(fontSize);
      state.doc.setTextColor(...color);
    }
  }

  state.y += gapAfter;
}

function splitFeedbackAdminPdfText(state, text, fontSize) {
  state.doc.setFontSize(fontSize);
  return state.doc.splitTextToSize(String(text || ""), state.contentWidth);
}

function finalizeFeedbackAdminPdf(doc, state) {
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(91, 102, 95);
    doc.text(`Page ${page} of ${totalPages}`, state.pageWidth - state.margin, state.pageHeight - 12, { align: "right" });
  }
}

async function loadFeedbackAdminPdfLibrary() {
  if (window.jspdf?.jsPDF) {
    return window.jspdf.jsPDF;
  }

  if (!feedbackAdminState.jsPdfLoader) {
    feedbackAdminState.jsPdfLoader = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-feedback-admin-jspdf]');

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.jspdf?.jsPDF));
        existingScript.addEventListener("error", () => reject(new Error("jsPDF failed to load.")));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
      script.async = true;
      script.dataset.feedbackAdminJspdf = "true";
      script.addEventListener("load", () => {
        if (window.jspdf?.jsPDF) {
          resolve(window.jspdf.jsPDF);
          return;
        }

        reject(new Error("jsPDF did not initialize correctly."));
      });
      script.addEventListener("error", () => {
        reject(new Error("jsPDF could not be loaded."));
      });
      document.head.appendChild(script);
    });
  }

  return feedbackAdminState.jsPdfLoader;
}

function buildFeedbackAdminFormUrl(group) {
  const baseOrigin = resolveFeedbackAdminPublicOrigin();
  const url = new URL("feedback.html", ensureFeedbackAdminTrailingSlash(baseOrigin));

  url.searchParams.set("view", "submit");

  if (group.sessionRunId) {
    url.searchParams.set("sessionRunId", group.sessionRunId);
  }

  if (group.productSlug) {
    url.searchParams.set("productSlug", group.productSlug);
  }

  if (group.productName) {
    url.searchParams.set("productName", group.productName);
  }

  if (group.title) {
    url.searchParams.set("sessionTitle", group.title);
  }

  if (group.facilitatorName) {
    url.searchParams.set("facilitatorName", group.facilitatorName);
  }

  if (group.organizationName) {
    url.searchParams.set("organizationName", group.organizationName);
  }

  if (group.sessionDate) {
    url.searchParams.set("sessionDate", normalizeFeedbackAdminDateParam(group.sessionDate));
  }

  if (group.audienceType) {
    url.searchParams.set("audience", normalizeFeedbackAdminAudienceKey(group.audienceType));
  }

  return url.toString();
}

function resolveFeedbackAdminPublicOrigin() {
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

function ensureFeedbackAdminTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function buildFeedbackAdminPdfFileName(group) {
  const bits = [
    normalizeFeedbackAdminSlug(group.organizationName),
    normalizeFeedbackAdminSlug(group.title),
    normalizeFeedbackAdminSlug(group.sessionDate ? normalizeFeedbackAdminDateParam(group.sessionDate) : "")
  ].filter(Boolean);

  return `${bits.join("-") || "corexformer-session-feedback"}.pdf`;
}

function buildFeedbackAdminCollectionPdfFileName(groups) {
  const bits = [
    "corexformer-feedback-window",
    feedbackAdminState.receivedFrom ? normalizeFeedbackAdminTimestampSlug(feedbackAdminState.receivedFrom) : "",
    feedbackAdminState.receivedTo ? normalizeFeedbackAdminTimestampSlug(feedbackAdminState.receivedTo) : "",
    groups.length ? `${groups.length}-groups` : "",
    groups.reduce((sum, group) => sum + group.responseCount, 0) ? `${groups.reduce((sum, group) => sum + group.responseCount, 0)}-responses` : ""
  ].filter(Boolean);

  return `${bits.join("-")}.pdf`;
}

function hasFeedbackAdminTimeWindow() {
  return Boolean(feedbackAdminState.receivedFrom || feedbackAdminState.receivedTo);
}

function hasInvalidFeedbackAdminTimeWindow() {
  if (!feedbackAdminState.receivedFrom || !feedbackAdminState.receivedTo) {
    return false;
  }

  const fromTimestamp = parseFeedbackAdminDateTimeInput(feedbackAdminState.receivedFrom);
  const toTimestamp = parseFeedbackAdminDateTimeInput(feedbackAdminState.receivedTo);

  return Number.isFinite(fromTimestamp) && Number.isFinite(toTimestamp) && fromTimestamp > toTimestamp;
}

function parseFeedbackAdminDateTimeInput(value) {
  const normalized = normalizeFeedbackAdminValue(value);

  if (!normalized) {
    return Number.NaN;
  }

  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function formatFeedbackAdminInputDateTime(value) {
  const timestamp = parseFeedbackAdminDateTimeInput(value);

  if (!Number.isFinite(timestamp)) {
    return normalizeFeedbackAdminValue(value) || "Not captured";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function normalizeFeedbackAdminTimestampSlug(value) {
  return normalizeFeedbackAdminValue(value)
    .replace(/[^0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatFeedbackAdminAverage(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric.toFixed(1)}/5` : "Not captured";
}

function averageFeedbackAdminMetric(values) {
  const numericValues = (Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!numericValues.length) {
    return Number.NaN;
  }

  const total = numericValues.reduce((sum, value) => sum + value, 0);
  return total / numericValues.length;
}

function maxDate(left, right) {
  const leftTime = sortableFeedbackAdminTime(left);
  const rightTime = sortableFeedbackAdminTime(right);
  return rightTime > leftTime ? right : left;
}

function sortableFeedbackAdminTime(value) {
  const normalized = normalizeFeedbackAdminValue(value);
  const timestamp = normalized ? new Date(normalized).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatFeedbackAdminDate(value) {
  const normalized = normalizeFeedbackAdminValue(value);

  if (!normalized) {
    return "Not added";
  }

  const date = new Date(normalized);

  if (!Number.isFinite(date.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatFeedbackAdminDateTime(value) {
  const normalized = normalizeFeedbackAdminValue(value);

  if (!normalized) {
    return "Not captured";
  }

  const date = new Date(normalized);

  if (!Number.isFinite(date.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function normalizeFeedbackAdminAudienceKey(value) {
  const normalized = normalizeFeedbackAdminValue(value).toLowerCase();

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
    case "government":
      return "government";
    case "communities":
    case "community":
      return "community";
    default:
      return normalized;
  }
}

function humanizeFeedbackAdminAudience(value) {
  switch (normalizeFeedbackAdminAudienceKey(value)) {
    case "school":
      return "Schools";
    case "teacher":
      return "Teachers";
    case "college":
      return "Colleges";
    case "corporate":
      return "Corporates";
    case "government":
      return "Government";
    case "community":
      return "Communities";
    default:
      return normalizeFeedbackAdminValue(value) || "Mixed group";
  }
}

function normalizeFeedbackAdminDateParam(value) {
  const normalized = normalizeFeedbackAdminValue(value);

  if (!normalized) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const date = new Date(normalized);

  if (!Number.isFinite(date.getTime())) {
    return normalized;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeFeedbackAdminValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFeedbackAdminSlug(value) {
  return normalizeFeedbackAdminValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtmlFeedbackAdmin(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isFeedbackAdminSchemaCompatibilityError(error) {
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

function setFeedbackAdminMessage(message, tone = "info") {
  if (!feedbackAdminDom.message) {
    return;
  }

  feedbackAdminDom.message.textContent = message;
  feedbackAdminDom.message.classList.remove("hidden", "is-error", "is-success");

  if (tone === "error") {
    feedbackAdminDom.message.classList.add("is-error");
    return;
  }

  if (tone === "success") {
    feedbackAdminDom.message.classList.add("is-success");
  }
}

function clearFeedbackAdminMessage() {
  if (!feedbackAdminDom.message) {
    return;
  }

  feedbackAdminDom.message.textContent = "";
  feedbackAdminDom.message.classList.add("hidden");
  feedbackAdminDom.message.classList.remove("is-error", "is-success");
}

async function copyFeedbackAdminText(value) {
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
