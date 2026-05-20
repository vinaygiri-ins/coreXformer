const APPLICATION_ADMIN_ROLES = ["owner", "editor"];
const APPLICATION_STATUS_LABELS = {
  submitted: "Submitted",
  screening: "Screening",
  shortlisted: "Shortlisted",
  invited_to_onboarding: "Invited",
  rejected: "Rejected",
  archived: "Archived"
};

const applicationDom = {
  section: document.getElementById("applicationReviewSection"),
  stats: document.getElementById("applicationStats"),
  list: document.getElementById("applicationList"),
  emptyState: document.getElementById("applicationEmptyState"),
  message: document.getElementById("applicationsMessage")
};

const applicationState = {
  supabase: null,
  session: null,
  profile: null,
  applications: [],
  tableAvailable: true
};

document.addEventListener("DOMContentLoaded", () => {
  void initApplicationReview();
});

async function initApplicationReview() {
  if (!applicationDom.section || !window.COREXFORMER_STUDIO_CONFIG || !window.supabase?.createClient) {
    return;
  }

  applicationState.supabase = window.supabase.createClient(
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

  bindApplicationEvents();

  const {
    data: { session }
  } = await applicationState.supabase.auth.getSession();

  await handleApplicationSession(session);

  applicationState.supabase.auth.onAuthStateChange((_event, sessionUpdate) => {
    void handleApplicationSession(sessionUpdate);
  });
}

function bindApplicationEvents() {
  applicationDom.list?.addEventListener("click", (event) => {
    const saveButton = event.target.closest("[data-application-save]");
    const inviteButton = event.target.closest("[data-application-invite]");
    const copyInviteButton = event.target.closest("[data-application-copy-invite]");

    if (inviteButton) {
      const card = inviteButton.closest("[data-application-card]");

      if (!card) {
        return;
      }

      void inviteApplicationToOnboarding(card.dataset.applicationCard);
      return;
    }

    if (copyInviteButton) {
      const card = copyInviteButton.closest("[data-application-card]");

      if (!card) {
        return;
      }

      void copyApplicationInvite(card.dataset.applicationCard);
      return;
    }

    if (!saveButton) {
      return;
    }

    const card = saveButton.closest("[data-application-card]");

    if (!card) {
      return;
    }

    void saveApplicationReview(card.dataset.applicationCard);
  });
}

async function handleApplicationSession(session) {
  applicationState.session = session ?? null;
  applicationState.profile = null;
  applicationState.applications = [];
  applicationState.tableAvailable = true;

  if (!applicationState.session) {
    hideApplications();
    return;
  }

  try {
    applicationState.profile = await waitForApplicationProfile(applicationState.session.user.id);

    if (!isApplicationAdmin()) {
      hideApplications();
      return;
    }

    applicationDom.section.classList.remove("hidden");
    await loadApplications();
    renderApplications();
  } catch (error) {
    applicationDom.section.classList.remove("hidden");
    showApplicationAdminMessage(error.message || "The facilitator application queue could not be loaded.", "error");
    renderApplicationStats();
    renderApplicationCards();
  }
}

async function waitForApplicationProfile(userId, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await applicationState.supabase
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

    await new Promise((resolve) => {
      window.setTimeout(resolve, 900);
    });
  }

  return null;
}

async function loadApplications() {
  clearApplicationAdminMessage();

  const { data, error } = await applicationState.supabase
    .from("facilitator_applications")
    .select("id, full_name, email, phone, city, background, experience_summary, audience_interest, product_interest, availability, motivation, application_status, review_notes, reviewed_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    if (isApplicationsTableMissing(error)) {
      applicationState.tableAvailable = false;
      showApplicationAdminMessage(
        "The facilitator application table is not enabled yet. Run facilitator-applications-v1.sql in Supabase to activate this queue.",
        "error"
      );
      return;
    }

    throw error;
  }

  applicationState.tableAvailable = true;
  applicationState.applications = Array.isArray(data) ? data : [];
}

async function inviteApplicationToOnboarding(applicationId) {
  const card = applicationDom.list?.querySelector(`[data-application-card="${applicationId}"]`);

  if (!card) {
    return;
  }

  const statusInput = card.querySelector("[data-application-status]");
  const notesInput = card.querySelector("[data-application-notes]");

  if (statusInput) {
    statusInput.value = "invited_to_onboarding";
  }

  if (notesInput && !normalizeApplicationValue(notesInput.value)) {
    notesInput.value = buildInviteReviewNote();
  }

  await performApplicationReviewSave(applicationId, {
    successMessage: "Application marked as invited to onboarding."
  });
}

async function copyApplicationInvite(applicationId) {
  const application = applicationState.applications.find((item) => item.id === applicationId);

  if (!application) {
    return;
  }

  const inviteCopy = buildInviteCopy(application);

  try {
    await navigator.clipboard.writeText(inviteCopy);
    showApplicationAdminMessage("Onboarding invitation copy is ready to paste.", "success");
  } catch (error) {
    showApplicationAdminMessage("The invitation copy could not reach the clipboard on this browser yet.", "error");
    console.warn("CoreXformer application invite copy failed.", error);
  }
}

