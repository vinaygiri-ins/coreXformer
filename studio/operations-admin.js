const OPERATIONS_ADMIN_ROLES = ["owner", "editor"];
const OPERATIONS_SETTING_KEY = "operations_workspace_v1";
const OPERATIONS_TABS = [
  { key: "schools", label: "Schools" },
  { key: "colleges", label: "Colleges" },
  { key: "corporates", label: "Corporates" },
  { key: "teachers", label: "Teachers" },
  { key: "communities", label: "Communities" },
  { key: "government", label: "Government" },
  { key: "learning-values", label: "Learning Values" },
  { key: "games", label: "Games" },
  { key: "tasks", label: "Tasks" }
];

const operationsDom = {
  tabList: document.getElementById("operationsTabList"),
  workspace: document.getElementById("operationsWorkspace"),
  activeTabLabel: document.getElementById("operationsActiveTabLabel"),
  updatedBadge: document.getElementById("operationsUpdatedBadge"),
  message: document.getElementById("operationsMessage"),
  form: document.getElementById("operationsEditorForm"),
  titleInput: document.getElementById("operationsTitleInput"),
  bodyInput: document.getElementById("operationsBodyInput"),
  saveButton: document.getElementById("operationsSaveButton"),
  resetButton: document.getElementById("operationsResetButton"),
  clearButton: document.getElementById("operationsClearButton")
};

const operationsState = {
  supabase: null,
  profile: null,
  isAdmin: false,
  isLoading: false,
  isSaving: false,
  activeTab: OPERATIONS_TABS[0].key,
  persistedSections: createEmptyOperationsSections(),
  draftSections: createEmptyOperationsSections(),
  dirtyTabs: new Set()
};

document.addEventListener("DOMContentLoaded", () => {
  bindOperationsAdminEvents();
  renderOperationsWorkspace();

  if (window.COREXFORMER_ADMIN_CONTEXT) {
    void handleOperationsAdminContext(window.COREXFORMER_ADMIN_CONTEXT);
  }
});

document.addEventListener("corexformer:admin-context", (event) => {
  void handleOperationsAdminContext(event.detail);
});

function bindOperationsAdminEvents() {
  operationsDom.tabList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-operations-tab]");

    if (!button) {
      return;
    }

    const nextTab = button.dataset.operationsTab || "";

    if (!nextTab || nextTab === operationsState.activeTab) {
      return;
    }

    syncCurrentOperationsDraft();
    operationsState.activeTab = nextTab;
    renderOperationsWorkspace();
    scrollActiveOperationsTabIntoView();
  });

  operationsDom.titleInput?.addEventListener("input", () => {
    syncCurrentOperationsDraft();
    renderOperationsStatus();
    syncOperationsActionState();
  });

  operationsDom.bodyInput?.addEventListener("input", () => {
    syncCurrentOperationsDraft();
    renderOperationsStatus();
    syncOperationsActionState();
  });

  operationsDom.form?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveOperationsWorkspace();
  });

  operationsDom.saveButton?.addEventListener("click", () => {
    void saveOperationsWorkspace();
  });

  operationsDom.resetButton?.addEventListener("click", () => {
    resetCurrentOperationsTab();
  });

  operationsDom.clearButton?.addEventListener("click", () => {
    clearCurrentOperationsTab();
  });

  document.addEventListener("keydown", (event) => {
    const isSaveShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";

    if (!isSaveShortcut || !isOperationsWorkspaceVisible()) {
      return;
    }

    if (!operationsDom.workspace?.contains(document.activeElement)) {
      return;
    }

    event.preventDefault();
    void saveOperationsWorkspace();
  });
}

async function handleOperationsAdminContext(detail) {
  operationsState.supabase = detail?.supabase ?? null;
  operationsState.profile = detail?.profile ?? null;
  operationsState.isAdmin = Boolean(detail?.profile && OPERATIONS_ADMIN_ROLES.includes(detail.profile.role));

  if (!operationsState.isAdmin || !operationsState.supabase) {
    resetOperationsState();
    renderOperationsWorkspace();
    return;
  }

  await loadOperationsWorkspace();
}

function resetOperationsState() {
  operationsState.persistedSections = createEmptyOperationsSections();
  operationsState.draftSections = createEmptyOperationsSections();
  operationsState.dirtyTabs.clear();
  clearOperationsMessage();
}

async function loadOperationsWorkspace() {
  if (operationsState.isLoading || !operationsState.supabase) {
    return;
  }

  operationsState.isLoading = true;
  setOperationsMessage("Loading operations workspace...", "info");
  syncOperationsActionState();

  try {
    const { data, error } = await operationsState.supabase
      .from("site_settings")
      .select("key, value")
      .eq("key", OPERATIONS_SETTING_KEY)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const sections = normalizeOperationsSections(data?.value?.sections);
    operationsState.persistedSections = cloneOperationsSections(sections);
    operationsState.draftSections = cloneOperationsSections(sections);
    operationsState.dirtyTabs.clear();
    clearOperationsMessage();
  } catch (error) {
    const errorText = String(error?.message || "");
    const backendNotReady = errorText.includes("site_settings") && (
      errorText.includes("does not exist")
      || errorText.includes("schema cache")
      || errorText.includes("permission denied")
      || errorText.includes("row-level")
    );

    operationsState.persistedSections = createEmptyOperationsSections();
    operationsState.draftSections = createEmptyOperationsSections();
    operationsState.dirtyTabs.clear();
    setOperationsMessage(
      backendNotReady
        ? "The shared operations storage is not fully enabled yet. Activate the `site_settings` table access in Supabase, then refresh this page."
        : "Operations notes could not be loaded right now. Please try again shortly.",
      "error"
    );
  } finally {
    operationsState.isLoading = false;
    renderOperationsWorkspace();
  }
}

