const websiteInsightsDom = {
  message: document.getElementById("websiteInsightsMessage"),
  scope: document.getElementById("websiteInsightsScope"),
  rangeButtons: Array.from(document.querySelectorAll("[data-insights-range]")),
  summaryCards: document.getElementById("websiteInsightsSummaryCards"),
  highlights: document.getElementById("websiteInsightsHighlights"),
  recentList: document.getElementById("websiteInsightsRecentList"),
  pagesList: document.getElementById("websiteInsightsPagesList"),
  landingList: document.getElementById("websiteInsightsLandingList"),
  sourcesList: document.getElementById("websiteInsightsSourcesList"),
  searchList: document.getElementById("websiteInsightsSearchList"),
  timezoneList: document.getElementById("websiteInsightsTimezoneList"),
  journeysList: document.getElementById("websiteInsightsJourneysList"),
  recentSessionsList: document.getElementById("websiteInsightsRecentSessionsList"),
  formsList: document.getElementById("websiteInsightsFormsList"),
  conversionList: document.getElementById("websiteInsightsConversionList")
};

const websiteInsightsState = {
  supabase: null,
  isAdmin: false,
  rangeDays: 30,
  isLoading: false
};

document.addEventListener("DOMContentLoaded", () => {
  bindWebsiteInsightsEvents();

  if (window.COREXFORMER_ADMIN_CONTEXT) {
    void handleWebsiteInsightsContext(window.COREXFORMER_ADMIN_CONTEXT);
  }
});

document.addEventListener("corexformer:admin-context", (event) => {
  void handleWebsiteInsightsContext(event.detail);
});

function bindWebsiteInsightsEvents() {
  websiteInsightsDom.rangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextRange = button.dataset.insightsRange;

      if (!nextRange) {
        return;
      }

      websiteInsightsState.rangeDays = nextRange === "all" ? "all" : Number(nextRange);
      syncWebsiteInsightsRangeTabs();

      if (websiteInsightsState.isAdmin && websiteInsightsState.supabase) {
        void loadWebsiteInsights();
      }
    });
  });
}

async function handleWebsiteInsightsContext(detail) {
  websiteInsightsState.supabase = detail?.supabase ?? null;
  websiteInsightsState.isAdmin = Boolean(detail?.isAdmin);

  if (!websiteInsightsState.isAdmin || !websiteInsightsState.supabase) {
    clearWebsiteInsightsUi();
    return;
  }

  syncWebsiteInsightsRangeTabs();
  await loadWebsiteInsights();
}

async function loadWebsiteInsights() {
  if (websiteInsightsState.isLoading || !websiteInsightsState.supabase) {
    return;
  }

  websiteInsightsState.isLoading = true;
  setWebsiteInsightsMessage("Loading website insight signals...", "info");
  setWebsiteInsightsScope("Preparing the current analytics window...");

  try {
    const events = await fetchWebsiteInsightEvents();
    const aggregate = aggregateWebsiteInsights(events);
    renderWebsiteInsights(aggregate);
    clearWebsiteInsightsMessage();
  } catch (error) {
    const errorText = String(error?.message || "");
    const backendNotReady = errorText.includes("website_analytics_events") && (
      errorText.includes("does not exist")
      || errorText.includes("schema cache")
      || errorText.includes("permission denied")
      || errorText.includes("row-level")
    );

    setWebsiteInsightsScope("Website insights are not available yet.");
    setWebsiteInsightsMessage(
      backendNotReady
        ? "Website insights backend is not enabled yet. Apply website-insights-v1.sql in Supabase and refresh this page."
        : "Website insights could not be loaded right now. Please try again shortly.",
      "error"
    );
    clearWebsiteInsightsLists();
    console.warn("CoreXformer website insights could not be loaded.", error);
  } finally {
    websiteInsightsState.isLoading = false;
  }
}

