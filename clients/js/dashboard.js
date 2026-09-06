/* ============================================================
   DASHBOARD.JS
   Pulls data through state.js and paints it into dashboard.html.
   Nothing in here touches localStorage directly — state.js owns
   that. No data is hardcoded here; every number comes from a
   state.js getter.
   ============================================================ */

// Which habit within today's focus session is currently selected in
// the pill row. This is transient view state, not persisted — it
// resets to the session's first habit on reload.
let focusSelectedHabitId = null;

document.addEventListener("DOMContentLoaded", () => {
    renderSidebar();
    renderTopbar();
    renderFocus();
    renderHabits();
    renderRoutine();
    renderGoals();
    renderWeek();
    renderReflection();
});

/* ------------------------------------------------------------
   HELPERS
   ------------------------------------------------------------ */

function getInitials(name) {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
}

function formatToday() {
    return new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric"
    });
}

// Converts "HH:MM" into minutes since midnight, for comparing times.
function timeToMinutes(time) {
    if (!time || !time.includes(":")) return null;
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

// "everyday" -> "Every day", "weekdays" -> "Weekdays"
function humanizeFrequencyLabel(frequency) {
    if (frequency === "everyday") return "Every day";
    return frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

// A week label like "W36 · 2026" for the This Week panel header.
function getWeekLabel() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + start.getDay() + 1) / 7);
    return `W${week} · ${now.getFullYear()}`;
}

function promptForHabitAmount(habit) {
    const unitLabel = habit.unit ? ` (${habit.unit})` : "";
    const input = window.prompt(`How much did you complete for "${habit.name}"${unitLabel}?`);
    if (input === null) return null;
    const amount = parseFloat(input);
    return isNaN(amount) || amount <= 0 ? null : amount;
}

/* ------------------------------------------------------------
   SIDEBAR
   ------------------------------------------------------------ */

function renderSidebar() {
    const profile = getProfile();
    const nameEl = document.getElementById("sidebarProfileName");
    const avatarEl = document.getElementById("sidebarProfileAvatar");
    const roleEl = document.getElementById("sidebarProfileRole");
    const habitsCountEl = document.getElementById("sidebarHabitsCount");
    const goalsCountEl = document.getElementById("sidebarGoalsCount");

    if (nameEl) nameEl.textContent = profile.name || "Guest";
    if (avatarEl) avatarEl.textContent = getInitials(profile.name);
    if (roleEl) roleEl.textContent = profile.identity || "";

    const habits = getHabits();
    if (habitsCountEl) {
        habitsCountEl.textContent = habits.length
            ? `${habits.filter(h => h.completedToday).length}/${habits.length}`
            : "";
    }

    const goals = getGoals();
    if (goalsCountEl) goalsCountEl.textContent = goals.length || "";
}

/* ------------------------------------------------------------
   TOPBAR
   ------------------------------------------------------------ */

function renderTopbar() {
    const profile = getProfile();
    const titleEl = document.getElementById("topbarTitle");
    const dateEl = document.getElementById("topbarDate");

    if (titleEl) {
        titleEl.textContent = profile.name ? `Good day, ${profile.name}` : "Good day";
    }
    if (dateEl) {
        dateEl.textContent = `${formatToday()} · Build deliberately. One focused action at a time.`;
    }
}

/* ------------------------------------------------------------
   SHARED — one habit's quantified-progress row
   ------------------------------------------------------------
   Used by the Habits panel. `onLogged` runs after a successful
   log so the caller can re-render whatever else depends on it.
   ------------------------------------------------------------ */

