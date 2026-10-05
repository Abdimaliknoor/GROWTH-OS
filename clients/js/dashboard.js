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

// Which habit's row is currently showing its inline "record progress"
// input instead of the "+" button. Also transient view state.
let recordingHabitId = null;

// The Focus timer's live state. None of this is saved to state.js —
// it's just what's happening on screen right now, and resets if the
// page reloads or the user switches to a different habit's pill.
let focusTimerSeconds = 0;      // seconds counted so far in this session
let focusTimerIntervalId = null; // the setInterval handle, or null when paused
let focusTimerRunning = false;

document.addEventListener("DOMContentLoaded", () => {
    const profile = getProfile();
    console.log(profile);
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

/* ------------------------------------------------------------
   FOCUS TIMER
   ------------------------------------------------------------
   A live countdown/elapsed display only makes sense for a
   time-based habit (unit "min"), so the timer only appears for
   those. It doesn't save anything by itself — it just visualizes
   the current session. Clicking "Record Result" is what actually
   commits the session's minutes to state.js, via addHabitProgress.
   ------------------------------------------------------------ */

function isTimeBasedHabit(habit) {
    return !!habit && habit.unit === "min";
}

// Turns a number of minutes into a "M:SS" clock string, e.g. 75.5 -> "75:30".
function formatMinutesAsClock(totalMinutes) {
    const totalSeconds = Math.round(totalMinutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return mins + ":" + (secs < 10 ? "0" : "") + secs;
}

function startFocusTimer() {
    if (focusTimerIntervalId !== null) return; // already running
    focusTimerRunning = true;
    focusTimerIntervalId = setInterval(() => {
        focusTimerSeconds = focusTimerSeconds + 1;
        updateFocusTimerDisplay();
    }, 1000);
}

function pauseFocusTimer() {
    if (focusTimerIntervalId !== null) {
        clearInterval(focusTimerIntervalId);
        focusTimerIntervalId = null;
    }
    focusTimerRunning = false;
}

// Called whenever the selected habit changes (switching pills, or
// starting a brand new session) — the timer always starts over at 0.
function resetFocusTimer() {
    pauseFocusTimer();
    focusTimerSeconds = 0;
}

// Updates only the timer's own DOM pieces (ring, remaining/elapsed
// text) plus the shared badge/target-row text, every second. It does
// NOT call renderFocus() — rebuilding the whole panel every second
// would also rebuild the pill row and button for no reason.
function updateFocusTimerDisplay() {
    const focusHabits = getTodayFocusHabits();
    const habit = focusHabits.find(h => h.id === focusSelectedHabitId);
    if (!habit || !isTimeBasedHabit(habit)) return;

    const elapsedMinutes = Math.min(habit.target, habit.todayAmount + focusTimerSeconds / 60);
    const percent = Math.round(Math.min(100, (elapsedMinutes / habit.target) * 100));
    const remainingMinutes = Math.max(0, habit.target - elapsedMinutes);

    const remainingEl = document.getElementById("focusTimerRemaining");
    if (remainingEl) remainingEl.textContent = formatMinutesAsClock(remainingMinutes);

    const elapsedEl = document.getElementById("focusTimerElapsed");
    if (elapsedEl) {
        elapsedEl.textContent = formatMinutesAsClock(elapsedMinutes) + " / " + formatMinutesAsClock(habit.target) + " elapsed";
    }

    const ringEl = document.getElementById("focusTimerRingProgress");
    if (ringEl) {
        const circumference = 213.6; // 2 * PI * r(34), matches dashboard.css
        ringEl.style.strokeDashoffset = circumference * (1 - percent / 100);
    }

    const badgeEl = document.getElementById("focusSessionBadge");
    if (badgeEl) badgeEl.classList.toggle("hidden", !focusTimerRunning);

    // Keep the shared badge/target-row (also used for non-timer habits)
    // in sync with the live timer instead of the plain todayAmount.
    const countBadgeEl = document.getElementById("focusCountBadge");
    if (countBadgeEl) {
        countBadgeEl.textContent = `${Math.round(elapsedMinutes)}/${habit.target} ${habit.unit.toUpperCase()}`;
    }
    const targetLabelEl = document.getElementById("focusTargetLabel");
    if (targetLabelEl) targetLabelEl.textContent = `Target: ${habit.target} ${habit.unit}`;
    const percentLabelEl = document.getElementById("focusPercentLabel");
    if (percentLabelEl) percentLabelEl.textContent = `${percent}% Completed`;
    const progressBarEl = document.getElementById("focusProgressBar");
    if (progressBarEl) progressBarEl.style.width = percent + "%";
}

// A week label like "W36 · 2026" for the This Week panel header.
function getWeekLabel() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + start.getDay() + 1) / 7);
    return `W${week} · ${now.getFullYear()}`;
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

    const habits = getActiveHabits();
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

    // Quick way to record today's progress: a real inline number input
    // with Save/Cancel, shown only for the row currently being recorded —
    // no browser prompt() popups.
    if (habit.id === recordingHabitId) {
        row.appendChild(createRecordProgressForm(habit, onLogged));
    } else {
        const logBtn = document.createElement("button");
        logBtn.className = "icon-button habit-row-log-button";
        logBtn.setAttribute("aria-label", `Log progress for ${habit.name}`);
        logBtn.innerHTML = '<span class="icon icon-sm">add</span>';
        logBtn.addEventListener("click", () => {
            recordingHabitId = habit.id;
            renderHabits();
            renderFocus();
        });
        row.appendChild(logBtn);
    }

    return row;
}

