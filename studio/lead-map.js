const LEAD_MAP_ALLOWED_ROLES = ["owner"];
const LEAD_MAP_STORAGE_KEY = "corexformer-lead-map-v1";
const LEAD_MAP_USAGE_STORAGE_KEY = "corexformer-lead-map-usage-v1";
const LEAD_MAP_DEFAULT_VIEW = {
  center: [22.9734, 78.6569],
  zoom: 5
};
const LEAD_MAP_GOOGLE_SCRIPT_ID = "corexformer-google-lead-map-api";
const LEAD_MAP_GOOGLE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "googleMapsURI",
  "primaryType",
  "businessStatus"
];
const LEAD_MAP_GOOGLE_MAX_RADIUS_METERS = 50000;
const LEAD_MAP_GOOGLE_NEARBY_LIMIT = 20;
const LEAD_MAP_GOOGLE_TEXT_LIMIT = 12;
const LEAD_GOOGLE_CORPORATE_PRIMARY_TYPES = new Set([
  "corporate_office",
  "manufacturer",
  "business_center"
]);
const LEAD_MAP_USAGE_DEFAULT_CAPS = {
  mapLoads: 1000,
  autocompleteRequests: 5000,
  placeDetailsRequests: 1000,
  placeSearchRequests: 2000
};
const LEAD_MAP_USAGE_METRICS = {
  mapLoads: {
    label: "Map loads",
    hint: "Google map openings in this browser"
  },
  autocompleteRequests: {
    label: "Autocomplete",
    hint: "Type-ahead suggestion requests"
  },
  placeDetailsRequests: {
    label: "Place details",
    hint: "Chosen suggestion detail lookups"
  },
  placeSearchRequests: {
    label: "Place searches",
    hint: "Find-on-map and scan requests"
  }
};
const LEAD_GOOGLE_CORPORATE_ALLOWED_NAME_PATTERN = /\b(ltd|limited|pvt|private limited|inc|corp|corporation|group|industries|industry|industrial|manufacturing|factory|plant|technology|technologies|software|systems|solutions|engineering|logistics|motors|steel|cement|pharma|energy|power|telecom|digital|automation|exports|enterprise|enterprises|business park|tech park|technology park|industrial estate|industrial area|it park|sez)\b/i;
const LEAD_MAP_GOOGLE_CATEGORY_SEARCH = {
  schools: {
    nearbyPrimaryTypes: ["school", "secondary_school", "primary_school", "preschool"],
    textSearches: [
      { textQuery: "school", includedType: "school", strict: true },
      { textQuery: "senior secondary school", includedType: "secondary_school", strict: true }
    ]
  },
  colleges: {
    nearbyPrimaryTypes: ["university"],
    textSearches: [
      { textQuery: "college", includedType: "university", strict: false },
      { textQuery: "university", includedType: "university", strict: true },
      { textQuery: "engineering college", includedType: "university", strict: false }
    ]
  },
  corporates: {
    nearbyPrimaryTypes: ["corporate_office", "manufacturer", "business_center"],
    textSearches: [
      { textQuery: "IT company", includedType: "corporate_office", strict: false },
      { textQuery: "software company", includedType: "corporate_office", strict: false },
      { textQuery: "technology company", includedType: "corporate_office", strict: false },
      { textQuery: "engineering company", includedType: "corporate_office", strict: false },
      { textQuery: "corporate office", includedType: "corporate_office", strict: false },
      { textQuery: "business park", includedType: "business_center", strict: false },
      { textQuery: "technology park", strict: false },
      { textQuery: "IT park", strict: false },
      { textQuery: "industrial area", strict: false },
      { textQuery: "industrial estate", strict: false },
      { textQuery: "manufacturing company", includedType: "manufacturer", strict: false },
      { textQuery: "factory", includedType: "manufacturer", strict: false },
      { textQuery: "plant", includedType: "manufacturer", strict: false }
    ]
  },
  communities: {
    nearbyPrimaryTypes: ["community_center"],
    textSearches: [
      { textQuery: "community center", includedType: "community_center", strict: true },
      { textQuery: "cultural center" },
      { textQuery: "NGO" }
    ]
  },
  government: {
    nearbyPrimaryTypes: ["government_office", "local_government_office", "city_hall"],
    textSearches: [
      { textQuery: "government office", includedType: "government_office", strict: false },
      { textQuery: "district office", includedType: "government_office", strict: false },
      { textQuery: "municipal office", includedType: "local_government_office", strict: false }
    ]
  }
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
  usagePanel: document.getElementById("leadMapUsagePanel"),
  usageStatus: document.getElementById("leadMapUsageStatus"),
  usageSummary: document.getElementById("leadMapUsageSummary"),
  usageCards: document.getElementById("leadMapUsageCards"),
  usageFootnote: document.getElementById("leadMapUsageFootnote"),
  mapCanvas: document.getElementById("leadMapCanvas"),
  searchInput: document.getElementById("leadMapSearchInput"),
  searchSuggestions: document.getElementById("leadMapSearchSuggestions"),
  searchButton: document.getElementById("leadMapSearchButton"),
  resetButton: document.getElementById("leadMapResetButton"),
  scanButton: document.getElementById("leadMapScanButton"),
  areaSummary: document.getElementById("leadMapAreaSummary"),
  scanModeButtons: Array.from(document.querySelectorAll("[data-lead-scan-mode]")),
  radiusControls: document.getElementById("leadRadiusControls"),
  radiusCenterInput: document.getElementById("leadRadiusCenterInput"),
  radiusKmInput: document.getElementById("leadRadiusKmInput"),
  radiusUseMyLocationButton: document.getElementById("leadRadiusUseMyLocationButton"),
  radiusUseMapCenterButton: document.getElementById("leadRadiusUseMapCenterButton"),
  radiusClearButton: document.getElementById("leadRadiusClearButton"),
  resultFilter: document.getElementById("leadMapResultFilter"),
  categoryInputs: Array.from(document.querySelectorAll("[data-lead-category]")),
  stats: document.getElementById("leadMapStats"),
  bulkActions: document.getElementById("leadMapBulkActions"),
  bulkSummary: document.getElementById("leadMapBulkSummary"),
  selectAllButton: document.getElementById("leadMapSelectAllButton"),
  clearSelectionButton: document.getElementById("leadMapClearSelectionButton"),
  saveSelectedButton: document.getElementById("leadMapSaveSelectedButton"),
  results: document.getElementById("leadMapResults"),
  emptyState: document.getElementById("leadMapEmptyState"),
  savedStats: document.getElementById("leadSavedStats"),
  savedMapCanvas: document.getElementById("leadSavedMapCanvas"),
  savedCategoryTabs: document.getElementById("leadSavedCategoryTabs"),
  savedPlaceTabs: document.getElementById("leadSavedPlaceTabs"),
  savedScope: document.getElementById("leadSavedScope"),
  savedList: document.getElementById("leadSavedList"),
  savedEmptyState: document.getElementById("leadSavedEmptyState"),
  copyJsonButton: document.getElementById("leadMapCopyJsonButton"),
  exportCsvButton: document.getElementById("leadMapExportCsvButton")
};

const leadMapState = {
  context: null,
  providerMode: "osm",
  providerConfig: getLeadMapProviderConfig(),
  map: null,
  mapReady: false,
  initializationPromise: null,
  markersLayer: null,
  selectionLayer: null,
  savedReferenceMap: null,
  savedReferenceMarkersLayer: null,
  savedReferenceMarkerLookup: new Map(),
  savedReferenceMarkerCount: 0,
  savedReferenceScopeKey: "",
  savedReferenceHasAutoFit: false,
  radiusMarker: null,
  radiusCircle: null,
  googleMarkers: [],
  googleInfoWindow: null,
  googleGeocoder: null,
  googlePlacesLibrary: null,
  scanResults: [],
  selectedScanResultKeys: new Set(),
  hasScanned: false,
  savedLeads: loadLeadMapSavedState(),
  activeSavedCategory: "",
  activeSavedPlace: "",
  activeSavedLeadSourceKey: "",
  usage: loadLeadMapUsageState(),
  activeCategories: new Set(["schools", "colleges", "corporates", "communities"]),
  scanMode: "bounds",
  radiusCenter: null,
  radiusKm: 5,
  resolvedAreaHint: "",
  autocompleteSuggestions: [],
  autocompleteSessionToken: null,
  selectedPrediction: null,
  highlightedSuggestionIndex: -1,
  autocompleteDebounceId: 0,
  autocompleteRequestSerial: 0,
  currentFilter: "",
  scanning: false,
  locatingUserPosition: false
};

function getLeadMapProviderConfig() {
  const config = window.COREXFORMER_STUDIO_CONFIG?.leadMap || {};

  return {
    provider: normalizeLeadMapProviderMode(config.provider),
    googleMapsApiKey: normalizeLeadValue(config.googleMapsApiKey),
    googleMapId: normalizeLeadValue(config.googleMapId),
    googleRegion: normalizeLeadValue(config.googleRegion) || "IN",
    googleLanguage: normalizeLeadValue(config.googleLanguage) || "en",
    usageGuard: getLeadMapUsageGuardConfig(config.usageGuard)
  };
}

function getLeadMapUsageGuardConfig(config = {}) {
  const warningThresholdPercent = clampLeadPercent(config.warningThresholdPercent, 60);
  const criticalThresholdPercent = Math.max(
    warningThresholdPercent,
    clampLeadPercent(config.criticalThresholdPercent, 80)
  );
  const hardStopThresholdPercent = Math.max(
    criticalThresholdPercent,
    clampLeadPercent(config.hardStopThresholdPercent, 100)
  );

  return {
    enabled: config.enabled !== false,
    timezone: normalizeLeadValue(config.timezone) || "Asia/Kolkata",
    warningThresholdPercent,
    criticalThresholdPercent,
    hardStopThresholdPercent,
    monthlyCaps: {
      mapLoads: normalizeLeadUsageCap(config.monthlyCaps?.mapLoads, LEAD_MAP_USAGE_DEFAULT_CAPS.mapLoads),
      autocompleteRequests: normalizeLeadUsageCap(
        config.monthlyCaps?.autocompleteRequests,
        LEAD_MAP_USAGE_DEFAULT_CAPS.autocompleteRequests
      ),
      placeDetailsRequests: normalizeLeadUsageCap(
        config.monthlyCaps?.placeDetailsRequests,
        LEAD_MAP_USAGE_DEFAULT_CAPS.placeDetailsRequests
      ),
      placeSearchRequests: normalizeLeadUsageCap(
        config.monthlyCaps?.placeSearchRequests,
        LEAD_MAP_USAGE_DEFAULT_CAPS.placeSearchRequests
      )
    }
  };
}

