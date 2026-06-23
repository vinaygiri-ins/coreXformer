const OPERATIONS_ADMIN_ROLES = ["owner", "editor"];
const OPERATIONS_SETTING_KEY = "operations_workspace_v1";
const OPERATIONS_IMAGE_MAX_DIMENSION = 1400;
const OPERATIONS_IMAGE_MAX_BYTES = 1.35 * 1024 * 1024;
const OPERATIONS_HABIT_TAB_KEY = "change-a-habit";
const OPERATIONS_TASK_TAB_KEY = "tasks";
const OPERATIONS_TASK_REMINDER_LEAD_MS = 60 * 60 * 1000;
const OPERATIONS_DEFAULT_HABIT_METHOD_TAB = {
  key: "methods",
  label: "Methods"
};
const OPERATIONS_TASK_PRIORITIES = [
  { key: "urgent", label: "Urgent" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" }
];
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
  habitTabPanel: document.getElementById("operationsHabitTabPanel"),
  habitTabList: document.getElementById("operationsHabitTabList"),
  createHabitTabButton: document.getElementById("operationsCreateHabitTabButton"),
  deleteHabitTabButton: document.getElementById("operationsDeleteHabitTabButton"),
  taskWorkspace: document.getElementById("operationsTaskWorkspace"),
  taskForm: document.getElementById("operationsTaskForm"),
  taskTitleInput: document.getElementById("operationsTaskTitleInput"),
  taskDueInput: document.getElementById("operationsTaskDueInput"),
  taskPriorityInput: document.getElementById("operationsTaskPriorityInput"),
  taskNotesInput: document.getElementById("operationsTaskNotesInput"),
  taskNewButton: document.getElementById("operationsNewTaskButton"),
  taskSaveButton: document.getElementById("operationsSaveTaskButton"),
  taskResetButton: document.getElementById("operationsResetTaskButton"),
  taskList: document.getElementById("operationsTaskList"),
  taskCount: document.getElementById("operationsTaskCount"),
  taskReminderSummary: document.getElementById("operationsTaskReminderSummary"),
  taskEmptyState: document.getElementById("operationsTaskEmptyState"),
  enableRemindersButton: document.getElementById("operationsEnableRemindersButton"),
  form: document.getElementById("operationsEditorForm"),
  titleInput: document.getElementById("operationsTitleInput"),
  imageInput: document.getElementById("operationsImageInput"),
  removePhotoButton: document.getElementById("operationsRemovePhotoButton"),
  imagePreview: document.getElementById("operationsImagePreview"),
  bodyInput: document.getElementById("operationsBodyInput"),
  linkedTaskPanel: document.getElementById("operationsLinkedTaskPanel"),
  linkedTaskFields: document.getElementById("operationsLinkedTaskFields"),
  toggleLinkedTaskButton: document.getElementById("operationsToggleLinkedTaskButton"),
  linkedTaskTitleInput: document.getElementById("operationsLinkedTaskTitleInput"),
  linkedTaskDueInput: document.getElementById("operationsLinkedTaskDueInput"),
  linkedTaskPriorityInput: document.getElementById("operationsLinkedTaskPriorityInput"),
  linkedTaskNotesInput: document.getElementById("operationsLinkedTaskNotesInput"),
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
  activeHabitTab: OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key,
  persistedSections: createEmptyOperationsSections(),
  draftsByTab: createEmptyOperationsDrafts(),
  taskDraft: createBlankOperationsTaskDraft(),
  linkedTaskDraft: createBlankOperationsLinkedTaskDraft(),
  linkedTaskEnabled: false,
  reminderTimers: [],
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

    syncCurrentOperationsWorkspaceDraft();
    operationsState.activeTab = nextTab;
    ensureActiveOperationsHabitTab();
    clearOperationsMessage();
    renderOperationsWorkspace();
    scrollActiveOperationsTabIntoView();
  });

  operationsDom.habitTabList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-operations-habit-tab]");

    if (!button || operationsState.activeTab !== OPERATIONS_HABIT_TAB_KEY) {
      return;
    }

    const nextHabitTab = button.dataset.operationsHabitTab || "";

    if (!nextHabitTab || nextHabitTab === operationsState.activeHabitTab) {
      return;
    }

    syncCurrentOperationsWorkspaceDraft();
    operationsState.activeHabitTab = nextHabitTab;
    ensureActiveOperationsHabitTab();
    clearOperationsMessage();
    renderOperationsWorkspace();
    scrollActiveOperationsHabitTabIntoView();
  });

  operationsDom.createHabitTabButton?.addEventListener("click", () => {
    void createOperationsHabitTab();
  });

  operationsDom.deleteHabitTabButton?.addEventListener("click", () => {
    void deleteOperationsHabitTab();
  });

  operationsDom.taskTitleInput?.addEventListener("input", () => {
    syncCurrentOperationsTaskDraft();
    renderOperationsStatus();
    syncOperationsActionState();
  });

  operationsDom.taskDueInput?.addEventListener("input", () => {
    syncCurrentOperationsTaskDraft();
    renderOperationsStatus();
    syncOperationsActionState();
  });

  operationsDom.taskPriorityInput?.addEventListener("change", () => {
    syncCurrentOperationsTaskDraft();
    renderOperationsStatus();
    syncOperationsActionState();
  });

  operationsDom.taskNotesInput?.addEventListener("input", () => {
    syncCurrentOperationsTaskDraft();
    renderOperationsStatus();
    syncOperationsActionState();
  });

  operationsDom.taskForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveOperationsTask();
  });

  operationsDom.taskNewButton?.addEventListener("click", () => {
    startNewOperationsTask();
  });

  operationsDom.taskSaveButton?.addEventListener("click", () => {
    void saveOperationsTask();
  });

  operationsDom.taskResetButton?.addEventListener("click", () => {
    resetCurrentOperationsTask();
  });

  operationsDom.enableRemindersButton?.addEventListener("click", () => {
    void enableOperationsTaskReminders();
  });

  operationsDom.taskList?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-operations-task-action]");

    if (!actionButton) {
      return;
    }

    const taskId = actionButton.dataset.operationsTaskId || "";
    const action = actionButton.dataset.operationsTaskAction || "";

    void handleOperationsTaskAction(taskId, action);
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
    void saveOperationsCurrentWorkspace();
  });

  operationsDom.toggleLinkedTaskButton?.addEventListener("click", () => {
    toggleOperationsLinkedTask();
  });

  operationsDom.linkedTaskTitleInput?.addEventListener("input", () => {
    syncCurrentOperationsLinkedTaskDraft();
    syncOperationsActionState();
  });

  operationsDom.linkedTaskDueInput?.addEventListener("input", () => {
    syncCurrentOperationsLinkedTaskDraft();
  });

  operationsDom.linkedTaskPriorityInput?.addEventListener("change", () => {
    syncCurrentOperationsLinkedTaskDraft();
  });

  operationsDom.linkedTaskNotesInput?.addEventListener("input", () => {
    syncCurrentOperationsLinkedTaskDraft();
  });

  operationsDom.newEntryButton?.addEventListener("click", () => {
    startNewOperationsEntry();
  });

  operationsDom.saveButton?.addEventListener("click", () => {
    void saveOperationsCurrentWorkspace();
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
    void saveOperationsCurrentWorkspace();
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
  operationsState.activeHabitTab = OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key;
  operationsState.persistedSections = createEmptyOperationsSections();
  operationsState.draftsByTab = createEmptyOperationsDrafts();
  operationsState.taskDraft = createBlankOperationsTaskDraft();
  operationsState.linkedTaskDraft = createBlankOperationsLinkedTaskDraft();
  operationsState.linkedTaskEnabled = false;
  operationsState.dirtyTabs.clear();
  clearOperationsTaskReminderTimers();
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
    operationsState.taskDraft = createBlankOperationsTaskDraft();
    operationsState.linkedTaskDraft = createBlankOperationsLinkedTaskDraft();
    operationsState.linkedTaskEnabled = false;
    operationsState.dirtyTabs.clear();
    ensureActiveOperationsHabitTab();
    scheduleOperationsTaskReminderTimers();
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
    operationsState.taskDraft = createBlankOperationsTaskDraft();
    operationsState.linkedTaskDraft = createBlankOperationsLinkedTaskDraft();
    operationsState.linkedTaskEnabled = false;
    operationsState.dirtyTabs.clear();
    clearOperationsTaskReminderTimers();
    ensureActiveOperationsHabitTab();
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

async function createOperationsHabitTab() {
  if (
    operationsState.activeTab !== OPERATIONS_HABIT_TAB_KEY
    || !operationsState.isAdmin
    || !operationsState.supabase
    || operationsState.isSaving
  ) {
    return;
  }

  const rawLabel = window.prompt("Name this habit method tab");
  const label = normalizeOperationsTitle(rawLabel);

  if (!label) {
    return;
  }

  const existingTabs = getOperationsHabitTabs();
  const alreadyExists = existingTabs.some((tab) => {
    return tab.label.toLowerCase() === label.toLowerCase();
  });

  if (alreadyExists) {
    setOperationsMessage("A habit method tab with this name already exists.", "error");
    return;
  }

  syncCurrentOperationsDraft();
  operationsState.isSaving = true;
  syncOperationsActionState();
  setOperationsMessage("Generating this habit method tab...", "info");

  const updatedAt = new Date().toISOString();
  const nextSections = cloneOperationsSections(operationsState.persistedSections);
  const habitSection = nextSections[OPERATIONS_HABIT_TAB_KEY] || createEmptyOperationsSection();
  const customHabitTabs = normalizeOperationsHabitTabs(habitSection.habitTabs);
  const habitTab = normalizeOperationsHabitTab({
    key: createOperationsHabitTabKey(label, existingTabs),
    label,
    createdAt: updatedAt,
    updatedAt
  });

  habitSection.habitTabs = [...customHabitTabs, habitTab];
  nextSections[OPERATIONS_HABIT_TAB_KEY] = habitSection;

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
    setOperationsMessage(error.message || "This habit method tab could not be generated right now.", "error");
    renderOperationsStatus();
    syncOperationsActionState();
    return;
  }

  const normalizedSections = normalizeOperationsSections(nextSections);
  operationsState.persistedSections = cloneOperationsSections(normalizedSections);
  operationsState.activeHabitTab = habitTab.key;
  operationsState.draftsByTab[buildOperationsScopeKey(OPERATIONS_HABIT_TAB_KEY, habitTab.key)] = createBlankOperationsDraft();
  setOperationsMessage("Habit method tab generated. You can now save rails under it.", "success");
  renderOperationsWorkspace();
  scrollActiveOperationsHabitTabIntoView();
}

async function deleteOperationsHabitTab() {
  if (
    operationsState.activeTab !== OPERATIONS_HABIT_TAB_KEY
    || operationsState.activeHabitTab === OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key
    || !operationsState.isAdmin
    || !operationsState.supabase
    || operationsState.isSaving
  ) {
    return;
  }

  const activeHabitTab = getActiveOperationsHabitTab();
  const activeHabitTabKey = activeHabitTab?.key || "";

  if (!activeHabitTabKey || activeHabitTabKey === OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key) {
    return;
  }

  const scopedEntries = getOperationsEntriesForScope(OPERATIONS_HABIT_TAB_KEY, activeHabitTabKey);
  const railWarning = scopedEntries.length
    ? ` This will also delete ${scopedEntries.length} saved rail${scopedEntries.length === 1 ? "" : "s"} under this method tab.`
    : "";

  if (!window.confirm(`Delete "${activeHabitTab.label}"?${railWarning} This cannot be undone.`)) {
    return;
  }

  operationsState.isSaving = true;
  syncOperationsActionState();
  setOperationsMessage("Deleting this habit method tab...", "info");

  const nextSections = cloneOperationsSections(operationsState.persistedSections);
  const habitSection = nextSections[OPERATIONS_HABIT_TAB_KEY] || createEmptyOperationsSection();
  const nextHabitTabs = normalizeOperationsHabitTabs(habitSection.habitTabs)
    .filter((tab) => tab.key !== activeHabitTabKey);
  const nextEntries = (habitSection.entries || []).filter((entry) => {
    const entrySubTabKey = normalizeOperationsText(entry?.subTabKey).trim()
      || OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key;
    return entrySubTabKey !== activeHabitTabKey;
  });

  habitSection.habitTabs = nextHabitTabs;
  habitSection.entries = sortOperationsEntries(nextEntries);
  nextSections[OPERATIONS_HABIT_TAB_KEY] = habitSection;

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
    setOperationsMessage(error.message || "This habit method tab could not be deleted right now.", "error");
    renderOperationsStatus();
    syncOperationsActionState();
    return;
  }

  const deletedScopeKey = buildOperationsScopeKey(OPERATIONS_HABIT_TAB_KEY, activeHabitTabKey);
  const normalizedSections = normalizeOperationsSections(nextSections);

  delete operationsState.draftsByTab[deletedScopeKey];
  operationsState.dirtyTabs.delete(deletedScopeKey);
  operationsState.persistedSections = cloneOperationsSections(normalizedSections);
  operationsState.draftsByTab = createDraftsFromSections(normalizedSections);
  operationsState.activeHabitTab = OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key;
  ensureActiveOperationsHabitTab();
  setOperationsMessage("Habit method tab deleted.", "success");
  renderOperationsWorkspace();
  scrollActiveOperationsHabitTabIntoView();
}