async function saveOperationsWorkspace() {
  if (!operationsState.isAdmin || !operationsState.supabase || operationsState.isSaving) {
    return;
  }

  syncCurrentOperationsDraft();

  if (!operationsState.dirtyTabs.size) {
    setOperationsMessage("There are no new changes to save in Operations.", "success");
    renderOperationsStatus();
    syncOperationsActionState();
    return;
  }

  operationsState.isSaving = true;
  syncOperationsActionState();
  setOperationsMessage("Saving operations updates...", "info");

  const updatedAt = new Date().toISOString();
  const updatedBy = operationsState.profile?.full_name || operationsState.profile?.email || "Admin";

  operationsState.dirtyTabs.forEach((tabKey) => {
    const section = operationsState.draftSections[tabKey];

    if (!section) {
      return;
    }

    section.updatedAt = updatedAt;
    section.updatedBy = updatedBy;
  });

  const payload = {
    key: OPERATIONS_SETTING_KEY,
    value: {
      sections: operationsState.draftSections
    },
    is_public: false,
    updated_by: operationsState.profile?.id || null
  };

  const { error } = await operationsState.supabase
    .from("site_settings")
    .upsert(payload, { onConflict: "key" });

  operationsState.isSaving = false;

  if (error) {
    setOperationsMessage(error.message || "Operations updates could not be saved.", "error");
    renderOperationsStatus();
    syncOperationsActionState();
    return;
  }

  operationsState.persistedSections = cloneOperationsSections(operationsState.draftSections);
  operationsState.dirtyTabs.clear();
  setOperationsMessage("Operations updates were saved successfully.", "success");
  renderOperationsWorkspace();
}

function resetCurrentOperationsTab() {
  const activeKey = operationsState.activeTab;
  const persistedSection = cloneOperationSection(operationsState.persistedSections[activeKey]);
  operationsState.draftSections[activeKey] = persistedSection;
  syncOperationsDirtyState(activeKey);
  clearOperationsMessage();
  renderOperationsWorkspace();
}

function clearCurrentOperationsTab() {
  const activeKey = operationsState.activeTab;
  const current = operationsState.draftSections[activeKey] || createEmptyOperationSection();

  operationsState.draftSections[activeKey] = {
    title: "",
    body: "",
    updatedAt: current.updatedAt || "",
    updatedBy: current.updatedBy || ""
  };

  syncOperationsDirtyState(activeKey);
  clearOperationsMessage();
  renderOperationsWorkspace();
}

function syncCurrentOperationsDraft() {
  const activeKey = operationsState.activeTab;
  const current = operationsState.draftSections[activeKey] || createEmptyOperationSection();

  operationsState.draftSections[activeKey] = {
    ...current,
    title: normalizeOperationsText(operationsDom.titleInput?.value),
    body: normalizeOperationsText(operationsDom.bodyInput?.value)
  };

  syncOperationsDirtyState(activeKey);
}

function syncOperationsDirtyState(tabKey) {
  if (isOperationSectionDirty(tabKey)) {
    operationsState.dirtyTabs.add(tabKey);
    return;
  }

  operationsState.dirtyTabs.delete(tabKey);
}

function isOperationSectionDirty(tabKey) {
  const draft = operationsState.draftSections[tabKey] || createEmptyOperationSection();
  const persisted = operationsState.persistedSections[tabKey] || createEmptyOperationSection();

  return normalizeOperationsText(draft.title) !== normalizeOperationsText(persisted.title)
    || normalizeOperationsText(draft.body) !== normalizeOperationsText(persisted.body);
}

function renderOperationsWorkspace() {
  renderOperationsTabs();
  renderOperationsEditor();
  renderOperationsStatus();
  syncOperationsActionState();
}

function renderOperationsTabs() {
  if (!operationsDom.tabList) {
    return;
  }

  operationsDom.tabList.innerHTML = OPERATIONS_TABS.map((tab) => {
    const isActive = tab.key === operationsState.activeTab;
    const isDirty = operationsState.dirtyTabs.has(tab.key);

    return `
      <button
        type="button"
        class="workspace-tab operations-tab${isActive ? " is-active" : ""}${isDirty ? " is-dirty" : ""}"
        data-operations-tab="${escapeOperationsHtml(tab.key)}"
        aria-selected="${isActive ? "true" : "false"}"
        role="tab"
      >
        <span class="operations-tab-label">
          <span>${escapeOperationsHtml(tab.label)}</span>
          ${isDirty ? '<span class="operations-tab-dot" aria-hidden="true"></span>' : ""}
        </span>
      </button>
    `;
  }).join("");
}