function clampLeadPercent(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(1, parsed));
}

function normalizeLeadUsageCap(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getLeadMapUsageMonthKey(timezone = "Asia/Kolkata") {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit"
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;

    if (year && month) {
      return `${year}-${month}`;
    }
  } catch (error) {
    console.warn("CoreXformer lead map could not format the usage month key in the preferred timezone.", error);
  }

  const fallbackDate = new Date();
  return `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, "0")}`;
}

function createEmptyLeadMapUsageCounts() {
  return Object.keys(LEAD_MAP_USAGE_METRICS).reduce((counts, key) => {
    counts[key] = 0;
    return counts;
  }, {});
}

function createLeadMapUsageState(config = getLeadMapUsageGuardConfig()) {
  return {
    monthKey: getLeadMapUsageMonthKey(config.timezone),
    counts: createEmptyLeadMapUsageCounts(),
    updatedAt: ""
  };
}

function loadLeadMapUsageState() {
  const config = getLeadMapUsageGuardConfig(window.COREXFORMER_STUDIO_CONFIG?.leadMap?.usageGuard || {});
  const emptyState = createLeadMapUsageState(config);

  try {
    const raw = window.localStorage.getItem(LEAD_MAP_USAGE_STORAGE_KEY);

    if (!raw) {
      return emptyState;
    }

    const parsed = JSON.parse(raw);
    const monthKey = getLeadMapUsageMonthKey(config.timezone);

    if (normalizeLeadValue(parsed?.monthKey) !== monthKey) {
      return emptyState;
    }

    return {
      monthKey,
      counts: Object.keys(LEAD_MAP_USAGE_METRICS).reduce((counts, key) => {
        counts[key] = normalizeLeadUsageCount(parsed?.counts?.[key]);
        return counts;
      }, {}),
      updatedAt: normalizeLeadValue(parsed?.updatedAt)
    };
  } catch (error) {
    console.warn("CoreXformer lead map usage counters could not be restored.", error);
    return emptyState;
  }
}

function normalizeLeadUsageCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeLeadMapProviderMode(value) {
  return String(value || "").trim().toLowerCase() === "google" ? "google" : "osm";
}

function isGoogleLeadMapProvider() {
  return leadMapState.providerMode === "google";
}

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
    const savedButton = event.target.closest('[data-admin-view="lead-map-saved"]');
    const searchSuggestionButton = event.target.closest("[data-lead-suggestion-index]");
    const clickedInsideSearch = event.target.closest(".lead-map-search-box");

    if (searchSuggestionButton) {
      event.preventDefault();
      void selectLeadMapAutocompleteSuggestion(Number(searchSuggestionButton.dataset.leadSuggestionIndex));
      return;
    }

    if (!clickedInsideSearch) {
      clearLeadMapAutocompleteSuggestions();
    }

    if (moduleButton || scannerButton) {
      if (!leadMapState.mapReady) {
        void requestLeadMapInitialization();
      }

      scheduleLeadMapResize();
    }

    if (moduleButton || savedButton) {
      renderSavedLeadBoard();
      scheduleSavedLeadReferenceMapResize();
    }
  });

  leadMapDom.searchButton?.addEventListener("click", () => {
    void searchLeadMapLocation();
  });

  leadMapDom.searchInput?.addEventListener("input", () => {
    handleLeadMapSearchInputChange();
  });

  leadMapDom.searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveLeadMapSuggestionHighlight(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveLeadMapSuggestionHighlight(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void searchLeadMapLocation();
      return;
    }

    if (event.key === "Escape") {
      clearLeadMapAutocompleteSuggestions();
    }
  });

  leadMapDom.searchInput?.addEventListener("focus", () => {
    renderLeadMapAutocompleteSuggestions();
  });

  leadMapDom.resetButton?.addEventListener("click", () => {
    void resetLeadMapView();
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

  leadMapDom.radiusUseMyLocationButton?.addEventListener("click", () => {
    void useLeadMapCurrentLocation();
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

  leadMapDom.selectAllButton?.addEventListener("click", () => {
    selectAllVisibleScanResults();
  });

  leadMapDom.clearSelectionButton?.addEventListener("click", () => {
    clearSelectedScanResults();
  });

  leadMapDom.saveSelectedButton?.addEventListener("click", () => {
    saveSelectedScanResults();
  });

  leadMapDom.categoryInputs.forEach((input) => {
    input.addEventListener("change", () => {
      syncLeadMapCategories();
    });
  });

  leadMapDom.results?.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-lead-select]");

    if (!checkbox) {
      return;
    }

    toggleScanResultSelection(checkbox.dataset.leadSelect, checkbox.checked);
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
      return;
    }

    if (event.target.closest("button, a, input, select, textarea, label")) {
      return;
    }

    const card = event.target.closest("[data-saved-lead-card]");

    if (card) {
      focusSavedLeadOnReferenceMap(card.dataset.savedLeadCard);
    }
  });

  leadMapDom.savedPanel?.addEventListener("click", (event) => {
    const categoryButton = event.target.closest("[data-saved-category-tab]");
    const placeButton = event.target.closest("[data-saved-place-tab]");

    if (categoryButton) {
      setActiveSavedCategory(categoryButton.dataset.savedCategoryTab);
      return;
    }

    if (placeButton) {
      setActiveSavedPlace(placeButton.dataset.savedPlaceTab);
    }
  });

  leadMapDom.copyJsonButton?.addEventListener("click", async () => {
    await copySavedLeadsJson();
  });

  leadMapDom.exportCsvButton?.addEventListener("click", () => {
    exportSavedLeadsCsv();
  });
}

function ensureLeadMapUsageStateCurrent() {
  const usageConfig = leadMapState.providerConfig.usageGuard;
  const monthKey = getLeadMapUsageMonthKey(usageConfig.timezone);

  if (leadMapState.usage.monthKey === monthKey) {
    return;
  }

  leadMapState.usage = createLeadMapUsageState(usageConfig);
  persistLeadMapUsageState();
}

function persistLeadMapUsageState() {
  try {
    window.localStorage.setItem(LEAD_MAP_USAGE_STORAGE_KEY, JSON.stringify(leadMapState.usage));
  } catch (error) {
    console.warn("CoreXformer lead map usage counters could not be saved.", error);
  }
}

function getLeadMapUsageCount(metricKey) {
  ensureLeadMapUsageStateCurrent();
  return normalizeLeadUsageCount(leadMapState.usage.counts?.[metricKey]);
}

function getLeadMapUsageLimit(metricKey) {
  return leadMapState.providerConfig.usageGuard.monthlyCaps[metricKey] || 0;
}

function getLeadMapUsagePercent(metricKey) {
  const limit = getLeadMapUsageLimit(metricKey);

  if (!limit) {
    return 0;
  }

  return Math.min(100, Math.round((getLeadMapUsageCount(metricKey) / limit) * 100));
}

function getLeadMapUsageStatusLevel(percent) {
  const usageConfig = leadMapState.providerConfig.usageGuard;

  if (percent >= usageConfig.hardStopThresholdPercent) {
    return "paused";
  }

  if (percent >= usageConfig.criticalThresholdPercent) {
    return "critical";
  }

  if (percent >= usageConfig.warningThresholdPercent) {
    return "watch";
  }

  return "safe";
}

function getLeadMapOverallUsageStatus() {
  const highestPercent = Object.keys(LEAD_MAP_USAGE_METRICS).reduce((currentMax, metricKey) => (
    Math.max(currentMax, getLeadMapUsagePercent(metricKey))
  ), 0);

  return {
    percent: highestPercent,
    level: getLeadMapUsageStatusLevel(highestPercent)
  };
}

function getLeadMapUsageStatusCopy(level) {
  switch (level) {
    case "watch":
      return {
        label: "Watch",
        summary: "Usage has crossed the early warning line. Keep scans focused.",
        footnote: "You are still within your private monthly cap, but this is the point to slow down."
      };
    case "critical":
      return {
        label: "Near limit",
        summary: "Usage is nearing your monthly cap. One or two wider scans could block the tool.",
        footnote: "Keep the area tight and only scan the categories you really need."
      };
    case "paused":
      return {
        label: "Paused",
        summary: "At least one request type has hit the monthly hard stop. The affected Google action is now blocked on this device until the next month or until you raise the cap in studio/config.js.",
        footnote: "This local guard is intentionally conservative. The cards below show which request type has actually paused."
      };
    default:
      return {
        label: "Safe",
        summary: "Usage is comfortably inside your private monthly cap.",
        footnote: "This local guard tracks Google map loads, suggestions, details, and place searches in this browser."
      };
  }
}

function estimateLeadMapGoogleScanRequests() {
  return Array.from(leadMapState.activeCategories).reduce((total, categoryKey) => {
    const categoryConfig = LEAD_MAP_GOOGLE_CATEGORY_SEARCH[categoryKey];

    if (!categoryConfig) {
      return total;
    }

    return total
      + (categoryConfig.nearbyPrimaryTypes?.length || 0)
      + (categoryConfig.textSearches?.length || 0);
  }, 0);
}

function renderLeadMapUsageGuard() {
  if (!leadMapDom.usagePanel || !leadMapDom.usageStatus || !leadMapDom.usageSummary || !leadMapDom.usageCards || !leadMapDom.usageFootnote) {
    return;
  }

  const usageConfig = leadMapState.providerConfig.usageGuard;
  const showGuard = isGoogleLeadMapProvider() && usageConfig.enabled;
  leadMapDom.usagePanel.classList.toggle("hidden", !showGuard);

  if (!showGuard) {
    return;
  }

  ensureLeadMapUsageStateCurrent();

  const overall = getLeadMapOverallUsageStatus();
  const copy = getLeadMapUsageStatusCopy(overall.level);
  leadMapDom.usageStatus.textContent = copy.label;
  leadMapDom.usageStatus.classList.remove("status-safe", "status-watch", "status-critical", "status-paused");
  leadMapDom.usageStatus.classList.add(`status-${overall.level}`);
  leadMapDom.usageSummary.textContent = copy.summary;

  leadMapDom.usageCards.innerHTML = Object.entries(LEAD_MAP_USAGE_METRICS)
    .map(([metricKey, config]) => {
      const used = getLeadMapUsageCount(metricKey);
      const limit = getLeadMapUsageLimit(metricKey);
      const percent = getLeadMapUsagePercent(metricKey);
      const level = getLeadMapUsageStatusLevel(percent);

      return `
        <div class="lead-map-usage-card">
          <div class="lead-map-usage-card-head">
            <strong>${escapeHtml(config.label)}</strong>
            <span>${escapeHtml(`${used} / ${limit}`)}</span>
          </div>
          <div class="lead-map-usage-progress" aria-hidden="true">
            <div class="lead-map-usage-progress-bar status-${escapeAttribute(level)}" style="width: ${Math.max(percent, used > 0 ? 2 : 0)}%;"></div>
          </div>
          <small>${escapeHtml(config.hint)}</small>
        </div>
      `;
    })
    .join("");

  const estimatedScanRequests = estimateLeadMapGoogleScanRequests();
  const remainingSearches = Math.max(0, getLeadMapUsageLimit("placeSearchRequests") - getLeadMapUsageCount("placeSearchRequests"));
  const scanCostMessage = remainingSearches < estimatedScanRequests
    ? `Current category mix needs about ${estimatedScanRequests} Google place-search calls per scan, so new scans are paused until next month or until you reduce the scan scope.`
    : `Current category mix uses about ${estimatedScanRequests} Google place-search calls per scan. Remaining search-call headroom this month: ${remainingSearches}.`;
  leadMapDom.usageFootnote.textContent = `${copy.footnote} ${scanCostMessage}`;
  syncLeadMapUsageButtons();
}

