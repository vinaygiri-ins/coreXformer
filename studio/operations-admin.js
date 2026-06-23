const OPERATIONS_ADMIN_ROLES = ["owner", "editor"];
const OPERATIONS_SETTING_KEY = "operations_workspace_v1";
const OPERATIONS_IMAGE_MAX_DIMENSION = 1400;
const OPERATIONS_IMAGE_MAX_BYTES = 1.35 * 1024 * 1024;
const OPERATIONS_TABS = [
  { key: "schools", label: "Schools" },
  { key: "colleges", label: "Colleges" },
  { key: "corporates", label: "Corporates" },
  { key: "teachers", label: "Teachers" },
  { key: "communities", label: "Communities" },
  { key: "government", label: "Government" },
  { key: "learning-values", label: "Learning Values" },
  { key: "change-a-habit", label: "Change a Habit" },
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
  imageInput: document.getElementById("operationsImageInput"),
  removePhotoButton: document.getElementById("operationsRemovePhotoButton"),
  imagePreview: document.getElementById("operationsImagePreview"),
  bodyInput: document.getElementById("operationsBodyInput"),
  newEntryButton: document.getElementById("operationsNewEntryButton"),
  saveButton: document.getElementById("operationsSaveButton"),
  resetButton: document.getElementById("operationsResetButton"),
  railSection: document.getElementById("operationsRailSection"),
  railCount: document.getElementById("operationsRailCount"),
  entriesRail: document.getElementById("operationsEntriesRail"),
  entriesEmptyState: document.getElementById("operationsEntriesEmptyState")
};

const operationsState = {
  supabase: null,
  profile: null,
  isAdmin: false,
  isLoading: false,
  isSaving: false,
  isUploadingImage: false,
  activeTab: OPERATIONS_TABS[0].key,
  persistedSections: createEmptyOperationsSections(),
  draftsByTab: createEmptyOperationsDrafts(),
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
    clearOperationsMessage();
    renderOperationsWorkspace();
    scrollActiveOperationsTabIntoView();
  });

  operationsDom.titleInput?.addEventListener("input", () => {
    syncCurrentOperationsDraft();
    renderOperationsTabs();
    renderOperationsStatus();
    syncOperationsActionState();
  });

  operationsDom.bodyInput?.addEventListener("input", () => {
    syncCurrentOperationsDraft();
    renderOperationsTabs();
    renderOperationsStatus();
    syncOperationsActionState();
  });

  operationsDom.imageInput?.addEventListener("change", (event) => {
    void handleOperationsImageSelection(event);
  });

  operationsDom.removePhotoButton?.addEventListener("click", () => {
    removeCurrentOperationsImage();
  });

  operationsDom.form?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveOperationsWorkspace();
  });

  operationsDom.newEntryButton?.addEventListener("click", () => {
    startNewOperationsEntry();
  });

  operationsDom.saveButton?.addEventListener("click", () => {
    void saveOperationsWorkspace();
  });

  operationsDom.resetButton?.addEventListener("click", () => {
    resetCurrentOperationsTab();
  });

  operationsDom.entriesRail?.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-operations-entry-delete]");

    if (deleteButton) {
      void deleteOperationsEntry(deleteButton.dataset.operationsEntryDelete || "");
      return;
    }

    const selectButton = event.target.closest("[data-operations-entry-select]");

    if (!selectButton) {
      return;
    }

    loadOperationsEntryIntoDraft(selectButton.dataset.operationsEntrySelect || "");
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
  operationsState.isAdmin = Boolean(
    detail?.profile && OPERATIONS_ADMIN_ROLES.includes(detail.profile.role)
  );

  if (!operationsState.isAdmin || !operationsState.supabase) {
    resetOperationsState();
    renderOperationsWorkspace();
    return;
  }

  await loadOperationsWorkspace();
}