function renderOperationsEditor() {
  const tab = getActiveOperationsTab();
  const draft = operationsState.draftSections[operationsState.activeTab] || createEmptyOperationSection();

  if (operationsDom.activeTabLabel) {
    operationsDom.activeTabLabel.textContent = tab.label;
  }

  if (operationsDom.titleInput) {
    operationsDom.titleInput.value = draft.title || "";
    operationsDom.titleInput.placeholder = `Optional heading for ${tab.label.toLowerCase()}`;
  }

  if (operationsDom.bodyInput) {
    operationsDom.bodyInput.value = draft.body || "";
    operationsDom.bodyInput.placeholder = `Write and update your ${tab.label.toLowerCase()} notes here.`;
  }
}

function renderOperationsStatus() {
  if (!operationsDom.updatedBadge) {
    return;
  }

  const activeKey = operationsState.activeTab;
  const section = operationsState.draftSections[activeKey] || createEmptyOperationSection();
  const isDirty = operationsState.dirtyTabs.has(activeKey);

  operationsDom.updatedBadge.classList.toggle("is-draft", isDirty);

  if (isDirty) {
    operationsDom.updatedBadge.textContent = "Unsaved changes";
    return;
  }

  if (section.updatedAt) {
    operationsDom.updatedBadge.textContent = section.updatedBy
      ? `Saved ${formatOperationsTimestamp(section.updatedAt)} · ${section.updatedBy}`
      : `Saved ${formatOperationsTimestamp(section.updatedAt)}`;
    return;
  }

  operationsDom.updatedBadge.textContent = "Not saved yet";
}

function syncOperationsActionState() {
  const canEdit = operationsState.isAdmin && !operationsState.isLoading;
  const activeKey = operationsState.activeTab;
  const draft = operationsState.draftSections[activeKey] || createEmptyOperationSection();
  const hasContent = Boolean(draft.title || draft.body);
  const isDirty = operationsState.dirtyTabs.has(activeKey);

  if (operationsDom.titleInput) {
    operationsDom.titleInput.disabled = !canEdit || operationsState.isSaving;
  }

  if (operationsDom.bodyInput) {
    operationsDom.bodyInput.disabled = !canEdit || operationsState.isSaving;
  }

  if (operationsDom.saveButton) {
    operationsDom.saveButton.disabled = !canEdit || operationsState.isSaving || !operationsState.dirtyTabs.size;
  }

  if (operationsDom.resetButton) {
    operationsDom.resetButton.disabled = !canEdit || operationsState.isSaving || !isDirty;
  }

  if (operationsDom.clearButton) {
    operationsDom.clearButton.disabled = !canEdit || operationsState.isSaving || !hasContent;
  }
}

function scrollActiveOperationsTabIntoView() {
  if (!window.matchMedia("(max-width: 980px)").matches) {
    return;
  }

  operationsDom.tabList
    ?.querySelector("[data-operations-tab].is-active")
    ?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
}

function createEmptyOperationsSections() {
  return OPERATIONS_TABS.reduce((accumulator, tab) => {
    accumulator[tab.key] = createEmptyOperationSection();
    return accumulator;
  }, {});
}

function createEmptyOperationSection() {
  return {
    title: "",
    body: "",
    updatedAt: "",
    updatedBy: ""
  };
}

function cloneOperationsSections(source) {
  return OPERATIONS_TABS.reduce((accumulator, tab) => {
    accumulator[tab.key] = cloneOperationSection(source?.[tab.key]);
    return accumulator;
  }, {});
}

function cloneOperationSection(section) {
  return {
    title: normalizeOperationsText(section?.title),
    body: normalizeOperationsText(section?.body),
    updatedAt: normalizeOperationsText(section?.updatedAt),
    updatedBy: normalizeOperationsText(section?.updatedBy)
  };
}

function normalizeOperationsSections(source) {
  return cloneOperationsSections(source || {});
}

function getActiveOperationsTab() {
  return OPERATIONS_TABS.find((tab) => tab.key === operationsState.activeTab) || OPERATIONS_TABS[0];
}

function setOperationsMessage(message, tone = "info") {
  if (!operationsDom.message) {
    return;
  }

  operationsDom.message.textContent = message;
  operationsDom.message.classList.remove("hidden", "is-error", "is-success");

  if (tone === "error") {
    operationsDom.message.classList.add("is-error");
    return;
  }

  if (tone === "success") {
    operationsDom.message.classList.add("is-success");
  }
}

function clearOperationsMessage() {
  if (!operationsDom.message) {
    return;
  }

  operationsDom.message.textContent = "";
  operationsDom.message.classList.add("hidden");
  operationsDom.message.classList.remove("is-error", "is-success");
}

function isOperationsWorkspaceVisible() {
  return Boolean(operationsDom.workspace && !operationsDom.workspace.closest("[data-admin-view-panel]")?.classList.contains("hidden"));
}

function formatOperationsTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function normalizeOperationsText(value) {
  return typeof value === "string" ? value : "";
}

function escapeOperationsHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
