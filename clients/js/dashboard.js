/* ============================================================
   DASHBOARD.JS
   Pulls data through state.js and paints it into dashboard.html.
   Nothing in here touches localStorage directly — state.js owns
   that.
   ============================================================ */

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

/* ------------------------------------------------------------
   SIDEBAR
   ------------------------------------------------------------ */

function renderSidebar() {
    const profile = getProfile();
    const nameEl = document.getElementById("sidebarUserName");
    const avatarEl = document.getElementById("sidebarUserAvatar");

    if (nameEl) nameEl.textContent = profile.name || "Guest";
    if (avatarEl) avatarEl.textContent = getInitials(profile.name);
}

/* ------------------------------------------------------------
   TOPBAR
   ------------------------------------------------------------ */

function renderTopbar() {
    const profile = getProfile();
    const titleEl = document.getElementById("topbarTitle");
    const dateEl = document.getElementById("topbarDate");

    if (titleEl) {
        titleEl.textContent = profile.name
            ? `Welcome back, ${profile.name}`
            : "Welcome back";
    }
    if (dateEl) dateEl.textContent = formatToday();
}

/* ------------------------------------------------------------
   TODAY'S FOCUS
   ------------------------------------------------------------
   Focus is not its own stored feature yet — it is drawn from
   the user's first goal, since focus is "what am I doing right
   now to move a goal forward."
   ------------------------------------------------------------ */

function renderFocus() {
    const goals = getGoals();
    const taskEl = document.getElementById("focusTask");
    const nextEl = document.getElementById("focusNextAction");
    const emptyEl = document.getElementById("focusEmpty");
    const bodyEl = document.getElementById("focusBody");

    if (!goals.length) {
        if (bodyEl) bodyEl.classList.add("hidden");
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }

    if (bodyEl) bodyEl.classList.remove("hidden");
    if (emptyEl) emptyEl.classList.add("hidden");

    const primaryGoal = goals[0];
    const headline = primaryGoal.currentFocus || primaryGoal.title;
    const nextAction = primaryGoal.currentFocus
        ? `Part of your goal: ${primaryGoal.title}`
        : "Decide the next concrete step for this goal.";

    if (taskEl) taskEl.textContent = headline;
    if (nextEl) nextEl.textContent = nextAction;
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
        const row = document.createElement("label");
        row.className = "checkbox-row" + (habit.completed ? " is-done" : "");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = habit.completed;
        checkbox.addEventListener("change", () => {
            toggleHabit(habit.id);
            renderHabits();
        });

        const textWrap = document.createElement("span");
        textWrap.className = "checkbox-row-text";

        const label = document.createElement("span");
        label.className = "checkbox-row-label";
        label.textContent = habit.name;
        textWrap.appendChild(label);

        if (habit.detail) {
            const detail = document.createElement("span");
            detail.className = "checkbox-row-detail";
            detail.textContent = habit.detail;
            textWrap.appendChild(detail);
        }

        row.appendChild(checkbox);
        row.appendChild(textWrap);
        listEl.appendChild(row);
    });

    updateHabitCount(habits, countEl);
}

function updateHabitCount(habits, countEl) {
    if (!countEl) return;
    const done = habits.filter(h => h.completed).length;
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

    // Find the last routine item whose time has already passed —
    // that one is "now", everything before it is "past".
    let currentIndex = -1;
    routine.forEach((item, index) => {
        const itemMinutes = timeToMinutes(item.time);
        if (itemMinutes !== null && itemMinutes <= nowMinutes) {
            currentIndex = index;
        }
    });

    routine.forEach((item, index) => {
        const row = document.createElement("div");
        let state = "is-upcoming";
        if (index < currentIndex) state = "is-past";
        if (index === currentIndex) state = "is-now";

        row.className = "timeline-item " + state;

        const dot = document.createElement("span");
        dot.className = "timeline-dot";

        const time = document.createElement("span");
        time.className = "timeline-time";
        time.textContent = item.time || "—";

        const labelWrap = document.createElement("div");
        const label = document.createElement("span");
        label.className = "timeline-label";
        label.textContent = item.label;
        labelWrap.appendChild(label);

        if (state === "is-now") {
            const badge = document.createElement("span");
            badge.className = "timeline-now-badge";
            badge.textContent = "NOW";
            labelWrap.appendChild(document.createElement("br"));
            labelWrap.appendChild(badge);
        }

        row.appendChild(dot);
        row.appendChild(time);
        row.appendChild(labelWrap);
        listEl.appendChild(row);
    });
}

/* ------------------------------------------------------------
   YOUR GOALS
   ------------------------------------------------------------ */

function renderGoals() {
    const goals = getGoals();
    const gridEl = document.getElementById("goalGrid");
    const emptyEl = document.getElementById("goalsEmpty");

    if (!gridEl) return;

    if (!goals.length) {
        gridEl.classList.add("hidden");
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }

    gridEl.classList.remove("hidden");
    if (emptyEl) emptyEl.classList.add("hidden");
    gridEl.innerHTML = "";

    goals.forEach(goal => {
        const card = document.createElement("div");
        card.className = "goal-card";

        const title = document.createElement("h4");
        title.className = "goal-title";
        title.textContent = goal.title;
        card.appendChild(title);

        // Only render a progress bar when we actually have a number —
        // never invent a percentage.
        if (typeof goal.progress === "number") {
            const track = document.createElement("div");
            track.className = "progress-track";
            const fill = document.createElement("div");
            fill.className = "progress-fill";
            fill.style.width = `${Math.max(0, Math.min(100, goal.progress))}%`;
            track.appendChild(fill);
            card.appendChild(track);
        }

        if (goal.currentFocus) {
            const focusLabel = document.createElement("span");
            focusLabel.className = "goal-focus-label";
            focusLabel.textContent = "CURRENT FOCUS";
            const focusValue = document.createElement("span");
            focusValue.className = "goal-focus-value";
            focusValue.textContent = goal.currentFocus;
            card.appendChild(focusLabel);
            card.appendChild(focusValue);
        }

        gridEl.appendChild(card);
    });
}

/* ------------------------------------------------------------
   THIS WEEK
   ------------------------------------------------------------
   Only real numbers from stats — no invented percentages for
   features (focus sessions, reflections) that don't have
   storage yet.
   ------------------------------------------------------------ */

function renderWeek() {
    const stats = getStats();

    const streakEl = document.getElementById("statStreak");
    const completedEl = document.getElementById("statCompleted");
    const daysEl = document.getElementById("statDays");

    if (streakEl) streakEl.textContent = stats.streak;
    if (completedEl) completedEl.textContent = stats.completedHabits;
    if (daysEl) daysEl.textContent = stats.totalDays;
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