function createHabitProgressRow(habit, onLogged) {
    const row = document.createElement("div");
    row.className = "habit-row" + (habit.completedToday ? " is-done" : "");

    const check = document.createElement("div");
    check.className = "habit-row-check";
    if (habit.completedToday) {
        check.innerHTML = '<span class="icon icon-filled">check</span>';
    }
    row.appendChild(check);

    const info = document.createElement("div");
    info.className = "habit-row-info";

    const top = document.createElement("div");
    top.className = "habit-row-top";

    const name = document.createElement("span");
    name.className = "habit-row-name";
    name.textContent = habit.name;
    top.appendChild(name);

    if (typeof habit.target === "number") {
        const percent = document.createElement("span");
        percent.className = "habit-row-percent";
        percent.textContent = `${Math.round(Math.min(100, (habit.todayAmount / habit.target) * 100))}%`;
        top.appendChild(percent);
    }
    info.appendChild(top);

    const metaLine = document.createElement("span");
    metaLine.className = "habit-row-meta";
    if (typeof habit.target === "number") {
        const freqPart = habit.frequency ? ` · ${humanizeFrequencyLabel(habit.frequency)}` : "";
        metaLine.textContent = `${habit.todayAmount}/${habit.target} ${habit.unit}${freqPart}`;
    } else {
        metaLine.textContent = habit.detail;
    }
    info.appendChild(metaLine);

    if (typeof habit.target === "number") {
        const track = document.createElement("div");
        track.className = "progress";
        const fill = document.createElement("div");
        fill.className = "progress-bar";
        fill.style.width = `${Math.min(100, (habit.todayAmount / habit.target) * 100)}%`;
        track.appendChild(fill);
        info.appendChild(track);
    }

    row.appendChild(info);

    // Quick way to record today's progress. This is an interim control —
    // the full Habits page will get a proper stepper/input instead of a
    // prompt.
    const logBtn = document.createElement("button");
    logBtn.className = "icon-button habit-row-log-button";
    logBtn.setAttribute("aria-label", `Log progress for ${habit.name}`);
    logBtn.innerHTML = '<span class="icon icon-sm">add</span>';
    logBtn.addEventListener("click", () => {
        const amount = promptForHabitAmount(habit);
        if (amount === null) return;
        addHabitProgress(habit.id, amount);
        if (onLogged) onLogged();
    });
    row.appendChild(logBtn);

    return row;
}

/* ------------------------------------------------------------
   TODAY'S FOCUS
   ------------------------------------------------------------
   Focus is a real, user-created execution session: a title plus
   the specific habits being worked on right now. The pill row
   lets the user pick which of the session's habits to view and
   record progress for; the session is treated as complete once
   every habit in it has hit today's target (no manual flag).
   ------------------------------------------------------------ */

