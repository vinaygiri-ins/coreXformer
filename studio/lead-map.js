const LEAD_MAP_ALLOWED_ROLES = ["owner"];
const LEAD_MAP_STORAGE_KEY = "corexformer-lead-map-v1";
const LEAD_MAP_DEFAULT_VIEW = {
  center: [22.9734, 78.6569],
  zoom: 5
};

const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "contacted", label: "Contacted" },
  { value: "follow_up", label: "Follow-up" },
  { value: "warm", label: "Warm" },
  { value: "not_relevant", label: "Not relevant" }
];

const LEAD_PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" }
];

const LEAD_OSM_ENTITY_TYPES = ["node", "way", "relation"];
const LEAD_COLLEGE_NAME_PATTERN = /\b(college|university|campus|iit|iim|institute of technology|engineering college|business school|law school|polytechnic)\b/i;
const LEAD_SCHOOL_NAME_PATTERN = /\b(school|academy|public school|high school|secondary school|senior secondary|kindergarten|play school)\b/i;
const LEAD_CORPORATE_NAME_PATTERN = /\b(ltd|limited|pvt|private limited|inc|corp|corporation|group|industries|industry|industrial|manufacturing|factory|plant|technology|technologies|software|systems|solutions|engineering|logistics|motors|steel|cement|pharma|energy|power|telecom|digital|automation|exports|enterprise|enterprises)\b/i;
const LEAD_CORPORATE_EXCLUDE_NAME_PATTERN = /\b(shop|store|mart|mall|boutique|bakery|salon|spa|restaurant|cafe|hotel|pharmacy|chemist|jewellers?|jewelry|fashions?|supermarket|mobile shop|electronics store)\b/i;
const LEAD_CORPORATE_OFFICE_VALUES = new Set([
  "company",
  "it",
  "consulting",
  "telecommunication",
  "financial",
  "insurance",
  "research",
  "logistics",
  "administrative",
  "corporate",
  "industrial"
]);

function buildLeadQueries(clauses) {
  return clauses.flatMap((clause) =>
    LEAD_OSM_ENTITY_TYPES.map((entityType) => `${entityType}${clause}{{target}};`)
  );
}

function createLeadCategory(label, color, clauses) {
  return {
    label,
    color,
    clauses,
    query: buildLeadQueries(clauses)
  };
}

const LEAD_CATEGORY_CONFIG = {
  schools: createLeadCategory("Schools", "#2f6b50", [
    '["amenity"="school"]["name"]',
    '["building"="school"]["name"]',
    '["amenity"="kindergarten"]["name"]',
    '["building"="kindergarten"]["name"]',
    '["office"="educational_institution"]["name"]',
    '["landuse"="education"]["name"]'
  ]),
  colleges: createLeadCategory("Colleges", "#7a4b2f", [
    '["amenity"~"college|university"]["name"]',
    '["building"~"college|university"]["name"]',
    '["landuse"="education"]["name"]',
    '["office"="educational_institution"]["name"]',
    '["amenity"="research_institute"]["name"]'
  ]),
  corporates: createLeadCategory("Companies & Employers", "#355c9a", [
    '["office"~"company|it|consulting|telecommunication|financial|insurance|research|logistics|administrative|corporate|industrial"]["name"]',
    '["office"~"company|it|consulting|telecommunication|financial|insurance|research|logistics|administrative|corporate|industrial"]["operator"]',
    '["office"]["name"]',
    '["office"]["operator"]',
    '["building"="office"]["name"]',
    '["building"="industrial"]["name"]',
    '["landuse"="industrial"]["name"]',
    '["landuse"="industrial"]["operator"]',
    '["industrial"]["name"]',
    '["industrial"]["operator"]',
    '["man_made"="works"]["name"]',
    '["company"]["name"]',
    '["company"]["operator"]'
  ]),
  communities: createLeadCategory("Communities", "#8b6a1b", [
    '["amenity"="community_centre"]["name"]',
    '["amenity"="community_center"]["name"]',
    '["office"="ngo"]["name"]',
    '["social_facility"]["name"]',
    '["amenity"="social_facility"]["name"]',
    '["club"]["name"]'
  ]),
  government: createLeadCategory("Government", "#6f4fa3", [
    '["office"="government"]["name"]',
    '["government"]["name"]',
    '["amenity"~"townhall|courthouse|police|fire_station|post_office"]["name"]',
    '["public_building"]["name"]'
  ])
};

const leadMapDom = {
  modulePanel: document.querySelector('[data-admin-module-panel="lead-map"]'),
  scannerPanel: document.querySelector('[data-admin-view-panel="lead-map-scanner"]'),
  savedPanel: document.querySelector('[data-admin-view-panel="lead-map-saved"]'),
  message: document.getElementById("leadMapMessage"),
  mapCanvas: document.getElementById("leadMapCanvas"),
  searchInput: document.getElementById("leadMapSearchInput"),
  searchButton: document.getElementById("leadMapSearchButton"),
  resetButton: document.getElementById("leadMapResetButton"),
  scanButton: document.getElementById("leadMapScanButton"),
  areaSummary: document.getElementById("leadMapAreaSummary"),
  scanModeButtons: Array.from(document.querySelectorAll("[data-lead-scan-mode]")),
  radiusControls: document.getElementById("leadRadiusControls"),
  radiusCenterInput: document.getElementById("leadRadiusCenterInput"),
  radiusKmInput: document.getElementById("leadRadiusKmInput"),
  radiusUseMapCenterButton: document.getElementById("leadRadiusUseMapCenterButton"),
  radiusClearButton: document.getElementById("leadRadiusClearButton"),
  resultFilter: document.getElementById("leadMapResultFilter"),
  categoryInputs: Array.from(document.querySelectorAll("[data-lead-category]")),
  stats: document.getElementById("leadMapStats"),
  results: document.getElementById("leadMapResults"),
  emptyState: document.getElementById("leadMapEmptyState"),
  savedStats: document.getElementById("leadSavedStats"),
  savedList: document.getElementById("leadSavedList"),
  savedEmptyState: document.getElementById("leadSavedEmptyState"),
  copyJsonButton: document.getElementById("leadMapCopyJsonButton"),
  exportCsvButton: document.getElementById("leadMapExportCsvButton")
};

