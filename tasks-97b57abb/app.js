(() => {
  "use strict";

  const STORAGE_KEY = "taskmanager.tasks.v1";

  /** @typedef {{id:string,title:string,notes:string,category:string,priority:'low'|'medium'|'high',dueDate:string,dueTime:string,completed:boolean,createdAt:string}} Task */

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
    fCategory: document.getElementById("f-category"),
    fRepeat: document.getElementById("f-repeat"),
    categoryList: document.getElementById("category-list"),
    fSearch: document.getElementById("f-search"),
    fStatus: document.getElementById("f-status"),
    fCategoryFilter: document.getElementById("f-category-filter"),
  };

  let tasks = loadTasks();
  let view = "list";
  let calDate = new Date();
  let selectedDay = null;

  // ---------- storage ----------

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load tasks", e);
      return [];
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
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

  function categories() {
    const set = new Set(tasks.map((t) => t.category).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  // ---------- form ----------

  function resetForm() {
    els.form.reset();
    els.taskId.value = "";
    els.fPriority.value = "medium";
    els.fRepeat.value = "none";
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
    els.fCategory.value = task.category || "";
    els.fRepeat.value = task.repeat || "none";
    els.formHeading.textContent = "Edit task";
    els.formSubmit.textContent = "Save changes";
    els.formCancel.hidden = false;
    els.fTitle.focus();
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = els.fTitle.value.trim();
    if (!title) return;

    const id = els.taskId.value;
    if (id) {
      const task = tasks.find((t) => t.id === id);
      if (task) {
        task.title = title;
        task.notes = els.fNotes.value.trim();
        task.dueDate = els.fDate.value;
        task.dueTime = els.fTime.value;
        task.priority = els.fPriority.value;
        task.category = els.fCategory.value.trim();
        task.repeat = els.fRepeat.value;
      }
    } else {
      tasks.push({
        id: uid(),
        title,
        notes: els.fNotes.value.trim(),
        dueDate: els.fDate.value,
        dueTime: els.fTime.value,
        priority: els.fPriority.value,
        category: els.fCategory.value.trim(),
        repeat: els.fRepeat.value,
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

  [els.fSearch, els.fStatus, els.fCategoryFilter].forEach((el) => {
    el.addEventListener("input", renderAll);
    el.addEventListener("change", renderAll);
  });

  function filteredTasks() {
    const q = els.fSearch.value.trim().toLowerCase();
    const status = els.fStatus.value;
    const cat = els.fCategoryFilter.value;

    return tasks.filter((t) => {
      if (status === "active" && t.completed) return false;
      if (status === "completed" && !t.completed) return false;
      if (cat && t.category !== cat) return false;
      if (q) {
        const hay = `${t.title} ${t.notes} ${t.category}`.toLowerCase();
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

  // ---------- rendering: category options ----------

  function renderCategoryOptions() {
    const cats = categories();
    els.categoryList.innerHTML = cats.map((c) => `<option value="${escapeHtml(c)}">`).join("");
    const current = els.fCategoryFilter.value;
    els.fCategoryFilter.innerHTML =
      `<option value="">All categories</option>` +
      cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    if (cats.includes(current)) els.fCategoryFilter.value = current;
  }

  // ---------- rendering: task item ----------

  function taskItemHtml(task) {
    const dueBadge = task.dueDate
      ? `<span class="badge due-date ${isOverdue(task) ? "overdue" : ""}">${formatDateHuman(task.dueDate)}${task.dueTime ? " · " + task.dueTime : ""}</span>`
      : "";
    const catBadge = task.category ? `<span class="badge category">${escapeHtml(task.category)}</span>` : "";
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
            ${catBadge}
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
    renderCategoryOptions();
    if (view === "list") renderListView();
    else renderCalendarView();
  }

  renderAll();
})();