async function fetchWebsiteInsightEvents() {
  let query = websiteInsightsState.supabase
    .from("website_analytics_events")
    .select([
      "session_id",
      "event_name",
      "page_path",
      "page_slug",
      "page_title",
      "landing_path",
      "previous_path",
      "referrer_host",
      "referrer_type",
      "search_engine",
      "search_query",
      "source_label",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "device_type",
      "browser_name",
      "os_name",
      "language",
      "timezone",
      "form_name",
      "form_context",
      "metadata",
      "created_at"
    ].join(","))
    .order("created_at", { ascending: false })
    .limit(3000);

  if (websiteInsightsState.rangeDays !== "all") {
    const since = new Date(Date.now() - Number(websiteInsightsState.rangeDays) * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

function aggregateWebsiteInsights(events) {
  const sortedAscending = [...events].sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
  const pageViews = sortedAscending.filter((event) => event.event_name === "page_view");
  const formSubmissions = sortedAscending.filter((event) => event.event_name === "form_submit");
  const uniqueSessionCount = new Set(sortedAscending.map((event) => event.session_id).filter(Boolean)).size;
  const sessionSummaries = collectSessionSummaries(sortedAscending);
  const sourceCounts = collectCounts(sessionSummaries, (event) => event.sourceLabel || "Direct");
  const pageCounts = collectPageCounts(pageViews, formSubmissions);
  const landingCounts = collectCounts(sessionSummaries, (event) => event.landingPath || "/");
  const searchCounts = collectSearchCounts(sessionSummaries);
  const timezoneCounts = collectCounts(sessionSummaries, (event) => event.timezone || "Unknown timezone");
  const recentPageViews = [...pageViews].sort((left, right) => new Date(right.created_at) - new Date(left.created_at)).slice(0, 8);
  const formsByName = collectFormCounts(formSubmissions);
  const conversionsByLanding = collectCounts(formSubmissions, (event) => event.landing_path || event.page_path || "/");
  const journeyCounts = collectJourneyCounts(sessionSummaries);
  const topPage = pageCounts[0] || null;
  const topSource = sourceCounts[0] || null;
  const topSearch = searchCounts[0] || null;

  return {
    events,
    pageViews,
    formSubmissions,
    uniqueSessionCount,
    sourceCounts,
    pageCounts,
    landingCounts,
    searchCounts,
    timezoneCounts,
    recentPageViews,
    formsByName,
    conversionsByLanding,
    sessionSummaries,
    journeyCounts,
    summary: {
      totalPageViews: pageViews.length,
      uniqueSessions: uniqueSessionCount,
      formSubmissions: formSubmissions.length,
      topPage,
      topSource,
      topSearch
    }
  };
}

function renderWebsiteInsights(aggregate) {
  const rangeLabel = websiteInsightsState.rangeDays === "all"
    ? "all tracked public activity currently available"
    : `the last ${websiteInsightsState.rangeDays} days`;

  setWebsiteInsightsScope(
    `${aggregate.summary.totalPageViews} page views, ${aggregate.summary.uniqueSessions} sessions, and ${aggregate.summary.formSubmissions} successful form submissions observed across ${rangeLabel}.`
  );

  renderWebsiteInsightsSummary(aggregate.summary);
  renderWebsiteInsightsHighlights(aggregate);
  renderWebsiteInsightsRecent(aggregate.recentPageViews);
  renderWebsiteInsightsPages(aggregate.pageCounts);
  renderWebsiteInsightsLandingPages(aggregate.landingCounts);
  renderWebsiteInsightsSources(aggregate.sourceCounts);
  renderWebsiteInsightsSearches(aggregate.searchCounts);
  renderWebsiteInsightsTimezones(aggregate.timezoneCounts);
  renderWebsiteInsightsJourneys(aggregate.journeyCounts);
  renderWebsiteInsightsRecentSessions(aggregate.sessionSummaries);
  renderWebsiteInsightsForms(aggregate.formsByName);
  renderWebsiteInsightsConversions(aggregate.conversionsByLanding, aggregate.formSubmissions);
}

function renderWebsiteInsightsSummary(summary) {
  if (!websiteInsightsDom.summaryCards) {
    return;
  }

  const cards = [
    {
      label: "Page views",
      value: String(summary.totalPageViews),
      copy: "How many public page views were captured in the current window."
    },
    {
      label: "Sessions",
      value: String(summary.uniqueSessions),
      copy: "Approximate anonymous visitor sessions across the public website."
    },
    {
      label: "Successful forms",
      value: String(summary.formSubmissions),
      copy: "Inquiry, facilitator application, and feedback submissions that completed successfully."
    },
    {
      label: "Top source",
      value: summary.topSource?.label || "None yet",
      copy: summary.topSource ? `${summary.topSource.count} sessions came through the strongest observed entry source.` : "No source signal has been captured yet."
    }
  ];

  websiteInsightsDom.summaryCards.innerHTML = cards.map((card) => `
    <article class="pipeline-card website-insight-summary-card">
      <span>${escapeWebsiteInsightsHtml(card.label)}</span>
      <strong>${escapeWebsiteInsightsHtml(card.value)}</strong>
      <p>${escapeWebsiteInsightsHtml(card.copy)}</p>
    </article>
  `).join("");
}

function renderWebsiteInsightsHighlights(aggregate) {
  if (!websiteInsightsDom.highlights) {
    return;
  }

  const items = [
    aggregate.summary.topPage
      ? {
          title: "Most visited page",
          copy: `${getReadablePageLabel(aggregate.summary.topPage.label, aggregate.summary.topPage.title)} led with ${aggregate.summary.topPage.count} views across ${aggregate.summary.topPage.sessionCount} sessions.`
        }
      : null,
    aggregate.summary.topSearch
      ? {
          title: "Search term signal",
          copy: `"${aggregate.summary.topSearch.label}" appeared ${aggregate.summary.topSearch.count} times in visible search-referrer data.`
        }
      : {
          title: "Search term signal",
          copy: "No visible search query has been exposed by referrers in the current window yet. That is normal when search engines hide the exact term."
        },
    aggregate.sourceCounts[0]
      ? {
          title: "Strongest entry path",
          copy: `${aggregate.sourceCounts[0].label} is currently the largest observed source with ${aggregate.sourceCounts[0].count} sessions.`
        }
      : null,
    aggregate.formsByName[0]
      ? {
          title: "Form movement",
          copy: `${getReadableFormName(aggregate.formsByName[0].label)} leads the successful form activity with ${aggregate.formsByName[0].count} completions.`
        }
      : {
          title: "Form movement",
          copy: "No successful form submissions have been captured in this current window yet."
        }
  ].filter(Boolean);

  websiteInsightsDom.highlights.innerHTML = items.map((item) => `
    <article class="path-card website-insight-card">
      <h3>${escapeWebsiteInsightsHtml(item.title)}</h3>
      <p>${escapeWebsiteInsightsHtml(item.copy)}</p>
    </article>
  `).join("");
}

function renderWebsiteInsightsRecent(rows) {
  renderWebsiteInsightsList(
    websiteInsightsDom.recentList,
    rows.map((row) => ({
      title: getReadablePageLabel(row.page_path, row.page_title),
      meta: `${formatWebsiteInsightsDate(row.created_at)} · ${row.source_label || "Direct"} · ${row.device_type || "Device unknown"}`,
      copy: `${row.page_path || "/"}${row.search_query ? ` · search term: ${row.search_query}` : ""}`
    })),
    "No recent public page activity has been captured yet."
  );
}

function renderWebsiteInsightsPages(rows) {
  renderWebsiteInsightsList(
    websiteInsightsDom.pagesList,
    rows.map((row) => ({
      title: getReadablePageLabel(row.label, row.title),
      meta: `${row.count} views · ${row.sessionCount} sessions · ${row.formCount} successful forms`,
      copy: row.topSource ? `Most common source: ${row.topSource}` : "No dominant source signal yet."
    })),
    "No public page views have been captured yet."
  );
}

function renderWebsiteInsightsLandingPages(rows) {
  renderWebsiteInsightsList(
    websiteInsightsDom.landingList,
    rows.map((row) => ({
      title: getReadablePageLabel(row.label, null),
      meta: `${row.count} sessions began here`,
      copy: "This page is acting as a landing page for these observed sessions."
    })),
    "No landing-page data is available yet."
  );
}

function renderWebsiteInsightsSources(rows) {
  renderWebsiteInsightsList(
    websiteInsightsDom.sourcesList,
    rows.map((row) => ({
      title: row.label,
      meta: `${row.count} sessions`,
      copy: "This source label represents how the session first reached the public website."
    })),
    "No source data has been captured yet."
  );
}

function renderWebsiteInsightsSearches(rows) {
  renderWebsiteInsightsList(
    websiteInsightsDom.searchList,
    rows.map((row) => ({
      title: row.label,
      meta: `${row.count} sessions exposed this query`,
      copy: row.engine ? `Seen through ${row.engine}.` : "Seen through a search referrer."
    })),
    "No visible search terms have been exposed by referrers in this window."
  );
}

function renderWebsiteInsightsTimezones(rows) {
  renderWebsiteInsightsList(
    websiteInsightsDom.timezoneList,
    rows.map((row) => ({
      title: row.label,
      meta: `${row.count} sessions`,
      copy: "This is the browser timezone the visitor session reported."
    })),
    "No timezone signals have been captured yet."
  );
}

function renderWebsiteInsightsJourneys(rows) {
  renderWebsiteInsightsList(
    websiteInsightsDom.journeysList,
    rows.map((row) => ({
      title: row.label,
      meta: `${row.count} sessions followed a similar path`,
      copy: row.sourceLabel ? `Common first source: ${row.sourceLabel}` : "No consistent first source captured."
    })),
    "No repeat visitor paths have formed yet."
  );
}

function renderWebsiteInsightsRecentSessions(rows) {
  renderWebsiteInsightsList(
    websiteInsightsDom.recentSessionsList,
    rows.slice(0, 8).map((row) => ({
      title: row.pathLabel,
      meta: `${formatWebsiteInsightsDate(row.lastSeenAt)} · ${row.sourceLabel || "Direct"} · ${row.pageCount} pages`,
      copy: row.formCount ? `${row.formCount} successful form submissions happened in this session.` : "No successful forms happened in this session."
    })),
    "No session journeys have been captured yet."
  );
}

function renderWebsiteInsightsForms(rows) {
  renderWebsiteInsightsList(
    websiteInsightsDom.formsList,
    rows.map((row) => ({
      title: getReadableFormName(row.label),
      meta: `${row.count} successful submissions`,
      copy: row.topContext ? `Most common context: ${row.topContext}.` : "No repeated context captured yet."
    })),
    "No successful form submissions have been observed yet."
  );
}

function renderWebsiteInsightsConversions(rows, formSubmissions) {
  const topSourceRows = collectCounts(formSubmissions, (event) => event.source_label || "Direct");
  const cards = [];

  if (rows[0]) {
    cards.push({
      title: "Top landing page before conversion",
      meta: `${rows[0].count} successful forms`,
      copy: `${getReadablePageLabel(rows[0].label, null)} is currently the strongest first landing page among successful form sessions.`
    });
  }

  if (topSourceRows[0]) {
    cards.push({
      title: "Top conversion source",
      meta: `${topSourceRows[0].count} successful forms`,
      copy: `${topSourceRows[0].label} currently leads the source labels behind successful forms.`
    });
  }

  renderWebsiteInsightsList(
    websiteInsightsDom.conversionList,
    cards,
    "Conversion summaries will appear here once successful forms are captured."
  );
}

function renderWebsiteInsightsList(target, items, emptyCopy) {
  if (!target) {
    return;
  }

  if (!items.length) {
    target.innerHTML = `
      <article class="empty-state website-insight-empty">
        <h3>Nothing yet</h3>
        <p>${escapeWebsiteInsightsHtml(emptyCopy)}</p>
      </article>
    `;
    return;
  }

  target.innerHTML = items.map((item) => `
    <article class="thread-card website-insight-list-card">
      <div class="thread-card-head">
        <div>
          <h3>${escapeWebsiteInsightsHtml(item.title)}</h3>
          <p class="thread-card-meta">${escapeWebsiteInsightsHtml(item.meta)}</p>
        </div>
      </div>
      <p class="thread-card-copy">${escapeWebsiteInsightsHtml(item.copy)}</p>
    </article>
  `).join("");
}

function clearWebsiteInsightsUi() {
  clearWebsiteInsightsLists();
  clearWebsiteInsightsMessage();
  setWebsiteInsightsScope("Website insights will appear here once an admin session and tracking data are available.");
}

function clearWebsiteInsightsLists() {
  [
    websiteInsightsDom.summaryCards,
    websiteInsightsDom.highlights,
    websiteInsightsDom.recentList,
    websiteInsightsDom.pagesList,
    websiteInsightsDom.landingList,
    websiteInsightsDom.sourcesList,
    websiteInsightsDom.searchList,
    websiteInsightsDom.timezoneList,
    websiteInsightsDom.journeysList,
    websiteInsightsDom.recentSessionsList,
    websiteInsightsDom.formsList,
    websiteInsightsDom.conversionList
  ].forEach((node) => {
    if (node) {
      node.innerHTML = "";
    }
  });
}

function syncWebsiteInsightsRangeTabs() {
  websiteInsightsDom.rangeButtons.forEach((button) => {
    const isActive = String(button.dataset.insightsRange) === String(websiteInsightsState.rangeDays);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function setWebsiteInsightsScope(text) {
  if (websiteInsightsDom.scope) {
    websiteInsightsDom.scope.textContent = text;
  }
}

function setWebsiteInsightsMessage(message, tone = "info") {
  if (!websiteInsightsDom.message) {
    return;
  }

  websiteInsightsDom.message.textContent = message;
  websiteInsightsDom.message.classList.remove("hidden", "is-error", "is-success");

  if (tone === "error") {
    websiteInsightsDom.message.classList.add("is-error");
    return;
  }

  if (tone === "success") {
    websiteInsightsDom.message.classList.add("is-success");
  }
}

function clearWebsiteInsightsMessage() {
  if (!websiteInsightsDom.message) {
    return;
  }

  websiteInsightsDom.message.textContent = "";
  websiteInsightsDom.message.classList.add("hidden");
  websiteInsightsDom.message.classList.remove("is-error", "is-success");
}

function collectPageCounts(pageViews, formSubmissions) {
  const sourceByPage = new Map();

  pageViews.forEach((row) => {
    const key = row.page_path || "/";
    const sourceMap = sourceByPage.get(key) || new Map();
    sourceMap.set(row.source_label || "Direct", Number(sourceMap.get(row.source_label || "Direct") || 0) + 1);
    sourceByPage.set(key, sourceMap);
  });

  const formCounts = collectCounts(formSubmissions, (row) => row.page_path || "/");

  return collectCounts(pageViews, (row) => row.page_path || "/", (bucket, row) => {
    if (!bucket.title && row.page_title) {
      bucket.title = row.page_title;
    }
  }).map((row) => {
    const matchingFormCount = formCounts.find((item) => item.label === row.label)?.count || 0;
    const topSource = getTopMapKey(sourceByPage.get(row.label));

    return {
      ...row,
      title: row.title || null,
      formCount: matchingFormCount,
      topSource
    };
  });
}

function collectSearchCounts(pageViews) {
  const counts = new Map();

  pageViews.forEach((row) => {
    const rawQuery = row.search_query || row.searchQuery || "";
    const query = typeof rawQuery === "string" ? rawQuery.trim() : "";

    if (!query) {
      return;
    }

    const key = query.toLowerCase();
    const existing = counts.get(key) || {
      label: query,
      count: 0,
      sessionIds: new Set(),
      engine: row.search_engine || row.searchEngine || null
    };

    existing.count += 1;

    if (row.sessionId || row.session_id) {
      existing.sessionIds.add(row.sessionId || row.session_id);
    }

    if (!existing.engine && (row.search_engine || row.searchEngine)) {
      existing.engine = row.search_engine || row.searchEngine;
    }

    counts.set(key, existing);
  });

  return [...counts.values()]
    .map((row) => ({
      label: row.label,
      count: row.count,
      sessionCount: row.sessionIds.size,
      engine: row.engine
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function collectFormCounts(rows) {
  const contextMaps = new Map();

  rows.forEach((row) => {
    const key = row.form_name || "unknown_form";
    const contextMap = contextMaps.get(key) || new Map();
    const contextLabel = row.form_context || "general";
    contextMap.set(contextLabel, Number(contextMap.get(contextLabel) || 0) + 1);
    contextMaps.set(key, contextMap);
  });

  return collectCounts(rows, (row) => row.form_name || "unknown_form").map((row) => ({
    ...row,
    topContext: getTopMapKey(contextMaps.get(row.label))
  }));
}

function collectJourneyCounts(sessionSummaries) {
  const counts = new Map();

  sessionSummaries.forEach((summary) => {
    const key = summary.pathLabel;
    const existing = counts.get(key) || {
      label: key,
      count: 0,
      sources: new Map()
    };

    existing.count += 1;

    if (summary.sourceLabel) {
      existing.sources.set(summary.sourceLabel, Number(existing.sources.get(summary.sourceLabel) || 0) + 1);
    }

    counts.set(key, existing);
  });

  return [...counts.values()]
    .map((row) => ({
      label: row.label,
      count: row.count,
      sourceLabel: getTopMapKey(row.sources)
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function collectSessionSummaries(events) {
  const grouped = new Map();

  events.forEach((row) => {
    if (!row.session_id) {
      return;
    }

    const existing = grouped.get(row.session_id) || [];
    existing.push(row);
    grouped.set(row.session_id, existing);
  });

  return [...grouped.entries()]
    .map(([sessionId, rows]) => {
      const ordered = [...rows].sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
      const pagePaths = ordered
        .filter((row) => row.event_name === "page_view")
        .map((row) => row.page_path || "/")
        .filter(Boolean);
      const compactPaths = pagePaths.filter((path, index) => index === 0 || path !== pagePaths[index - 1]);
      const visiblePaths = compactPaths.slice(0, 4);
      const formCount = ordered.filter((row) => row.event_name === "form_submit").length;
      const firstPageView = ordered.find((row) => row.event_name === "page_view") || ordered[0];
      const lastSeen = ordered[ordered.length - 1];

      return {
        sessionId,
        pathLabel: visiblePaths.length ? visiblePaths.join(" -> ") : "No page path recorded",
        pageCount: pagePaths.length,
        formCount,
        sourceLabel: firstPageView?.source_label || null,
        landingPath: firstPageView?.landing_path || firstPageView?.page_path || "/",
        searchQuery: firstPageView?.search_query || null,
        searchEngine: firstPageView?.search_engine || null,
        timezone: firstPageView?.timezone || null,
        lastSeenAt: lastSeen?.created_at || null
      };
    })
    .sort((left, right) => new Date(right.lastSeenAt || 0) - new Date(left.lastSeenAt || 0));
}

function collectCounts(rows, getKey, decorateBucket) {
  const counts = new Map();

  rows.forEach((row) => {
    const rawKey = getKey(row);
    const key = typeof rawKey === "string" ? rawKey.trim() : rawKey;

    if (!key) {
      return;
    }

    const existing = counts.get(key) || {
      label: key,
      count: 0,
      sessionIds: new Set()
    };

    existing.count += 1;

    if (row.sessionId || row.session_id) {
      existing.sessionIds.add(row.sessionId || row.session_id);
    }

    if (typeof decorateBucket === "function") {
      decorateBucket(existing, row);
    }

    counts.set(key, existing);
  });

  return [...counts.values()]
    .map((row) => ({
      ...row,
      sessionCount: row.sessionIds.size
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function getTopMapKey(map) {
  if (!(map instanceof Map) || !map.size) {
    return null;
  }

  return [...map.entries()]
    .sort((left, right) => right[1] - left[1])[0]?.[0] || null;
}

function getReadablePageLabel(path, title) {
  if (title) {
    return title;
  }

  if (!path || path === "/") {
    return "Homepage";
  }

  return path
    .replace(/^\//, "")
    .replaceAll("/", " / ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getReadableFormName(formName) {
  switch (formName) {
    case "inquiry":
      return "Inquiry form";
    case "facilitator_application":
      return "Facilitator application";
    case "session_feedback":
      return "Session feedback";
    default:
      return String(formName || "Form").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function formatWebsiteInsightsDate(value) {
  if (!value) {
    return "Unknown time";
  }

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
}

function escapeWebsiteInsightsHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