function syncLeadMapUsageButtons() {
  if (!leadMapDom.scanButton) {
    return;
  }

  const usageConfig = leadMapState.providerConfig.usageGuard;

  if (!isGoogleLeadMapProvider() || !usageConfig.enabled) {
    leadMapDom.scanButton.disabled = Boolean(leadMapState.scanning);
    leadMapDom.scanButton.title = "";
    return;
  }

  const plannedSearches = estimateLeadMapGoogleScanRequests();
  const remainingSearches = Math.max(0, getLeadMapUsageLimit("placeSearchRequests") - getLeadMapUsageCount("placeSearchRequests"));
  const blockedBySearchCap = plannedSearches > remainingSearches;
  leadMapDom.scanButton.disabled = Boolean(leadMapState.scanning || blockedBySearchCap);
  leadMapDom.scanButton.title = blockedBySearchCap
    ? "Monthly search-call guard reached for the current scan size. Reduce categories or wait for the next month."
    : "";
}

function reserveLeadMapUsage(metricKey, amount, reason) {
  const usageConfig = leadMapState.providerConfig.usageGuard;

  if (!isGoogleLeadMapProvider() || !usageConfig.enabled) {
    return { allowed: true };
  }

  ensureLeadMapUsageStateCurrent();

  const nextCount = getLeadMapUsageCount(metricKey) + amount;
  const limit = getLeadMapUsageLimit(metricKey);

  if (nextCount > limit) {
    renderLeadMapUsageGuard();
    return {
      allowed: false,
      message: buildLeadMapUsageLimitMessage(metricKey, amount, reason)
    };
  }

  leadMapState.usage.counts[metricKey] = nextCount;
  leadMapState.usage.updatedAt = new Date().toISOString();
  persistLeadMapUsageState();
  renderLeadMapUsageGuard();
  return { allowed: true };
}

function buildLeadMapUsageLimitMessage(metricKey, amount, reason) {
  const metricLabel = LEAD_MAP_USAGE_METRICS[metricKey]?.label.toLowerCase() || "Google usage";
  const used = getLeadMapUsageCount(metricKey);
  const limit = getLeadMapUsageLimit(metricKey);
  const remaining = Math.max(0, limit - used);

  if (reason === "scan") {
    return `This scan would use about ${amount} Google place-search calls, but only ${remaining} remain in your monthly guard. Wait for the next month or raise the private cap in studio/config.js.`;
  }

  return `The monthly guard has blocked this ${metricLabel} action. ${remaining} of ${limit} remain in the current cap for this browser.`;
}

function applyAdminContext(context) {
  leadMapState.context = context;
  leadMapState.providerConfig = getLeadMapProviderConfig();
  leadMapState.providerMode = normalizeLeadMapProviderMode(leadMapState.providerConfig.provider);
  ensureLeadMapUsageStateCurrent();
  renderLeadMapUsageGuard();

  const canUseLeadMap = Boolean(
    context &&
    context.isAdmin &&
    LEAD_MAP_ALLOWED_ROLES.includes(context.profile?.role)
  );

  if (!canUseLeadMap) {
    return;
  }

  if (!leadMapState.mapReady) {
    void requestLeadMapInitialization();
  }

  renderLeadMapUsageGuard();
  renderSavedLeadBoard();
}

async function requestLeadMapInitialization() {
  if (leadMapState.mapReady) {
    return;
  }

  if (leadMapState.initializationPromise) {
    return leadMapState.initializationPromise;
  }

  leadMapState.initializationPromise = (async () => {
    if (leadMapState.providerMode === "google") {
      await initGoogleLeadMap();
      return;
    }

    initOsmLeadMap();
  })()
    .catch((error) => {
      setLeadMapMessage(error.message || "The lead map could not be prepared.", "error");
      throw error;
    })
    .finally(() => {
      if (!leadMapState.mapReady) {
        leadMapState.initializationPromise = null;
      }
    });

  return leadMapState.initializationPromise;
}

function initOsmLeadMap() {
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

async function initGoogleLeadMap() {
  if (!leadMapDom.mapCanvas || leadMapState.mapReady) {
    return;
  }

  const config = leadMapState.providerConfig;
  const loadReservation = reserveLeadMapUsage("mapLoads", 1, "map-load");

  if (!loadReservation.allowed) {
    throw new Error(loadReservation.message);
  }

  if (!config.googleMapsApiKey) {
    throw new Error("Google lead map is selected, but the API key is missing in studio/config.js.");
  }

  await loadGoogleMapsApi(config);

  if (!window.google?.maps?.importLibrary) {
    throw new Error("Google Maps could not finish loading for the lead map.");
  }

  const { Map } = await window.google.maps.importLibrary("maps");
  await window.google.maps.importLibrary("places");

  leadMapState.googlePlacesLibrary = window.google.maps.places || null;
  leadMapState.googleInfoWindow = new window.google.maps.InfoWindow();
  leadMapState.googleGeocoder = new window.google.maps.Geocoder();

  const mapOptions = {
    center: {
      lat: LEAD_MAP_DEFAULT_VIEW.center[0],
      lng: LEAD_MAP_DEFAULT_VIEW.center[1]
    },
    zoom: LEAD_MAP_DEFAULT_VIEW.zoom,
    streetViewControl: false,
    fullscreenControl: true,
    mapTypeControl: false
  };

  if (config.googleMapId) {
    mapOptions.mapId = config.googleMapId;
  }

  leadMapState.map = new Map(leadMapDom.mapCanvas, mapOptions);

  leadMapState.map.addListener("idle", () => {
    updateLeadMapAreaSummary();
  });

  leadMapState.map.addListener("click", (event) => {
    if (leadMapState.scanMode !== "radius" || !event.latLng) {
      return;
    }

    setRadiusCenter(event.latLng.lat(), event.latLng.lng());
    setLeadMapMessage("Radius center selected from the map. You can now scan that circle.", "success");
  });

  leadMapState.mapReady = true;
  syncLeadScanModeUi();
  updateLeadMapAreaSummary();
}

async function loadGoogleMapsApi(config) {
  if (window.google?.maps?.importLibrary) {
    return;
  }

  const existing = document.getElementById(LEAD_MAP_GOOGLE_SCRIPT_ID);

  if (existing) {
    await waitForGoogleMapsLibrary();
    return;
  }

  const script = document.createElement("script");
  script.id = LEAD_MAP_GOOGLE_SCRIPT_ID;
  script.async = true;
  script.defer = true;
  script.src = buildGoogleMapsScriptUrl(config);

  const readyPromise = new Promise((resolve, reject) => {
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Google Maps could not be loaded for the lead map.")), { once: true });
  });

  document.head.append(script);
  await readyPromise;
  await waitForGoogleMapsLibrary();
}

function handleLeadMapSearchInputChange() {
  leadMapState.selectedPrediction = null;
  leadMapState.resolvedAreaHint = "";

  if (!isGoogleLeadMapProvider()) {
    return;
  }

  const query = normalizeLeadValue(leadMapDom.searchInput?.value);

  if (leadMapState.autocompleteDebounceId) {
    window.clearTimeout(leadMapState.autocompleteDebounceId);
  }

  if (query.length < 2) {
    clearLeadMapAutocompleteSuggestions();
    return;
  }

  if (leadMapDom.message?.classList.contains("is-error")) {
    setLeadMapMessage("Choose a suggestion or press Find on map to move the map.", "info");
  }

  leadMapState.autocompleteDebounceId = window.setTimeout(() => {
    void fetchLeadMapAutocompleteSuggestions(query);
  }, 180);
}

async function fetchLeadMapAutocompleteSuggestions(query) {
  if (!isGoogleLeadMapProvider()) {
    return;
  }

  const normalizedQuery = normalizeLeadValue(query);

  if (normalizedQuery.length < 2) {
    clearLeadMapAutocompleteSuggestions();
    return;
  }

  await requestLeadMapInitialization();

  const AutocompleteSuggestion = window.google?.maps?.places?.AutocompleteSuggestion;
  const AutocompleteSessionToken = window.google?.maps?.places?.AutocompleteSessionToken;

  if (!AutocompleteSuggestion?.fetchAutocompleteSuggestions || !AutocompleteSessionToken) {
    return;
  }

  if (!leadMapState.autocompleteSessionToken) {
    leadMapState.autocompleteSessionToken = new AutocompleteSessionToken();
  }

  const requestSerial = ++leadMapState.autocompleteRequestSerial;
  const locationRestriction = getCurrentMapBounds() || undefined;
  const origin = locationRestriction ? getCurrentMapCenterFromBounds(locationRestriction) : undefined;
  const usageReservation = reserveLeadMapUsage("autocompleteRequests", 1, "autocomplete");

  if (!usageReservation.allowed) {
    clearLeadMapAutocompleteSuggestions();
    setLeadMapMessage(usageReservation.message, "error");
    return;
  }

  try {
    const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: normalizedQuery,
      sessionToken: leadMapState.autocompleteSessionToken,
      locationRestriction,
      origin,
      language: leadMapState.providerConfig.googleLanguage,
      region: leadMapState.providerConfig.googleRegion.toLowerCase()
    });

    if (requestSerial !== leadMapState.autocompleteRequestSerial) {
      return;
    }

    const suggestions = Array.isArray(response?.suggestions)
      ? response.suggestions
          .map((suggestion) => normalizeLeadMapSuggestion(suggestion))
          .filter(Boolean)
          .slice(0, 6)
      : [];

    leadMapState.autocompleteSuggestions = suggestions;
    leadMapState.highlightedSuggestionIndex = suggestions.length > 0 ? 0 : -1;
    renderLeadMapAutocompleteSuggestions();
  } catch (error) {
    console.warn("CoreXformer lead map autocomplete failed.", error);
  }
}

