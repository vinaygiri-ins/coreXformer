(function initCoreXformerFeedback() {
  const config = window.COREXFORMER_PUBLIC_CONFIG;
  const supabaseLib = window.supabase;

  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !supabaseLib?.createClient) {
    return;
  }

  const supabase = supabaseLib.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  applyFeedbackContext();

  const feedbackForm = document.querySelector("[data-feedback-form]");
  const shareToggle = document.querySelector("[data-share-toggle]");
  const shareNameWrap = document.querySelector("[data-share-name-wrap]");

  if (shareToggle && shareNameWrap) {
    shareToggle.addEventListener("change", () => {
      shareNameWrap.classList.toggle("hidden", !shareToggle.checked);
    });
  }

  if (feedbackForm) {
    feedbackForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitFeedback(supabase, feedbackForm);
    });
  }

  if (document.querySelector("[data-feedback-total], [data-feedback-quote-grid]")) {
    void loadFeedbackInsights(supabase);
  }
})();

async function submitFeedback(supabase, feedbackForm) {
  const submitButton = feedbackForm.querySelector("[data-feedback-submit]");
  const messageElement = feedbackForm.querySelector("[data-feedback-message]");
  const shareToggle = feedbackForm.querySelector("[data-share-toggle]");
  const shareNameField = feedbackForm.querySelector('[name="displayName"]');
  const formData = new FormData(feedbackForm);

  const payload = {
    organization_name: normalizeValue(formData.get("organizationName")),
    audience_type: normalizeValue(formData.get("audienceType")),
    safe_space_rating: Number(formData.get("safeSpaceRating")),
    activity_meaning_rating: Number(formData.get("activityMeaningRating")),
    reflection_value_rating: Number(formData.get("reflectionValueRating")),
    lasting_moment: normalizeValue(formData.get("lastingMoment")),
    teamwork_insight: normalizeValue(formData.get("teamworkInsight")),
    future_takeaway: normalizeValue(formData.get("futureTakeaway")),
    share_publicly: Boolean(shareToggle?.checked),
    display_name: shareToggle?.checked ? normalizeValue(formData.get("displayName")) : null
  };

  if (!payload.safe_space_rating || !payload.activity_meaning_rating || !payload.reflection_value_rating) {
    showFeedbackMessage(messageElement, "Please complete the three reflection ratings before submitting.", "error");
    return;
  }

  if (!payload.lasting_moment || !payload.teamwork_insight || !payload.future_takeaway) {
    showFeedbackMessage(messageElement, "Please answer the three written reflection questions before submitting.", "error");
    return;
  }

  if (payload.share_publicly && !payload.display_name) {
    showFeedbackMessage(messageElement, "If you would like your words to appear on the site, add a name or a simple identifier.", "error");
    if (shareNameField) {
      shareNameField.focus();
    }
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sharing reflection...";
  }

  showFeedbackMessage(messageElement, "Saving your reflection...", "info");

  const { error } = await supabase
    .from("session_feedback")
    .insert([payload]);

  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = "Share Reflection";
  }

  if (error) {
    showFeedbackMessage(
      messageElement,
      "Your reflection could not be saved yet. Please try once more in a moment.",
      "error"
    );
    console.warn("CoreXformer feedback submission failed.", error);
    return;
  }

  feedbackForm.reset();

  const shareNameWrap = feedbackForm.querySelector("[data-share-name-wrap]");

  if (shareNameWrap) {
    shareNameWrap.classList.add("hidden");
  }

  showFeedbackMessage(
    messageElement,
    "Thank you. Your reflection has been received and will help shape the evolving story of this work.",
    "success"
  );

  await loadFeedbackInsights(supabase);
}

async function loadFeedbackInsights(supabase) {
  const { data, error } = await supabase
    .from("session_feedback")
    .select([
      "audience_type",
      "safe_space_rating",
      "activity_meaning_rating",
      "reflection_value_rating",
      "lasting_moment",
      "teamwork_insight",
      "future_takeaway",
      "share_publicly",
      "display_name",
      "created_at"
    ].join(","))
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    console.warn("CoreXformer feedback insights could not be loaded.", error);
    renderFeedbackFallback();
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  renderFeedbackStats(rows);
  renderFeedbackQuotes(rows);
}