async function saveOperationsCurrentWorkspace() {
  if (operationsState.activeTab === OPERATIONS_TASK_TAB_KEY) {
    await saveOperationsTask();
    return;
  }

  await saveOperationsWorkspace();
}

async function saveOperationsWorkspace() {
  if (!operationsState.isAdmin || !operationsState.supabase || operationsState.isSaving) {
    return;
  }

  syncCurrentOperationsDraft();
  syncCurrentOperationsLinkedTaskDraft();

  const activeKey = operationsState.activeTab;
  const activeScopeKey = getActiveOperationsScopeKey();
  const activeHabitTabKey = getActiveOperationsHabitTabKey();
  const draft = getOperationsDraft(activeScopeKey);
  const linkedTaskDraft = operationsState.linkedTaskDraft;

  if (!hasOperationsDraftContent(draft)) {
    setOperationsMessage("Add some writing or a photo before saving this rail.", "error");
    syncOperationsActionState();
    return;
  }

  if (
    operationsState.linkedTaskEnabled
    && hasOperationsLinkedTaskContent(linkedTaskDraft)
    && !normalizeOperationsTitle(linkedTaskDraft.title)
  ) {
    setOperationsMessage("Add a task title, or close the task panel before saving this rail.", "error");
    syncOperationsActionState();
    return;
  }

  if (!operationsState.dirtyTabs.has(activeScopeKey)) {
    if (!hasOperationsLinkedTaskContent(linkedTaskDraft)) {
      setOperationsMessage("There are no new changes to save in this rail.", "success");
      renderOperationsStatus();
      syncOperationsActionState();
      return;
    }

    if (!normalizeOperationsTitle(linkedTaskDraft.title)) {
      setOperationsMessage("Add a task title before creating a task from this rail.", "error");
      syncOperationsActionState();
      return;
    }

    setOperationsMessage("Saving this task from the current rail...", "info");
  } else {
    setOperationsMessage("Saving this rail...", "info");
  }

  const shouldCreateLinkedTask = hasOperationsLinkedTaskContent(linkedTaskDraft)
    && normalizeOperationsTitle(linkedTaskDraft.title);

  if (!operationsState.dirtyTabs.has(activeScopeKey) && !shouldCreateLinkedTask) {
    renderOperationsStatus();
    syncOperationsActionState();
    return;
  }

  operationsState.isSaving = true;
  syncOperationsActionState();

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
        subTabKey: activeKey === OPERATIONS_HABIT_TAB_KEY ? activeHabitTabKey : "",
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
      subTabKey: activeKey === OPERATIONS_HABIT_TAB_KEY ? activeHabitTabKey : "",
      createdAt: updatedAt,
      updatedAt,
      updatedBy
    }, `saved-${activeKey}`);

    existingEntries.unshift(savedEntry);
  }

  activeSection.entries = sortOperationsEntries(existingEntries);
  nextSections[activeKey] = activeSection;

  if (shouldCreateLinkedTask) {
    const tasksSection = nextSections[OPERATIONS_TASK_TAB_KEY] || createEmptyOperationsSection();
    const existingTasks = Array.isArray(tasksSection.tasks) ? [...tasksSection.tasks] : [];
    const sourceLabel = buildOperationsTaskSourceLabel(activeKey, activeHabitTabKey, savedEntry);
    const linkedTask = normalizeOperationsTask({
      id: createOperationsId("task"),
      title: linkedTaskDraft.title,
      notes: linkedTaskDraft.notes,
      dueAt: linkedTaskDraft.dueAt,
      priority: linkedTaskDraft.priority,
      status: "open",
      sourceTabKey: activeKey,
      sourceSubTabKey: activeKey === OPERATIONS_HABIT_TAB_KEY ? activeHabitTabKey : "",
      sourceEntryId: savedEntry.id,
      sourceTitle: sourceLabel,
      createdAt: updatedAt,
      updatedAt,
      updatedBy,
      order: createOperationsTaskOrderValue(linkedTaskDraft.dueAt, updatedAt)
    }, "linked-task");

    if (linkedTask) {
      tasksSection.tasks = sortOperationsTasks([linkedTask, ...existingTasks]);
      nextSections[OPERATIONS_TASK_TAB_KEY] = tasksSection;
    }
  }

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
    getOperationsEntriesForSectionScope(normalizedSections[activeKey], activeKey, activeHabitTabKey),
    savedEntry?.id
  );

  operationsState.persistedSections = cloneOperationsSections(normalizedSections);
  operationsState.draftsByTab[activeScopeKey] = wasEditingExisting && persistedEntry
    ? createOperationsDraftFromEntry(persistedEntry)
    : createBlankOperationsDraft();
  operationsState.linkedTaskDraft = createBlankOperationsLinkedTaskDraft();
  operationsState.linkedTaskEnabled = false;
  operationsState.dirtyTabs.delete(activeScopeKey);
  scheduleOperationsTaskReminderTimers();

  setOperationsMessage(
    shouldCreateLinkedTask
      ? "Rail saved and task added to the Tasks window."
      : wasEditingExisting
      ? "This rail was updated successfully."
      : "A new rail was saved successfully.",
    "success"
  );
  renderOperationsWorkspace();
  scrollOperationsRailIntoView();
}