function normalizeLeadMapSuggestion(suggestion) {
  const prediction = suggestion?.placePrediction || null;

  if (!prediction) {
    return null;
  }

  const fullText = extractPredictionText(prediction?.text);
  const structuredFormat = prediction?.structuredFormat || null;
  const primaryText = extractPredictionText(structuredFormat?.mainText) || fullText;
  const secondaryText = extractPredictionText(structuredFormat?.secondaryText);
  const label = normalizeLeadValue(fullText || joinLeadParts(primaryText, secondaryText));

  if (!label) {
    return null;
  }

  return {
    prediction,
    label,
    primaryText: normalizeLeadValue(primaryText) || label,
    secondaryText: normalizeLeadValue(secondaryText)
  };
}

function extractPredictionText(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return normalizeLeadValue(value);
  }

  if (typeof value?.text === "string") {
    return normalizeLeadValue(value.text);
  }

  if (typeof value?.toString === "function") {
    const rendered = value.toString();
    return normalizeLeadValue(rendered === "[object Object]" ? "" : rendered);
  }

  return "";
}

function renderLeadMapAutocompleteSuggestions() {
  if (!leadMapDom.searchSuggestions) {
    return;
  }

  const suggestions = leadMapState.autocompleteSuggestions;
  const shouldShow = suggestions.length > 0 && document.activeElement === leadMapDom.searchInput;

  leadMapDom.searchSuggestions.classList.toggle("hidden", !shouldShow);

  if (!shouldShow) {
    leadMapDom.searchSuggestions.innerHTML = "";
    return;
  }

  leadMapDom.searchSuggestions.innerHTML = suggestions
    .map((suggestion, index) => {
      const isActive = index === leadMapState.highlightedSuggestionIndex;
      const secondary = suggestion.secondaryText
        ? `<span class="lead-map-suggestion-secondary">${escapeHtml(suggestion.secondaryText)}</span>`
        : "";

      return `
        <button
          type="button"
          class="lead-map-suggestion${isActive ? " is-active" : ""}"
          data-lead-suggestion-index="${escapeAttribute(String(index))}"
          role="option"
          aria-selected="${isActive ? "true" : "false"}"
        >
          <span class="lead-map-suggestion-primary">${escapeHtml(suggestion.primaryText)}</span>
          ${secondary}
        </button>
      `;
    })
    .join("");
}

function clearLeadMapAutocompleteSuggestions() {
  leadMapState.autocompleteSuggestions = [];
  leadMapState.highlightedSuggestionIndex = -1;

  if (leadMapDom.searchSuggestions) {
    leadMapDom.searchSuggestions.innerHTML = "";
    leadMapDom.searchSuggestions.classList.add("hidden");
  }
}

function focusLeadMapOnCoordinates(lat, lng, radiusKm = 0) {
  if (!leadMapState.map) {
    return;
  }

  const zoom = getLeadMapRadiusZoom(radiusKm);

  if (isGoogleLeadMapProvider()) {
    leadMapState.map.setCenter({ lat, lng });
    leadMapState.map.setZoom(zoom);
    return;
  }

  leadMapState.map.setView([lat, lng], zoom);
}

function getLeadMapRadiusZoom(radiusKm) {
  const safeRadius = Math.max(1, Number(radiusKm) || 5);

  if (safeRadius <= 2) {
    return 14;
  }

  if (safeRadius <= 5) {
    return 13;
  }

  if (safeRadius <= 10) {
    return 12;
  }

  if (safeRadius <= 20) {
    return 11;
  }

  if (safeRadius <= 50) {
    return 10;
  }

  return 9;
}

function moveLeadMapSuggestionHighlight(direction) {
  const suggestions = leadMapState.autocompleteSuggestions;

  if (suggestions.length === 0) {
    return;
  }

  const maxIndex = suggestions.length - 1;
  const current = leadMapState.highlightedSuggestionIndex < 0 ? 0 : leadMapState.highlightedSuggestionIndex;
  const next = direction > 0
    ? (current >= maxIndex ? 0 : current + 1)
    : (current <= 0 ? maxIndex : current - 1);

  leadMapState.highlightedSuggestionIndex = next;
  renderLeadMapAutocompleteSuggestions();
}

async function useLeadMapCurrentLocation() {
  if (!navigator.geolocation) {
    setLeadMapMessage("This browser does not support location access for the lead map.", "error");
    return;
  }

  await requestLeadMapInitialization();
  setLeadMapLocationButtonState(true);
  setLeadMapMessage("Finding your current location for a nearby radius scan...", "info");

  try {
    const position = await getLeadMapCurrentPosition();
    const latitude = Number(position.coords.latitude);
    const longitude = Number(position.coords.longitude);

    leadMapState.selectedPrediction = null;
    leadMapState.resolvedAreaHint = "";
    leadMapState.autocompleteSessionToken = null;
    clearLeadMapAutocompleteSuggestions();

    if (leadMapDom.searchInput) {
      leadMapDom.searchInput.value = "";
    }

    setLeadScanMode("radius");
    setRadiusCenter(latitude, longitude);
    focusLeadMapOnCoordinates(latitude, longitude, leadMapState.radiusKm);
    setLeadMapMessage(`Moved to your current location. You can now scan ${leadMapState.radiusKm} km around you.`, "success");
  } catch (error) {
    setLeadMapMessage(error.message || "Your current location could not be used for the lead map.", "error");
  } finally {
    setLeadMapLocationButtonState(false);
  }
}

function getLeadMapCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        reject(new Error(getLeadMapLocationErrorMessage(error)));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 300000
      }
    );
  });
}

function getLeadMapLocationErrorMessage(error) {
  switch (error?.code) {
    case error?.PERMISSION_DENIED:
      return "Location access was denied. Allow location in the browser and try again.";
    case error?.POSITION_UNAVAILABLE:
      return "Your location could not be determined right now. Try again in a moment.";
    case error?.TIMEOUT:
      return "Location lookup timed out. Try again or choose a point manually on the map.";
    default:
      return "Your current location could not be used right now.";
  }
}

function setLeadMapLocationButtonState(isBusy) {
  leadMapState.locatingUserPosition = Boolean(isBusy);

  if (!leadMapDom.radiusUseMyLocationButton) {
    return;
  }

  leadMapDom.radiusUseMyLocationButton.disabled = Boolean(isBusy);
  leadMapDom.radiusUseMyLocationButton.textContent = isBusy ? "Locating..." : "Use my current location";
}

async function selectLeadMapAutocompleteSuggestion(index) {
  const suggestion = leadMapState.autocompleteSuggestions[index];

  if (!suggestion?.prediction) {
    return;
  }

  await requestLeadMapInitialization();
  await applyLeadMapPrediction(suggestion.prediction, suggestion.label);
}

async function applyLeadMapPrediction(prediction, fallbackLabel = "") {
  const place = typeof prediction?.toPlace === "function" ? prediction.toPlace() : null;

  if (!place?.fetchFields) {
    throw new Error("The selected suggestion could not be opened on the map.");
  }

  const usageReservation = reserveLeadMapUsage("placeDetailsRequests", 1, "place-details");

  if (!usageReservation.allowed) {
    throw new Error(usageReservation.message);
  }

  await place.fetchFields({
    fields: ["displayName", "formattedAddress", "location", "viewport"]
  });

  const viewport = place.viewport || null;
  const location = place.location || null;

  if (viewport) {
    leadMapState.map.fitBounds(viewport, 24);
  } else if (location) {
    leadMapState.map.setCenter(location);
    leadMapState.map.setZoom(13);
  }

  const placeName = normalizeLeadValue(place.displayName) || normalizeLeadValue(place.formattedAddress) || fallbackLabel;
  leadMapState.selectedPrediction = prediction;
  leadMapState.resolvedAreaHint = placeName;

  if (leadMapDom.searchInput && placeName) {
    leadMapDom.searchInput.value = placeName;
  }

  clearLeadMapAutocompleteSuggestions();
  leadMapState.autocompleteSessionToken = null;
  setLeadMapMessage(`Map moved to ${placeName}. Adjust the view if needed and scan the selected area.`, "success");
}

async function waitForGoogleMapsLibrary() {
  const startedAt = Date.now();

  while (!(window.google?.maps?.importLibrary)) {
    if (Date.now() - startedAt > 15000) {
      throw new Error("Google Maps did not finish initializing for the lead map.");
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 80);
    });
  }
}