// The inline "how much did you complete?" form shown in place of the
// "+" button once a row is selected for recording.
function createRecordProgressForm(habit, onLogged) {
    const wrap = document.createElement("div");
    wrap.className = "flex gap-sm items-center";

    const amountInput = document.createElement("input");
    amountInput.className = "input";
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "any";
    amountInput.placeholder = habit.unit || "amount";
    amountInput.style.width = "80px";
    wrap.appendChild(amountInput);

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-primary btn-sm";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => {
        const amount = parseFloat(amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            window.alert("Please enter a number greater than 0.");
            return;
        }
        addHabitProgress(habit.id, amount);
        recordingHabitId = null;
        if (onLogged) onLogged();
    });
    wrap.appendChild(saveBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-ghost btn-sm";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
        recordingHabitId = null;
        renderHabits();
        renderFocus();
    });
    wrap.appendChild(cancelBtn);

    return wrap;
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
                resetFocusTimer();
                renderFocus();
            });
            pillRow.appendChild(pill);
        });
    }

    // The timer (for a minutes-based habit) or the static target row
    // (for anything else) owns the shared badge/target-row text — never
    // both at once, so they can't show conflicting numbers.
    const targetWrap = document.getElementById("focusTargetWrap");
    const timerWrap = document.getElementById("focusTimerWrap");
    const sessionBadgeEl = document.getElementById("focusSessionBadge");

    if (selectedHabit && isTimeBasedHabit(selectedHabit)) {
        if (timerWrap) timerWrap.classList.remove("hidden");
        if (targetWrap) targetWrap.classList.remove("hidden");
        if (countBadgeEl) countBadgeEl.classList.remove("hidden");
        updateFocusTimerDisplay(); // fills in the ring + text right away
    } else if (selectedHabit && typeof selectedHabit.target === "number") {
        if (timerWrap) timerWrap.classList.add("hidden");
        if (sessionBadgeEl) sessionBadgeEl.classList.add("hidden");
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
        if (timerWrap) timerWrap.classList.add("hidden");
        if (sessionBadgeEl) sessionBadgeEl.classList.add("hidden");
        if (countBadgeEl) countBadgeEl.classList.add("hidden");
        if (targetWrap) targetWrap.classList.add("hidden");
    }

    // Session is complete once every habit in it hit today's target —
    // derived, not a manual flag.
    const allDone = focusHabits.length > 0 && focusHabits.every(h => h.completedToday);

    if (actionsEl) {
        if (allDone) {
            actionsEl.innerHTML = '<span class="text-body-sm text-muted">Session complete for today ✓</span>';
        } else if (selectedHabit && recordingHabitId === selectedHabit.id) {
            // Recording mode: a real inline input instead of actions.
            actionsEl.innerHTML = "";
            actionsEl.appendChild(buildFocusRecordForm(selectedHabit));
        } else {
            const canTime = isTimeBasedHabit(selectedHabit);
            let startLabel = "Start Focus";
            let startIcon = "play_arrow";
            if (focusTimerRunning) {
                startLabel = "Pause";
                startIcon = "pause";
            } else if (focusTimerSeconds > 0) {
                startLabel = "Resume Focus";
            }

            actionsEl.innerHTML = `
                <button class="btn btn-primary btn-full" id="focusStartBtn" ${canTime ? "" : "disabled"}>
                    <span class="icon icon-sm icon-filled">${startIcon}</span>
                    ${startLabel}
                </button>
                <button class="btn btn-outline btn-full" id="focusRecordBtn">
                    Record Result
                </button>`;

            const startBtn = document.getElementById("focusStartBtn");
            if (startBtn && canTime) {
                startBtn.addEventListener("click", () => {
                    if (focusTimerRunning) {
                        pauseFocusTimer();
                    } else {
                        startFocusTimer();
                    }
                    renderFocus(); // updates the button label to match the new state
                });
            }

            const recordBtn = document.getElementById("focusRecordBtn");
            if (recordBtn) {
                recordBtn.disabled = !selectedHabit;
                recordBtn.addEventListener("click", () => {
                    if (!selectedHabit) return;
                    recordingHabitId = selectedHabit.id;
                    renderFocus();
                });
            }
        }
        actionsEl.classList.remove("hidden");
    }
}

// The inline "how much did you complete?" form for the Focus panel's
// selected habit. For a timer habit, it pre-fills with the live
// session's minutes so far — saving commits that time via
// addHabitProgress() and resets the timer, since that time is now
// permanently logged.
function buildFocusRecordForm(habit) {
    const wrap = document.createElement("div");
    wrap.className = "flex gap-sm items-center";

    const amountInput = document.createElement("input");
    amountInput.className = "input";
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "any";
    amountInput.placeholder = habit.unit || "amount";
    amountInput.style.width = "90px";
    if (isTimeBasedHabit(habit) && focusTimerSeconds > 0) {
        amountInput.value = Math.round((focusTimerSeconds / 60) * 10) / 10;
    }
    wrap.appendChild(amountInput);

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-primary btn-sm";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => {
        const amount = parseFloat(amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            window.alert("Please enter a number greater than 0.");
            return;
        }
        addHabitProgress(habit.id, amount);
        recordingHabitId = null;
        resetFocusTimer(); // this session's time is now saved, start fresh
        renderFocus();
        renderHabits();
        renderGoals();
        renderWeek();
        renderSidebar();
    });
    wrap.appendChild(saveBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-ghost btn-sm";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
        recordingHabitId = null;
        renderFocus();
    });
    wrap.appendChild(cancelBtn);

    return wrap;
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

    const habits = getActiveHabits();

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
        resetFocusTimer();
        renderFocus();
    });
    setupEl.appendChild(startBtn);
}

/* ------------------------------------------------------------
   TODAY'S HABITS
   ------------------------------------------------------------ */

function renderHabits() {
    const habits = getActiveHabits();
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
    const routine = getSortedRoutine();
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
    const habits = getActiveHabits().filter(h => typeof h.target === "number");
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