function resetOperationsState() {
  operationsState.persistedSections = createEmptyOperationsSections();
  operationsState.draftsByTab = createEmptyOperationsDrafts();
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
    operationsState.draftsByTab = createDraftsFromSections(sections);
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
    operationsState.draftsByTab = createEmptyOperationsDrafts();
    operationsState.dirtyTabs.clear();
    setOperationsMessage(
      backendNotReady
        ? "The shared operations storage is not fully enabled yet. Activate the `site_settings` table access in Supabase, then refresh this page."
        : "Operations rails could not be loaded right now. Please try again shortly.",
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

  const activeKey = operationsState.activeTab;
  const draft = getOperationsDraft(activeKey);

  if (!hasOperationsDraftContent(draft)) {
    setOperationsMessage("Add some writing or a photo before saving this rail.", "error");
    syncOperationsActionState();
    return;
  }

  if (!operationsState.dirtyTabs.has(activeKey)) {
    setOperationsMessage("There are no new changes to save in this rail.", "success");
    renderOperationsStatus();
    syncOperationsActionState();
    return;
  }

  operationsState.isSaving = true;
  syncOperationsActionState();
  setOperationsMessage("Saving this rail...", "info");

  const updatedAt = new Date().toISOString();
  const updatedBy = operationsState.profile?.full_name || operationsState.profile?.email || "Admin";
  const nextSections = cloneOperationsSections(operationsState.persistedSections);
  const activeSection = nextSections[activeKey] || createEmptyOperationsSection();
  const existingEntries = Array.isArray(activeSection.entries) ? [...activeSection.entries] : [];
  let wasEditingExisting = false;

  let savedEntry = null;
  const title = normalizeOperationsTitle(draft.title);
  const body = normalizeOperationsBody(draft.body);
  const imageDataUrl = normalizeOperationsDataUrl(draft.imageDataUrl);
  const imageName = normalizeOperationsFilename(draft.imageName);

  if (draft.selectedEntryId) {
    const entryIndex = existingEntries.findIndex((entry) => entry.id === draft.selectedEntryId);

    if (entryIndex >= 0) {
      wasEditingExisting = true;
      const existingEntry = existingEntries[entryIndex];
      savedEntry = normalizeOperationsEntry({
        ...existingEntry,
        title,
        body,
        imageDataUrl,
        imageName,
        createdAt: existingEntry.createdAt || draft.createdAt || updatedAt,
        updatedAt,
        updatedBy
      }, `saved-${activeKey}`);

      existingEntries[entryIndex] = savedEntry;
    }
  }

  if (!savedEntry) {
    savedEntry = normalizeOperationsEntry({
      id: createOperationsId(activeKey),
      title,
      body,
      imageDataUrl,
      imageName,
      createdAt: updatedAt,
      updatedAt,
      updatedBy
    }, `saved-${activeKey}`);

    existingEntries.unshift(savedEntry);
  }

  activeSection.entries = sortOperationsEntries(existingEntries);
  nextSections[activeKey] = activeSection;

  const payload = {
    key: OPERATIONS_SETTING_KEY,
    value: {
      sections: nextSections
    },
    is_public: false,
    updated_by: operationsState.profile?.id || null
  };

  const { error } = await operationsState.supabase
    .from("site_settings")
    .upsert(payload, { onConflict: "key" });

  operationsState.isSaving = false;

  if (error) {
    setOperationsMessage(error.message || "This rail could not be saved right now.", "error");
    renderOperationsStatus();
    syncOperationsActionState();
    return;
  }

  const normalizedSections = normalizeOperationsSections(nextSections);
  const persistedEntry = findOperationsEntryById(
    normalizedSections[activeKey].entries,
    savedEntry?.id
  );

  operationsState.persistedSections = cloneOperationsSections(normalizedSections);
  operationsState.draftsByTab[activeKey] = wasEditingExisting && persistedEntry
    ? createOperationsDraftFromEntry(persistedEntry)
    : createBlankOperationsDraft();
  operationsState.dirtyTabs.delete(activeKey);

  setOperationsMessage(
    wasEditingExisting
      ? "This rail was updated successfully."
      : "A new rail was saved successfully.",
    "success"
  );
  renderOperationsWorkspace();
  scrollOperationsRailIntoView();
}

function startNewOperationsEntry() {
  const activeKey = operationsState.activeTab;
  const draft = getOperationsDraft(activeKey);

  if (
    operationsState.dirtyTabs.has(activeKey)
    && !window.confirm("You have unsaved changes in this rail. Start a new rail anyway?")
  ) {
    return;
  }

  if (!draft.selectedEntryId && !hasOperationsDraftContent(draft)) {
    return;
  }

  operationsState.draftsByTab[activeKey] = createBlankOperationsDraft();
  operationsState.dirtyTabs.delete(activeKey);
  clearOperationsMessage();
  renderOperationsWorkspace();
}

function resetCurrentOperationsTab() {
  const activeKey = operationsState.activeTab;
  const draft = getOperationsDraft(activeKey);

  if (draft.selectedEntryId) {
    const persistedEntry = findOperationsEntryById(
      operationsState.persistedSections[activeKey]?.entries,
      draft.selectedEntryId
    );

    operationsState.draftsByTab[activeKey] = persistedEntry
      ? createOperationsDraftFromEntry(persistedEntry)
      : createBlankOperationsDraft();
  } else {
    operationsState.draftsByTab[activeKey] = createBlankOperationsDraft();
  }

  syncOperationsDirtyState(activeKey);
  clearOperationsMessage();
  renderOperationsWorkspace();
}

function loadOperationsEntryIntoDraft(entryId) {
  const activeKey = operationsState.activeTab;
  const draft = getOperationsDraft(activeKey);
  const isSameEntry = draft.selectedEntryId === entryId;

  if (!entryId) {
    return;
  }

  if (
    operationsState.dirtyTabs.has(activeKey)
    && !window.confirm(
      isSameEntry
        ? "Discard the unsaved edits in this rail and reopen the saved version?"
        : "You have unsaved changes in this rail. Open another saved rail anyway?"
    )
  ) {
    return;
  }

  const entry = findOperationsEntryById(operationsState.persistedSections[activeKey]?.entries, entryId);

  if (!entry) {
    setOperationsMessage("That saved rail could not be opened right now.", "error");
    return;
  }

  operationsState.draftsByTab[activeKey] = createOperationsDraftFromEntry(entry);
  operationsState.dirtyTabs.delete(activeKey);
  clearOperationsMessage();
  renderOperationsWorkspace();
  operationsDom.titleInput?.focus();
  operationsDom.workspace?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function deleteOperationsEntry(entryId) {
  const activeKey = operationsState.activeTab;

  if (!entryId) {
    return;
  }

  const targetEntry = findOperationsEntryById(operationsState.persistedSections[activeKey]?.entries, entryId);

  if (!targetEntry) {
    setOperationsMessage("That rail could not be found anymore.", "error");
    return;
  }

  if (!window.confirm("Delete this saved rail? This cannot be undone.")) {
    return;
  }

  if (!operationsState.supabase || operationsState.isSaving) {
    return;
  }

  operationsState.isSaving = true;
  syncOperationsActionState();
  setOperationsMessage("Deleting this rail...", "info");

  const nextSections = cloneOperationsSections(operationsState.persistedSections);
  const nextEntries = (nextSections[activeKey]?.entries || []).filter((entry) => entry.id !== entryId);
  nextSections[activeKey] = {
    entries: sortOperationsEntries(nextEntries)
  };

  const payload = {
    key: OPERATIONS_SETTING_KEY,
    value: {
      sections: nextSections
    },
    is_public: false,
    updated_by: operationsState.profile?.id || null
  };

  const { error } = await operationsState.supabase
    .from("site_settings")
    .upsert(payload, { onConflict: "key" });

  operationsState.isSaving = false;

  if (error) {
    setOperationsMessage(error.message || "This rail could not be deleted right now.", "error");
    renderOperationsStatus();
    syncOperationsActionState();
    return;
  }

  const normalizedSections = normalizeOperationsSections(nextSections);
  operationsState.persistedSections = cloneOperationsSections(normalizedSections);

  const currentDraft = getOperationsDraft(activeKey);

  if (currentDraft.selectedEntryId === entryId) {
    const nextSelectedEntry = normalizedSections[activeKey].entries[0] || null;
    operationsState.draftsByTab[activeKey] = nextSelectedEntry
      ? createOperationsDraftFromEntry(nextSelectedEntry)
      : createBlankOperationsDraft();
    operationsState.dirtyTabs.delete(activeKey);
  } else {
    syncOperationsDirtyState(activeKey);
  }

  setOperationsMessage("The saved rail was deleted.", "success");
  renderOperationsWorkspace();
}

async function handleOperationsImageSelection(event) {
  const file = event?.target?.files?.[0];

  if (!file) {
    return;
  }

  operationsState.isUploadingImage = true;
  setOperationsMessage("Preparing photo for this rail...", "info");
  syncOperationsActionState();
  renderOperationsStatus();

  try {
    const image = await prepareOperationsImage(file);
    const activeKey = operationsState.activeTab;
    const draft = getOperationsDraft(activeKey);

    draft.imageDataUrl = image.dataUrl;
    draft.imageName = image.fileName;
    syncOperationsDirtyState(activeKey);
    clearOperationsMessage();
    renderOperationsTabs();
    renderOperationsImagePreview();
  } catch (error) {
    setOperationsMessage(
      error?.message || "This photo could not be added right now. Please try another image.",
      "error"
    );
  } finally {
    operationsState.isUploadingImage = false;

    if (operationsDom.imageInput) {
      operationsDom.imageInput.value = "";
    }

    renderOperationsStatus();
    syncOperationsActionState();
  }
}

function removeCurrentOperationsImage() {
  const activeKey = operationsState.activeTab;
  const draft = getOperationsDraft(activeKey);

  if (!draft.imageDataUrl) {
    return;
  }

  draft.imageDataUrl = "";
  draft.imageName = "";
  syncOperationsDirtyState(activeKey);
  clearOperationsMessage();
  renderOperationsTabs();
  renderOperationsImagePreview();
  renderOperationsStatus();
  syncOperationsActionState();
}

function syncCurrentOperationsDraft() {
  const activeKey = operationsState.activeTab;
  const draft = getOperationsDraft(activeKey);

  draft.title = normalizeOperationsTitle(operationsDom.titleInput?.value);
  draft.body = normalizeOperationsBody(operationsDom.bodyInput?.value);
  syncOperationsDirtyState(activeKey);
}

function syncOperationsDirtyState(tabKey) {
  if (isOperationsDraftDirty(tabKey)) {
    operationsState.dirtyTabs.add(tabKey);
    return;
  }

  operationsState.dirtyTabs.delete(tabKey);
}

function isOperationsDraftDirty(tabKey) {
  const draft = getOperationsDraft(tabKey);
  const persistedEntry = getPersistedEntryForDraft(tabKey);

  if (!draft.selectedEntryId) {
    return hasOperationsDraftContent(draft);
  }

  if (!persistedEntry) {
    return hasOperationsDraftContent(draft);
  }

  return normalizeOperationsTitle(draft.title) !== normalizeOperationsTitle(persistedEntry.title)
    || normalizeOperationsBody(draft.body) !== normalizeOperationsBody(persistedEntry.body)
    || normalizeOperationsDataUrl(draft.imageDataUrl) !== normalizeOperationsDataUrl(persistedEntry.imageDataUrl)
    || normalizeOperationsFilename(draft.imageName) !== normalizeOperationsFilename(persistedEntry.imageName);
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
  const draft = getOperationsDraft(operationsState.activeTab);

  if (operationsDom.activeTabLabel) {
    operationsDom.activeTabLabel.textContent = tab.label;
  }

  if (operationsDom.titleInput) {
    operationsDom.titleInput.value = draft.title || "";
    operationsDom.titleInput.placeholder = getOperationsTitlePlaceholder(tab);
  }

  if (operationsDom.bodyInput) {
    operationsDom.bodyInput.value = draft.body || "";
    operationsDom.bodyInput.placeholder = getOperationsBodyPlaceholder(tab);
  }

  renderOperationsImagePreview();
  renderOperationsEntriesRail();
}

function getOperationsTitlePlaceholder(tab) {
  if (tab.key === "change-a-habit") {
    return "Method name, cue, routine, reward, or behavior shift";
  }

  return `Optional heading for this ${tab.label.toLowerCase()} rail`;
}

function getOperationsBodyPlaceholder(tab) {
  if (tab.key === "change-a-habit") {
    return "Write the method to change a habit here: cue, routine, reward, friction, replacement behavior, and next practice step.";
  }

  return `Write and update your ${tab.label.toLowerCase()} working window here.`;
}

function renderOperationsImagePreview() {
  if (!operationsDom.imagePreview) {
    return;
  }

  const draft = getOperationsDraft(operationsState.activeTab);
  const hasImage = Boolean(draft.imageDataUrl);

  operationsDom.imagePreview.classList.toggle("hidden", !hasImage);

  if (!hasImage) {
    operationsDom.imagePreview.innerHTML = "";
    return;
  }

  operationsDom.imagePreview.innerHTML = `
    <div class="operations-image-preview-card">
      <img src="${escapeOperationsHtml(draft.imageDataUrl)}" alt="Operations rail preview image">
      <div class="operations-image-preview-meta">
        <strong>${escapeOperationsHtml(draft.imageName || "Attached photo")}</strong>
        <span>This photo will stay attached to this rail when you save it.</span>
      </div>
    </div>
  `;
}

function renderOperationsEntriesRail() {
  const section = operationsState.persistedSections[operationsState.activeTab] || createEmptyOperationsSection();
  const entries = Array.isArray(section.entries) ? section.entries : [];
  const draft = getOperationsDraft(operationsState.activeTab);

  if (operationsDom.railCount) {
    operationsDom.railCount.textContent = `${entries.length} rail${entries.length === 1 ? "" : "s"}`;
  }

  if (operationsDom.entriesEmptyState) {
    operationsDom.entriesEmptyState.classList.toggle("hidden", entries.length > 0);
  }

  if (!operationsDom.entriesRail) {
    return;
  }

  if (!entries.length) {
    operationsDom.entriesRail.innerHTML = "";
    return;
  }

  operationsDom.entriesRail.innerHTML = entries.map((entry) => {
    const isActive = draft.selectedEntryId === entry.id;
    const excerpt = buildOperationsExcerpt(entry.body);
    const description = excerpt
      || (entry.imageDataUrl ? "Photo attached to this rail." : "No notes were added to this rail yet.");
    const meta = [
      entry.updatedAt ? `Updated ${formatOperationsTimestamp(entry.updatedAt, "compact")}` : "",
      entry.updatedBy ? entry.updatedBy : "",
      entry.imageDataUrl ? "Photo" : ""
    ].filter(Boolean).join(" · ");

    return `
      <article class="operations-entry-card${isActive ? " is-active" : ""}">
        ${entry.imageDataUrl ? `
          <div class="operations-entry-card-media">
            <img src="${escapeOperationsHtml(entry.imageDataUrl)}" alt="">
          </div>
        ` : ""}
        <button
          type="button"
          class="operations-entry-card-body"
          data-operations-entry-select="${escapeOperationsHtml(entry.id)}"
          aria-label="Open saved rail ${escapeOperationsHtml(entry.title || "Untitled rail")}"
        >
          <span class="operations-entry-card-kicker">${escapeOperationsHtml(meta || "Saved rail")}</span>
          <h4>${escapeOperationsHtml(entry.title || "Untitled rail")}</h4>
          <p>${escapeOperationsHtml(description)}</p>
        </button>
        <div class="operations-entry-card-actions">
          <button
            type="button"
            class="button button-ghost"
            data-operations-entry-select="${escapeOperationsHtml(entry.id)}"
          >
            Edit rail
          </button>
          <button
            type="button"
            class="button button-muted"
            data-operations-entry-delete="${escapeOperationsHtml(entry.id)}"
          >
            Delete
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderOperationsStatus() {
  if (!operationsDom.updatedBadge) {
    return;
  }

  const activeKey = operationsState.activeTab;
  const draft = getOperationsDraft(activeKey);
  const isDirty = operationsState.dirtyTabs.has(activeKey);
  const persistedEntry = getPersistedEntryForDraft(activeKey);

  operationsDom.updatedBadge.classList.toggle("is-draft", isDirty || operationsState.isUploadingImage);

  if (operationsState.isUploadingImage) {
    operationsDom.updatedBadge.textContent = "Preparing photo";
    return;
  }

  if (isDirty) {
    operationsDom.updatedBadge.textContent = draft.selectedEntryId ? "Unsaved edits" : "Unsaved new rail";
    return;
  }

  if (persistedEntry?.updatedAt) {
    operationsDom.updatedBadge.textContent = persistedEntry.updatedBy
      ? `Saved ${formatOperationsTimestamp(persistedEntry.updatedAt, "compact")} · ${persistedEntry.updatedBy}`
      : `Saved ${formatOperationsTimestamp(persistedEntry.updatedAt, "compact")}`;
    return;
  }

  operationsDom.updatedBadge.textContent = "New rail";
}

function syncOperationsActionState() {
  const canEdit = operationsState.isAdmin && !operationsState.isLoading;
  const activeKey = operationsState.activeTab;
  const draft = getOperationsDraft(activeKey);
  const hasContent = hasOperationsDraftContent(draft);
  const isDirty = operationsState.dirtyTabs.has(activeKey);
  const isBusy = operationsState.isSaving || operationsState.isUploadingImage;

  if (operationsDom.titleInput) {
    operationsDom.titleInput.disabled = !canEdit || isBusy;
  }

  if (operationsDom.bodyInput) {
    operationsDom.bodyInput.disabled = !canEdit || isBusy;
  }

  if (operationsDom.imageInput) {
    operationsDom.imageInput.disabled = !canEdit || isBusy;
  }

  if (operationsDom.removePhotoButton) {
    operationsDom.removePhotoButton.disabled = !canEdit || isBusy || !draft.imageDataUrl;
  }

  if (operationsDom.saveButton) {
    operationsDom.saveButton.disabled = !canEdit || isBusy || !isDirty || !hasContent;
  }

  if (operationsDom.resetButton) {
    operationsDom.resetButton.disabled = !canEdit || isBusy || !isDirty;
  }

  if (operationsDom.newEntryButton) {
    operationsDom.newEntryButton.disabled = !canEdit || isBusy || (!draft.selectedEntryId && !hasContent);
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

function scrollOperationsRailIntoView() {
  operationsDom.entriesRail?.scrollTo({
    left: 0,
    behavior: "smooth"
  });

  operationsDom.railSection?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function getOperationsDraft(tabKey) {
  if (!operationsState.draftsByTab[tabKey]) {
    const firstEntry = operationsState.persistedSections[tabKey]?.entries?.[0] || null;
    operationsState.draftsByTab[tabKey] = firstEntry
      ? createOperationsDraftFromEntry(firstEntry)
      : createBlankOperationsDraft();
  }

  return operationsState.draftsByTab[tabKey];
}

function getPersistedEntryForDraft(tabKey) {
  const draft = getOperationsDraft(tabKey);

  if (!draft.selectedEntryId) {
    return null;
  }

  return findOperationsEntryById(
    operationsState.persistedSections[tabKey]?.entries,
    draft.selectedEntryId
  );
}

function getActiveOperationsTab() {
  return OPERATIONS_TABS.find((tab) => tab.key === operationsState.activeTab) || OPERATIONS_TABS[0];
}

function hasOperationsDraftContent(draft) {
  return Boolean(
    normalizeOperationsTitle(draft?.title)
    || normalizeOperationsBody(draft?.body)
    || normalizeOperationsDataUrl(draft?.imageDataUrl)
  );
}

function buildOperationsExcerpt(value) {
  const normalized = normalizeOperationsBody(value).replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177).trimEnd()}...`;
}

function createEmptyOperationsSections() {
  return OPERATIONS_TABS.reduce((accumulator, tab) => {
    accumulator[tab.key] = createEmptyOperationsSection();
    return accumulator;
  }, {});
}

function createEmptyOperationsSection() {
  return {
    entries: []
  };
}

function createEmptyOperationsDrafts() {
  return OPERATIONS_TABS.reduce((accumulator, tab) => {
    accumulator[tab.key] = createBlankOperationsDraft();
    return accumulator;
  }, {});
}

function createDraftsFromSections(sections) {
  return OPERATIONS_TABS.reduce((accumulator, tab) => {
    const firstEntry = sections?.[tab.key]?.entries?.[0] || null;
    accumulator[tab.key] = firstEntry
      ? createOperationsDraftFromEntry(firstEntry)
      : createBlankOperationsDraft();
    return accumulator;
  }, {});
}

function createBlankOperationsDraft() {
  return {
    selectedEntryId: "",
    title: "",
    body: "",
    imageDataUrl: "",
    imageName: "",
    createdAt: "",
    updatedAt: "",
    updatedBy: ""
  };
}

function createOperationsDraftFromEntry(entry) {
  return {
    selectedEntryId: normalizeOperationsText(entry?.id),
    title: normalizeOperationsTitle(entry?.title),
    body: normalizeOperationsBody(entry?.body),
    imageDataUrl: normalizeOperationsDataUrl(entry?.imageDataUrl),
    imageName: normalizeOperationsFilename(entry?.imageName),
    createdAt: normalizeOperationsText(entry?.createdAt),
    updatedAt: normalizeOperationsText(entry?.updatedAt),
    updatedBy: normalizeOperationsText(entry?.updatedBy)
  };
}

function cloneOperationsSections(source) {
  return OPERATIONS_TABS.reduce((accumulator, tab) => {
    accumulator[tab.key] = {
      entries: (source?.[tab.key]?.entries || [])
        .map((entry, index) => normalizeOperationsEntry(entry, `${tab.key}-${index}`))
        .filter(Boolean)
    };
    return accumulator;
  }, {});
}

function normalizeOperationsSections(source) {
  return OPERATIONS_TABS.reduce((accumulator, tab) => {
    const rawSection = source?.[tab.key];
    let entries = normalizeOperationsEntries(rawSection?.entries, tab.key);

    if (!entries.length) {
      const legacyEntry = normalizeLegacyOperationsEntry(rawSection, tab.key);

      if (legacyEntry) {
        entries = [legacyEntry];
      }
    }

    accumulator[tab.key] = {
      entries: sortOperationsEntries(entries)
    };
    return accumulator;
  }, {});
}

function normalizeOperationsEntries(entries, tabKey) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return sortOperationsEntries(
    entries
      .map((entry, index) => normalizeOperationsEntry(entry, `${tabKey}-${index}`))
      .filter(Boolean)
  );
}

function normalizeLegacyOperationsEntry(section, tabKey) {
  if (!section || typeof section !== "object") {
    return null;
  }

  return normalizeOperationsEntry({
    id: createOperationsId(`${tabKey}-legacy`),
    title: section.title,
    body: section.body,
    imageDataUrl: section.imageDataUrl,
    imageName: section.imageName,
    createdAt: section.createdAt || section.updatedAt,
    updatedAt: section.updatedAt,
    updatedBy: section.updatedBy
  }, `${tabKey}-legacy`);
}

function normalizeOperationsEntry(entry, fallbackSeed = "operations") {
  const normalized = {
    id: normalizeOperationsText(entry?.id) || createOperationsId(fallbackSeed),
    title: normalizeOperationsTitle(entry?.title),
    body: normalizeOperationsBody(entry?.body),
    imageDataUrl: normalizeOperationsDataUrl(entry?.imageDataUrl),
    imageName: normalizeOperationsFilename(entry?.imageName),
    createdAt: normalizeOperationsText(entry?.createdAt),
    updatedAt: normalizeOperationsText(entry?.updatedAt),
    updatedBy: normalizeOperationsText(entry?.updatedBy)
  };

  if (!normalized.title && !normalized.body && !normalized.imageDataUrl) {
    return null;
  }

  if (!normalized.createdAt) {
    normalized.createdAt = normalized.updatedAt;
  }

  if (!normalized.updatedAt) {
    normalized.updatedAt = normalized.createdAt;
  }

  return normalized;
}

function sortOperationsEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftTime = getOperationsSortTime(left);
    const rightTime = getOperationsSortTime(right);
    return rightTime - leftTime;
  });
}