function buildGoogleMapsScriptUrl(config) {
  const params = new URLSearchParams({
    key: config.googleMapsApiKey,
    v: "weekly",
    loading: "async",
    libraries: "places",
    language: config.googleLanguage,
    region: config.googleRegion
  });

  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

async function searchLeadMapLocation() {
  const query = normalizeLeadValue(leadMapDom.searchInput?.value);

  if (!query) {
    setLeadMapMessage("Enter a city, district, or neighborhood name first.", "error");
    return;
  }

  await requestLeadMapInitialization();

  leadMapDom.searchButton.disabled = true;
  setLeadMapMessage("Searching for the area on the map...", "info");

  try {
    if (isGoogleLeadMapProvider()) {
      const highlightedSuggestion = leadMapState.autocompleteSuggestions[
        leadMapState.highlightedSuggestionIndex >= 0 ? leadMapState.highlightedSuggestionIndex : 0
      ];

      if (highlightedSuggestion?.prediction) {
        await applyLeadMapPrediction(highlightedSuggestion.prediction, highlightedSuggestion.label);
        return;
      }

      const Place = window.google?.maps?.places?.Place;

      if (!Place?.searchByText) {
        throw new Error("Google Places search is not ready yet for moving the map.");
      }

      const usageReservation = reserveLeadMapUsage("placeSearchRequests", 1, "find-on-map");

      if (!usageReservation.allowed) {
        throw new Error(usageReservation.message);
      }

      const currentBounds = getCurrentMapBounds();
      const currentCenter = currentBounds ? getCurrentMapCenterFromBounds(currentBounds) : null;
      const response = await Place.searchByText({
        textQuery: query,
        fields: ["displayName", "formattedAddress", "location", "viewport"],
        maxResultCount: 1,
        locationBias: currentCenter ? { lat: currentCenter.lat, lng: currentCenter.lng } : undefined,
        rankPreference: window.google.maps.places.SearchByTextRankPreference?.RELEVANCE,
        language: leadMapState.providerConfig.googleLanguage,
        region: leadMapState.providerConfig.googleRegion.toLowerCase()
      });
      const place = Array.isArray(response?.places) ? response.places[0] : null;

      if (!place) {
        throw new Error("No matching place was found. Try a broader town or district name.");
      }

      const viewport = place.viewport || null;
      const location = place.location || null;

      if (viewport) {
        leadMapState.map.fitBounds(viewport, 24);
      } else if (location) {
        leadMapState.map.setCenter(location);
        leadMapState.map.setZoom(13);
      }

      const placeName = normalizeLeadValue(place.displayName) || normalizeLeadValue(place.formattedAddress) || query;
      leadMapState.resolvedAreaHint = placeName;
      leadMapState.autocompleteSessionToken = null;
      clearLeadMapAutocompleteSuggestions();
      setLeadMapMessage(`Map moved to ${placeName}. Adjust the view if needed and scan the selected area.`, "success");
      return;
    }

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

    leadMapState.resolvedAreaHint = normalizeLeadValue(place.display_name) || query;
    clearLeadMapAutocompleteSuggestions();
    setLeadMapMessage(`Map moved to ${place.display_name}. Adjust the view if needed and scan the visible area.`, "success");
  } catch (error) {
    setLeadMapMessage(error.message || "The map search could not be completed.", "error");
  } finally {
    leadMapDom.searchButton.disabled = false;
  }
}

async function resetLeadMapView() {
  await requestLeadMapInitialization();

  if (isGoogleLeadMapProvider()) {
    leadMapState.map.setCenter({
      lat: LEAD_MAP_DEFAULT_VIEW.center[0],
      lng: LEAD_MAP_DEFAULT_VIEW.center[1]
    });
    leadMapState.map.setZoom(LEAD_MAP_DEFAULT_VIEW.zoom);
  } else {
    leadMapState.map.setView(LEAD_MAP_DEFAULT_VIEW.center, LEAD_MAP_DEFAULT_VIEW.zoom);
  }

  leadMapState.selectedPrediction = null;
  leadMapState.autocompleteSessionToken = null;
  leadMapState.resolvedAreaHint = "";
  clearLeadMapAutocompleteSuggestions();
  setLeadMapMessage("The map view has been reset. Move to the next area you want to scan.", "success");
}

function setLeadScanMode(nextMode) {
  leadMapState.scanMode = nextMode === "radius" ? "radius" : "bounds";
  syncLeadScanModeUi();
  updateLeadMapAreaSummary();
  renderLeadMapUsageGuard();
}

function syncLeadMapCategories() {
  leadMapState.activeCategories = new Set(
    leadMapDom.categoryInputs
      .filter((input) => input.checked)
      .map((input) => input.dataset.leadCategory)
      .filter(Boolean)
  );
  renderLeadMapUsageGuard();
}

async function scanLeadMapArea() {
  await requestLeadMapInitialization();

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
    setLeadMapMessage("Choose a point on the map, use your current location, or use the current map center before running a radius scan.", "error");
    return;
  }

  leadMapState.scanning = true;
  leadMapDom.scanButton.disabled = true;
  setLeadMapMessage(
    leadMapState.scanMode === "radius"
      ? "Scanning the selected radius for institutions..."
      : "Scanning the selected area for institutions...",
    "info"
  );

  try {
    const normalized = isGoogleLeadMapProvider()
      ? await scanGoogleLeadMapArea(queryTarget)
      : await scanOsmLeadMapArea(queryTarget);

    leadMapState.hasScanned = true;
    leadMapState.selectedScanResultKeys.clear();
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
    renderLeadMapUsageGuard();
  }
}

async function scanOsmLeadMapArea(queryTarget) {
  const query = buildOverpassQuery(queryTarget, Array.from(leadMapState.activeCategories));
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

  return dedupeLeadResults(
    rawElements
      .map((element) => normalizeLeadElement(element))
      .filter(Boolean)
      .filter((item) => leadMapState.activeCategories.has(item.category))
  );
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

async function scanGoogleLeadMapArea(queryTarget) {
  if (!window.google?.maps?.places?.Place) {
    throw new Error("Google Places is not available yet for the lead map.");
  }

  const plannedSearchRequests = estimateLeadMapGoogleScanRequests();
  const searchReservation = reserveLeadMapUsage("placeSearchRequests", plannedSearchRequests, "scan");

  if (!searchReservation.allowed) {
    throw new Error(searchReservation.message);
  }

  const Place = window.google.maps.places.Place;
  const SearchNearbyRankPreference = window.google.maps.places.SearchNearbyRankPreference;
  const aggregated = [];
  const categories = Array.from(leadMapState.activeCategories);

  for (const categoryKey of categories) {
    const searchConfig = LEAD_MAP_GOOGLE_CATEGORY_SEARCH[categoryKey];

    if (!searchConfig) {
      continue;
    }

    for (const primaryType of searchConfig.nearbyPrimaryTypes || []) {
      try {
        const nearbyRequest = buildGoogleNearbyRequest(queryTarget, primaryType);
        nearbyRequest.maxResultCount = LEAD_MAP_GOOGLE_NEARBY_LIMIT;
        nearbyRequest.fields = LEAD_MAP_GOOGLE_FIELDS;
        nearbyRequest.rankPreference = SearchNearbyRankPreference?.POPULARITY;
        const response = await Place.searchNearby(nearbyRequest);
        const places = Array.isArray(response?.places) ? response.places : [];

        places.forEach((place) => {
          const normalized = normalizeGoogleLeadPlace(place, categoryKey);
          if (normalized) {
            aggregated.push(normalized);
          }
        });
      } catch (error) {
        console.warn(`CoreXformer Google nearby search failed for ${categoryKey}:${primaryType}`, error);
      }
    }

    for (const textSearch of searchConfig.textSearches || []) {
      try {
        const response = await Place.searchByText(buildGoogleTextSearchRequest(textSearch, queryTarget));
        const places = Array.isArray(response?.places) ? response.places : [];

        places.forEach((place) => {
          const normalized = normalizeGoogleLeadPlace(place, categoryKey);
          if (normalized) {
            aggregated.push(normalized);
          }
        });
      } catch (error) {
        console.warn(`CoreXformer Google text search failed for ${categoryKey}:${textSearch.textQuery}`, error);
      }
    }
  }

  return dedupeLeadResults(aggregated);
}

function buildGoogleTextSearchRequest(textSearch, queryTarget) {
  const request = {
    textQuery: buildGoogleTextQuery(textSearch.textQuery, queryTarget),
    fields: LEAD_MAP_GOOGLE_FIELDS,
    maxResultCount: LEAD_MAP_GOOGLE_TEXT_LIMIT,
    locationBias: buildGoogleTextLocationBias(queryTarget),
    rankPreference: window.google.maps.places.SearchByTextRankPreference?.RELEVANCE,
    language: leadMapState.providerConfig.googleLanguage,
    region: leadMapState.providerConfig.googleRegion.toLowerCase()
  };

  if (textSearch.includedType) {
    request.includedType = textSearch.includedType;
    request.useStrictTypeFiltering = textSearch.strict !== false;
  }

  return request;
}

function buildGoogleNearbyRequest(queryTarget, primaryType) {
  const request = {
    includedPrimaryTypes: [primaryType],
    language: leadMapState.providerConfig.googleLanguage,
    region: leadMapState.providerConfig.googleRegion.toLowerCase()
  };

  if (queryTarget.mode === "radius") {
    request.locationRestriction = {
      center: {
        lat: queryTarget.lat,
        lng: queryTarget.lng
      },
      radius: Math.min(Math.round(queryTarget.radiusMeters), LEAD_MAP_GOOGLE_MAX_RADIUS_METERS)
    };
    return request;
  }

  request.locationRestriction = {
    center: {
      lat: queryTarget.center.lat,
      lng: queryTarget.center.lng
    },
    radius: Math.min(Math.round(queryTarget.radiusMeters), LEAD_MAP_GOOGLE_MAX_RADIUS_METERS)
  };

  return request;
}

function buildGoogleTextLocationBias(queryTarget) {
  return {
    lat: queryTarget.center.lat,
    lng: queryTarget.center.lng
  };
}

function buildGoogleTextQuery(baseQuery, queryTarget) {
  const base = normalizeLeadValue(baseQuery);
  const hint = buildGoogleAreaHint(queryTarget);
  return hint ? `${base} in ${hint}` : base;
}

function buildGoogleAreaHint(queryTarget) {
  if (leadMapState.resolvedAreaHint) {
    return leadMapState.resolvedAreaHint;
  }

  const inputHint = normalizeLeadValue(leadMapDom.searchInput?.value);

  if (inputHint) {
    return inputHint;
  }

  const center = queryTarget.center;

  if (!center) {
    return "";
  }

  return `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
}

function normalizeGoogleLeadPlace(place, categoryKey) {
  const lat = getGoogleLatValue(place?.location, "lat");
  const lon = getGoogleLatValue(place?.location, "lng");
  const name = normalizeLeadValue(place?.displayName);

  if (!name || Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }

  if (categoryKey === "corporates" && !isAllowedGoogleCorporatePlace(place, name)) {
    return null;
  }

  const categoryLabel = LEAD_CATEGORY_CONFIG[categoryKey]?.label || "Institution";
  const placeId = normalizeLeadValue(place?.id);

  return {
    sourceKey: placeId ? `google-${placeId}` : `google-${categoryKey}-${name.toLowerCase()}-${lat.toFixed(4)}-${lon.toFixed(4)}`,
    sourceProvider: "google",
    placeId,
    name,
    category: categoryKey,
    categoryLabel,
    lat,
    lon,
    address: normalizeLeadValue(place?.formattedAddress),
    website: normalizeLeadUrl(place?.websiteURI),
    phone: normalizeLeadValue(place?.internationalPhoneNumber || place?.nationalPhoneNumber),
    email: "",
    placeLabel: normalizeLeadValue(place?.formattedAddress),
    tagSummary: [normalizeLeadValue(place?.primaryType), normalizeLeadValue(place?.businessStatus)].filter(Boolean).join(" · "),
    googleMapsUrl: normalizeLeadValue(place?.googleMapsURI) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`,
    osmUrl: "",
    discoveredAt: new Date().toISOString()
  };
}

function getGoogleLatValue(location, axis) {
  if (!location) {
    return Number.NaN;
  }

  const value = location?.[axis];

  if (typeof value === "function") {
    return Number(value.call(location));
  }

  return Number(value);
}