async function saveApplicationReview(applicationId) {
  return performApplicationReviewSave(applicationId, {});
}

async function performApplicationReviewSave(applicationId, options = {}) {
  if (!isApplicationAdmin()) {
    showApplicationAdminMessage("Only owner or editor accounts can review facilitator applications.", "error");
    return;
  }

  const card = applicationDom.list?.querySelector(`[data-application-card="${applicationId}"]`);

  if (!card) {
    return;
  }

  const statusInput = card.querySelector("[data-application-status]");
  const notesInput = card.querySelector("[data-application-notes]");
  const saveButton = card.querySelector("[data-application-save]");

  if (!statusInput || !notesInput || !saveButton) {
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";
  showApplicationAdminMessage("Saving application review...", "info");

  const payload = {
    application_status: statusInput.value,
    review_notes: normalizeApplicationValue(notesInput.value) || null,
    reviewed_by: applicationState.profile?.id || null,
    reviewed_at: new Date().toISOString()
  };

  const { error } = await applicationState.supabase
    .from("facilitator_applications")
    .update(payload)
    .eq("id", applicationId);

  saveButton.disabled = false;
  saveButton.textContent = "Save review";

  if (error) {
    showApplicationAdminMessage(error.message || "The application review could not be saved.", "error");
    return;
  }

  const application = applicationState.applications.find((item) => item.id === applicationId);

  if (application) {
    application.application_status = payload.application_status;
    application.review_notes = payload.review_notes;
    application.reviewed_at = payload.reviewed_at;
  }

  showApplicationAdminMessage(options.successMessage || "Application review saved.", "success");
  renderApplications();
}

function renderApplications() {
  applicationDom.section.classList.remove("hidden");
  renderApplicationStats();
  renderApplicationCards();
}

function renderApplicationStats() {
  if (!applicationDom.stats) {
    return;
  }

  const submitted = applicationState.applications.filter((item) => item.application_status === "submitted").length;
  const screening = applicationState.applications.filter((item) => item.application_status === "screening" || item.application_status === "shortlisted").length;
  const invited = applicationState.applications.filter((item) => item.application_status === "invited_to_onboarding").length;
  const closed = applicationState.applications.filter((item) => item.application_status === "rejected" || item.application_status === "archived").length;

  applicationDom.stats.innerHTML = [
    renderApplicationMetric("Submitted", submitted, "Fresh join requests waiting for first review."),
    renderApplicationMetric("Screening", screening, "Applications currently being reviewed or shortlisted."),
    renderApplicationMetric("Invited", invited, "People ready to move into onboarding and credential creation."),
    renderApplicationMetric("Closed", closed, "Applications that were declined or archived.")
  ].join("");
}

function renderApplicationMetric(label, value, copy) {
  return `
    <div class="pipeline-card">
      <span>${escapeApplicationHtml(label)}</span>
      <strong>${escapeApplicationHtml(String(value))}</strong>
      <p>${escapeApplicationHtml(copy)}</p>
    </div>
  `;
}

function renderApplicationCards() {
  if (!applicationDom.list || !applicationDom.emptyState) {
    return;
  }

  if (!applicationState.tableAvailable) {
    applicationDom.list.innerHTML = "";
    applicationDom.emptyState.classList.add("hidden");
    return;
  }

  if (!applicationState.applications.length) {
    applicationDom.list.innerHTML = "";
    applicationDom.emptyState.classList.remove("hidden");
    return;
  }

  applicationDom.emptyState.classList.add("hidden");
  applicationDom.list.innerHTML = applicationState.applications
    .map((application) => renderApplicationCard(application))
    .join("");
}

function renderApplicationCard(application) {
  const audiences = renderApplicationChipList(application.audience_interest);
  const products = renderApplicationChipList(application.product_interest);
  const background = escapeApplicationHtml(normalizeApplicationValue(application.background) || "Not shared");
  const experience = escapeApplicationHtml(normalizeApplicationValue(application.experience_summary) || "No experience summary shared yet.");
  const availability = escapeApplicationHtml(normalizeApplicationValue(application.availability) || "Not specified");
  const motivation = escapeApplicationHtml(normalizeApplicationValue(application.motivation) || "No motivation shared.");
  const reviewNotes = escapeApplicationHtml(normalizeApplicationValue(application.review_notes));

  return `
    <article class="application-card" data-application-card="${escapeApplicationHtml(application.id)}">
      <div class="application-card-head">
        <div>
          <h3>${escapeApplicationHtml(application.full_name)}</h3>
          <p class="application-meta">${escapeApplicationHtml(application.city)} · ${escapeApplicationHtml(application.email)} · ${escapeApplicationHtml(application.phone)}</p>
        </div>
        <span class="status-pill">${escapeApplicationHtml(humanizeApplicationStatus(application.application_status))}</span>
      </div>

      <div class="application-field-grid">
        <div class="application-field-block">
          <strong>Background</strong>
          <p>${background}</p>
        </div>
        <div class="application-field-block">
          <strong>How they want to begin</strong>
          <p>${availability}</p>
        </div>
      </div>

      <div class="application-field-block">
        <strong>Experience summary</strong>
        <p>${experience}</p>
      </div>

      <div class="application-field-block">
        <strong>Why they want to join</strong>
        <p>${motivation}</p>
      </div>

      <div class="application-field-grid">
        <div class="application-field-block">
          <strong>Audience interest</strong>
          <div class="application-chip-list">${audiences}</div>
        </div>
        <div class="application-field-block">
          <strong>Product interest</strong>
          <div class="application-chip-list">${products}</div>
        </div>
      </div>

      <div class="application-field-grid application-review-grid">
        <label>
          <span>Review status</span>
          <select data-application-status>
            ${renderApplicationStatusOptions(application.application_status)}
          </select>
        </label>
        <label>
          <span>Review notes</span>
          <textarea data-application-notes rows="4" placeholder="Private review notes, next steps, or why this person is being shortlisted.">${reviewNotes}</textarea>
        </label>
      </div>

      <div class="application-actions">
        <div class="inline-action-group">
          <button type="button" class="button" data-application-save>Save review</button>
          <button type="button" class="button button-ghost" data-application-invite>Invite to onboarding</button>
          <button type="button" class="button button-muted" data-application-copy-invite>Copy invite note</button>
        </div>
        <p class="application-meta">Submitted ${formatApplicationDate(application.created_at)}${application.reviewed_at ? ` · reviewed ${formatApplicationDate(application.reviewed_at)}` : ""}</p>
      </div>
    </article>
  `;
}

function renderApplicationStatusOptions(activeStatus) {
  return Object.keys(APPLICATION_STATUS_LABELS)
    .map((status) => {
      const selected = status === activeStatus ? " selected" : "";
      return `<option value="${escapeApplicationHtml(status)}"${selected}>${escapeApplicationHtml(APPLICATION_STATUS_LABELS[status])}</option>`;
    })
    .join("");
}

function renderApplicationChipList(values) {
  const safeValues = Array.isArray(values) ? values.map(normalizeApplicationValue).filter(Boolean) : [];

  if (!safeValues.length) {
    return `<span class="application-chip">Not specified</span>`;
  }

  return safeValues
    .map((value) => `<span class="application-chip">${escapeApplicationHtml(humanizeApplicationValue(value))}</span>`)
    .join("");
}

function humanizeApplicationStatus(status) {
  return APPLICATION_STATUS_LABELS[status] || "Submitted";
}

function humanizeApplicationValue(value) {
  return String(value)
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatApplicationDate(value) {
  if (!value) {
    return "recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function isApplicationAdmin() {
  return Boolean(
    applicationState.session
    && applicationState.profile
    && APPLICATION_ADMIN_ROLES.includes(applicationState.profile.role)
  );
}

function isApplicationsTableMissing(error) {
  const errorText = String(error?.message || "").toLowerCase();

  return errorText.includes("facilitator_applications") && (
    errorText.includes("does not exist")
    || errorText.includes("schema cache")
    || errorText.includes("permission denied")
    || errorText.includes("row-level")
  );
}

function hideApplications() {
  applicationDom.section?.classList.add("hidden");
  applicationState.applications = [];
  clearApplicationAdminMessage();
}

function showApplicationAdminMessage(message, tone = "info") {
  if (!applicationDom.message) {
    return;
  }

  applicationDom.message.textContent = message;
  applicationDom.message.classList.remove("hidden", "is-error", "is-success");

  if (tone === "error") {
    applicationDom.message.classList.add("is-error");
  } else if (tone === "success") {
    applicationDom.message.classList.add("is-success");
  }
}

function clearApplicationAdminMessage() {
  if (!applicationDom.message) {
    return;
  }

  applicationDom.message.textContent = "";
  applicationDom.message.classList.add("hidden");
  applicationDom.message.classList.remove("is-error", "is-success");
}

function normalizeApplicationValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildInviteReviewNote() {
  return "Invite this person into onboarding. Once the backend activation flow is live, they should activate access through /studio/ using Facilitator > Activate invited account.";
}

function buildInviteCopy(application) {
  const firstName = normalizeApplicationValue(application.full_name).split(" ")[0] || "there";
  return [
    `Hello ${firstName},`,
    "",
    "Your CoreXformer application has been reviewed and you are invited into onboarding.",
    "",
    "Next step:",
    "1. Open https://corexformer.pages.dev/studio/",
    "2. Choose Facilitator",
    "3. Switch to Activate invited account",
    "4. Use the same email address you applied with and create your password",
    "",
    "After activation, you will enter the facilitator workspace through the onboarding side first.",
    "",
    "If the activation step does not work yet, reply back and CoreXformer will complete the backend activation for your invite.",
    "",
    "Warmly,",
    "CoreXformer"
  ].join("\n");
}

function escapeApplicationHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
