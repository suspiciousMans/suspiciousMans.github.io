(() => {
  "use strict";

  const STORAGE_KEY = "taskmanager.tasks.v1";
  const SYNC_CODE_KEY = "taskmanager.syncCode.v1";

  // Public-safe: identifies the Firebase project only. Access is enforced
  // by the Realtime Database security rules (see README), not by keeping
  // this config secret. Same project the site's chat page uses, under a
  // separate "taskSync" path.
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB5T6k3KWKFldgob5vRwzX2a2rTht_4Obw",
    authDomain: "chat-d4d38.firebaseapp.com",
    databaseURL: "https://chat-d4d38-default-rtdb.firebaseio.com",
    projectId: "chat-d4d38",
    storageBucket: "chat-d4d38.firebasestorage.app",
    messagingSenderId: "184896105986",
    appId: "1:184896105986:web:61d27c21a0c2f32a5f011b",
    measurementId: "G-3QS7ZZQ4DP",
  };

  /** @typedef {{id:string,title:string,notes:string,tags:string[],priority:'low'|'medium'|'high',dueDate:string,dueTime:string,repeat:string,completed:boolean,createdAt:string}} Task */

  const els = {
    stats: document.getElementById("stats"),
    viewBtns: Array.from(document.querySelectorAll(".view-btn")),
    listView: document.getElementById("list-view"),
    calendarView: document.getElementById("calendar-view"),
    form: document.getElementById("task-form"),
    formHeading: document.getElementById("form-heading"),
    formSubmit: document.getElementById("form-submit"),
    formCancel: document.getElementById("form-cancel"),
    taskId: document.getElementById("task-id"),
    fTitle: document.getElementById("f-title"),
    fNotes: document.getElementById("f-notes"),
    fDate: document.getElementById("f-date"),
    fTime: document.getElementById("f-time"),
    fPriority: document.getElementById("f-priority"),
    fRepeat: document.getElementById("f-repeat"),
    tagChips: document.getElementById("tag-chips"),
    fTagInput: document.getElementById("f-tag-input"),
    tagList: document.getElementById("tag-list"),
    fSearch: document.getElementById("f-search"),
    fStatus: document.getElementById("f-status"),
    fTagFilter: document.getElementById("f-tag-filter"),
    tagManager: document.getElementById("tag-manager"),
    exportBtn: document.getElementById("export-btn"),
    importBtn: document.getElementById("import-btn"),
    importFile: document.getElementById("import-file"),
    syncDisconnected: document.getElementById("sync-disconnected"),
    syncConnected: document.getElementById("sync-connected"),
    syncCodeInput: document.getElementById("sync-code-input"),
    syncCodeShown: document.getElementById("sync-code-shown"),
    syncGenerateBtn: document.getElementById("sync-generate-btn"),
    syncConnectBtn: document.getElementById("sync-connect-btn"),
    syncDisconnectBtn: document.getElementById("sync-disconnect-btn"),
    syncCopyBtn: document.getElementById("sync-copy-btn"),
    syncStatus: document.getElementById("sync-status"),
  };

  let tasks = loadTasks();
  let view = "list";
  let calDate = new Date();
  let selectedDay = null;
  let formTags = [];

  const sync = {
    clientId: uid(),
    code: "",
    db: null,
    ref: null,
    unsubscribe: null,
    applyingRemote: false,
    pushTimer: null,
  };

  // ---------- storage ----------

  function normalizeTask(raw) {
    let tags = Array.isArray(raw.tags) ? raw.tags.slice() : [];
    if (!tags.length && raw.category) tags = [raw.category];
    tags = dedupeTags(tags.map((t) => String(t).trim()).filter(Boolean));
    return {
      id: raw.id || uid(),
      title: String(raw.title || "").trim(),
      notes: raw.notes || "",
      tags,
      priority: ["low", "medium", "high"].includes(raw.priority) ? raw.priority : "medium",
      dueDate: raw.dueDate || "",
      dueTime: raw.dueTime || "",
      repeat: raw.repeat || "none",
      completed: !!raw.completed,
      createdAt: raw.createdAt || new Date().toISOString(),
    };
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((t) => t && t.title).map(normalizeTask);
    } catch (e) {
      console.error("Failed to load tasks", e);
      return [];
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    if (sync.ref && !sync.applyingRemote) scheduleSyncPush();
  }

  // ---------- helpers ----------

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayStr() {
    return toDateStr(new Date());
  }

  function toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseDateStr(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  const REPEAT_LABELS = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

  function nextOccurrence(dateStr, repeat) {
    const d = parseDateStr(dateStr);
    if (repeat === "daily") d.setDate(d.getDate() + 1);
    else if (repeat === "weekly") d.setDate(d.getDate() + 7);
    else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
    else if (repeat === "yearly") d.setFullYear(d.getFullYear() + 1);
    else return dateStr;
    return toDateStr(d);
  }

  function isOverdue(task) {
    if (!task.dueDate || task.completed) return false;
    return task.dueDate < todayStr();
  }

  function isToday(dateStr) {
    return dateStr === todayStr();
  }

  function formatDateHuman(dateStr) {
    if (!dateStr) return "";
    const d = parseDateStr(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function dedupeTags(tagArr) {
    const seen = new Map();
    for (const t of tagArr) {
      const key = t.toLowerCase();
      if (!seen.has(key)) seen.set(key, t);
    }
    return Array.from(seen.values());
  }

  function allTags() {
    const seen = new Map();
    for (const t of tasks) {
      for (const tag of t.tags || []) {
        const key = tag.toLowerCase();
        if (!seen.has(key)) seen.set(key, tag);
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }

  // ---------- tag input (form) ----------

  function renderTagChips() {
    els.tagChips.innerHTML = formTags
      .map(
        (tag, i) => `
          <span class="tag-chip">
            ${escapeHtml(tag)}
            <button type="button" class="tag-chip-remove" data-remove-tag="${i}" aria-label="Remove tag ${escapeHtml(tag)}">&times;</button>
          </span>
        `
      )
      .join("");
  }

  function addFormTag(raw) {
    const tag = raw.trim().replace(/,$/, "").trim();
    if (!tag) return;
    if (formTags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    formTags.push(tag);
    renderTagChips();
  }

  function commitPendingTag() {
    if (els.fTagInput.value.trim()) {
      addFormTag(els.fTagInput.value);
      els.fTagInput.value = "";
    }
  }

  els.fTagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addFormTag(els.fTagInput.value);
      els.fTagInput.value = "";
    } else if (e.key === "Backspace" && !els.fTagInput.value && formTags.length) {
      formTags.pop();
      renderTagChips();
    }
  });

  els.fTagInput.addEventListener("blur", commitPendingTag);

  els.tagChips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-tag]");
    if (!btn) return;
    formTags.splice(Number(btn.dataset.removeTag), 1);
    renderTagChips();
  });

  // ---------- quick due-date buttons ----------

  document.querySelectorAll("[data-quick-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.quickDate;
      if (kind === "clear") {
        els.fDate.value = "";
        return;
      }
      const d = new Date();
      if (kind === "tomorrow") d.setDate(d.getDate() + 1);
      if (kind === "week") d.setDate(d.getDate() + 7);
      els.fDate.value = toDateStr(d);
    });
  });

  // ---------- form ----------

  function resetForm() {
    els.form.reset();
    els.taskId.value = "";
    els.fPriority.value = "medium";
    els.fRepeat.value = "none";
    formTags = [];
    renderTagChips();
    els.formHeading.textContent = "Add task";
    els.formSubmit.textContent = "Add task";
    els.formCancel.hidden = true;
  }

  function fillFormForEdit(task) {
    els.taskId.value = task.id;
    els.fTitle.value = task.title;
    els.fNotes.value = task.notes || "";
    els.fDate.value = task.dueDate || "";
    els.fTime.value = task.dueTime || "";
    els.fPriority.value = task.priority || "medium";
    els.fRepeat.value = task.repeat || "none";
    formTags = (task.tags || []).slice();
    renderTagChips();
    els.formHeading.textContent = "Edit task";
    els.formSubmit.textContent = "Save changes";
    els.formCancel.hidden = false;
    els.fTitle.focus();
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = els.fTitle.value.trim();
    if (!title) return;
    commitPendingTag();
    const tags = dedupeTags(formTags);

    const id = els.taskId.value;
    if (id) {
      const task = tasks.find((t) => t.id === id);
      if (task) {
        task.title = title;
        task.notes = els.fNotes.value.trim();
        task.dueDate = els.fDate.value;
        task.dueTime = els.fTime.value;
        task.priority = els.fPriority.value;
        task.repeat = els.fRepeat.value;
        task.tags = tags;
      }
    } else {
      tasks.push({
        id: uid(),
        title,
        notes: els.fNotes.value.trim(),
        dueDate: els.fDate.value,
        dueTime: els.fTime.value,
        priority: els.fPriority.value,
        repeat: els.fRepeat.value,
        tags,
        completed: false,
        createdAt: new Date().toISOString(),
      });
    }

    saveTasks();
    resetForm();
    renderAll();
  });

  els.formCancel.addEventListener("click", resetForm);

  // ---------- filters ----------

  [els.fSearch, els.fStatus, els.fTagFilter].forEach((el) => {
    el.addEventListener("input", renderAll);
    el.addEventListener("change", renderAll);
  });

  function filteredTasks() {
    const q = els.fSearch.value.trim().toLowerCase();
    const status = els.fStatus.value;
    const tag = els.fTagFilter.value;

    return tasks.filter((t) => {
      if (status === "active" && t.completed) return false;
      if (status === "completed" && !t.completed) return false;
      if (tag && !(t.tags || []).some((x) => x.toLowerCase() === tag.toLowerCase())) return false;
      if (q) {
        const hay = `${t.title} ${t.notes} ${(t.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  // ---------- task actions (event delegation) ----------

  function taskById(id) {
    return tasks.find((t) => t.id === id);
  }

  function handleTaskAction(e) {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const id = actionEl.closest("[data-task-id]")?.dataset.taskId;
    const action = actionEl.dataset.action;

    if (action === "toggle") {
      const task = taskById(id);
      if (task) {
        const checked = actionEl.checked;
        if (checked && task.repeat && task.repeat !== "none" && task.dueDate) {
          task.dueDate = nextOccurrence(task.dueDate, task.repeat);
          task.completed = false;
        } else {
          task.completed = checked;
        }
        saveTasks();
        renderAll();
      }
    } else if (action === "edit") {
      const task = taskById(id);
      if (task) {
        fillFormForEdit(task);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else if (action === "delete") {
      const task = taskById(id);
      if (task && confirm(`Delete "${task.title}"?`)) {
        tasks = tasks.filter((t) => t.id !== id);
        saveTasks();
        renderAll();
      }
    }
  }

  els.listView.addEventListener("click", handleTaskAction);
  els.listView.addEventListener("change", handleTaskAction);
  els.calendarView.addEventListener("click", handleTaskAction);
  els.calendarView.addEventListener("change", handleTaskAction);

  // ---------- tag management ----------

  function renameTagGlobally(oldTag, newTagRaw) {
    const newTag = newTagRaw.trim();
    if (!newTag || newTag.toLowerCase() === oldTag.toLowerCase()) return;
    for (const t of tasks) {
      if (!t.tags) continue;
      const idx = t.tags.findIndex((x) => x.toLowerCase() === oldTag.toLowerCase());
      if (idx !== -1) {
        t.tags[idx] = newTag;
        t.tags = dedupeTags(t.tags);
      }
    }
    saveTasks();
    renderAll();
  }

  function deleteTagGlobally(tag) {
    for (const t of tasks) {
      if (!t.tags) continue;
      t.tags = t.tags.filter((x) => x.toLowerCase() !== tag.toLowerCase());
    }
    saveTasks();
    renderAll();
  }

  els.tagManager.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const tag = btn.closest("[data-tag]")?.dataset.tag;
    if (!tag) return;
    if (btn.dataset.action === "rename-tag") {
      const next = prompt(`Rename tag "${tag}" to:`, tag);
      if (next !== null) renameTagGlobally(tag, next);
    } else if (btn.dataset.action === "delete-tag") {
      const count = tasks.filter((t) => (t.tags || []).some((x) => x.toLowerCase() === tag.toLowerCase())).length;
      if (confirm(`Delete tag "${tag}" from ${count} task(s)? This can't be undone.`)) {
        deleteTagGlobally(tag);
      }
    }
  });

  function renderTagManager() {
    const tags = allTags();
    if (!tags.length) {
      els.tagManager.innerHTML = `<div class="empty-state small">No tags yet.</div>`;
      return;
    }
    els.tagManager.innerHTML = tags
      .map((tag) => {
        const count = tasks.filter((t) => (t.tags || []).some((x) => x.toLowerCase() === tag.toLowerCase())).length;
        return `
          <div class="tag-manage-item" data-tag="${escapeHtml(tag)}">
            <span class="tag-manage-name">${escapeHtml(tag)}</span>
            <span class="tag-manage-count">${count}</span>
            <button type="button" class="btn-icon" data-action="rename-tag" title="Rename">&#9998;</button>
            <button type="button" class="btn-icon" data-action="delete-tag" title="Delete">&#10005;</button>
          </div>
        `;
      })
      .join("");
  }

  // ---------- export / import ----------

  els.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasks-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  els.importBtn.addEventListener("click", () => els.importFile.click());

  els.importFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("File does not contain a task list.");
      const incoming = parsed.filter((t) => t && t.title).map(normalizeTask);
      if (!confirm(`Import ${incoming.length} task(s)? This replaces your current ${tasks.length} task(s).`)) return;
      tasks = incoming;
      saveTasks();
      resetForm();
      renderAll();
    } catch (err) {
      alert("Could not import file: " + err.message);
    } finally {
      e.target.value = "";
    }
  });

  // ---------- cloud sync ----------

  let fb = null;

  async function loadFirebaseModules() {
    if (fb) return fb;
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out reaching sync server.")), 8000));
    const [{ initializeApp }, dbModule] = await Promise.race([
      Promise.all([
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"),
      ]),
      timeout,
    ]);
    fb = { initializeApp, ...dbModule };
    return fb;
  }

  function sanitizeSyncCode(raw) {
    return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  }

  function randomSyncCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function setSyncStatus(kind, text) {
    els.syncStatus.textContent = text;
    els.syncStatus.className = "sync-status" + (kind ? " " + kind : "");
  }

  function showSyncConnected(code) {
    els.syncDisconnected.hidden = true;
    els.syncConnected.hidden = false;
    els.syncCodeShown.textContent = code;
  }

  function showSyncDisconnected() {
    els.syncConnected.hidden = true;
    els.syncDisconnected.hidden = false;
  }

  function describeFirebaseError(err) {
    const code = err && err.code;
    const msg = (err && err.message) || String(err);
    if (code === "PERMISSION_DENIED" || /permission_denied/i.test(msg)) {
      return "Sync isn't enabled on the server yet (permission denied) — see README for the one-time setup.";
    }
    return "Sync error: " + msg;
  }

  function applyRemoteTasks(data) {
    sync.applyingRemote = true;
    tasks = Object.values(data.tasks || {}).map(normalizeTask);
    saveTasks();
    sync.applyingRemote = false;
    resetForm();
    renderAll();
  }

  function handleRemoteSnapshot(data) {
    if (!data) return;
    if (data.updatedBy === sync.clientId) return;
    applyRemoteTasks(data);
    setSyncStatus("ok", "Synced — updated from another device.");
  }

  function pushToCloud() {
    if (!sync.ref || !fb) return;
    const tasksObj = {};
    for (const t of tasks) tasksObj[t.id] = t;
    const payload = { tasks: tasksObj, updatedAt: Date.now(), updatedBy: sync.clientId };
    fb.set(sync.ref, payload)
      .then(() => {
        setSyncStatus("ok", `Synced ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      })
      .catch((err) => setSyncStatus("error", describeFirebaseError(err)));
  }

  function scheduleSyncPush() {
    clearTimeout(sync.pushTimer);
    sync.pushTimer = setTimeout(pushToCloud, 500);
  }

  async function connectSync(rawCode) {
    const code = sanitizeSyncCode(rawCode);
    if (!code) {
      setSyncStatus("error", "Enter a code first.");
      return;
    }
    els.syncConnectBtn.disabled = true;
    setSyncStatus("", "Connecting…");
    try {
      const mod = await loadFirebaseModules();
      if (!sync.db) {
        const app = mod.initializeApp(FIREBASE_CONFIG);
        sync.db = mod.getDatabase(app);
      }
      const dbRef = mod.ref(sync.db, `taskSync/${code}`);
      const snapshot = await mod.get(dbRef);
      const remote = snapshot.val();

      if (remote && remote.tasks) {
        const remoteCount = Object.keys(remote.tasks).length;
        if (
          tasks.length &&
          !confirm(`This sync code already has ${remoteCount} task(s) saved. Replace your ${tasks.length} local task(s) with the synced ones?`)
        ) {
          setSyncStatus("", "Not connected.");
          return;
        }
        applyRemoteTasks(remote);
      }

      sync.ref = dbRef;
      sync.code = code;
      sync.unsubscribe = mod.onValue(
        dbRef,
        (snap) => handleRemoteSnapshot(snap.val()),
        (err) => setSyncStatus("error", describeFirebaseError(err))
      );

      if (!remote || !remote.tasks) pushToCloud();

      localStorage.setItem(SYNC_CODE_KEY, code);
      showSyncConnected(code);
      setSyncStatus("ok", "Connected.");
    } catch (err) {
      setSyncStatus("error", describeFirebaseError(err));
    } finally {
      els.syncConnectBtn.disabled = false;
    }
  }

  function disconnectSync() {
    if (sync.unsubscribe) sync.unsubscribe();
    sync.ref = null;
    sync.code = "";
    localStorage.removeItem(SYNC_CODE_KEY);
    showSyncDisconnected();
    setSyncStatus("", "Disconnected.");
  }

  els.syncGenerateBtn.addEventListener("click", () => {
    els.syncCodeInput.value = randomSyncCode();
    els.syncCodeInput.focus();
  });

  els.syncConnectBtn.addEventListener("click", () => connectSync(els.syncCodeInput.value));

  els.syncCodeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      connectSync(els.syncCodeInput.value);
    }
  });

  els.syncDisconnectBtn.addEventListener("click", () => {
    if (confirm("Disconnect this device from sync? Your tasks stay as they are locally.")) disconnectSync();
  });

  els.syncCopyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(sync.code);
      setSyncStatus("ok", "Code copied.");
    } catch {
      setSyncStatus("error", "Could not copy — copy it manually.");
    }
  });

  // ---------- keyboard shortcuts ----------

  document.addEventListener("keydown", (e) => {
    if (e.key !== "/") return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    els.fSearch.focus();
  });

  // ---------- rendering: stats ----------

  function renderStats() {
    const active = tasks.filter((t) => !t.completed);
    const overdue = active.filter(isOverdue).length;
    const today = active.filter((t) => t.dueDate && isToday(t.dueDate)).length;
    els.stats.innerHTML = `
      <span class="stat-chip">${active.length} active</span>
      <span class="stat-chip today">${today} today</span>
      <span class="stat-chip overdue">${overdue} overdue</span>
    `;
  }

  // ---------- rendering: tag options ----------

  function renderTagOptions() {
    const tags = allTags();
    els.tagList.innerHTML = tags.map((t) => `<option value="${escapeHtml(t)}">`).join("");
    const current = els.fTagFilter.value;
    els.fTagFilter.innerHTML =
      `<option value="">All tags</option>` +
      tags.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
    if (tags.some((t) => t.toLowerCase() === current.toLowerCase())) els.fTagFilter.value = current;
  }

  // ---------- rendering: task item ----------

  function taskItemHtml(task) {
    const dueBadge = task.dueDate
      ? `<span class="badge due-date ${isOverdue(task) ? "overdue" : ""}">${formatDateHuman(task.dueDate)}${task.dueTime ? " · " + task.dueTime : ""}</span>`
      : "";
    const tagBadges = (task.tags || []).map((tag) => `<span class="badge tag">${escapeHtml(tag)}</span>`).join("");
    const repeatBadge = task.repeat && task.repeat !== "none"
      ? `<span class="badge repeat" title="Repeats ${REPEAT_LABELS[task.repeat]}">&#8635; ${REPEAT_LABELS[task.repeat]}</span>`
      : "";
    return `
      <li class="task-item ${task.completed ? "completed" : ""}" data-task-id="${task.id}">
        <input type="checkbox" class="task-checkbox" data-action="toggle" ${task.completed ? "checked" : ""} aria-label="${task.repeat && task.repeat !== "none" ? "Mark complete and reschedule" : "Mark complete"}">
        <div class="task-main">
          <div class="task-title">${escapeHtml(task.title)}</div>
          ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ""}
          <div class="task-meta">
            <span class="badge priority-${task.priority}">${task.priority}</span>
            ${tagBadges}
            ${repeatBadge}
            ${dueBadge}
          </div>
        </div>
        <div class="task-actions">
          <button type="button" class="btn-icon" data-action="edit" title="Edit">&#9998;</button>
          <button type="button" class="btn-icon" data-action="delete" title="Delete">&#10005;</button>
        </div>
      </li>
    `;
  }

  function taskGroupHtml(title, list, extraClass) {
    if (!list.length) return "";
    return `
      <div class="task-group">
        <div class="task-group-title ${extraClass || ""}">${title} (${list.length})</div>
        <ul class="task-list">${list.map(taskItemHtml).join("")}</ul>
      </div>
    `;
  }

  // ---------- rendering: list view ----------

  function renderListView() {
    const list = filteredTasks();
    const activeList = list.filter((t) => !t.completed);
    const completedList = list.filter((t) => t.completed);

    const overdue = activeList.filter(isOverdue);
    const today = activeList.filter((t) => t.dueDate && isToday(t.dueDate) && !isOverdue(t));
    const upcoming = activeList.filter((t) => t.dueDate && t.dueDate > todayStr());
    const noDate = activeList.filter((t) => !t.dueDate);

    upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    let html = "";
    html += taskGroupHtml("Overdue", overdue, "overdue");
    html += taskGroupHtml("Today", today, "today");
    html += taskGroupHtml("Upcoming", upcoming);
    html += taskGroupHtml("No due date", noDate);

    html += taskGroupHtml("Completed", completedList);

    if (!overdue.length && !today.length && !upcoming.length && !noDate.length && !completedList.length) {
      html += `<div class="empty-state">Nothing here. Add a task to get started.</div>`;
    }

    els.listView.innerHTML = html;
  }

  // ---------- rendering: calendar view ----------

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MAX_CHIPS_PER_DAY = 3;

  function tasksByDate() {
    const map = new Map();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (!map.has(t.dueDate)) map.set(t.dueDate, []);
      map.get(t.dueDate).push(t);
    }
    return map;
  }

  function renderCalendarView() {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const monthLabel = calDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const byDate = tasksByDate();

    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);

    let cellsHtml = "";
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + i);
      const dateStr = toDateStr(cellDate);
      const outside = cellDate.getMonth() !== month;
      const dayTasks = (byDate.get(dateStr) || []).slice().sort((a, b) => (a.dueTime || "").localeCompare(b.dueTime || ""));
      const visible = dayTasks.slice(0, MAX_CHIPS_PER_DAY);
      const overflow = dayTasks.length - visible.length;

      const classes = ["calendar-cell"];
      if (outside) classes.push("outside");
      if (isToday(dateStr)) classes.push("today");
      if (dateStr === selectedDay) classes.push("selected");

      cellsHtml += `
        <div class="${classes.join(" ")}" data-date="${dateStr}" data-action="select-day">
          <div class="calendar-date">${cellDate.getDate()}</div>
          ${visible.map((t) => `<div class="calendar-chip priority-${t.priority} ${t.completed ? "done" : ""}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>`).join("")}
          ${overflow > 0 ? `<div class="calendar-more">+${overflow} more</div>` : ""}
        </div>
      `;
    }

    const dowHtml = DOW.map((d) => `<div class="calendar-dow">${d}</div>`).join("");

    let dayDetailHtml = "";
    if (selectedDay) {
      const dayTasks = (byDate.get(selectedDay) || []);
      dayDetailHtml = `
        <div class="day-detail">
          <h3>${formatDateHuman(selectedDay)}</h3>
          ${dayTasks.length
            ? `<ul class="task-list">${dayTasks.map(taskItemHtml).join("")}</ul>`
            : `<div class="empty-state">No tasks on this day.</div>`}
        </div>
      `;
    }

    els.calendarView.innerHTML = `
      <div class="calendar-header">
        <h2>${monthLabel}</h2>
        <div class="calendar-nav">
          <button type="button" class="btn" id="cal-prev">&larr; Prev</button>
          <button type="button" class="btn" id="cal-today">Today</button>
          <button type="button" class="btn" id="cal-next">Next &rarr;</button>
        </div>
      </div>
      <div class="calendar-grid">${dowHtml}${cellsHtml}</div>
      ${dayDetailHtml}
    `;

    document.getElementById("cal-prev").addEventListener("click", () => {
      calDate = new Date(year, month - 1, 1);
      renderCalendarView();
    });
    document.getElementById("cal-next").addEventListener("click", () => {
      calDate = new Date(year, month + 1, 1);
      renderCalendarView();
    });
    document.getElementById("cal-today").addEventListener("click", () => {
      calDate = new Date();
      selectedDay = todayStr();
      renderCalendarView();
    });

    els.calendarView.querySelectorAll('[data-action="select-day"]').forEach((cell) => {
      cell.addEventListener("click", () => {
        const date = cell.dataset.date;
        selectedDay = selectedDay === date ? null : date;
        if (selectedDay) els.fDate.value = selectedDay;
        renderCalendarView();
      });
    });
  }

  // ---------- view switching ----------

  els.viewBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      view = btn.dataset.view;
      els.viewBtns.forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", String(b === btn));
      });
      els.listView.hidden = view !== "list";
      els.calendarView.hidden = view !== "calendar";
      renderAll();
    });
  });

  // ---------- main render ----------

  function renderAll() {
    renderStats();
    renderTagOptions();
    renderTagManager();
    if (view === "list") renderListView();
    else renderCalendarView();
  }

  renderAll();

  const savedSyncCode = localStorage.getItem(SYNC_CODE_KEY);
  if (savedSyncCode) {
    els.syncCodeInput.value = savedSyncCode;
    connectSync(savedSyncCode);
  }
})();