async function saveOperationsTask() {
  if (!operationsState.isAdmin || !operationsState.supabase || operationsState.isSaving) {
    return;
  }

  syncCurrentOperationsTaskDraft();

  const draft = operationsState.taskDraft;
  const title = normalizeOperationsTitle(draft.title);

  if (!title) {
    setOperationsMessage("Add a task title before saving.", "error");
    syncOperationsActionState();
    return;
  }

  if (!isOperationsTaskDraftDirty()) {
    setOperationsMessage("There are no new changes to save in this task.", "success");
    renderOperationsStatus();
    syncOperationsActionState();
    return;
  }

  operationsState.isSaving = true;
  syncOperationsActionState();
  setOperationsMessage("Saving this task...", "info");

  const updatedAt = new Date().toISOString();
  const updatedBy = operationsState.profile?.full_name || operationsState.profile?.email || "Admin";
  const nextSections = cloneOperationsSections(operationsState.persistedSections);
  const taskSection = nextSections[OPERATIONS_TASK_TAB_KEY] || createEmptyOperationsSection();
  const existingTasks = Array.isArray(taskSection.tasks) ? [...taskSection.tasks] : [];
  let savedTask = null;
  let wasEditingExisting = false;

  if (draft.selectedTaskId) {
    const taskIndex = existingTasks.findIndex((task) => task.id === draft.selectedTaskId);

    if (taskIndex >= 0) {
      wasEditingExisting = true;
      const existingTask = existingTasks[taskIndex];
      const dueChanged = normalizeOperationsDateTime(draft.dueAt) !== normalizeOperationsDateTime(existingTask.dueAt);
      savedTask = normalizeOperationsTask({
        ...existingTask,
        title,
        notes: draft.notes,
        dueAt: draft.dueAt,
        priority: draft.priority,
        updatedAt,
        updatedBy,
        order: dueChanged
          ? createOperationsTaskOrderValue(draft.dueAt, existingTask.createdAt || updatedAt)
          : existingTask.order ?? createOperationsTaskOrderValue(draft.dueAt, existingTask.createdAt || updatedAt)
      }, "task-edit");

      existingTasks[taskIndex] = savedTask;
    }
  }

  if (!savedTask) {
    savedTask = normalizeOperationsTask({
      id: createOperationsId("task"),
      title,
      notes: draft.notes,
      dueAt: draft.dueAt,
      priority: draft.priority,
      status: "open",
      sourceTabKey: "",
      sourceSubTabKey: "",
      sourceEntryId: "",
      sourceTitle: "",
      createdAt: updatedAt,
      updatedAt,
      updatedBy,
      order: createOperationsTaskOrderValue(draft.dueAt, updatedAt)
    }, "task-new");

    if (savedTask) {
      existingTasks.push(savedTask);
    }
  }

  taskSection.tasks = sortOperationsTasks(existingTasks);
  nextSections[OPERATIONS_TASK_TAB_KEY] = taskSection;

  const error = await persistOperationsSections(nextSections);
  operationsState.isSaving = false;

  if (error) {
    setOperationsMessage(error.message || "This task could not be saved right now.", "error");
    renderOperationsStatus();
    syncOperationsActionState();
    return;
  }

  const normalizedSections = normalizeOperationsSections(nextSections);
  const persistedTask = findOperationsTaskById(
    getOperationsTasksFromSections(normalizedSections),
    savedTask?.id
  );

  operationsState.persistedSections = cloneOperationsSections(normalizedSections);
  operationsState.taskDraft = wasEditingExisting && persistedTask
    ? createOperationsTaskDraftFromTask(persistedTask)
    : createBlankOperationsTaskDraft();
  scheduleOperationsTaskReminderTimers();
  setOperationsMessage(wasEditingExisting ? "Task updated." : "Task added to your reminder sequence.", "success");
  renderOperationsWorkspace();
}

function startNewOperationsTask() {
  if (
    isOperationsTaskDraftDirty()
    && !window.confirm("You have unsaved task changes. Start a new task anyway?")
  ) {
    return;
  }

  operationsState.taskDraft = createBlankOperationsTaskDraft();
  clearOperationsMessage();
  renderOperationsWorkspace();
  operationsDom.taskTitleInput?.focus();
}

function resetCurrentOperationsTask() {
  const persistedTask = findOperationsTaskById(
    getOperationsTasks(),
    operationsState.taskDraft.selectedTaskId
  );

  operationsState.taskDraft = persistedTask
    ? createOperationsTaskDraftFromTask(persistedTask)
    : createBlankOperationsTaskDraft();
  clearOperationsMessage();
  renderOperationsWorkspace();
}

async function handleOperationsTaskAction(taskId, action) {
  if (!taskId || !action || operationsState.isSaving) {
    return;
  }

  if (action === "edit") {
    loadOperationsTaskIntoDraft(taskId);
    return;
  }

  if (action === "delete") {
    await deleteOperationsTask(taskId);
    return;
  }

  if (action === "complete" || action === "reopen") {
    await toggleOperationsTaskCompletion(taskId);
    return;
  }

  if (action === "up" || action === "down") {
    await moveOperationsTask(taskId, action);
  }
}

function loadOperationsTaskIntoDraft(taskId) {
  if (
    isOperationsTaskDraftDirty()
    && !window.confirm("You have unsaved task changes. Open another task anyway?")
  ) {
    return;
  }

  const task = findOperationsTaskById(getOperationsTasks(), taskId);

  if (!task) {
    setOperationsMessage("That task could not be found anymore.", "error");
    return;
  }

  operationsState.taskDraft = createOperationsTaskDraftFromTask(task);
  clearOperationsMessage();
  renderOperationsWorkspace();
  operationsDom.taskTitleInput?.focus();
}

async function deleteOperationsTask(taskId) {
  const targetTask = findOperationsTaskById(getOperationsTasks(), taskId);

  if (!targetTask) {
    setOperationsMessage("That task could not be found anymore.", "error");
    return;
  }

  if (!window.confirm(`Delete "${targetTask.title}"? This cannot be undone.`)) {
    return;
  }

  const nextTasks = getOperationsTasks().filter((task) => task.id !== taskId);
  const didSave = await saveOperationsTaskList(nextTasks, "Task deleted.");

  if (didSave && operationsState.taskDraft.selectedTaskId === taskId) {
    operationsState.taskDraft = createBlankOperationsTaskDraft();
  }

  renderOperationsWorkspace();
}

async function toggleOperationsTaskCompletion(taskId) {
  const updatedAt = new Date().toISOString();
  const updatedBy = operationsState.profile?.full_name || operationsState.profile?.email || "Admin";
  const nextTasks = getOperationsTasks().map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    const isDone = task.status === "done";

    return normalizeOperationsTask({
      ...task,
      status: isDone ? "open" : "done",
      completedAt: isDone ? "" : updatedAt,
      updatedAt,
      updatedBy
    }, "task-toggle");
  }).filter(Boolean);

  const didSave = await saveOperationsTaskList(nextTasks, "Task status updated.");

  if (didSave && operationsState.taskDraft.selectedTaskId === taskId) {
    const refreshedTask = findOperationsTaskById(nextTasks, taskId);
    operationsState.taskDraft = refreshedTask
      ? createOperationsTaskDraftFromTask(refreshedTask)
      : createBlankOperationsTaskDraft();
  }

  renderOperationsWorkspace();
}