const leadMapState = {
  context: null,
  map: null,
  mapReady: false,
  markersLayer: null,
  selectionLayer: null,
  radiusMarker: null,
  radiusCircle: null,
  scanResults: [],
  hasScanned: false,
  savedLeads: loadLeadMapSavedState(),
  activeCategories: new Set(["schools", "colleges", "corporates", "communities"]),
  scanMode: "bounds",
  radiusCenter: null,
  radiusKm: 5,
  currentFilter: "",
  scanning: false
};

document.addEventListener("DOMContentLoaded", () => {
  void initLeadMapModule();
});

async function initLeadMapModule() {
  if (!leadMapDom.modulePanel) {
    return;
  }

  bindLeadMapEvents();
  applyAdminContext(window.COREXFORMER_ADMIN_CONTEXT || null);
  document.addEventListener("corexformer:admin-context", (event) => {
    applyAdminContext(event.detail || null);
  });
  renderSavedLeadBoard();
}

function bindLeadMapEvents() {
  document.addEventListener("click", (event) => {
    const moduleButton = event.target.closest('[data-admin-module="lead-map"]');
    const scannerButton = event.target.closest('[data-admin-view="lead-map-scanner"]');

    if (!moduleButton && !scannerButton) {
      return;
    }

    if (!leadMapState.mapReady) {
      initLeadMap();
    }

    scheduleLeadMapResize();
  });

  leadMapDom.searchButton?.addEventListener("click", () => {
    void searchLeadMapLocation();
  });

  leadMapDom.searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void searchLeadMapLocation();
    }
  });

  leadMapDom.resetButton?.addEventListener("click", () => {
    resetLeadMapView();
  });

  leadMapDom.scanButton?.addEventListener("click", () => {
    void scanLeadMapArea();
  });

  leadMapDom.scanModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.leadScanMode;
      if (!nextMode) {
        return;
      }

      setLeadScanMode(nextMode);
    });
  });

  leadMapDom.radiusKmInput?.addEventListener("input", (event) => {
    const nextValue = clampLeadRadius(event.target.value);
    leadMapState.radiusKm = nextValue;
    event.target.value = String(nextValue);
    renderRadiusSelection();
    updateLeadMapAreaSummary();
  });

  leadMapDom.radiusUseMapCenterButton?.addEventListener("click", () => {
    if (!leadMapState.map) {
      return;
    }

    const center = leadMapState.map.getCenter();
    setRadiusCenter(center.lat, center.lng);
    setLeadMapMessage("Radius center updated to the current map center.", "success");
  });

  leadMapDom.radiusClearButton?.addEventListener("click", () => {
    clearRadiusCenter();
    setLeadMapMessage("The selected radius point has been cleared.", "success");
  });

  leadMapDom.resultFilter?.addEventListener("input", (event) => {
    leadMapState.currentFilter = normalizeLeadValue(event.target.value);
    renderLeadMapResults();
  });

  leadMapDom.categoryInputs.forEach((input) => {
    input.addEventListener("change", () => {
      syncLeadMapCategories();
    });
  });

  leadMapDom.results?.addEventListener("click", (event) => {
    const saveButton = event.target.closest("[data-lead-save]");

    if (!saveButton) {
      return;
    }

    saveLeadFromScan(saveButton.dataset.leadSave);
  });

  leadMapDom.savedList?.addEventListener("click", (event) => {
    const saveButton = event.target.closest("[data-saved-lead-save]");
    const removeButton = event.target.closest("[data-saved-lead-remove]");

    if (saveButton) {
      saveLeadEdits(saveButton.dataset.savedLeadSave);
      return;
    }

    if (removeButton) {
      removeSavedLead(removeButton.dataset.savedLeadRemove);
    }
  });

  leadMapDom.copyJsonButton?.addEventListener("click", async () => {
    await copySavedLeadsJson();
  });

  leadMapDom.exportCsvButton?.addEventListener("click", () => {
    exportSavedLeadsCsv();
  });
}

function applyAdminContext(context) {
  leadMapState.context = context;

  const canUseLeadMap = Boolean(
    context &&
    context.isAdmin &&
    LEAD_MAP_ALLOWED_ROLES.includes(context.profile?.role)
  );

  if (!canUseLeadMap) {
    return;
  }

  if (!leadMapState.mapReady) {
    initLeadMap();
  }

  renderSavedLeadBoard();
}