function renderFocus() {
    const focus = getTodayFocus();
    const bodyEl = document.getElementById("focusBody");
    const setupEl = document.getElementById("focusSetup");
    const actionsEl = document.getElementById("focusActions");
    const countBadgeEl = document.getElementById("focusCountBadge");

    if (!focus) {
        if (bodyEl) bodyEl.classList.add("hidden");
        if (actionsEl) actionsEl.classList.add("hidden");
        if (countBadgeEl) countBadgeEl.classList.add("hidden");
        focusSelectedHabitId = null;
        renderFocusSetup(setupEl);
        return;
    }

    if (setupEl) setupEl.classList.add("hidden");
    if (bodyEl) bodyEl.classList.remove("hidden");

    const taskEl = document.getElementById("focusTask");
    if (taskEl) taskEl.textContent = focus.title;

    const focusHabits = getTodayFocusHabits();

    // Meta line: which goals this session's habits contribute to, if any.
    const metaEl = document.getElementById("focusMeta");
    if (metaEl) {
        const goals = getGoals();
        const goalTitles = [...new Set(
            focusHabits.filter(h => h.goalId)
                .map(h => goals.find(g => g.id === h.goalId))
                .filter(Boolean)
                .map(g => g.title)
        )];
        metaEl.textContent = goalTitles.length ? `Contributing to: ${goalTitles.join(", ")}` : "";
    }

    // Keep the selected pill valid — default to the first habit in the
    // session if nothing (or something stale) is selected.
    if (!focusHabits.some(h => h.id === focusSelectedHabitId)) {
        focusSelectedHabitId = focusHabits.length ? focusHabits[0].id : null;
    }
    const selectedHabit = focusHabits.find(h => h.id === focusSelectedHabitId) || null;

    // Pill row — one per habit in the session.
    const pillRow = document.getElementById("focusPillRow");
    if (pillRow) {
        pillRow.innerHTML = "";
        focusHabits.forEach(habit => {
            const pill = document.createElement("button");
            pill.className = "focus-pill" + (habit.id === focusSelectedHabitId ? " is-selected" : "");
            pill.innerHTML = `<span class="focus-pill-dot"></span><span>${habit.name}</span>`;
            pill.addEventListener("click", () => {
                focusSelectedHabitId = habit.id;
                renderFocus();
            });
            pillRow.appendChild(pill);
        });
    }

    // Top-right badge + target row reflect the SELECTED habit's own
    // progress in its own unit — never a number merged across habits
    // with different units.
    const targetWrap = document.getElementById("focusTargetWrap");
    if (selectedHabit && typeof selectedHabit.target === "number") {
        const percent = Math.round(Math.min(100, (selectedHabit.todayAmount / selectedHabit.target) * 100));

        if (countBadgeEl) {
            countBadgeEl.textContent = `${selectedHabit.todayAmount}/${selectedHabit.target} ${selectedHabit.unit.toUpperCase()}`;
            countBadgeEl.classList.remove("hidden");
        }
        document.getElementById("focusTargetLabel").textContent = `Target: ${selectedHabit.target} ${selectedHabit.unit}`;
        document.getElementById("focusPercentLabel").textContent = `${percent}% Completed`;
        document.getElementById("focusProgressBar").style.width = `${percent}%`;
        if (targetWrap) targetWrap.classList.remove("hidden");
    } else {
        if (countBadgeEl) countBadgeEl.classList.add("hidden");
        if (targetWrap) targetWrap.classList.add("hidden");
    }

    // Session is complete once every habit in it hit today's target —
    // derived, not a manual flag.
    const allDone = focusHabits.length > 0 && focusHabits.every(h => h.completedToday);

    if (actionsEl) {
        if (allDone) {
            actionsEl.innerHTML = '<span class="text-body-sm text-muted">Session complete for today ✓</span>';
        } else {
            actionsEl.innerHTML = `
                <button class="btn btn-primary btn-full" id="focusStartBtn">
                    <span class="icon icon-sm icon-filled">play_arrow</span>
                    Start Focus
                </button>
                <button class="btn btn-outline btn-full" id="focusRecordBtn">
                    Record Result
                </button>`;

            const recordBtn = document.getElementById("focusRecordBtn");
            if (recordBtn) {
                recordBtn.disabled = !selectedHabit;
                recordBtn.addEventListener("click", () => {
                    if (!selectedHabit) return;
                    const amount = promptForHabitAmount(selectedHabit);
                    if (amount === null) return;
                    addHabitProgress(selectedHabit.id, amount);
                    renderFocus();
                    renderHabits();
                    renderGoals();
                    renderWeek();
                    renderSidebar();
                });
            }
            // "Start Focus" is a placeholder for the future focus-timer
            // feature — intentionally not wired to anything yet.
        }
        actionsEl.classList.remove("hidden");
    }
}

// Habit ids currently toggled on in the "begin a session" setup screen.
let focusSetupSelectedIds = new Set();

// The inline "begin a focus session" form shown when there's no focus
// set for today yet — pick a title and which habits belong to it. Uses
// the same pill component as the active session view so the two states
// look and feel like one product, not two different screens.
function renderFocusSetup(setupEl) {
    if (!setupEl) return;
    setupEl.classList.remove("hidden");
    setupEl.innerHTML = "";

    const habits = getHabits();

    const prompt = document.createElement("p");
    prompt.className = "text-body-sm text-muted";
    prompt.textContent = habits.length
        ? "What are you working on right now?"
        : "Add a habit first, then start a focus session around it.";
    setupEl.appendChild(prompt);

    if (!habits.length) return;

    const titleInput = document.createElement("input");
    titleInput.className = "input";
    titleInput.placeholder = "e.g. Morning Training";
    titleInput.id = "focusTitleInput";
    setupEl.appendChild(titleInput);

    const pickerLabel = document.createElement("span");
    pickerLabel.className = "text-label";
    pickerLabel.textContent = "Select Habits";
    setupEl.appendChild(pickerLabel);

    const pillRow = document.createElement("div");
    pillRow.className = "focus-pill-row";

    habits.forEach(habit => {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "focus-pill" + (focusSetupSelectedIds.has(habit.id) ? " is-selected" : "");
        pill.innerHTML = `<span class="focus-pill-dot"></span><span>${habit.name}</span>`;
        pill.addEventListener("click", () => {
            if (focusSetupSelectedIds.has(habit.id)) {
                focusSetupSelectedIds.delete(habit.id);
            } else {
                focusSetupSelectedIds.add(habit.id);
            }
            pill.classList.toggle("is-selected");
        });
        pillRow.appendChild(pill);
    });
    setupEl.appendChild(pillRow);

    const startBtn = document.createElement("button");
    startBtn.className = "btn btn-primary btn-full";
    startBtn.textContent = "Begin Session";
    startBtn.addEventListener("click", () => {
        const title = titleInput.value.trim();
        const habitIds = Array.from(focusSetupSelectedIds);
        if (!title || !habitIds.length) return;

        setFocus({ title, habitIds });
        focusSetupSelectedIds = new Set();
        focusSelectedHabitId = null;
        renderFocus();
    });
    setupEl.appendChild(startBtn);
}