async function moveOperationsTask(taskId, direction) {
  const sortedTasks = sortOperationsTasks(getOperationsTasks());
  const movableTasks = sortedTasks.filter((task) => task.status !== "done");
  const currentIndex = movableTasks.findIndex((task) => task.id === taskId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= movableTasks.length) {
    return;
  }

  const currentTask = movableTasks[currentIndex];
  const targetTask = movableTasks[targetIndex];
  const currentStoredOrder = Number(currentTask.order);
  const targetStoredOrder = Number(targetTask.order);
  const currentOrder = Number.isFinite(currentStoredOrder)
    ? currentStoredOrder
    : createOperationsTaskOrderValue(currentTask.dueAt, currentTask.createdAt);
  const targetOrder = Number.isFinite(targetStoredOrder)
    ? targetStoredOrder
    : createOperationsTaskOrderValue(targetTask.dueAt, targetTask.createdAt);
  const updatedAt = new Date().toISOString();
  const updatedBy = operationsState.profile?.full_name || operationsState.profile?.email || "Admin";

  const nextTasks = getOperationsTasks().map((task) => {
    if (task.id === currentTask.id) {
      return normalizeOperationsTask({
        ...task,
        order: targetOrder,
        updatedAt,
        updatedBy
      }, "task-move-current");
    }

    if (task.id === targetTask.id) {
      return normalizeOperationsTask({
        ...task,
        order: currentOrder,
        updatedAt,
        updatedBy
      }, "task-move-target");
    }

    return task;
  }).filter(Boolean);

  await saveOperationsTaskList(nextTasks, "Task priority order updated.");
  renderOperationsWorkspace();
}

async function saveOperationsTaskList(tasks, successMessage) {
  if (!operationsState.supabase || operationsState.isSaving) {
    return false;
  }

  operationsState.isSaving = true;
  syncOperationsActionState();
  setOperationsMessage("Updating tasks...", "info");

  const nextSections = cloneOperationsSections(operationsState.persistedSections);
  const taskSection = nextSections[OPERATIONS_TASK_TAB_KEY] || createEmptyOperationsSection();
  taskSection.tasks = sortOperationsTasks(tasks);
  nextSections[OPERATIONS_TASK_TAB_KEY] = taskSection;

  const error = await persistOperationsSections(nextSections);
  operationsState.isSaving = false;

  if (error) {
    setOperationsMessage(error.message || "Tasks could not be updated right now.", "error");
    syncOperationsActionState();
    return false;
  }

  const normalizedSections = normalizeOperationsSections(nextSections);
  operationsState.persistedSections = cloneOperationsSections(normalizedSections);
  scheduleOperationsTaskReminderTimers();
  setOperationsMessage(successMessage, "success");
  return true;
}

function startNewOperationsEntry() {
  const activeScopeKey = getActiveOperationsScopeKey();
  const draft = getOperationsDraft(activeScopeKey);

  if (
    operationsState.dirtyTabs.has(activeScopeKey)
    && !window.confirm("You have unsaved changes in this rail. Start a new rail anyway?")
  ) {
    return;
  }

  if (!draft.selectedEntryId && !hasOperationsDraftContent(draft)) {
    return;
  }

  operationsState.draftsByTab[activeScopeKey] = createBlankOperationsDraft();
  operationsState.dirtyTabs.delete(activeScopeKey);
  clearOperationsMessage();
  renderOperationsWorkspace();
}

function resetCurrentOperationsTab() {
  const activeKey = operationsState.activeTab;
  const activeScopeKey = getActiveOperationsScopeKey();
  const draft = getOperationsDraft(activeScopeKey);

  if (draft.selectedEntryId) {
    const persistedEntry = findOperationsEntryById(
      getOperationsEntriesForScope(activeKey, getActiveOperationsHabitTabKey()),
      draft.selectedEntryId
    );

    operationsState.draftsByTab[activeScopeKey] = persistedEntry
      ? createOperationsDraftFromEntry(persistedEntry)
      : createBlankOperationsDraft();
  } else {
    operationsState.draftsByTab[activeScopeKey] = createBlankOperationsDraft();
  }

  syncOperationsDirtyState(activeScopeKey);
  clearOperationsMessage();
  renderOperationsWorkspace();
}