function getOperationsSortTime(entry) {
  const value = entry?.updatedAt || entry?.createdAt || "";
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function findOperationsEntryById(entries, entryId) {
  if (!entryId || !Array.isArray(entries)) {
    return null;
  }

  return entries.find((entry) => entry.id === entryId) || null;
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
  return Boolean(
    operationsDom.workspace
    && !operationsDom.workspace.closest("[data-admin-view-panel]")?.classList.contains("hidden")
  );
}

function formatOperationsTimestamp(value, mode = "default") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat("en-IN", mode === "compact" ? {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  } : {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

async function prepareOperationsImage(file) {
  const sourceDataUrl = await readOperationsFileAsDataUrl(file);
  const image = await loadOperationsImage(sourceDataUrl);
  const dimensions = getScaledOperationsDimensions(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    OPERATIONS_IMAGE_MAX_DIMENSION
  );
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This browser could not prepare the photo. Please try another device.");
  }

  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

  const preferredTypes = file.type === "image/png"
    ? ["image/png", "image/jpeg"]
    : ["image/jpeg"];

  for (const type of preferredTypes) {
    const qualitySteps = type === "image/png"
      ? [undefined]
      : [0.82, 0.74, 0.66, 0.58];

    for (const quality of qualitySteps) {
      const dataUrl = quality === undefined
        ? canvas.toDataURL(type)
        : canvas.toDataURL(type, quality);

      if (estimateOperationsDataUrlBytes(dataUrl) <= OPERATIONS_IMAGE_MAX_BYTES) {
        return {
          dataUrl,
          fileName: normalizeOperationsFilename(file.name) || "operations-photo"
        };
      }
    }
  }

  throw new Error("This photo is still too large after compression. Please use a smaller image.");
}

function readOperationsFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ""));
    };

    reader.onerror = () => {
      reject(new Error("This photo could not be read from your device."));
    };

    reader.readAsDataURL(file);
  });
}

function loadOperationsImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This photo format is not supported on this device."));
    image.src = source;
  });
}

function getScaledOperationsDimensions(width, height, maxDimension) {
  if (!width || !height) {
    return {
      width: maxDimension,
      height: maxDimension
    };
  }

  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const scale = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function estimateOperationsDataUrlBytes(dataUrl) {
  const [, base64 = ""] = String(dataUrl).split(",");
  const padding = (base64.match(/=*$/)?.[0].length) || 0;
  return Math.ceil((base64.length * 3) / 4) - padding;
}

function createOperationsId(seed = "operations") {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${seed}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeOperationsText(value) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n") : "";
}

function normalizeOperationsTitle(value) {
  return normalizeOperationsText(value).trim();
}

function normalizeOperationsBody(value) {
  return normalizeOperationsText(value).trim();
}

function normalizeOperationsFilename(value) {
  return normalizeOperationsText(value).trim();
}

function normalizeOperationsDataUrl(value) {
  const normalized = normalizeOperationsText(value).trim();
  return normalized.startsWith("data:image/") ? normalized : "";
}

function escapeOperationsHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