/* ------------------------------------------------------------
   TODAY'S HABITS
   ------------------------------------------------------------ */

function renderHabits() {
    const habits = getHabits();
    const listEl = document.getElementById("habitList");
    const countEl = document.getElementById("habitCount");
    const emptyEl = document.getElementById("habitsEmpty");

    if (!listEl) return;

    if (!habits.length) {
        listEl.classList.add("hidden");
        if (emptyEl) emptyEl.classList.remove("hidden");
        if (countEl) countEl.textContent = "0/0";
        return;
    }

    listEl.classList.remove("hidden");
    if (emptyEl) emptyEl.classList.add("hidden");
    listEl.innerHTML = "";

    habits.forEach(habit => {
        const row = createHabitProgressRow(habit, () => {
            renderHabits();
            renderGoals();
            renderFocus();
            renderWeek();
            renderSidebar();
        });
        listEl.appendChild(row);
    });

    updateHabitCount(habits, countEl);
}

function updateHabitCount(habits, countEl) {
    if (!countEl) return;
    const done = habits.filter(h => h.completedToday).length;
    countEl.textContent = `${done}/${habits.length}`;
}

/* ------------------------------------------------------------
   TODAY'S ROUTINE
   ------------------------------------------------------------ */

function renderRoutine() {
    const routine = getRoutine();
    const listEl = document.getElementById("routineList");
    const emptyEl = document.getElementById("routineEmpty");

    if (!listEl) return;

    if (!routine.length) {
        listEl.classList.add("hidden");
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }

    listEl.classList.remove("hidden");
    if (emptyEl) emptyEl.classList.add("hidden");
    listEl.innerHTML = "";

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    let currentIndex = -1;
    routine.forEach((item, index) => {
        const itemMinutes = timeToMinutes(item.time);
        if (itemMinutes !== null && itemMinutes <= nowMinutes) currentIndex = index;
    });

    routine.forEach((item, index) => {
        const row = document.createElement("div");
        let state = "is-upcoming";
        if (index < currentIndex) state = "is-past";
        if (index === currentIndex) state = "is-now";
        if (state === "is-upcoming" && index > currentIndex + 1) state = "is-planned";

        row.className = "routine-row " + (state === "is-planned" ? "" : state);

        const left = document.createElement("div");
        left.className = "routine-row-left";

        const time = document.createElement("span");
        time.className = "routine-row-time";
        time.textContent = item.time || "—";

        const label = document.createElement("span");
        label.className = "routine-row-label";
        label.textContent = item.label;

        left.appendChild(time);
        left.appendChild(label);
        row.appendChild(left);

        if (state === "is-now") {
            const badge = document.createElement("span");
            badge.className = "badge badge-solid";
            badge.textContent = "NOW";
            row.appendChild(badge);
        } else {
            const status = document.createElement("span");
            status.className = "routine-row-status";
            status.textContent = state === "is-past" ? "Passed" : state === "is-upcoming" ? "Upcoming" : "Planned";
            row.appendChild(status);
        }

        listEl.appendChild(row);
    });
}

/* ------------------------------------------------------------
   YOUR GOALS
   ------------------------------------------------------------
   "Current Focus" on a goal card is today's focus session's
   title, IF that session includes a habit linked to this goal —
   a real link across Goal -> Habit -> Focus, not a static label.
   ------------------------------------------------------------ */