function isAllowedGoogleCorporatePlace(place, displayName = "") {
  const normalizedName = normalizeLeadValue(displayName);
  const primaryType = normalizeLeadValue(place?.primaryType).toLowerCase();
  const businessStatus = normalizeLeadValue(place?.businessStatus).toLowerCase();
  const isExcludedName = LEAD_CORPORATE_EXCLUDE_NAME_PATTERN.test(normalizedName);

  if (!normalizedName || isExcludedName) {
    return false;
  }

  if (businessStatus === "closed_permanently") {
    return false;
  }

  if (LEAD_GOOGLE_CORPORATE_PRIMARY_TYPES.has(primaryType)) {
    return true;
  }

  return LEAD_CORPORATE_NAME_PATTERN.test(normalizedName) || LEAD_GOOGLE_CORPORATE_ALLOWED_NAME_PATTERN.test(normalizedName);
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

  syncSelectedScanResultsWithCurrentScan();
  const filtered = filterLeadResults(leadMapState.scanResults, leadMapState.currentFilter);
  renderLeadMapBulkActions(filtered);
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
    renderLeadMapBulkActions(filtered);
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
      const isSelected = leadMapState.selectedScanResultKeys.has(item.sourceKey);
      const contactRows = [
        item.address ? `<li><strong>Address</strong><span>${escapeHtml(item.address)}</span></li>` : "",
        item.phone ? `<li><strong>Phone</strong><span>${escapeHtml(item.phone)}</span></li>` : "",
        item.website ? `<li><strong>Website</strong><span><a href="${escapeAttribute(item.website)}" target="_blank" rel="noreferrer">${escapeHtml(item.website)}</a></span></li>` : "",
        item.tagSummary ? `<li><strong>Tags</strong><span>${escapeHtml(item.tagSummary)}</span></li>` : ""
      ].filter(Boolean).join("");
      const mapLinks = [
        item.googleMapsUrl ? `<a class="workspace-link" href="${escapeAttribute(item.googleMapsUrl)}" target="_blank" rel="noreferrer">Open in Google Maps</a>` : "",
        item.osmUrl ? `<a class="workspace-link" href="${escapeAttribute(item.osmUrl)}" target="_blank" rel="noreferrer">Open in OSM</a>` : ""
      ].filter(Boolean).join("");

      return `
        <article class="lead-result-card${isSelected ? " is-selected" : ""}">
          <div class="lead-result-head">
            <div>
              <p class="lead-result-category">${escapeHtml(item.categoryLabel)}</p>
              <h3>${escapeHtml(item.name)}</h3>
              <p class="lead-result-meta">${escapeHtml(item.placeLabel || item.address || "Location details available on the map")}</p>
            </div>
            <div class="lead-result-controls">
              <label class="lead-result-select">
                <input
                  type="checkbox"
                  data-lead-select="${escapeAttribute(item.sourceKey)}"
                  ${isSelected ? "checked" : ""}
                >
                <span>Select</span>
              </label>
              <span class="status-pill lead-category-pill" style="--lead-pill:${escapeAttribute(LEAD_CATEGORY_CONFIG[item.category]?.color || "#2f6b50")}">${escapeHtml(isSaved ? "Saved lead" : "Scanned")}</span>
            </div>
          </div>

          <ul class="detail-list lead-result-details">${contactRows || '<li class="detail-row"><strong>Details</strong><span>Basic public details were limited for this place.</span></li>'}</ul>

          <div class="inline-action-group">
            <button type="button" class="button" data-lead-save="${escapeAttribute(item.sourceKey)}">${isSaved ? "Update saved lead" : "Save to lead board"}</button>
            ${mapLinks}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderLeadMapMarkers() {
  if (isGoogleLeadMapProvider()) {
    clearGoogleLeadMarkers();

    if (!window.google?.maps) {
      return;
    }

    leadMapState.scanResults.forEach((item) => {
      const marker = new window.google.maps.Marker({
        map: leadMapState.map,
        position: {
          lat: item.lat,
          lng: item.lon
        },
        title: item.name
      });

      marker.addListener("click", () => {
        leadMapState.googleInfoWindow?.setContent(`
          <strong>${escapeHtml(item.name)}</strong><br>
          ${escapeHtml(item.categoryLabel)}<br>
          ${escapeHtml(item.address || item.placeLabel || "No address available")}
        `);
        leadMapState.googleInfoWindow?.open({
          map: leadMapState.map,
          anchor: marker
        });
      });

      leadMapState.googleMarkers.push(marker);
    });
    return;
  }

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

function clearGoogleLeadMarkers() {
  leadMapState.googleMarkers.forEach((marker) => {
    marker?.setMap?.(null);
  });
  leadMapState.googleMarkers = [];
}

function saveLeadFromScan(sourceKey) {
  const result = leadMapState.scanResults.find((item) => item.sourceKey === sourceKey);

  if (!result) {
    return;
  }

  const saveResult = upsertSavedLeadFromScanResult(result);
  renderSavedLeadBoard();
  renderLeadMapResults();
  setLeadMapMessage(
    saveResult.created
      ? `${result.name} is now on your private lead board.`
      : `${result.name} has been updated on your private lead board.`,
    "success"
  );
}

function upsertSavedLeadFromScanResult(result) {
  const existing = findSavedLead(result.sourceKey);
  const nextLead = {
    sourceKey: result.sourceKey,
    sourceProvider: result.sourceProvider || "osm",
    placeId: result.placeId || "",
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
    leadMapState.savedLeads = leadMapState.savedLeads.map((lead) => (lead.sourceKey === result.sourceKey ? nextLead : lead));
  } else {
    leadMapState.savedLeads = [nextLead, ...leadMapState.savedLeads];
  }

  persistSavedLeads();
  return {
    created: !existing
  };
}

function getVisibleScanResults() {
  return filterLeadResults(leadMapState.scanResults, leadMapState.currentFilter);
}

function clearSelectedScanResults() {
  if (leadMapState.selectedScanResultKeys.size === 0) {
    return;
  }

  leadMapState.selectedScanResultKeys.clear();
  renderLeadMapResults();
}

function toggleScanResultSelection(sourceKey, shouldSelect) {
  if (!sourceKey) {
    return;
  }

  if (shouldSelect) {
    leadMapState.selectedScanResultKeys.add(sourceKey);
  } else {
    leadMapState.selectedScanResultKeys.delete(sourceKey);
  }

  renderLeadMapResults();
}

function selectAllVisibleScanResults() {
  const visible = getVisibleScanResults();

  if (visible.length === 0) {
    return;
  }

  visible.forEach((item) => {
    leadMapState.selectedScanResultKeys.add(item.sourceKey);
  });
  renderLeadMapResults();
}

function saveSelectedScanResults() {
  const selectedResults = leadMapState.scanResults.filter((item) => leadMapState.selectedScanResultKeys.has(item.sourceKey));

  if (selectedResults.length === 0) {
    setLeadMapMessage("Select at least one scanned place before saving to the lead board.", "error");
    return;
  }

  let createdCount = 0;
  let updatedCount = 0;

  selectedResults.forEach((result) => {
    const saveResult = upsertSavedLeadFromScanResult(result);
    if (saveResult.created) {
      createdCount += 1;
    } else {
      updatedCount += 1;
    }
  });

  leadMapState.selectedScanResultKeys.clear();
  renderSavedLeadBoard();
  renderLeadMapResults();

  const summaryParts = [];
  if (createdCount > 0) {
    summaryParts.push(`${createdCount} added`);
  }
  if (updatedCount > 0) {
    summaryParts.push(`${updatedCount} updated`);
  }

  setLeadMapMessage(`Saved ${selectedResults.length} lead${selectedResults.length === 1 ? "" : "s"} to the private board${summaryParts.length > 0 ? ` (${summaryParts.join(", ")})` : ""}.`, "success");
}

function syncSelectedScanResultsWithCurrentScan() {
  const validKeys = new Set(leadMapState.scanResults.map((item) => item.sourceKey));
  leadMapState.selectedScanResultKeys.forEach((sourceKey) => {
    if (!validKeys.has(sourceKey)) {
      leadMapState.selectedScanResultKeys.delete(sourceKey);
    }
  });
}

function renderLeadMapBulkActions(filteredResults = getVisibleScanResults()) {
  if (!leadMapDom.bulkActions || !leadMapDom.bulkSummary || !leadMapDom.selectAllButton || !leadMapDom.clearSelectionButton || !leadMapDom.saveSelectedButton) {
    return;
  }

  const hasResults = leadMapState.scanResults.length > 0;
  const visibleCount = filteredResults.length;
  const selectedVisibleCount = filteredResults.filter((item) => leadMapState.selectedScanResultKeys.has(item.sourceKey)).length;
  const selectedTotalCount = leadMapState.scanResults.filter((item) => leadMapState.selectedScanResultKeys.has(item.sourceKey)).length;

  leadMapDom.bulkActions.classList.toggle("hidden", !hasResults);

  if (!hasResults) {
    return;
  }

  if (visibleCount === 0) {
    leadMapDom.bulkSummary.textContent = `No visible results match the current filter. ${selectedTotalCount} selected from the full scan.`;
  } else if (selectedTotalCount === 0) {
    leadMapDom.bulkSummary.textContent = `${visibleCount} visible scanned place${visibleCount === 1 ? "" : "s"}. Select the ones you want to save to the lead board.`;
  } else {
    leadMapDom.bulkSummary.textContent = `${selectedTotalCount} selected lead${selectedTotalCount === 1 ? "" : "s"} from ${leadMapState.scanResults.length} scanned place${leadMapState.scanResults.length === 1 ? "" : "s"}${visibleCount !== leadMapState.scanResults.length ? ` · ${selectedVisibleCount} visible in this filter` : ""}.`;
  }

  const allVisibleSelected = visibleCount > 0 && selectedVisibleCount === visibleCount;
  leadMapDom.selectAllButton.textContent = allVisibleSelected ? "Visible already selected" : "Select all visible";
  leadMapDom.selectAllButton.disabled = visibleCount === 0 || allVisibleSelected;
  leadMapDom.clearSelectionButton.disabled = selectedTotalCount === 0;
  leadMapDom.saveSelectedButton.disabled = selectedTotalCount === 0;
  leadMapDom.saveSelectedButton.textContent = selectedTotalCount > 0
    ? `Save selected (${selectedTotalCount})`
    : "Save selected";
}

function renderSavedLeadBoard() {
  renderSavedLeadStats();

  const hierarchy = buildSavedLeadHierarchy([...leadMapState.savedLeads].sort(compareSavedLeads));
  syncSavedLeadHierarchySelection(hierarchy);
  renderSavedLeadTabs(hierarchy);
  renderSavedLeadScope(hierarchy);
  renderSavedLeadReferenceMap(
    getActiveSavedLeadSubset(hierarchy),
    getActiveSavedLeadScopeKey()
  );
  renderSavedLeadList(hierarchy);
}

function renderSavedLeadReferenceMap(leads = [], scopeKey = "") {
  ensureSavedLeadReferenceMap();

  if (!leadMapState.savedReferenceMap || !leadMapState.savedReferenceMarkersLayer) {
    return;
  }

  leadMapState.savedReferenceMarkersLayer.clearLayers();
  leadMapState.savedReferenceMarkerLookup = new Map();

  if (leads.length === 0) {
    leadMapState.savedReferenceMap.setView(LEAD_MAP_DEFAULT_VIEW.center, LEAD_MAP_DEFAULT_VIEW.zoom);
    leadMapState.savedReferenceMarkerCount = 0;
    leadMapState.savedReferenceScopeKey = "";
    leadMapState.savedReferenceHasAutoFit = false;
    scheduleSavedLeadReferenceMapResize();
    return;
  }

  const bounds = [];

  leads.forEach((lead) => {
    const color = LEAD_CATEGORY_CONFIG[lead.category]?.color || "#2f6b50";
    const marker = window.L.circleMarker([lead.lat, lead.lon], {
      radius: 8,
      weight: 2,
      color,
      fillColor: color,
      fillOpacity: 0.18
    });

    marker.bindPopup(`
      <strong>${escapeHtml(lead.name)}</strong><br>
      ${escapeHtml(lead.categoryLabel)}<br>
      ${escapeHtml(lead.address || lead.placeLabel || "Location details saved")}<br>
      ${escapeHtml(humanizeLeadValue(lead.status))}
    `);
    marker.corexformerSourceKey = lead.sourceKey;
    marker.corexformerBaseColor = color;
    marker.on("click", () => {
      setActiveSavedLeadSourceKey(lead.sourceKey);
      updateSavedLeadActiveCard();
      updateSavedLeadReferenceMapMarkerStyles();
    });
    marker.addTo(leadMapState.savedReferenceMarkersLayer);
    leadMapState.savedReferenceMarkerLookup.set(lead.sourceKey, marker);
    bounds.push([lead.lat, lead.lon]);
  });

  const scopeChanged = leadMapState.savedReferenceScopeKey !== scopeKey;
  const markerCountChanged = leadMapState.savedReferenceMarkerCount !== leads.length;
  leadMapState.savedReferenceMarkerCount = leads.length;
  leadMapState.savedReferenceScopeKey = scopeKey;

  if (bounds.length > 0 && (!leadMapState.savedReferenceHasAutoFit || markerCountChanged || scopeChanged)) {
    leadMapState.savedReferenceMap.fitBounds(bounds, {
      padding: [24, 24],
      maxZoom: 13
    });
    leadMapState.savedReferenceHasAutoFit = true;
  }

  syncActiveSavedLeadSelection(leads);
  updateSavedLeadReferenceMapMarkerStyles();
  scheduleSavedLeadReferenceMapResize();
}

function ensureSavedLeadReferenceMap() {
  if (!leadMapDom.savedMapCanvas || leadMapState.savedReferenceMap || !window.L) {
    return;
  }

  leadMapState.savedReferenceMap = window.L.map(leadMapDom.savedMapCanvas, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView(LEAD_MAP_DEFAULT_VIEW.center, LEAD_MAP_DEFAULT_VIEW.zoom);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(leadMapState.savedReferenceMap);

  leadMapState.savedReferenceMarkersLayer = window.L.layerGroup().addTo(leadMapState.savedReferenceMap);
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

function renderSavedLeadList(hierarchy = buildSavedLeadHierarchy([...leadMapState.savedLeads].sort(compareSavedLeads))) {
  if (!leadMapDom.savedList || !leadMapDom.savedEmptyState) {
    return;
  }

  if (leadMapState.savedLeads.length === 0) {
    leadMapDom.savedList.innerHTML = "";
    leadMapDom.savedEmptyState.classList.remove("hidden");
    return;
  }

  leadMapDom.savedEmptyState.classList.add("hidden");
  const activeCategory = hierarchy.find((group) => group.key === leadMapState.activeSavedCategory) || null;
  const activePlace = activeCategory?.places.find((group) => group.key === leadMapState.activeSavedPlace) || null;

  if (!activeCategory || !activePlace) {
    leadMapDom.savedList.innerHTML = `
      <div class="empty-state">
        <h3>No active saved lead group</h3>
        <p>Choose a category and then a place to view the saved leads.</p>
      </div>
    `;
    return;
  }

  leadMapDom.savedList.innerHTML = `
    <section class="saved-lead-group">
      <div class="saved-lead-group-head">
        <div>
          <p class="lead-result-category">${escapeHtml(activeCategory.label)}</p>
          <h3>${escapeHtml(activePlace.place)}</h3>
        </div>
        <span class="status-pill lead-category-pill" style="--lead-pill:${escapeAttribute(activeCategory.color || "#2f6b50")}">${escapeHtml(String(activePlace.leads.length))}</span>
      </div>
      <div class="saved-lead-place-list">
        ${activePlace.leads.map((lead) => buildSavedLeadCardMarkup(lead)).join("")}
      </div>
    </section>
  `;
  updateSavedLeadActiveCard();
}

function buildSavedLeadCardMarkup(lead) {
  return `
    <article class="application-card saved-lead-card${lead.sourceKey === leadMapState.activeSavedLeadSourceKey ? " is-active" : ""}" data-saved-lead-card="${escapeAttribute(lead.sourceKey)}">
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
            ${lead.googleMapsUrl ? `<a class="workspace-link" href="${escapeAttribute(lead.googleMapsUrl)}" target="_blank" rel="noreferrer">Open in Google Maps</a>` : ""}
            ${lead.osmUrl ? `<a class="workspace-link" href="${escapeAttribute(lead.osmUrl)}" target="_blank" rel="noreferrer">Open in OSM</a>` : ""}
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
  `;
}

function buildSavedLeadHierarchy(sortedLeads) {
  return Object.entries(LEAD_CATEGORY_CONFIG)
    .map(([categoryKey, config]) => {
      const categoryLeads = sortedLeads.filter((lead) => lead.category === categoryKey);

      if (categoryLeads.length === 0) {
        return null;
      }

      return {
        key: categoryKey,
        label: config.label,
        color: config.color,
        leads: categoryLeads,
        places: groupSavedLeadsByPlace(categoryLeads)
      };
    })
    .filter(Boolean);
}

function syncSavedLeadHierarchySelection(hierarchy) {
  if (hierarchy.length === 0) {
    leadMapState.activeSavedCategory = "";
    leadMapState.activeSavedPlace = "";
    return;
  }

  const hasActiveCategory = hierarchy.some((group) => group.key === leadMapState.activeSavedCategory);

  if (!hasActiveCategory) {
    leadMapState.activeSavedCategory = hierarchy[0].key;
  }

  const activeCategory = hierarchy.find((group) => group.key === leadMapState.activeSavedCategory) || hierarchy[0];
  const hasActivePlace = activeCategory.places.some((group) => group.key === leadMapState.activeSavedPlace);

  if (!hasActivePlace) {
    leadMapState.activeSavedPlace = activeCategory.places[0]?.key || "";
  }
}

function renderSavedLeadTabs(hierarchy) {
  if (!leadMapDom.savedCategoryTabs || !leadMapDom.savedPlaceTabs) {
    return;
  }

  const hasHierarchy = hierarchy.length > 0;
  leadMapDom.savedCategoryTabs.classList.toggle("hidden", !hasHierarchy);
  leadMapDom.savedPlaceTabs.classList.toggle("hidden", !hasHierarchy);

  if (!hasHierarchy) {
    leadMapDom.savedCategoryTabs.innerHTML = "";
    leadMapDom.savedPlaceTabs.innerHTML = "";
    return;
  }

  leadMapDom.savedCategoryTabs.innerHTML = hierarchy
    .map((group) => `
      <button
        type="button"
        class="workspace-tab${group.key === leadMapState.activeSavedCategory ? " is-active" : ""}"
        data-saved-category-tab="${escapeAttribute(group.key)}"
        aria-selected="${group.key === leadMapState.activeSavedCategory ? "true" : "false"}"
      >
        ${escapeHtml(group.label)} (${escapeHtml(String(group.leads.length))})
      </button>
    `)
    .join("");

  const activeCategory = hierarchy.find((group) => group.key === leadMapState.activeSavedCategory) || hierarchy[0];

  leadMapDom.savedPlaceTabs.innerHTML = activeCategory.places
    .map((group) => `
      <button
        type="button"
        class="workspace-tab${group.key === leadMapState.activeSavedPlace ? " is-active" : ""}"
        data-saved-place-tab="${escapeAttribute(group.key)}"
        aria-selected="${group.key === leadMapState.activeSavedPlace ? "true" : "false"}"
      >
        ${escapeHtml(group.place)} (${escapeHtml(String(group.leads.length))})
      </button>
    `)
    .join("");
}

function renderSavedLeadScope(hierarchy) {
  if (!leadMapDom.savedScope) {
    return;
  }

  if (hierarchy.length === 0) {
    leadMapDom.savedScope.classList.add("hidden");
    leadMapDom.savedScope.textContent = "";
    return;
  }

  const activeCategory = hierarchy.find((group) => group.key === leadMapState.activeSavedCategory) || hierarchy[0];
  const activePlace = activeCategory.places.find((group) => group.key === leadMapState.activeSavedPlace) || activeCategory.places[0];

  if (!activeCategory || !activePlace) {
    leadMapDom.savedScope.classList.add("hidden");
    leadMapDom.savedScope.textContent = "";
    return;
  }

  leadMapDom.savedScope.classList.remove("hidden");
  leadMapDom.savedScope.textContent = `Showing ${activePlace.leads.length} saved lead${activePlace.leads.length === 1 ? "" : "s"} in ${activePlace.place} under ${activeCategory.label}.`;
}

function getActiveSavedLeadSubset(hierarchy) {
  const activeCategory = hierarchy.find((group) => group.key === leadMapState.activeSavedCategory) || null;
  const activePlace = activeCategory?.places.find((group) => group.key === leadMapState.activeSavedPlace) || null;
  return activePlace?.leads || [];
}

function getActiveSavedLeadScopeKey() {
  if (!leadMapState.activeSavedCategory || !leadMapState.activeSavedPlace) {
    return "";
  }

  return `${leadMapState.activeSavedCategory}:${leadMapState.activeSavedPlace}`;
}

function syncActiveSavedLeadSelection(activeLeads) {
  const hasActiveLead = activeLeads.some((lead) => lead.sourceKey === leadMapState.activeSavedLeadSourceKey);

  if (!hasActiveLead) {
    leadMapState.activeSavedLeadSourceKey = "";
  }
}

function setActiveSavedLeadSourceKey(sourceKey) {
  leadMapState.activeSavedLeadSourceKey = normalizeLeadValue(sourceKey);
}

function focusSavedLeadOnReferenceMap(sourceKey) {
  const normalizedSourceKey = normalizeLeadValue(sourceKey);

  if (!normalizedSourceKey) {
    return;
  }

  const marker = leadMapState.savedReferenceMarkerLookup.get(normalizedSourceKey);
  const lead = findSavedLead(normalizedSourceKey);

  if (!marker || !leadMapState.savedReferenceMap || !lead) {
    return;
  }

  setActiveSavedLeadSourceKey(normalizedSourceKey);
  updateSavedLeadActiveCard();
  updateSavedLeadReferenceMapMarkerStyles();

  const nextZoom = Math.max(leadMapState.savedReferenceMap.getZoom() || 0, 15);
  leadMapState.savedReferenceMap.setView([lead.lat, lead.lon], nextZoom, {
    animate: true
  });
  marker.openPopup();
}

function updateSavedLeadActiveCard() {
  if (!leadMapDom.savedList) {
    return;
  }

  const cards = Array.from(leadMapDom.savedList.querySelectorAll("[data-saved-lead-card]"));
  cards.forEach((card) => {
    const isActive = card.dataset.savedLeadCard === leadMapState.activeSavedLeadSourceKey;
    card.classList.toggle("is-active", isActive);
  });
}

function updateSavedLeadReferenceMapMarkerStyles() {
  leadMapState.savedReferenceMarkerLookup.forEach((marker, sourceKey) => {
    const isActive = sourceKey === leadMapState.activeSavedLeadSourceKey;
    const baseColor = marker.corexformerBaseColor || "#2f6b50";

    marker.setStyle({
      radius: isActive ? 10 : 8,
      weight: isActive ? 3 : 2,
      color: baseColor,
      fillColor: baseColor,
      fillOpacity: isActive ? 0.34 : 0.18
    });
  });
}

function setActiveSavedCategory(categoryKey) {
  if (!categoryKey || categoryKey === leadMapState.activeSavedCategory) {
    return;
  }

  leadMapState.activeSavedCategory = categoryKey;
  leadMapState.activeSavedPlace = "";
  leadMapState.activeSavedLeadSourceKey = "";
  renderSavedLeadBoard();
}

function setActiveSavedPlace(placeKey) {
  if (!placeKey || placeKey === leadMapState.activeSavedPlace) {
    return;
  }

  leadMapState.activeSavedPlace = placeKey;
  leadMapState.activeSavedLeadSourceKey = "";
  renderSavedLeadBoard();
}

function groupSavedLeadsByPlace(leads) {
  const placeMap = new Map();

  leads.forEach((lead) => {
    const place = resolveLeadPlaceGroup(lead);

    if (!placeMap.has(place)) {
      placeMap.set(place, []);
    }

    placeMap.get(place).push(lead);
  });

  return Array.from(placeMap.entries())
    .map(([place, groupedLeads]) => ({
      key: slugifyLeadMapValue(place),
      place,
      leads: groupedLeads.sort(compareSavedLeads)
    }))
    .sort((left, right) => left.place.localeCompare(right.place));
}

function resolveLeadPlaceGroup(lead) {
  const placeLabel = normalizeLeadValue(lead.placeLabel);

  if (placeLabel) {
    const derivedFromPlaceLabel = extractLeadPlaceFromAddress(placeLabel);
    if (derivedFromPlaceLabel) {
      return derivedFromPlaceLabel;
    }
  }

  const address = normalizeLeadValue(lead.address);

  if (address) {
    const derivedFromAddress = extractLeadPlaceFromAddress(address);
    if (derivedFromAddress) {
      return derivedFromAddress;
    }
  }

  return "Place not yet identified";
}

function extractLeadPlaceFromAddress(value) {
  const normalized = normalizeLeadValue(value);

  if (!normalized) {
    return "";
  }

  const rawParts = normalized
    .split(",")
    .map((part) => normalizeLeadValue(part))
    .filter(Boolean);

  if (rawParts.length === 0) {
    return normalized;
  }

  const nonCountryParts = rawParts.filter((part) => !/^india$/i.test(part));

  if (nonCountryParts.length >= 2) {
    const candidate = normalizeLeadPlacePart(nonCountryParts[nonCountryParts.length - 2]);
    if (candidate) {
      return candidate;
    }
  }

  for (let index = nonCountryParts.length - 1; index >= 0; index -= 1) {
    const candidate = normalizeLeadPlacePart(nonCountryParts[index]);
    if (candidate) {
      return candidate;
    }
  }

  return normalized;
}

function normalizeLeadPlacePart(value) {
  const withoutPostal = normalizeLeadValue(value).replace(/\b\d{5,6}\b/g, "").replace(/\s{2,}/g, " ").trim();

  if (!withoutPostal || /^india$/i.test(withoutPostal)) {
    return "";
  }

  return withoutPostal;
}

function slugifyLeadMapValue(value) {
  const normalized = normalizeLeadValue(value).toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "place";
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
      leadMapDom.areaSummary.textContent = `Radius mode is active. Click a point on the map, use your current location, or use the current map center, then scan ${leadMapState.radiusKm} km around it.`;
      return;
    }

    leadMapDom.areaSummary.textContent = `Radius scan: ${leadMapState.radiusKm} km around ${leadMapState.radiusCenter.lat.toFixed(4)}, ${leadMapState.radiusCenter.lng.toFixed(4)}.`;
    return;
  }

  const bounds = getCurrentMapBounds();

  if (!bounds) {
    leadMapDom.areaSummary.textContent = "Visible area scan is ready once the map settles on the selected region.";
    return;
  }

  leadMapDom.areaSummary.textContent = `Visible area scan: South ${bounds.south.toFixed(4)}, West ${bounds.west.toFixed(4)} · North ${bounds.north.toFixed(4)}, East ${bounds.east.toFixed(4)}`;
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

  clearRadiusSelectionVisuals();

  if (leadMapState.scanMode !== "radius" || !leadMapState.radiusCenter) {
    return;
  }

  if (isGoogleLeadMapProvider()) {
    if (!window.google?.maps) {
      return;
    }

    leadMapState.radiusMarker = new window.google.maps.Marker({
      map: leadMapState.map,
      position: leadMapState.radiusCenter
    });
    leadMapState.radiusCircle = new window.google.maps.Circle({
      map: leadMapState.map,
      center: leadMapState.radiusCenter,
      radius: leadMapState.radiusKm * 1000,
      strokeColor: "#ba7b3c",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: "#ba7b3c",
      fillOpacity: 0.12
    });
    return;
  }

  if (!leadMapState.selectionLayer) {
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
      radiusMeters: leadMapState.radiusKm * 1000,
      center: {
        lat: leadMapState.radiusCenter.lat,
        lng: leadMapState.radiusCenter.lng
      }
    };
  }

  const bounds = getCurrentMapBounds();

  if (!bounds) {
    return null;
  }

  const center = getCurrentMapCenterFromBounds(bounds);
  const radiusMeters = Math.min(
    LEAD_MAP_GOOGLE_MAX_RADIUS_METERS,
    Math.max(1000, Math.round(calculateBoundsRadiusMeters(bounds)))
  );

  return {
    mode: "bounds",
    bounds,
    center,
    radiusMeters
  };
}

function buildLeadTargetClause(target) {
  if (target.mode === "radius") {
    return `(around:${Math.round(target.radiusMeters)},${target.lat.toFixed(6)},${target.lng.toFixed(6)})`;
  }

  return `(${[
    target.bounds.south.toFixed(6),
    target.bounds.west.toFixed(6),
    target.bounds.north.toFixed(6),
    target.bounds.east.toFixed(6)
  ].join(",")})`;
}

function clampLeadRadius(value) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return 5;
  }

  return Math.min(100, Math.max(1, Math.round(parsed)));
}

function clearRadiusSelectionVisuals() {
  if (isGoogleLeadMapProvider()) {
    if (leadMapState.radiusMarker?.setMap) {
      leadMapState.radiusMarker.setMap(null);
    }

    if (leadMapState.radiusCircle?.setMap) {
      leadMapState.radiusCircle.setMap(null);
    }
  } else if (leadMapState.selectionLayer) {
    leadMapState.selectionLayer.clearLayers();
  }

  leadMapState.radiusMarker = null;
  leadMapState.radiusCircle = null;
}

function getCurrentMapBounds() {
  if (!leadMapState.map) {
    return null;
  }

  const bounds = leadMapState.map.getBounds?.();

  if (!bounds) {
    return null;
  }

  if (isGoogleLeadMapProvider()) {
    const southWest = bounds.getSouthWest?.();
    const northEast = bounds.getNorthEast?.();

    if (!southWest || !northEast) {
      return null;
    }

    return {
      south: Number(southWest.lat()),
      west: Number(southWest.lng()),
      north: Number(northEast.lat()),
      east: Number(northEast.lng())
    };
  }

  return {
    south: Number(bounds.getSouth()),
    west: Number(bounds.getWest()),
    north: Number(bounds.getNorth()),
    east: Number(bounds.getEast())
  };
}

function getCurrentMapCenterFromBounds(bounds) {
  return {
    lat: (bounds.south + bounds.north) / 2,
    lng: (bounds.west + bounds.east) / 2
  };
}

function calculateBoundsRadiusMeters(bounds) {
  const northWest = { lat: bounds.north, lng: bounds.west };
  const southEast = { lat: bounds.south, lng: bounds.east };
  return haversineDistanceMeters(northWest, southEast) / 2;
}

function haversineDistanceMeters(left, right) {
  const toRadians = (value) => value * (Math.PI / 180);
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(right.lat - left.lat);
  const deltaLng = toRadians(right.lng - left.lng);
  const lat1 = toRadians(left.lat);
  const lat2 = toRadians(right.lat);
  const a = (
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  );
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function dedupeLeadResults(results) {
  const seen = new Set();
  const deduped = [];

  results.forEach((item) => {
    const fingerprint = item?.placeId
      ? `google:${item.placeId}`
      : item
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
    if (!leadMapState.map) {
      return;
    }

    if (isGoogleLeadMapProvider()) {
      window.google?.maps?.event?.trigger?.(leadMapState.map, "resize");
      return;
    }

    leadMapState.map.invalidateSize?.();
  }, 120);
}

function scheduleSavedLeadReferenceMapResize() {
  window.setTimeout(() => {
    if (!leadMapState.savedReferenceMap) {
      return;
    }

    leadMapState.savedReferenceMap.invalidateSize?.();
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