function renderFeedbackStats(rows) {
  const total = rows.length;
  const safeAverage = average(rows.map((row) => row.safe_space_rating));
  const activityAverage = average(rows.map((row) => row.activity_meaning_rating));
  const reflectionAverage = average(rows.map((row) => row.reflection_value_rating));

  setTextForAll("[data-feedback-total]", total ? String(total) : "0");
  setTextForAll("[data-feedback-safe]", total ? `${safeAverage.toFixed(1)} / 5` : "—");
  setTextForAll("[data-feedback-activity]", total ? `${activityAverage.toFixed(1)} / 5` : "—");
  setTextForAll("[data-feedback-reflection]", total ? `${reflectionAverage.toFixed(1)} / 5` : "—");
}

function renderFeedbackQuotes(rows) {
  const quotes = rows
    .filter((row) => row.share_publicly)
    .map((row) => buildQuotePayload(row))
    .filter(Boolean);

  document.querySelectorAll("[data-feedback-quote-grid]").forEach((grid) => {
    const limit = Number(grid.dataset.feedbackQuoteLimit || 3);
    const selectedQuotes = quotes.slice(0, limit);

    grid.innerHTML = "";

    if (!selectedQuotes.length) {
      const emptyCard = document.createElement("article");
      emptyCard.className = "reflection-card reflection-card-empty";
      emptyCard.innerHTML = `
        <p class="eyebrow">Participant reflections</p>
        <h3>The first public reflections will appear here.</h3>
        <p>Once participants allow a short line to be shared, this space will begin carrying their words forward.</p>
      `;
      grid.appendChild(emptyCard);
      return;
    }

    selectedQuotes.forEach((quote) => {
      const article = document.createElement("article");
      article.className = "reflection-card";
      article.innerHTML = `
        <p class="eyebrow">${escapeHtml(quote.label)}</p>
        <blockquote>${escapeHtml(quote.text)}</blockquote>
        <p class="reflection-credit">${escapeHtml(quote.name)}</p>
      `;
      grid.appendChild(article);
    });
  });
}

function buildQuotePayload(row) {
  const candidates = [
    { label: "Carrying forward", text: normalizeValue(row.future_takeaway) },
    { label: "Team insight", text: normalizeValue(row.teamwork_insight) },
    { label: "What stayed", text: normalizeValue(row.lasting_moment) }
  ];

  const selected = candidates.find((candidate) => candidate.text);

  if (!selected) {
    return null;
  }

  return {
    label: selected.label,
    text: selected.text,
    name: normalizeValue(row.display_name) || "Participant reflection"
  };
}

function renderFeedbackFallback() {
  setTextForAll("[data-feedback-total]", "0");
  setTextForAll("[data-feedback-safe]", "—");
  setTextForAll("[data-feedback-activity]", "—");
  setTextForAll("[data-feedback-reflection]", "—");
}

function applyFeedbackContext() {
  const banner = document.querySelector("[data-feedback-context-banner]");
  const titleElement = document.querySelector("[data-feedback-context-title]");
  const bodyElement = document.querySelector("[data-feedback-context-body]");
  const audienceField = document.querySelector('[name="audienceType"]');
  const params = new URLSearchParams(window.location.search);
  const productName = normalizeValue(params.get("productName"));
  const rawAudience = normalizeValue(params.get("audience")).toLowerCase();
  const sessionTitle = normalizeValue(params.get("sessionTitle"));
  const audienceMap = {
    schools: "school",
    school: "school",
    colleges: "college",
    college: "college",
    teachers: "school",
    corporates: "corporate",
    corporate: "corporate",
    government: "government",
    communities: "community",
    community: "community"
  };
  const audienceValue = audienceMap[rawAudience] || "";

  if (audienceField && audienceValue && !audienceField.value) {
    audienceField.value = audienceValue;
  }

  if (!banner || !titleElement || !bodyElement || !productName) {
    return;
  }

  const contextBits = [];

  if (sessionTitle) {
    contextBits.push(`session: ${sessionTitle}`);
  }

  if (audienceValue) {
    contextBits.push(`audience: ${audienceValue}`);
  }

  titleElement.textContent = `Feedback for ${productName}`;
  bodyElement.textContent = contextBits.length
    ? `You arrived here from a specific CoreXformer product. This reflection is being written for ${productName} (${contextBits.join(" · ")}). As the product system matures, approved reflections from this flow will appear under that product directly.`
    : `You arrived here from a specific CoreXformer product. This reflection is being written for ${productName}. As the product system matures, approved reflections from this flow will appear under that product directly.`;
  banner.classList.remove("hidden");
  document.title = `CoreXformer | Feedback for ${productName}`;
}

function showFeedbackMessage(element, text, tone) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.classList.remove("hidden", "is-error", "is-success", "is-info");
  element.classList.add(`is-${tone || "info"}`);
}

function setTextForAll(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
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