function renderGoals() {
    const goals = getGoals();
    const listEl = document.getElementById("goalList");
    const emptyEl = document.getElementById("goalsEmpty");
    const countEl = document.getElementById("goalCount");

    if (countEl) countEl.textContent = goals.length;
    if (!listEl) return;

    if (!goals.length) {
        listEl.classList.add("hidden");
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }

    listEl.classList.remove("hidden");
    if (emptyEl) emptyEl.classList.add("hidden");
    listEl.innerHTML = "";

    const todaysFocusHabits = getTodayFocusHabits();
    const todaysFocus = getTodayFocus();

    goals.forEach(goal => {
        const card = document.createElement("div");
        card.className = "goal-card";

        const header = document.createElement("div");
        header.className = "goal-card-header";

        const title = document.createElement("h4");
        title.className = "goal-card-title";
        title.textContent = goal.title;
        header.appendChild(title);

        const percent = getGoalCompletionPercent(goal.id);
        if (percent !== null) {
            const percentEl = document.createElement("span");
            percentEl.className = "goal-card-percent";
            percentEl.textContent = `${percent}%`;
            header.appendChild(percentEl);
        }
        card.appendChild(header);

        if (percent !== null) {
            const track = document.createElement("div");
            track.className = "progress";
            const fill = document.createElement("div");
            fill.className = "progress-bar";
            fill.style.width = `${percent}%`;
            track.appendChild(fill);
            card.appendChild(track);
        }

        const contributions = getGoalProgress(goal.id);
        const focusLine = document.createElement("p");
        focusLine.className = "goal-card-focus-line";

        const linkedToTodaysFocus = todaysFocus && todaysFocusHabits.some(h => h.goalId === goal.id);
        if (linkedToTodaysFocus) {
            focusLine.innerHTML = `Current Focus: <strong>${todaysFocus.title}</strong>`;
        } else if (contributions.length) {
            focusLine.textContent = "No focus session today.";
        } else {
            focusLine.textContent = "No habits linked yet.";
        }
        card.appendChild(focusLine);

        listEl.appendChild(card);
    });
}

/* ------------------------------------------------------------
   THIS WEEK
   ------------------------------------------------------------
   Real per-habit weekly totals (up to 4) — habits without a
   numeric target are skipped since there's nothing to measure.
   ------------------------------------------------------------ */

function renderWeek() {
    const habits = getHabits().filter(h => typeof h.target === "number");
    const gridEl = document.getElementById("weekStatGrid");
    const emptyEl = document.getElementById("weekEmpty");
    const labelEl = document.getElementById("weekLabelBadge");

    if (labelEl) labelEl.textContent = getWeekLabel();
    if (!gridEl) return;

    if (!habits.length) {
        gridEl.classList.add("hidden");
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }

    gridEl.classList.remove("hidden");
    if (emptyEl) emptyEl.classList.add("hidden");
    gridEl.innerHTML = "";

    habits.slice(0, 4).forEach(habit => {
        const weeklyTotal = getHabitWeeklyTotal(habit.id);
        const weeklyTarget = habitWeeklyTarget(habit);

        const tile = document.createElement("div");
        tile.className = "stat-tile";

        const label = document.createElement("span");
        label.className = "stat-tile-label";
        label.textContent = habit.name;
        tile.appendChild(label);

        const valueRow = document.createElement("div");
        valueRow.className = "stat-tile-value-row";

        const value = document.createElement("span");
        value.className = "stat-tile-value";
        value.innerHTML = weeklyTarget ? `${weeklyTotal} <span>/ ${weeklyTarget}</span>` : `${weeklyTotal}`;
        valueRow.appendChild(value);

        const unit = document.createElement("span");
        unit.className = "stat-tile-unit";
        unit.textContent = habit.unit.toUpperCase();
        valueRow.appendChild(unit);

        tile.appendChild(valueRow);
        gridEl.appendChild(tile);
    });
}

/* ------------------------------------------------------------
   REFLECT
   ------------------------------------------------------------ */

function renderReflection() {
    const input = document.getElementById("reflectionInput");
    const saveBtn = document.getElementById("reflectionSaveBtn");
    const lastSavedEl = document.getElementById("reflectionLastSaved");

    updateLastSavedLabel(lastSavedEl);

    if (!saveBtn || !input) return;

    saveBtn.addEventListener("click", () => {
        const text = input.value.trim();
        if (!text) return;

        addJournalEntry(text);
        input.value = "";
        updateLastSavedLabel(lastSavedEl);
    });
}

function updateLastSavedLabel(lastSavedEl) {
    if (!lastSavedEl) return;
    const latest = getLatestJournalEntry();

    if (!latest) {
        lastSavedEl.textContent = "";
        return;
    }

    const date = new Date(latest.date);
    lastSavedEl.textContent = `Last saved ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}