function loadOperationsEntryIntoDraft(entryId) {
  const activeKey = operationsState.activeTab;
  const activeScopeKey = getActiveOperationsScopeKey();
  const draft = getOperationsDraft(activeScopeKey);
  const isSameEntry = draft.selectedEntryId === entryId;

  if (!entryId) {
    return;
  }

  if (
    operationsState.dirtyTabs.has(activeScopeKey)
    && !window.confirm(
      isSameEntry
        ? "Discard the unsaved edits in this rail and reopen the saved version?"
        : "You have unsaved changes in this rail. Open another saved rail anyway?"
    )
  ) {
    return;
  }

  const entry = findOperationsEntryById(
    getOperationsEntriesForScope(activeKey, getActiveOperationsHabitTabKey()),
    entryId
  );

  if (!entry) {
    setOperationsMessage("That saved rail could not be opened right now.", "error");
    return;
  }

  operationsState.draftsByTab[activeScopeKey] = createOperationsDraftFromEntry(entry);
  operationsState.dirtyTabs.delete(activeScopeKey);
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
  const activeScopeKey = getActiveOperationsScopeKey();
  const activeHabitTabKey = getActiveOperationsHabitTabKey();

  if (!entryId) {
    return;
  }

  const targetEntry = findOperationsEntryById(
    getOperationsEntriesForScope(activeKey, activeHabitTabKey),
    entryId
  );

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
  const nextSection = nextSections[activeKey] || createEmptyOperationsSection();
  nextSection.entries = sortOperationsEntries(nextEntries);
  nextSections[activeKey] = nextSection;

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

  const currentDraft = getOperationsDraft(activeScopeKey);

  if (currentDraft.selectedEntryId === entryId) {
    const nextSelectedEntry = getOperationsEntriesForSectionScope(
      normalizedSections[activeKey],
      activeKey,
      activeHabitTabKey
    )[0] || null;
    operationsState.draftsByTab[activeScopeKey] = nextSelectedEntry
      ? createOperationsDraftFromEntry(nextSelectedEntry)
      : createBlankOperationsDraft();
    operationsState.dirtyTabs.delete(activeScopeKey);
  } else {
    syncOperationsDirtyState(activeScopeKey);
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
    const activeScopeKey = getActiveOperationsScopeKey();
    const draft = getOperationsDraft(activeScopeKey);

    draft.imageDataUrl = image.dataUrl;
    draft.imageName = image.fileName;
    syncOperationsDirtyState(activeScopeKey);
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
  const activeScopeKey = getActiveOperationsScopeKey();
  const draft = getOperationsDraft(activeScopeKey);

  if (!draft.imageDataUrl) {
    return;
  }

  draft.imageDataUrl = "";
  draft.imageName = "";
  syncOperationsDirtyState(activeScopeKey);
  clearOperationsMessage();
  renderOperationsTabs();
  renderOperationsImagePreview();
  renderOperationsStatus();
  syncOperationsActionState();
}

function syncCurrentOperationsDraft() {
  if (operationsState.activeTab === OPERATIONS_TASK_TAB_KEY) {
    return;
  }

  const activeScopeKey = getActiveOperationsScopeKey();
  const draft = getOperationsDraft(activeScopeKey);

  draft.title = normalizeOperationsTitle(operationsDom.titleInput?.value);
  draft.body = normalizeOperationsBody(operationsDom.bodyInput?.value);
  syncOperationsDirtyState(activeScopeKey);
}

function syncCurrentOperationsWorkspaceDraft() {
  if (operationsState.activeTab === OPERATIONS_TASK_TAB_KEY) {
    syncCurrentOperationsTaskDraft();
    return;
  }

  syncCurrentOperationsDraft();
  syncCurrentOperationsLinkedTaskDraft();
}

function syncCurrentOperationsTaskDraft() {
  if (operationsState.activeTab !== OPERATIONS_TASK_TAB_KEY) {
    return;
  }

  operationsState.taskDraft.title = normalizeOperationsTitle(operationsDom.taskTitleInput?.value);
  operationsState.taskDraft.dueAt = normalizeOperationsDateTimeInput(operationsDom.taskDueInput?.value);
  operationsState.taskDraft.priority = normalizeOperationsTaskPriority(operationsDom.taskPriorityInput?.value);
  operationsState.taskDraft.notes = normalizeOperationsBody(operationsDom.taskNotesInput?.value);
}

function syncCurrentOperationsLinkedTaskDraft() {
  if (operationsState.activeTab === OPERATIONS_TASK_TAB_KEY) {
    return;
  }

  operationsState.linkedTaskDraft.title = normalizeOperationsTitle(operationsDom.linkedTaskTitleInput?.value);
  operationsState.linkedTaskDraft.dueAt = normalizeOperationsDateTimeInput(operationsDom.linkedTaskDueInput?.value);
  operationsState.linkedTaskDraft.priority = normalizeOperationsTaskPriority(operationsDom.linkedTaskPriorityInput?.value);
  operationsState.linkedTaskDraft.notes = normalizeOperationsBody(operationsDom.linkedTaskNotesInput?.value);
}

function toggleOperationsLinkedTask() {
  operationsState.linkedTaskEnabled = !operationsState.linkedTaskEnabled;

  if (!operationsState.linkedTaskEnabled) {
    operationsState.linkedTaskDraft = createBlankOperationsLinkedTaskDraft();
  }

  clearOperationsMessage();
  renderOperationsLinkedTaskPanel();
  syncOperationsActionState();

  if (operationsState.linkedTaskEnabled) {
    operationsDom.linkedTaskTitleInput?.focus();
  }
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

function isOperationsTaskDraftDirty() {
  const draft = operationsState.taskDraft;

  if (!draft.selectedTaskId) {
    return hasOperationsTaskDraftContent(draft);
  }

  const persistedTask = findOperationsTaskById(getOperationsTasks(), draft.selectedTaskId);

  if (!persistedTask) {
    return hasOperationsTaskDraftContent(draft);
  }

  return normalizeOperationsTitle(draft.title) !== normalizeOperationsTitle(persistedTask.title)
    || normalizeOperationsBody(draft.notes) !== normalizeOperationsBody(persistedTask.notes)
    || normalizeOperationsText(draft.dueAt) !== normalizeOperationsText(persistedTask.dueAt)
    || normalizeOperationsTaskPriority(draft.priority) !== normalizeOperationsTaskPriority(persistedTask.priority);
}

function renderOperationsWorkspace() {
  renderOperationsTabs();
  renderOperationsHabitTabs();
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
    const isDirty = isOperationsTopTabDirty(tab.key);

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

function renderOperationsHabitTabs() {
  const isHabitWorkspace = operationsState.activeTab === OPERATIONS_HABIT_TAB_KEY;

  operationsDom.habitTabPanel?.classList.toggle("hidden", !isHabitWorkspace);

  if (!operationsDom.habitTabList) {
    return;
  }

  if (!isHabitWorkspace) {
    operationsDom.habitTabList.innerHTML = "";
    return;
  }

  const habitTabs = getOperationsHabitTabs();
  ensureActiveOperationsHabitTab(habitTabs);

  operationsDom.habitTabList.innerHTML = habitTabs.map((tab) => {
    const isActive = tab.key === operationsState.activeHabitTab;
    const scopeKey = buildOperationsScopeKey(OPERATIONS_HABIT_TAB_KEY, tab.key);
    const isDirty = operationsState.dirtyTabs.has(scopeKey);

    return `
      <button
        type="button"
        class="workspace-tab operations-subtab${isActive ? " is-active" : ""}${isDirty ? " is-dirty" : ""}"
        data-operations-habit-tab="${escapeOperationsHtml(tab.key)}"
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
  const isTaskWorkspace = tab.key === OPERATIONS_TASK_TAB_KEY;
  const draft = getOperationsDraft(getActiveOperationsScopeKey());
  const habitTab = operationsState.activeTab === OPERATIONS_HABIT_TAB_KEY
    ? getActiveOperationsHabitTab()
    : null;

  if (operationsDom.activeTabLabel) {
    operationsDom.activeTabLabel.textContent = habitTab
      ? `${tab.label} · ${habitTab.label}`
      : tab.label;
  }

  operationsDom.taskWorkspace?.classList.toggle("hidden", !isTaskWorkspace);
  operationsDom.railSection?.classList.toggle("hidden", isTaskWorkspace);
  operationsDom.form?.classList.toggle("hidden", isTaskWorkspace);
  operationsDom.newEntryButton?.classList.toggle("hidden", isTaskWorkspace);
  operationsDom.saveButton?.classList.toggle("hidden", isTaskWorkspace);
  operationsDom.resetButton?.classList.toggle("hidden", isTaskWorkspace);

  if (isTaskWorkspace) {
    renderOperationsTaskWorkspace();
    return;
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
  renderOperationsLinkedTaskPanel();
  renderOperationsEntriesRail();
}

function renderOperationsTaskWorkspace() {
  const draft = operationsState.taskDraft;

  if (operationsDom.enableRemindersButton) {
    operationsDom.enableRemindersButton.textContent = ("Notification" in window && Notification.permission === "granted")
      ? "Reminders active"
      : "Enable reminders";
  }

  if (operationsDom.taskTitleInput) {
    operationsDom.taskTitleInput.value = draft.title || "";
  }

  if (operationsDom.taskDueInput) {
    operationsDom.taskDueInput.value = formatOperationsDateTimeInput(draft.dueAt);
  }

  if (operationsDom.taskPriorityInput) {
    operationsDom.taskPriorityInput.value = normalizeOperationsTaskPriority(draft.priority);
  }

  if (operationsDom.taskNotesInput) {
    operationsDom.taskNotesInput.value = draft.notes || "";
  }

  renderOperationsTaskList();
}

function renderOperationsLinkedTaskPanel() {
  const isTaskWorkspace = operationsState.activeTab === OPERATIONS_TASK_TAB_KEY;
  const draft = operationsState.linkedTaskDraft;

  operationsDom.linkedTaskPanel?.classList.toggle("hidden", isTaskWorkspace);
  operationsDom.linkedTaskFields?.classList.toggle("hidden", !operationsState.linkedTaskEnabled || isTaskWorkspace);

  if (operationsDom.toggleLinkedTaskButton) {
    operationsDom.toggleLinkedTaskButton.textContent = operationsState.linkedTaskEnabled
      ? "Close task"
      : "Add task";
    operationsDom.toggleLinkedTaskButton.setAttribute("aria-expanded", operationsState.linkedTaskEnabled ? "true" : "false");
  }

  if (operationsDom.linkedTaskTitleInput) {
    operationsDom.linkedTaskTitleInput.value = draft.title || "";
  }

  if (operationsDom.linkedTaskDueInput) {
    operationsDom.linkedTaskDueInput.value = formatOperationsDateTimeInput(draft.dueAt);
  }

  if (operationsDom.linkedTaskPriorityInput) {
    operationsDom.linkedTaskPriorityInput.value = normalizeOperationsTaskPriority(draft.priority);
  }

  if (operationsDom.linkedTaskNotesInput) {
    operationsDom.linkedTaskNotesInput.value = draft.notes || "";
  }
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

  const draft = getOperationsDraft(getActiveOperationsScopeKey());
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
  const activeKey = operationsState.activeTab;
  const activeHabitTabKey = getActiveOperationsHabitTabKey();
  const entries = getOperationsEntriesForScope(activeKey, activeHabitTabKey);
  const draft = getOperationsDraft(getActiveOperationsScopeKey());
  const habitTab = activeKey === OPERATIONS_HABIT_TAB_KEY
    ? getActiveOperationsHabitTab()
    : null;

  if (operationsDom.railCount) {
    const railText = `${entries.length} rail${entries.length === 1 ? "" : "s"}`;
    operationsDom.railCount.textContent = habitTab ? `${railText} · ${habitTab.label}` : railText;
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

function renderOperationsTaskList() {
  const tasks = sortOperationsTasks(getOperationsTasks());
  const openTasks = tasks.filter((task) => task.status !== "done");
  const selectedTaskId = operationsState.taskDraft.selectedTaskId;

  if (operationsDom.taskCount) {
    const openText = `${openTasks.length} open`;
    const doneText = `${tasks.length - openTasks.length} done`;
    operationsDom.taskCount.textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"} · ${openText} · ${doneText}`;
  }

  if (operationsDom.taskReminderSummary) {
    operationsDom.taskReminderSummary.textContent = buildOperationsTaskReminderSummary(tasks);
  }

  if (operationsDom.taskEmptyState) {
    operationsDom.taskEmptyState.classList.toggle("hidden", tasks.length > 0);
  }

  if (!operationsDom.taskList) {
    return;
  }

  if (!tasks.length) {
    operationsDom.taskList.innerHTML = "";
    return;
  }

  operationsDom.taskList.innerHTML = tasks.map((task) => {
    const isSelected = selectedTaskId === task.id;
    const isDone = task.status === "done";
    const dueState = getOperationsTaskDueState(task);
    const sourceLabel = buildOperationsTaskDisplaySource(task);
    const priorityLabel = getOperationsTaskPriorityLabel(task.priority);
    const taskIndex = openTasks.findIndex((openTask) => openTask.id === task.id);
    const canMoveUp = !isDone && taskIndex > 0;
    const canMoveDown = !isDone && taskIndex >= 0 && taskIndex < openTasks.length - 1;

    return `
      <article class="operations-task-card${isSelected ? " is-active" : ""}${isDone ? " is-done" : ""}">
        <div class="operations-task-card-main">
          <span class="operations-task-kicker">${escapeOperationsHtml(dueState.label)}</span>
          <h4>${escapeOperationsHtml(task.title || "Untitled task")}</h4>
          ${task.notes ? `<p>${escapeOperationsHtml(task.notes)}</p>` : ""}
          <div class="operations-task-meta">
            <span class="operations-task-priority is-${escapeOperationsHtml(task.priority)}">${escapeOperationsHtml(priorityLabel)}</span>
            ${sourceLabel ? `<span>${escapeOperationsHtml(sourceLabel)}</span>` : ""}
            ${task.updatedAt ? `<span>Updated ${escapeOperationsHtml(formatOperationsTimestamp(task.updatedAt, "compact"))}</span>` : ""}
          </div>
        </div>
        <div class="operations-task-card-actions">
          <button
            type="button"
            class="button button-ghost"
            data-operations-task-action="edit"
            data-operations-task-id="${escapeOperationsHtml(task.id)}"
          >
            Edit
          </button>
          <button
            type="button"
            class="button"
            data-operations-task-action="${isDone ? "reopen" : "complete"}"
            data-operations-task-id="${escapeOperationsHtml(task.id)}"
          >
            ${isDone ? "Reopen" : "Done"}
          </button>
          <button
            type="button"
            class="button button-muted"
            data-operations-task-action="delete"
            data-operations-task-id="${escapeOperationsHtml(task.id)}"
          >
            Delete
          </button>
          <div class="operations-task-move-actions">
            <button
              type="button"
              class="button button-ghost"
              data-operations-task-action="up"
              data-operations-task-id="${escapeOperationsHtml(task.id)}"
              ${canMoveUp ? "" : "disabled"}
            >
              Up
            </button>
            <button
              type="button"
              class="button button-ghost"
              data-operations-task-action="down"
              data-operations-task-id="${escapeOperationsHtml(task.id)}"
              ${canMoveDown ? "" : "disabled"}
            >
              Down
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderOperationsStatus() {
  if (!operationsDom.updatedBadge) {
    return;
  }

  if (operationsState.activeTab === OPERATIONS_TASK_TAB_KEY) {
    const taskDirty = isOperationsTaskDraftDirty();
    const persistedTask = findOperationsTaskById(getOperationsTasks(), operationsState.taskDraft.selectedTaskId);

    operationsDom.updatedBadge.classList.toggle("is-draft", taskDirty);

    if (taskDirty) {
      operationsDom.updatedBadge.textContent = persistedTask ? "Unsaved task edits" : "Unsaved new task";
      return;
    }

    if (persistedTask?.updatedAt) {
      operationsDom.updatedBadge.textContent = `Task saved ${formatOperationsTimestamp(persistedTask.updatedAt, "compact")}`;
      return;
    }

    operationsDom.updatedBadge.textContent = "New task";
    return;
  }

  const activeScopeKey = getActiveOperationsScopeKey();
  const draft = getOperationsDraft(activeScopeKey);
  const isDirty = operationsState.dirtyTabs.has(activeScopeKey);
  const persistedEntry = getPersistedEntryForDraft(activeScopeKey);

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
  const isTaskWorkspace = operationsState.activeTab === OPERATIONS_TASK_TAB_KEY;
  const activeScopeKey = getActiveOperationsScopeKey();
  const draft = getOperationsDraft(activeScopeKey);
  const hasContent = hasOperationsDraftContent(draft);
  const isDirty = operationsState.dirtyTabs.has(activeScopeKey);
  const isBusy = operationsState.isSaving || operationsState.isUploadingImage;
  const taskHasTitle = Boolean(normalizeOperationsTitle(operationsState.taskDraft.title));
  const taskDirty = isOperationsTaskDraftDirty();

  if (operationsDom.titleInput) {
    operationsDom.titleInput.disabled = !canEdit || isBusy || isTaskWorkspace;
  }

  if (operationsDom.bodyInput) {
    operationsDom.bodyInput.disabled = !canEdit || isBusy || isTaskWorkspace;
  }

  if (operationsDom.imageInput) {
    operationsDom.imageInput.disabled = !canEdit || isBusy || isTaskWorkspace;
  }

  if (operationsDom.removePhotoButton) {
    operationsDom.removePhotoButton.disabled = !canEdit || isBusy || isTaskWorkspace || !draft.imageDataUrl;
  }

  if (operationsDom.saveButton) {
    const linkedTaskReady = operationsState.linkedTaskEnabled
      && hasOperationsLinkedTaskContent(operationsState.linkedTaskDraft);
    operationsDom.saveButton.disabled = !canEdit || isBusy || isTaskWorkspace || ((!isDirty || !hasContent) && !linkedTaskReady);
  }

  if (operationsDom.resetButton) {
    operationsDom.resetButton.disabled = !canEdit || isBusy || isTaskWorkspace || !isDirty;
  }

  if (operationsDom.newEntryButton) {
    operationsDom.newEntryButton.disabled = !canEdit || isBusy || isTaskWorkspace || (!draft.selectedEntryId && !hasContent);
  }

  if (operationsDom.createHabitTabButton) {
    operationsDom.createHabitTabButton.disabled = !canEdit
      || isBusy
      || operationsState.activeTab !== OPERATIONS_HABIT_TAB_KEY;
  }

  if (operationsDom.deleteHabitTabButton) {
    operationsDom.deleteHabitTabButton.disabled = !canEdit
      || isBusy
      || operationsState.activeTab !== OPERATIONS_HABIT_TAB_KEY
      || operationsState.activeHabitTab === OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key;
  }

  if (operationsDom.taskTitleInput) {
    operationsDom.taskTitleInput.disabled = !canEdit || isBusy || !isTaskWorkspace;
  }

  if (operationsDom.taskDueInput) {
    operationsDom.taskDueInput.disabled = !canEdit || isBusy || !isTaskWorkspace;
  }

  if (operationsDom.taskPriorityInput) {
    operationsDom.taskPriorityInput.disabled = !canEdit || isBusy || !isTaskWorkspace;
  }

  if (operationsDom.taskNotesInput) {
    operationsDom.taskNotesInput.disabled = !canEdit || isBusy || !isTaskWorkspace;
  }

  if (operationsDom.taskSaveButton) {
    operationsDom.taskSaveButton.disabled = !canEdit || isBusy || !isTaskWorkspace || !taskHasTitle || !taskDirty;
  }

  if (operationsDom.taskResetButton) {
    operationsDom.taskResetButton.disabled = !canEdit || isBusy || !isTaskWorkspace || !taskDirty;
  }

  if (operationsDom.taskNewButton) {
    operationsDom.taskNewButton.disabled = !canEdit || isBusy || !isTaskWorkspace || (!operationsState.taskDraft.selectedTaskId && !hasOperationsTaskDraftContent(operationsState.taskDraft));
  }

  if (operationsDom.enableRemindersButton) {
    operationsDom.enableRemindersButton.disabled = !canEdit || !isTaskWorkspace || !("Notification" in window);
  }

  [
    operationsDom.toggleLinkedTaskButton,
    operationsDom.linkedTaskTitleInput,
    operationsDom.linkedTaskDueInput,
    operationsDom.linkedTaskPriorityInput,
    operationsDom.linkedTaskNotesInput
  ].forEach((element) => {
    if (element) {
      element.disabled = !canEdit || isBusy || isTaskWorkspace;
    }
  });
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

function scrollActiveOperationsHabitTabIntoView() {
  operationsDom.habitTabList
    ?.querySelector("[data-operations-habit-tab].is-active")
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

function getOperationsDraft(scopeKey) {
  if (!operationsState.draftsByTab[scopeKey]) {
    const { tabKey, subTabKey } = parseOperationsScopeKey(scopeKey);
    const firstEntry = getOperationsEntriesForScope(tabKey, subTabKey)[0] || null;
    operationsState.draftsByTab[scopeKey] = firstEntry
      ? createOperationsDraftFromEntry(firstEntry)
      : createBlankOperationsDraft();
  }

  return operationsState.draftsByTab[scopeKey];
}

function getPersistedEntryForDraft(scopeKey) {
  const draft = getOperationsDraft(scopeKey);
  const { tabKey, subTabKey } = parseOperationsScopeKey(scopeKey);

  if (!draft.selectedEntryId) {
    return null;
  }

  return findOperationsEntryById(
    getOperationsEntriesForScope(tabKey, subTabKey),
    draft.selectedEntryId
  );
}

function getActiveOperationsTab() {
  return OPERATIONS_TABS.find((tab) => tab.key === operationsState.activeTab) || OPERATIONS_TABS[0];
}

function getActiveOperationsScopeKey() {
  return buildOperationsScopeKey(operationsState.activeTab, getActiveOperationsHabitTabKey());
}

function getActiveOperationsHabitTabKey() {
  if (operationsState.activeTab !== OPERATIONS_HABIT_TAB_KEY) {
    return "";
  }

  ensureActiveOperationsHabitTab();
  return operationsState.activeHabitTab;
}

function getActiveOperationsHabitTab() {
  const habitTabs = getOperationsHabitTabs();
  ensureActiveOperationsHabitTab(habitTabs);
  return habitTabs.find((tab) => tab.key === operationsState.activeHabitTab) || habitTabs[0];
}

function ensureActiveOperationsHabitTab(habitTabs = getOperationsHabitTabs()) {
  if (!habitTabs.some((tab) => tab.key === operationsState.activeHabitTab)) {
    operationsState.activeHabitTab = habitTabs[0]?.key || OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key;
  }
}

function isOperationsTopTabDirty(tabKey) {
  if (tabKey === OPERATIONS_TASK_TAB_KEY) {
    return operationsState.activeTab === OPERATIONS_TASK_TAB_KEY && isOperationsTaskDraftDirty();
  }

  if (tabKey !== OPERATIONS_HABIT_TAB_KEY) {
    return operationsState.dirtyTabs.has(tabKey);
  }

  return [...operationsState.dirtyTabs].some((scopeKey) => {
    return scopeKey === tabKey || scopeKey.startsWith(`${tabKey}::`);
  });
}

function buildOperationsScopeKey(tabKey, subTabKey = "") {
  if (tabKey !== OPERATIONS_HABIT_TAB_KEY) {
    return tabKey;
  }

  return `${tabKey}::${subTabKey || OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key}`;
}

function parseOperationsScopeKey(scopeKey) {
  const [tabKey, subTabKey = ""] = String(scopeKey || "").split("::");

  return {
    tabKey: tabKey || OPERATIONS_TABS[0].key,
    subTabKey
  };
}

function getOperationsEntriesForScope(tabKey, subTabKey = "") {
  return getOperationsEntriesForSectionScope(
    operationsState.persistedSections[tabKey],
    tabKey,
    subTabKey
  );
}

function getOperationsEntriesForSectionScope(section, tabKey, subTabKey = "") {
  const entries = Array.isArray(section?.entries) ? section.entries : [];

  if (tabKey !== OPERATIONS_HABIT_TAB_KEY) {
    return entries;
  }

  const activeSubTabKey = subTabKey || OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key;

  return entries.filter((entry) => {
    const entrySubTabKey = normalizeOperationsText(entry?.subTabKey).trim()
      || OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key;
    return entrySubTabKey === activeSubTabKey;
  });
}

function getOperationsHabitTabs(section = operationsState.persistedSections[OPERATIONS_HABIT_TAB_KEY]) {
  return [
    OPERATIONS_DEFAULT_HABIT_METHOD_TAB,
    ...normalizeOperationsHabitTabs(section?.habitTabs)
  ];
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
    entries: [],
    habitTabs: [],
    tasks: []
  };
}

function createEmptyOperationsDrafts() {
  return createDraftsFromSections(createEmptyOperationsSections());
}

function createDraftsFromSections(sections) {
  const drafts = OPERATIONS_TABS.reduce((accumulator, tab) => {
    if (tab.key === OPERATIONS_HABIT_TAB_KEY) {
      return accumulator;
    }

    const firstEntry = getOperationsEntriesForSectionScope(sections?.[tab.key], tab.key)[0] || null;
    accumulator[tab.key] = firstEntry
      ? createOperationsDraftFromEntry(firstEntry)
      : createBlankOperationsDraft();
    return accumulator;
  }, {});

  getOperationsHabitTabs(sections?.[OPERATIONS_HABIT_TAB_KEY]).forEach((tab) => {
    const scopeKey = buildOperationsScopeKey(OPERATIONS_HABIT_TAB_KEY, tab.key);
    const firstEntry = getOperationsEntriesForSectionScope(
      sections?.[OPERATIONS_HABIT_TAB_KEY],
      OPERATIONS_HABIT_TAB_KEY,
      tab.key
    )[0] || null;
    drafts[scopeKey] = firstEntry
      ? createOperationsDraftFromEntry(firstEntry)
      : createBlankOperationsDraft();
  });

  return drafts;
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
        .filter(Boolean),
      habitTabs: tab.key === OPERATIONS_HABIT_TAB_KEY
        ? normalizeOperationsHabitTabs(source?.[tab.key]?.habitTabs)
        : [],
      tasks: tab.key === OPERATIONS_TASK_TAB_KEY
        ? normalizeOperationsTasks(source?.[tab.key]?.tasks)
        : []
    };
    return accumulator;
  }, {});
}

function normalizeOperationsSections(source) {
  return OPERATIONS_TABS.reduce((accumulator, tab) => {
    const rawSection = source?.[tab.key];
    let entries = normalizeOperationsEntries(rawSection?.entries, tab.key);
    const habitTabs = tab.key === OPERATIONS_HABIT_TAB_KEY
      ? normalizeOperationsHabitTabs(rawSection?.habitTabs)
      : [];
    const tasks = tab.key === OPERATIONS_TASK_TAB_KEY
      ? normalizeOperationsTasks(rawSection?.tasks)
      : [];

    if (!entries.length) {
      const legacyEntry = normalizeLegacyOperationsEntry(rawSection, tab.key);

      if (legacyEntry) {
        entries = [legacyEntry];
      }
    }

    accumulator[tab.key] = {
      entries: sortOperationsEntries(entries),
      habitTabs,
      tasks
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
    subTabKey: tabKey === OPERATIONS_HABIT_TAB_KEY ? OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key : "",
    createdAt: section.createdAt || section.updatedAt,
    updatedAt: section.updatedAt,
    updatedBy: section.updatedBy
  }, `${tabKey}-legacy`);
}

function normalizeOperationsTasks(tasks) {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return sortOperationsTasks(
    tasks
      .map((task, index) => normalizeOperationsTask(task, `task-${index}`))
      .filter(Boolean)
  );
}

function normalizeOperationsTask(task, fallbackSeed = "task") {
  const title = normalizeOperationsTitle(task?.title);

  if (!title) {
    return null;
  }

  const createdAt = normalizeOperationsText(task?.createdAt) || new Date().toISOString();
  const dueAt = normalizeOperationsDateTime(task?.dueAt);
  const orderValue = Number(task?.order);

  return {
    id: normalizeOperationsText(task?.id) || createOperationsId(fallbackSeed),
    title,
    notes: normalizeOperationsBody(task?.notes),
    dueAt,
    priority: normalizeOperationsTaskPriority(task?.priority),
    status: normalizeOperationsText(task?.status) === "done" ? "done" : "open",
    sourceTabKey: normalizeOperationsText(task?.sourceTabKey),
    sourceSubTabKey: normalizeOperationsText(task?.sourceSubTabKey),
    sourceEntryId: normalizeOperationsText(task?.sourceEntryId),
    sourceTitle: normalizeOperationsTitle(task?.sourceTitle),
    createdAt,
    updatedAt: normalizeOperationsText(task?.updatedAt) || createdAt,
    completedAt: normalizeOperationsText(task?.completedAt),
    updatedBy: normalizeOperationsText(task?.updatedBy),
    order: Number.isFinite(orderValue)
      ? orderValue
      : createOperationsTaskOrderValue(dueAt, createdAt)
  };
}

function normalizeOperationsHabitTabs(tabs) {
  if (!Array.isArray(tabs)) {
    return [];
  }

  const seen = new Set([OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key]);

  return tabs
    .map((tab, index) => normalizeOperationsHabitTab(tab, `habit-method-${index}`))
    .filter(Boolean)
    .filter((tab) => {
      if (seen.has(tab.key)) {
        return false;
      }

      seen.add(tab.key);
      return true;
    });
}

function normalizeOperationsHabitTab(tab, fallbackSeed = "habit-method") {
  const label = normalizeOperationsTitle(tab?.label);

  if (!label) {
    return null;
  }

  return {
    key: normalizeOperationsText(tab?.key).trim() || createOperationsHabitTabKey(label, [], fallbackSeed),
    label,
    createdAt: normalizeOperationsText(tab?.createdAt),
    updatedAt: normalizeOperationsText(tab?.updatedAt)
  };
}

function createOperationsHabitTabKey(label, existingTabs = [], fallbackSeed = "habit-method") {
  const usedKeys = new Set(
    existingTabs.map((tab) => normalizeOperationsText(tab?.key).trim()).filter(Boolean)
  );
  let baseKey = normalizeOperationsTitle(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!baseKey) {
    baseKey = fallbackSeed;
  }

  let nextKey = baseKey;
  let suffix = 2;

  while (usedKeys.has(nextKey) || nextKey === OPERATIONS_DEFAULT_HABIT_METHOD_TAB.key) {
    nextKey = `${baseKey}-${suffix}`;
    suffix += 1;
  }

  return nextKey;
}

function normalizeOperationsEntry(entry, fallbackSeed = "operations") {
  const normalized = {
    id: normalizeOperationsText(entry?.id) || createOperationsId(fallbackSeed),
    title: normalizeOperationsTitle(entry?.title),
    body: normalizeOperationsBody(entry?.body),
    imageDataUrl: normalizeOperationsDataUrl(entry?.imageDataUrl),
    imageName: normalizeOperationsFilename(entry?.imageName),
    subTabKey: normalizeOperationsText(entry?.subTabKey).trim(),
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

function sortOperationsTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const leftDone = left?.status === "done";
    const rightDone = right?.status === "done";

    if (leftDone !== rightDone) {
      return leftDone ? 1 : -1;
    }

    const leftStoredOrder = Number(left?.order);
    const rightStoredOrder = Number(right?.order);
    const leftOrder = Number.isFinite(leftStoredOrder)
      ? leftStoredOrder
      : createOperationsTaskOrderValue(left?.dueAt, left?.createdAt);
    const rightOrder = Number.isFinite(rightStoredOrder)
      ? rightStoredOrder
      : createOperationsTaskOrderValue(right?.dueAt, right?.createdAt);

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const priorityDifference = getOperationsTaskPriorityRank(left?.priority)
      - getOperationsTaskPriorityRank(right?.priority);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return getOperationsSortTime(right) - getOperationsSortTime(left);
  });
}

function getOperationsTasks() {
  return getOperationsTasksFromSections(operationsState.persistedSections);
}

function getOperationsTasksFromSections(sections) {
  return sortOperationsTasks(sections?.[OPERATIONS_TASK_TAB_KEY]?.tasks || []);
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

function findOperationsTaskById(tasks, taskId) {
  if (!taskId || !Array.isArray(tasks)) {
    return null;
  }

  return tasks.find((task) => task.id === taskId) || null;
}

async function persistOperationsSections(sections) {
  if (!operationsState.supabase) {
    return new Error("Operations storage is not connected.");
  }

  const payload = {
    key: OPERATIONS_SETTING_KEY,
    value: {
      sections
    },
    is_public: false,
    updated_by: operationsState.profile?.id || null
  };

  const { error } = await operationsState.supabase
    .from("site_settings")
    .upsert(payload, { onConflict: "key" });

  return error || null;
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

function createBlankOperationsTaskDraft() {
  return {
    selectedTaskId: "",
    title: "",
    notes: "",
    dueAt: "",
    priority: "medium"
  };
}

function createBlankOperationsLinkedTaskDraft() {
  return {
    title: "",
    notes: "",
    dueAt: "",
    priority: "medium"
  };
}

function createOperationsTaskDraftFromTask(task) {
  return {
    selectedTaskId: normalizeOperationsText(task?.id),
    title: normalizeOperationsTitle(task?.title),
    notes: normalizeOperationsBody(task?.notes),
    dueAt: normalizeOperationsDateTime(task?.dueAt),
    priority: normalizeOperationsTaskPriority(task?.priority)
  };
}

function hasOperationsTaskDraftContent(draft) {
  return Boolean(
    normalizeOperationsTitle(draft?.title)
    || normalizeOperationsBody(draft?.notes)
    || normalizeOperationsText(draft?.dueAt)
  );
}

function hasOperationsLinkedTaskContent(draft) {
  return Boolean(
    normalizeOperationsTitle(draft?.title)
    || normalizeOperationsBody(draft?.notes)
    || normalizeOperationsText(draft?.dueAt)
  );
}

function createOperationsTaskOrderValue(dueAt, fallbackAt = "") {
  const dueTime = Date.parse(dueAt || "");

  if (!Number.isNaN(dueTime)) {
    return dueTime;
  }

  const fallbackTime = Date.parse(fallbackAt || "");
  const stableOffset = Number.isNaN(fallbackTime) ? Date.now() : fallbackTime;
  return 4102444800000 + (stableOffset % 1000000);
}

function normalizeOperationsTaskPriority(priority) {
  const normalized = normalizeOperationsText(priority).trim().toLowerCase();
  return OPERATIONS_TASK_PRIORITIES.some((item) => item.key === normalized)
    ? normalized
    : "medium";
}

function getOperationsTaskPriorityLabel(priority) {
  const normalized = normalizeOperationsTaskPriority(priority);
  return OPERATIONS_TASK_PRIORITIES.find((item) => item.key === normalized)?.label || "Medium";
}

function getOperationsTaskPriorityRank(priority) {
  const normalized = normalizeOperationsTaskPriority(priority);
  const index = OPERATIONS_TASK_PRIORITIES.findIndex((item) => item.key === normalized);
  return index >= 0 ? index : 2;
}

function buildOperationsTaskSourceLabel(tabKey, subTabKey, entry) {
  const tab = OPERATIONS_TABS.find((item) => item.key === tabKey);
  const tabLabel = tab?.label || "Operations";
  const subTabLabel = tabKey === OPERATIONS_HABIT_TAB_KEY
    ? getOperationsHabitTabs().find((item) => item.key === subTabKey)?.label
    : "";
  const entryTitle = normalizeOperationsTitle(entry?.title);

  return [
    tabLabel,
    subTabLabel,
    entryTitle
  ].filter(Boolean).join(" · ");
}

function buildOperationsTaskDisplaySource(task) {
  if (task?.sourceTitle) {
    return `From ${task.sourceTitle}`;
  }

  const tab = OPERATIONS_TABS.find((item) => item.key === task?.sourceTabKey);
  return tab ? `From ${tab.label}` : "";
}

function getOperationsTaskDueState(task) {
  if (task?.status === "done") {
    return { key: "done", label: "Completed" };
  }

  if (!task?.dueAt) {
    return { key: "unscheduled", label: "No reminder set" };
  }

  const dueTime = Date.parse(task.dueAt);

  if (Number.isNaN(dueTime)) {
    return { key: "unscheduled", label: "No reminder set" };
  }

  const now = Date.now();
  const today = new Date();
  const dueDate = new Date(dueTime);
  const sameDate = today.getFullYear() === dueDate.getFullYear()
    && today.getMonth() === dueDate.getMonth()
    && today.getDate() === dueDate.getDate();

  if (dueTime < now) {
    return { key: "overdue", label: `Overdue · ${formatOperationsTaskDue(task.dueAt)}` };
  }

  if (sameDate) {
    return { key: "today", label: `Today · ${formatOperationsTaskDue(task.dueAt, "time")}` };
  }

  if (dueTime - now <= OPERATIONS_TASK_REMINDER_LEAD_MS) {
    return { key: "soon", label: `Coming up · ${formatOperationsTaskDue(task.dueAt)}` };
  }

  return { key: "upcoming", label: formatOperationsTaskDue(task.dueAt) };
}

function buildOperationsTaskReminderSummary(tasks) {
  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdueCount = openTasks.filter((task) => getOperationsTaskDueState(task).key === "overdue").length;
  const todayCount = openTasks.filter((task) => getOperationsTaskDueState(task).key === "today").length;
  const nextTask = openTasks.find((task) => task.dueAt);

  if (overdueCount) {
    return `${overdueCount} overdue`;
  }

  if (todayCount) {
    return `${todayCount} due today`;
  }

  if (nextTask?.dueAt) {
    return `Next ${formatOperationsTaskDue(nextTask.dueAt)}`;
  }

  return "No reminders due";
}

function formatOperationsTaskDue(value, mode = "date-time") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No reminder";
  }

  if (mode === "time") {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

async function enableOperationsTaskReminders() {
  if (!("Notification" in window)) {
    setOperationsMessage("Browser reminders are not supported on this device. The task dates are still saved.", "error");
    return;
  }

  let permission = Notification.permission;

  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    setOperationsMessage("Browser reminders are blocked. You can still use the due dates inside the Tasks tab.", "error");
    return;
  }

  scheduleOperationsTaskReminderTimers();
  setOperationsMessage("Browser reminders are active while this admin page stays open.", "success");
}

function scheduleOperationsTaskReminderTimers() {
  clearOperationsTaskReminderTimers();

  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const now = Date.now();

  getOperationsTasks()
    .filter((task) => task.status !== "done" && task.dueAt)
    .forEach((task) => {
      const dueTime = Date.parse(task.dueAt);

      if (Number.isNaN(dueTime) || dueTime <= now) {
        return;
      }

      const delay = Math.min(dueTime - now, 2147483647);
      const timer = window.setTimeout(() => {
        new Notification("CoreXformer task reminder", {
          body: task.title,
          tag: `corexformer-task-${task.id}`
        });
      }, delay);

      operationsState.reminderTimers.push(timer);
    });
}

function clearOperationsTaskReminderTimers() {
  operationsState.reminderTimers.forEach((timer) => window.clearTimeout(timer));
  operationsState.reminderTimers = [];
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

function normalizeOperationsDateTime(value) {
  const normalized = normalizeOperationsText(value).trim();

  if (!normalized) {
    return "";
  }

  const timestamp = Date.parse(normalized);

  if (Number.isNaN(timestamp)) {
    return "";
  }

  return new Date(timestamp).toISOString();
}

function normalizeOperationsDateTimeInput(value) {
  const normalized = normalizeOperationsText(value).trim();

  if (!normalized) {
    return "";
  }

  const timestamp = Date.parse(normalized);

  if (Number.isNaN(timestamp)) {
    return "";
  }

  return new Date(timestamp).toISOString();
}

function formatOperationsDateTimeInput(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return localDate.toISOString().slice(0, 16);
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