function initLeadMap() {
  if (!leadMapDom.mapCanvas || leadMapState.mapReady) {
    return;
  }

  if (!window.L) {
    setLeadMapMessage("The map library could not be loaded yet. Refresh the page and try again.", "error");
    return;
  }

  leadMapState.map = window.L.map(leadMapDom.mapCanvas, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView(LEAD_MAP_DEFAULT_VIEW.center, LEAD_MAP_DEFAULT_VIEW.zoom);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(leadMapState.map);

  leadMapState.markersLayer = window.L.layerGroup().addTo(leadMapState.map);
  leadMapState.selectionLayer = window.L.layerGroup().addTo(leadMapState.map);
  leadMapState.map.on("moveend zoomend", () => {
    updateLeadMapAreaSummary();
  });
  leadMapState.map.on("click", (event) => {
    if (leadMapState.scanMode !== "radius") {
      return;
    }

    setRadiusCenter(event.latlng.lat, event.latlng.lng);
    setLeadMapMessage("Radius center selected from the map. You can now scan that circle.", "success");
  });

  leadMapState.mapReady = true;
  syncLeadScanModeUi();
  updateLeadMapAreaSummary();

  window.setTimeout(() => {
    leadMapState.map?.invalidateSize();
  }, 200);
}

async function searchLeadMapLocation() {
  const query = normalizeLeadValue(leadMapDom.searchInput?.value);

  if (!query) {
    setLeadMapMessage("Enter a city, district, or neighborhood name first.", "error");
    return;
  }

  if (!leadMapState.mapReady) {
    initLeadMap();
  }

  leadMapDom.searchButton.disabled = true;
  setLeadMapMessage("Searching for the area on the map...", "info");

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });
    window.clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("The place search could not be completed right now.");
    }

    const places = await response.json();
    const place = Array.isArray(places) ? places[0] : null;

    if (!place) {
      throw new Error("No matching place was found. Try a broader town or district name.");
    }

    if (Array.isArray(place.boundingbox) && place.boundingbox.length === 4) {
      const south = Number(place.boundingbox[0]);
      const north = Number(place.boundingbox[1]);
      const west = Number(place.boundingbox[2]);
      const east = Number(place.boundingbox[3]);
      leadMapState.map.fitBounds([
        [south, west],
        [north, east]
      ], { padding: [20, 20] });
    } else {
      leadMapState.map.setView([Number(place.lat), Number(place.lon)], 13);
    }

    setLeadMapMessage(`Map moved to ${place.display_name}. Adjust the view if needed and scan the visible area.`, "success");
  } catch (error) {
    setLeadMapMessage(error.message || "The map search could not be completed.", "error");
  } finally {
    leadMapDom.searchButton.disabled = false;
  }
}

function resetLeadMapView() {
  if (!leadMapState.mapReady) {
    initLeadMap();
    return;
  }

  leadMapState.map.setView(LEAD_MAP_DEFAULT_VIEW.center, LEAD_MAP_DEFAULT_VIEW.zoom);
  setLeadMapMessage("The map view has been reset. Move to the next area you want to scan.", "success");
}

function setLeadScanMode(nextMode) {
  leadMapState.scanMode = nextMode === "radius" ? "radius" : "bounds";
  syncLeadScanModeUi();
  updateLeadMapAreaSummary();
}

function syncLeadMapCategories() {
  leadMapState.activeCategories = new Set(
    leadMapDom.categoryInputs
      .filter((input) => input.checked)
      .map((input) => input.dataset.leadCategory)
      .filter(Boolean)
  );
}

async function scanLeadMapArea() {
  if (!leadMapState.mapReady) {
    initLeadMap();
  }

  syncLeadMapCategories();

  if (leadMapState.activeCategories.size === 0) {
    setLeadMapMessage("Choose at least one institution type before scanning the map.", "error");
    return;
  }

  if (!leadMapState.map) {
    setLeadMapMessage("The map is not ready yet. Refresh once and try again.", "error");
    return;
  }

  const queryTarget = getLeadQueryTarget();

  if (!queryTarget) {
    setLeadMapMessage("Choose a point on the map or use the current map center before running a radius scan.", "error");
    return;
  }

  const query = buildOverpassQuery(queryTarget, Array.from(leadMapState.activeCategories));

  leadMapState.scanning = true;
  leadMapDom.scanButton.disabled = true;
  setLeadMapMessage("Scanning the visible area for institutions...", "info");

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25000);
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "text/plain;charset=UTF-8"
      },
      body: query
    });
    window.clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("The area scan could not be completed right now.");
    }

    const payload = await response.json();
    const rawElements = Array.isArray(payload?.elements) ? payload.elements : [];
    const normalized = dedupeLeadResults(
      rawElements
        .map((element) => normalizeLeadElement(element))
        .filter(Boolean)
        .filter((item) => leadMapState.activeCategories.has(item.category))
    );

    leadMapState.hasScanned = true;
    leadMapState.scanResults = normalized.sort((left, right) => {
      const categoryCompare = left.categoryLabel.localeCompare(right.categoryLabel);
      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      return left.name.localeCompare(right.name);
    });

    renderLeadMapResults();
    renderLeadMapStats();
    renderLeadMapMarkers();
    setLeadMapMessage(`Scan complete. ${leadMapState.scanResults.length} named places are ready for review.`, "success");
  } catch (error) {
    setLeadMapMessage(error.message || "The area scan could not be completed.", "error");
  } finally {
    leadMapState.scanning = false;
    leadMapDom.scanButton.disabled = false;
  }
}

function buildOverpassQuery(target, categories) {
  const targetClause = buildLeadTargetClause(target);

  const parts = categories.flatMap((categoryKey) => {
    const config = LEAD_CATEGORY_CONFIG[categoryKey];
    if (!config) {
      return [];
    }

    return config.query.map((queryPart) => queryPart.replace("{{target}}", targetClause));
  });

  return [
    "[out:json][timeout:25];",
    "(",
    ...parts,
    ");",
    "out center tags;"
  ].join("\n");
}

function normalizeLeadElement(element) {
  const tags = element?.tags || {};
  const name = getLeadDisplayName(tags);
  const category = inferLeadCategory(tags, name);
  const lat = Number(element?.lat ?? element?.center?.lat);
  const lon = Number(element?.lon ?? element?.center?.lon);

  if (!category || !name || Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }

  const categoryLabel = LEAD_CATEGORY_CONFIG[category]?.label || "Institution";
  const sourceKey = `${element.type || "item"}-${element.id}`;

  return {
    sourceKey,
    osmId: element.id,
    osmType: element.type,
    name,
    category,
    categoryLabel,
    lat,
    lon,
    address: buildLeadAddress(tags),
    website: normalizeLeadUrl(tags.website || tags["contact:website"]),
    phone: normalizeLeadValue(tags.phone || tags["contact:phone"]),
    email: normalizeLeadValue(tags.email || tags["contact:email"]),
    placeLabel: normalizeLeadValue(tags["addr:city"] || tags["addr:town"] || tags["addr:suburb"] || tags["is_in:city"]),
    tagSummary: buildLeadTagSummary(tags),
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`,
    osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    discoveredAt: new Date().toISOString()
  };
}

function inferLeadCategory(tags, displayName = "") {
  if (
    tags.amenity === "college" ||
    tags.amenity === "university" ||
    tags.building === "college" ||
    tags.building === "university" ||
    tags.amenity === "research_institute" ||
    LEAD_COLLEGE_NAME_PATTERN.test(displayName)
  ) {
    return "colleges";
  }

  if (
    tags.office === "government" ||
    tags.government ||
    ["townhall", "courthouse", "police", "fire_station", "post_office"].includes(tags.amenity)
  ) {
    return "government";
  }

  if (
    tags.amenity === "community_centre" ||
    tags.amenity === "community_center" ||
    tags.amenity === "social_facility" ||
    tags.office === "ngo" ||
    tags.social_facility ||
    tags.club
  ) {
    return "communities";
  }

  if (
    tags.amenity === "school" ||
    tags.amenity === "kindergarten" ||
    tags.building === "school" ||
    tags.building === "kindergarten" ||
    tags.landuse === "education" ||
    tags.office === "educational_institution" ||
    LEAD_SCHOOL_NAME_PATTERN.test(displayName)
  ) {
    return "schools";
  }

  if (isEmployerTypeCorporate(tags, displayName)) {
    return "corporates";
  }

  return null;
}

function isEmployerTypeCorporate(tags, displayName = "") {
  const officeValue = normalizeLeadValue(tags.office).toLowerCase();
  const isExcludedName = LEAD_CORPORATE_EXCLUDE_NAME_PATTERN.test(displayName);

  if (isExcludedName) {
    return false;
  }

  if (officeValue && LEAD_CORPORATE_OFFICE_VALUES.has(officeValue)) {
    return true;
  }

  if (
    officeValue &&
    !["government", "ngo", "educational_institution"].includes(officeValue) &&
    LEAD_CORPORATE_NAME_PATTERN.test(displayName)
  ) {
    return true;
  }

  if (
    tags.building === "industrial" ||
    tags.landuse === "industrial" ||
    tags.industrial ||
    tags.company ||
    tags.man_made === "works"
  ) {
    return LEAD_CORPORATE_NAME_PATTERN.test(displayName) || Boolean(tags.industrial || tags.company || tags.man_made === "works");
  }

  if (tags.building === "office") {
    return LEAD_CORPORATE_NAME_PATTERN.test(displayName);
  }

  return false;
}

function getLeadDisplayName(tags) {
  return normalizeLeadValue(
    tags.name ||
    tags.brand ||
    tags.operator ||
    tags["official_name"] ||
    tags["short_name"] ||
    tags["contact:name"]
  );
}

function buildLeadAddress(tags) {
  const parts = [
    normalizeLeadValue(joinLeadParts(tags["addr:housenumber"], tags["addr:street"])),
    normalizeLeadValue(tags["addr:suburb"]),
    normalizeLeadValue(tags["addr:city"] || tags["addr:town"] || tags["addr:village"]),
    normalizeLeadValue(tags["addr:district"]),
    normalizeLeadValue(tags["addr:state"])
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return normalizeLeadValue(tags["addr:full"] || tags["is_in"] || "");
}

function buildLeadTagSummary(tags) {
  const parts = [
    normalizeLeadValue(tags.operator),
    normalizeLeadValue(tags.office),
    normalizeLeadValue(tags.amenity),
    normalizeLeadValue(tags["addr:postcode"])
  ].filter(Boolean);

  return parts.join(" · ");
}

function renderLeadMapStats() {
  if (!leadMapDom.stats) {
    return;
  }

  if (leadMapState.scanResults.length === 0) {
    leadMapDom.stats.innerHTML = "";
    return;
  }

  const counts = countByCategory(leadMapState.scanResults);
  const fragments = [
    { label: "Named results", value: String(leadMapState.scanResults.length), hint: "Current visible area" },
    ...Object.entries(LEAD_CATEGORY_CONFIG)
      .filter(([key]) => counts[key] > 0)
      .map(([key, config]) => ({
        label: config.label,
        value: String(counts[key]),
        hint: "Detected in this scan"
      }))
  ];

  leadMapDom.stats.innerHTML = fragments
    .map(
      (item) => `
        <div class="pipeline-card lead-stat-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <p>${escapeHtml(item.hint)}</p>
        </div>
      `
    )
    .join("");
}

function renderLeadMapResults() {
  if (!leadMapDom.results || !leadMapDom.emptyState) {
    return;
  }

  const filtered = filterLeadResults(leadMapState.scanResults, leadMapState.currentFilter);
  leadMapDom.emptyState.classList.toggle("hidden", filtered.length > 0 || leadMapState.scanResults.length > 0);

  if (leadMapState.scanResults.length === 0) {
    const emptyTitle = leadMapState.hasScanned ? "No named places found in this area" : "No area scanned yet";
    const emptyCopy = leadMapState.hasScanned
      ? "Try widening the map view, switching institution types, or moving to a denser part of the area."
      : "Move the map to the area you want to study, choose the categories you care about, and scan the visible area.";

    leadMapDom.emptyState.innerHTML = `
      <h3>${escapeHtml(emptyTitle)}</h3>
      <p>${escapeHtml(emptyCopy)}</p>
    `;
    leadMapDom.results.innerHTML = "";
    return;
  }

  if (filtered.length === 0) {
    leadMapDom.results.innerHTML = `
      <div class="empty-state">
        <h3>No results match this filter</h3>
        <p>Try a broader filter phrase or clear it to see all scanned institutions again.</p>
      </div>
    `;
    return;
  }

  leadMapDom.results.innerHTML = filtered
    .map((item) => {
      const isSaved = Boolean(findSavedLead(item.sourceKey));
      const contactRows = [
        item.address ? `<li><strong>Address</strong><span>${escapeHtml(item.address)}</span></li>` : "",
        item.phone ? `<li><strong>Phone</strong><span>${escapeHtml(item.phone)}</span></li>` : "",
        item.website ? `<li><strong>Website</strong><span><a href="${escapeAttribute(item.website)}" target="_blank" rel="noreferrer">${escapeHtml(item.website)}</a></span></li>` : "",
        item.tagSummary ? `<li><strong>Tags</strong><span>${escapeHtml(item.tagSummary)}</span></li>` : ""
      ].filter(Boolean).join("");

      return `
        <article class="lead-result-card">
          <div class="lead-result-head">
            <div>
              <p class="lead-result-category">${escapeHtml(item.categoryLabel)}</p>
              <h3>${escapeHtml(item.name)}</h3>
              <p class="lead-result-meta">${escapeHtml(item.placeLabel || item.address || "Location details available on the map")}</p>
            </div>
            <span class="status-pill lead-category-pill" style="--lead-pill:${escapeAttribute(LEAD_CATEGORY_CONFIG[item.category]?.color || "#2f6b50")}">${escapeHtml(isSaved ? "Saved lead" : "Scanned")}</span>
          </div>

          <ul class="detail-list lead-result-details">${contactRows || '<li class="detail-row"><strong>Details</strong><span>Basic public details were limited for this place.</span></li>'}</ul>

          <div class="inline-action-group">
            <button type="button" class="button" data-lead-save="${escapeAttribute(item.sourceKey)}">${isSaved ? "Update saved lead" : "Save to lead board"}</button>
            <a class="workspace-link" href="${escapeAttribute(item.googleMapsUrl)}" target="_blank" rel="noreferrer">Open in Google Maps</a>
            <a class="workspace-link" href="${escapeAttribute(item.osmUrl)}" target="_blank" rel="noreferrer">Open in OSM</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderLeadMapMarkers() {
  if (!leadMapState.markersLayer) {
    return;
  }

  leadMapState.markersLayer.clearLayers();

  leadMapState.scanResults.forEach((item) => {
    const marker = window.L.circleMarker([item.lat, item.lon], {
      radius: 6,
      weight: 2,
      color: LEAD_CATEGORY_CONFIG[item.category]?.color || "#2f6b50",
      fillColor: LEAD_CATEGORY_CONFIG[item.category]?.color || "#2f6b50",
      fillOpacity: 0.8
    });

    marker.bindPopup(`
      <strong>${escapeHtml(item.name)}</strong><br>
      ${escapeHtml(item.categoryLabel)}<br>
      ${escapeHtml(item.address || item.placeLabel || "No address available")}
    `);

    marker.addTo(leadMapState.markersLayer);
  });
}

function saveLeadFromScan(sourceKey) {
  const result = leadMapState.scanResults.find((item) => item.sourceKey === sourceKey);

  if (!result) {
    return;
  }

  const existing = findSavedLead(sourceKey);
  const nextLead = {
    sourceKey: result.sourceKey,
    name: result.name,
    category: result.category,
    categoryLabel: result.categoryLabel,
    address: result.address,
    website: result.website,
    phone: result.phone,
    email: result.email,
    lat: result.lat,
    lon: result.lon,
    placeLabel: result.placeLabel,
    tagSummary: result.tagSummary,
    googleMapsUrl: result.googleMapsUrl,
    osmUrl: result.osmUrl,
    status: existing?.status || "new",
    priority: existing?.priority || "medium",
    contactPerson: existing?.contactPerson || "",
    nextFollowUp: existing?.nextFollowUp || "",
    notes: existing?.notes || "",
    savedAt: existing?.savedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    leadMapState.savedLeads = leadMapState.savedLeads.map((lead) => (lead.sourceKey === sourceKey ? nextLead : lead));
  } else {
    leadMapState.savedLeads = [nextLead, ...leadMapState.savedLeads];
  }

  persistSavedLeads();
  renderSavedLeadBoard();
  renderLeadMapResults();
  setLeadMapMessage(`${result.name} is now on your private lead board.`, "success");
}

function renderSavedLeadBoard() {
  renderSavedLeadStats();
  renderSavedLeadList();
}

function renderSavedLeadStats() {
  if (!leadMapDom.savedStats) {
    return;
  }

  if (leadMapState.savedLeads.length === 0) {
    leadMapDom.savedStats.innerHTML = "";
    return;
  }

  const counts = countByStatus(leadMapState.savedLeads);
  const statCards = [
    { label: "Saved leads", value: String(leadMapState.savedLeads.length), hint: "Private board total" },
    { label: "New", value: String(counts.new || 0), hint: "Not yet worked" },
    { label: "Contacted", value: String(counts.contacted || 0), hint: "Outreach started" },
    { label: "Warm", value: String(counts.warm || 0), hint: "Promising relationships" }
  ];

  leadMapDom.savedStats.innerHTML = statCards
    .map(
      (item) => `
        <div class="pipeline-card lead-stat-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <p>${escapeHtml(item.hint)}</p>
        </div>
      `
    )
    .join("");
}

function renderSavedLeadList() {
  if (!leadMapDom.savedList || !leadMapDom.savedEmptyState) {
    return;
  }

  if (leadMapState.savedLeads.length === 0) {
    leadMapDom.savedList.innerHTML = "";
    leadMapDom.savedEmptyState.classList.remove("hidden");
    return;
  }

  leadMapDom.savedEmptyState.classList.add("hidden");
  const sorted = [...leadMapState.savedLeads].sort(compareSavedLeads);

  leadMapDom.savedList.innerHTML = sorted
    .map((lead) => `
      <article class="application-card saved-lead-card" data-saved-lead-card="${escapeAttribute(lead.sourceKey)}">
        <div class="application-card-head">
          <div>
            <p class="lead-result-category">${escapeHtml(lead.categoryLabel)}</p>
            <h3>${escapeHtml(lead.name)}</h3>
            <p class="application-meta">${escapeHtml(lead.address || lead.placeLabel || "Location details saved")}</p>
          </div>
          <span class="status-pill lead-category-pill" style="--lead-pill:${escapeAttribute(LEAD_CATEGORY_CONFIG[lead.category]?.color || "#2f6b50")}">${escapeHtml(humanizeLeadValue(lead.status))}</span>
        </div>

        <div class="application-field-grid">
          <label class="application-field-block">
            <strong>Status</strong>
            <select data-saved-lead-field="status">
              ${buildSelectOptions(LEAD_STATUS_OPTIONS, lead.status)}
            </select>
          </label>

          <label class="application-field-block">
            <strong>Priority</strong>
            <select data-saved-lead-field="priority">
              ${buildSelectOptions(LEAD_PRIORITY_OPTIONS, lead.priority)}
            </select>
          </label>

          <label class="application-field-block">
            <strong>Best contact person</strong>
            <input data-saved-lead-field="contactPerson" type="text" value="${escapeAttribute(lead.contactPerson || "")}" placeholder="Principal, coordinator, HR lead, founder...">
          </label>

          <label class="application-field-block">
            <strong>Next follow-up</strong>
            <input data-saved-lead-field="nextFollowUp" type="date" value="${escapeAttribute(lead.nextFollowUp || "")}">
          </label>
        </div>

        <div class="application-field-grid">
          <div class="application-field-block">
            <strong>Contact details</strong>
            <p>${escapeHtml(formatLeadContactSummary(lead))}</p>
          </div>
          <div class="application-field-block">
            <strong>Map links</strong>
            <div class="inline-action-group">
              <a class="workspace-link" href="${escapeAttribute(lead.googleMapsUrl)}" target="_blank" rel="noreferrer">Open in Google Maps</a>
              <a class="workspace-link" href="${escapeAttribute(lead.osmUrl)}" target="_blank" rel="noreferrer">Open in OSM</a>
            </div>
          </div>
        </div>

        <label class="application-field-block">
          <strong>Notes</strong>
          <textarea data-saved-lead-field="notes" rows="4" placeholder="Why this organization matters, who to reach out to, and what kind of experiential work may resonate.">${escapeHtml(lead.notes || "")}</textarea>
        </label>

        <div class="application-actions">
          <small class="application-meta">Saved ${escapeHtml(formatLeadDate(lead.savedAt))}${lead.updatedAt ? ` · updated ${escapeHtml(formatLeadDate(lead.updatedAt))}` : ""}</small>
          <div class="inline-action-group">
            <button type="button" class="button" data-saved-lead-save="${escapeAttribute(lead.sourceKey)}">Save notes</button>
            <button type="button" class="button button-muted" data-saved-lead-remove="${escapeAttribute(lead.sourceKey)}">Remove</button>
          </div>
        </div>
      </article>
    `)
    .join("");
}

function saveLeadEdits(sourceKey) {
  const card = leadMapDom.savedList?.querySelector(`[data-saved-lead-card="${cssEscape(sourceKey)}"]`);
  const existing = findSavedLead(sourceKey);

  if (!card || !existing) {
    return;
  }

  const nextLead = {
    ...existing,
    status: normalizeLeadValue(card.querySelector('[data-saved-lead-field="status"]')?.value) || existing.status,
    priority: normalizeLeadValue(card.querySelector('[data-saved-lead-field="priority"]')?.value) || existing.priority,
    contactPerson: normalizeLeadValue(card.querySelector('[data-saved-lead-field="contactPerson"]')?.value),
    nextFollowUp: normalizeLeadValue(card.querySelector('[data-saved-lead-field="nextFollowUp"]')?.value),
    notes: normalizeLeadValue(card.querySelector('[data-saved-lead-field="notes"]')?.value),
    updatedAt: new Date().toISOString()
  };

  leadMapState.savedLeads = leadMapState.savedLeads.map((lead) => (lead.sourceKey === sourceKey ? nextLead : lead));
  persistSavedLeads();
  renderSavedLeadBoard();
  renderLeadMapResults();
  setLeadMapMessage(`${nextLead.name} has been updated on your private lead board.`, "success");
}

function removeSavedLead(sourceKey) {
  const lead = findSavedLead(sourceKey);

  if (!lead) {
    return;
  }

  leadMapState.savedLeads = leadMapState.savedLeads.filter((item) => item.sourceKey !== sourceKey);
  persistSavedLeads();
  renderSavedLeadBoard();
  renderLeadMapResults();
  setLeadMapMessage(`${lead.name} has been removed from your saved leads.`, "success");
}

async function copySavedLeadsJson() {
  if (leadMapState.savedLeads.length === 0) {
    setLeadMapMessage("There are no saved leads to copy yet.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(JSON.stringify(leadMapState.savedLeads, null, 2));
    setLeadMapMessage("Saved leads copied as JSON.", "success");
  } catch (error) {
    setLeadMapMessage("The saved leads could not be copied to the clipboard on this browser.", "error");
  }
}

function exportSavedLeadsCsv() {
  if (leadMapState.savedLeads.length === 0) {
    setLeadMapMessage("There are no saved leads to export yet.", "error");
    return;
  }

  const headers = [
    "name",
    "category",
    "status",
    "priority",
    "contact_person",
    "phone",
    "email",
    "website",
    "address",
    "next_follow_up",
    "notes",
    "google_maps_url",
    "osm_url"
  ];

  const rows = leadMapState.savedLeads.map((lead) => [
    lead.name,
    lead.categoryLabel,
    humanizeLeadValue(lead.status),
    humanizeLeadValue(lead.priority),
    lead.contactPerson || "",
    lead.phone || "",
    lead.email || "",
    lead.website || "",
    lead.address || "",
    lead.nextFollowUp || "",
    lead.notes || "",
    lead.googleMapsUrl || "",
    lead.osmUrl || ""
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `corexformer-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setLeadMapMessage("Saved leads exported as CSV.", "success");
}

function filterLeadResults(results, query) {
  const normalizedQuery = normalizeLeadValue(query).toLowerCase();

  if (!normalizedQuery) {
    return results;
  }

  return results.filter((item) => {
    const haystack = [
      item.name,
      item.categoryLabel,
      item.address,
      item.placeLabel,
      item.tagSummary
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function updateLeadMapAreaSummary() {
  if (!leadMapState.map || !leadMapDom.areaSummary) {
    return;
  }

  if (leadMapState.scanMode === "radius") {
    if (!leadMapState.radiusCenter) {
      leadMapDom.areaSummary.textContent = `Radius mode is active. Click a point on the map or use the current map center, then scan ${leadMapState.radiusKm} km around it.`;
      return;
    }

    leadMapDom.areaSummary.textContent = `Radius scan: ${leadMapState.radiusKm} km around ${leadMapState.radiusCenter.lat.toFixed(4)}, ${leadMapState.radiusCenter.lng.toFixed(4)}.`;
    return;
  }

  const bounds = leadMapState.map.getBounds();
  leadMapDom.areaSummary.textContent = `Visible area scan: South ${bounds.getSouth().toFixed(4)}, West ${bounds.getWest().toFixed(4)} · North ${bounds.getNorth().toFixed(4)}, East ${bounds.getEast().toFixed(4)}`;
}

function syncLeadScanModeUi() {
  leadMapDom.scanModeButtons.forEach((button) => {
    const isActive = button.dataset.leadScanMode === leadMapState.scanMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  leadMapDom.radiusControls?.classList.toggle("hidden", leadMapState.scanMode !== "radius");

  if (leadMapDom.scanButton) {
    leadMapDom.scanButton.textContent = leadMapState.scanMode === "radius" ? "Scan selected radius" : "Scan visible area";
  }

  renderRadiusSelection();
}

function setRadiusCenter(lat, lng) {
  leadMapState.radiusCenter = {
    lat: Number(lat),
    lng: Number(lng)
  };
  renderRadiusSelection();
  updateLeadMapAreaSummary();
}

function clearRadiusCenter() {
  leadMapState.radiusCenter = null;
  renderRadiusSelection();
  updateLeadMapAreaSummary();
}

function renderRadiusSelection() {
  if (leadMapDom.radiusCenterInput) {
    leadMapDom.radiusCenterInput.value = leadMapState.radiusCenter
      ? `${leadMapState.radiusCenter.lat.toFixed(5)}, ${leadMapState.radiusCenter.lng.toFixed(5)}`
      : "No point selected yet";
  }

  if (leadMapDom.radiusKmInput) {
    leadMapDom.radiusKmInput.value = String(leadMapState.radiusKm);
  }

  if (!leadMapState.selectionLayer) {
    return;
  }

  leadMapState.selectionLayer.clearLayers();
  leadMapState.radiusMarker = null;
  leadMapState.radiusCircle = null;

  if (leadMapState.scanMode !== "radius" || !leadMapState.radiusCenter) {
    return;
  }

  leadMapState.radiusMarker = window.L.marker([leadMapState.radiusCenter.lat, leadMapState.radiusCenter.lng]).addTo(leadMapState.selectionLayer);
  leadMapState.radiusCircle = window.L.circle([leadMapState.radiusCenter.lat, leadMapState.radiusCenter.lng], {
    radius: leadMapState.radiusKm * 1000,
    color: "#ba7b3c",
    weight: 2,
    fillColor: "#ba7b3c",
    fillOpacity: 0.12
  }).addTo(leadMapState.selectionLayer);
}

function getLeadQueryTarget() {
  if (!leadMapState.map) {
    return null;
  }

  if (leadMapState.scanMode === "radius") {
    if (!leadMapState.radiusCenter) {
      return null;
    }

    return {
      mode: "radius",
      lat: leadMapState.radiusCenter.lat,
      lng: leadMapState.radiusCenter.lng,
      radiusMeters: leadMapState.radiusKm * 1000
    };
  }

  return {
    mode: "bounds",
    bounds: leadMapState.map.getBounds()
  };
}

function buildLeadTargetClause(target) {
  if (target.mode === "radius") {
    return `(around:${Math.round(target.radiusMeters)},${target.lat.toFixed(6)},${target.lng.toFixed(6)})`;
  }

  return `(${[
    target.bounds.getSouth().toFixed(6),
    target.bounds.getWest().toFixed(6),
    target.bounds.getNorth().toFixed(6),
    target.bounds.getEast().toFixed(6)
  ].join(",")})`;
}

function clampLeadRadius(value) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return 5;
  }

  return Math.min(100, Math.max(1, Math.round(parsed)));
}

function dedupeLeadResults(results) {
  const seen = new Set();
  const deduped = [];

  results.forEach((item) => {
    const fingerprint = item
      ? `${item.category}:${item.name.toLowerCase()}:${item.lat.toFixed(4)}:${item.lon.toFixed(4)}`
      : "";

    if (!item || seen.has(fingerprint)) {
      return;
    }

    seen.add(fingerprint);
    deduped.push(item);
  });

  return deduped;
}

function countByCategory(items) {
  return items.reduce((counts, item) => {
    counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
  }, {});
}

function countByStatus(items) {
  return items.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});
}

function findSavedLead(sourceKey) {
  return leadMapState.savedLeads.find((lead) => lead.sourceKey === sourceKey) || null;
}

function compareSavedLeads(left, right) {
  const priorityWeight = {
    high: 0,
    medium: 1,
    low: 2
  };

  const priorityCompare = (priorityWeight[left.priority] ?? 9) - (priorityWeight[right.priority] ?? 9);

  if (priorityCompare !== 0) {
    return priorityCompare;
  }

  return left.name.localeCompare(right.name);
}

function persistSavedLeads() {
  try {
    window.localStorage.setItem(LEAD_MAP_STORAGE_KEY, JSON.stringify(leadMapState.savedLeads));
  } catch (error) {
    console.warn("CoreXformer lead map storage could not be updated.", error);
  }
}

function loadLeadMapSavedState() {
  try {
    const raw = window.localStorage.getItem(LEAD_MAP_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("CoreXformer lead map storage could not be read.", error);
    return [];
  }
}

function buildSelectOptions(options, selectedValue) {
  return options
    .map((option) => {
      const selected = option.value === selectedValue ? " selected" : "";
      return `<option value="${escapeAttribute(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
    })
    .join("");
}

function formatLeadContactSummary(lead) {
  return [lead.phone, lead.email, lead.website].filter(Boolean).join(" · ") || "No public phone, email, or website was available in this scan.";
}

function scheduleLeadMapResize() {
  window.setTimeout(() => {
    leadMapState.map?.invalidateSize();
  }, 120);
}

function formatLeadDate(value) {
  if (!value) {
    return "recently";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function setLeadMapMessage(message, tone = "info") {
  if (!leadMapDom.message) {
    return;
  }

  leadMapDom.message.textContent = message;
  leadMapDom.message.classList.remove("hidden", "is-error", "is-success");

  if (tone === "error") {
    leadMapDom.message.classList.add("is-error");
    return;
  }

  if (tone === "success") {
    leadMapDom.message.classList.add("is-success");
  }
}

function normalizeLeadValue(value) {
  return String(value || "").trim();
}

function normalizeLeadUrl(value) {
  const normalized = normalizeLeadValue(value);

  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return `https://${normalized}`;
}

function humanizeLeadValue(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function joinLeadParts(...parts) {
  return parts.filter(Boolean).join(" ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }

  return String(value).replaceAll('"', '\\"');
}
