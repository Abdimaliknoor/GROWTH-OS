/* ============================================================
   HABITS.JS
   Handles the Habits page: showing the stats row, showing each
   habit as a card, and the Add/Edit form at the bottom.

   This file is written in plain, step-by-step style on purpose —
   mostly regular for-loops and if/else, so it is easy to read
   line by line. It only reads/writes data through the functions
   in state.js.
   ============================================================ */

// While this is null, the form at the bottom is for ADDING a new
// habit. When it holds a habit id, we are EDITING that habit instead.
let editingHabitId = null;

// Which frequency button is currently selected in the form.
let selectedFrequency = "everyday";

// Which "how do you measure this" button is selected: "quantity" or
// "binary" (complete / not complete, like "Pray Fajr").
let selectedType = "quantity";

document.addEventListener("DOMContentLoaded", function () {
    renderSidebar();
    fillGoalDropdown();
    renderStats();
    renderHabitCards();
    renderArchivedSection();
    setupFrequencyButtons();
    setupTypeButtons();
    setupSaveButton();
    setupCancelButton();
});

/* ------------------------------------------------------------
   SIDEBAR (same idea as dashboard.js, kept simple and separate)
   ------------------------------------------------------------ */

function renderSidebar() {
    const profile = getProfile();

    const nameEl = document.getElementById("sidebarProfileName");
    const avatarEl = document.getElementById("sidebarProfileAvatar");
    const roleEl = document.getElementById("sidebarProfileRole");
    const habitsCountEl = document.getElementById("sidebarHabitsCount");
    const goalsCountEl = document.getElementById("sidebarGoalsCount");

    if (nameEl) {
        nameEl.textContent = profile.name ? profile.name : "Guest";
    }

    if (avatarEl) {
        let firstLetter = "?";
        if (profile.name) {
            firstLetter = profile.name.charAt(0).toUpperCase();
        }
        avatarEl.textContent = firstLetter;
    }

    if (roleEl) {
        roleEl.textContent = profile.identity ? profile.identity : "";
    }

    const habits = getActiveHabits();

    if (habitsCountEl) {
        if (habits.length > 0) {
            let doneCount = 0;
            for (let i = 0; i < habits.length; i++) {
                if (habits[i].completedToday) {
                    doneCount = doneCount + 1;
                }
            }
            habitsCountEl.textContent = doneCount + "/" + habits.length;
        } else {
            habitsCountEl.textContent = "";
        }
    }

    const goals = getGoals();
    if (goalsCountEl) {
        goalsCountEl.textContent = goals.length > 0 ? goals.length : "";
    }
}

/* ------------------------------------------------------------
   GOAL DROPDOWN — fills the "Linked goal" select with the
   user's real goals
   ------------------------------------------------------------ */

function fillGoalDropdown() {
    const select = document.getElementById("habitGoalSelect");
    if (!select) return;

    // Remove every option except the first one ("No goal").
    while (select.options.length > 1) {
        select.remove(1);
    }

    const goals = getGoals();

    for (let i = 0; i < goals.length; i++) {
        const option = document.createElement("option");
        option.value = goals[i].id;
        option.textContent = goals[i].title;
        select.appendChild(option);
    }
}

/* ------------------------------------------------------------
   STATS ROW
   ------------------------------------------------------------ */

function renderStats() {
    const habits = getActiveHabits();

    const activeCountEl = document.getElementById("statActiveHabits");
    if (activeCountEl) {
        activeCountEl.textContent = habits.length;
    }

    // How many habits already hit today's target.
    let doneToday = 0;
    for (let i = 0; i < habits.length; i++) {
        if (habits[i].completedToday) {
            doneToday = doneToday + 1;
        }
    }

    let todayPercent = 0;
    if (habits.length > 0) {
        todayPercent = Math.round((doneToday / habits.length) * 100);
    }

    const todayPercentEl = document.getElementById("statTodayPercent");
    if (todayPercentEl) {
        todayPercentEl.textContent = todayPercent + "%";
    }

    const todayCountEl = document.getElementById("statTodayCount");
    if (todayCountEl) {
        todayCountEl.textContent = doneToday + " of " + habits.length + " done";
    }

    // Average weekly completion across every habit that has a real
    // number target (skip habits with no target — nothing to measure).
    let totalRatio = 0;
    let countedHabits = 0;

    for (let j = 0; j < habits.length; j++) {
        const habit = habits[j];

        if (typeof habit.target === "number") {
            const weeklyTotal = getHabitWeeklyTotal(habit.id);
            const weeklyTarget = habitWeeklyTarget(habit);

            if (weeklyTarget > 0) {
                let ratio = weeklyTotal / weeklyTarget;
                if (ratio > 1) {
                    ratio = 1;
                }
                totalRatio = totalRatio + ratio;
                countedHabits = countedHabits + 1;
            }
        }
    }

    let weekPercent = 0;
    if (countedHabits > 0) {
        weekPercent = Math.round((totalRatio / countedHabits) * 100);
    }

    const weekPercentEl = document.getElementById("statWeekPercent");
    if (weekPercentEl) {
        weekPercentEl.textContent = weekPercent + "%";
    }
}

/* ------------------------------------------------------------
   HABIT CARDS
   ------------------------------------------------------------ */

function renderHabitCards() {
    const habits = getActiveHabits();
    const listEl = document.getElementById("habitCardList");
    const emptyEl = document.getElementById("habitCardsEmpty");

    if (!listEl) return;

    listEl.innerHTML = "";

    if (habits.length === 0) {
        listEl.classList.add("hidden");
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }

    listEl.classList.remove("hidden");
    if (emptyEl) emptyEl.classList.add("hidden");

    for (let i = 0; i < habits.length; i++) {
        const card = buildHabitCard(habits[i]);
        listEl.appendChild(card);
    }
}

// Shows a small list of archived habits with a "Restore" button each.
// The whole section hides itself when there's nothing archived.
function renderArchivedSection() {
    const archivedHabits = getArchivedHabits();
    const sectionEl = document.getElementById("archivedSection");
    const listEl = document.getElementById("archivedHabitList");

    if (!sectionEl || !listEl) return;

    if (archivedHabits.length === 0) {
        sectionEl.classList.add("hidden");
        return;
    }

    sectionEl.classList.remove("hidden");
    listEl.innerHTML = "";

    for (let i = 0; i < archivedHabits.length; i++) {
        const row = buildArchivedHabitRow(archivedHabits[i]);
        listEl.appendChild(row);
    }
}

// Builds one row for the Archived Habits list: the habit's name and a
// Restore button. Kept as its own function (like buildHabitCard) so
// each row gets its own habit variable instead of sharing one from a
// loop, which is the safe, simple way to do this.
function buildArchivedHabitRow(habit) {
    const row = document.createElement("div");
    row.className = "habit-row";

    const nameEl = document.createElement("span");
    nameEl.className = "habit-row-name";
    nameEl.textContent = habit.name;
    row.appendChild(nameEl);

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "btn btn-outline btn-sm";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", function () {
        handleRestoreClick(habit);
    });
    row.appendChild(restoreBtn);

    return row;
}

// Builds one habit card from scratch and returns it.
function buildHabitCard(habit) {
    const card = document.createElement("div");
    card.className = "panel habit-card";

    // ---- Top: which goal it's linked to, and its name ----
    const top = document.createElement("div");
    top.className = "habit-card-top";

    const nameBlock = document.createElement("div");

    const goalLine = document.createElement("div");
    goalLine.className = "habit-card-goal-line";
    goalLine.textContent = getGoalLabelForHabit(habit);
    nameBlock.appendChild(goalLine);

    const nameEl = document.createElement("h3");
    nameEl.className = "habit-card-name";
    nameEl.textContent = habit.name;
    nameBlock.appendChild(nameEl);

    // "Why it matters", only shown if the user actually filled it in.
    if (habit.purpose) {
        const purposeEl = document.createElement("p");
        purposeEl.className = "text-body-sm text-muted";
        purposeEl.textContent = habit.purpose;
        nameBlock.appendChild(purposeEl);
    }

    top.appendChild(nameBlock);
    card.appendChild(top);

    // ---- Today's status ----
    // A binary habit (target 1, no unit) just shows done / not done.
    // A quantity habit shows a target, an amount, and a progress bar.
    if (habit.isBinary) {
        const statusLine = document.createElement("p");
        statusLine.className = "completed-label";
        statusLine.textContent = habit.completedToday ? "Done today ✓" : "Not done today";
        card.appendChild(statusLine);
    } else if (typeof habit.target === "number") {
        const percent = Math.round(Math.min(100, (habit.todayAmount / habit.target) * 100));

        const progressRow = document.createElement("div");
        progressRow.className = "habit-card-progress-row";

        const targetLabel = document.createElement("span");
        targetLabel.className = "text-muted";
        targetLabel.textContent = "Target: " + habit.target + " " + habit.unit;
        progressRow.appendChild(targetLabel);

        const completedLabel = document.createElement("span");
        completedLabel.className = "completed-label";
        completedLabel.textContent = habit.todayAmount + "/" + habit.target + " " + habit.unit + " (" + percent + "%)";
        progressRow.appendChild(completedLabel);

        card.appendChild(progressRow);

        const track = document.createElement("div");
        track.className = "progress";
        const fill = document.createElement("div");
        fill.className = "progress-bar";
        fill.style.width = percent + "%";
        track.appendChild(fill);
        card.appendChild(track);
    }

    // ---- Trailing 7-day grid ----
    const weekGrid = buildWeekGrid(habit);
    card.appendChild(weekGrid);

    // ---- Actions: log progress / focus, edit, archive ----
    const actions = document.createElement("div");
    actions.className = "habit-card-actions";

    const leftActions = document.createElement("div");
    leftActions.className = "flex gap-sm";

    // Binary habits get a one-click toggle instead of a "how much?" prompt.
    const logBtn = document.createElement("button");
    logBtn.className = "btn btn-outline btn-sm";
    if (habit.isBinary) {
        logBtn.textContent = habit.completedToday ? "Undo" : "Mark Complete";
        logBtn.addEventListener("click", function () {
            handleBinaryToggleClick(habit);
        });
    } else {
        logBtn.textContent = "Log Progress";
        logBtn.addEventListener("click", function () {
            handleLogClick(habit);
        });
    }
    leftActions.appendChild(logBtn);

    // "Focus" sends this habit into today's Focus session on the
    // dashboard, then jumps there — see handleFocusClick() below.
    const focusBtn = document.createElement("button");
    focusBtn.className = "btn btn-ghost btn-sm";
    focusBtn.textContent = "Focus";
    focusBtn.addEventListener("click", function () {
        handleFocusClick(habit);
    });
    leftActions.appendChild(focusBtn);

    actions.appendChild(leftActions);

    const editArchiveWrap = document.createElement("div");
    editArchiveWrap.className = "flex gap-sm";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-button";
    editBtn.setAttribute("aria-label", "Edit " + habit.name);
    editBtn.innerHTML = '<span class="icon icon-sm">edit</span>';
    editBtn.addEventListener("click", function () {
        handleEditClick(habit);
    });
    editArchiveWrap.appendChild(editBtn);

    // Archive instead of delete, so logged history isn't lost.
    const archiveBtn = document.createElement("button");
    archiveBtn.className = "icon-button";
    archiveBtn.setAttribute("aria-label", "Archive " + habit.name);
    archiveBtn.innerHTML = '<span class="icon icon-sm">archive</span>';
    archiveBtn.addEventListener("click", function () {
        handleArchiveClick(habit);
    });
    editArchiveWrap.appendChild(archiveBtn);

    actions.appendChild(editArchiveWrap);
    card.appendChild(actions);

    return card;
}

// Finds which goal (if any) a habit is linked to, and returns a
// short label to show on the card.
function getGoalLabelForHabit(habit) {
    if (!habit.goalId) {
        return "No goal linked";
    }

    const goals = getGoals();

    for (let i = 0; i < goals.length; i++) {
        if (goals[i].id === habit.goalId) {
            return "Goal: " + goals[i].title;
        }
    }

    return "No goal linked";
}

// Builds the row of 7 small boxes showing the last 7 days, with a
// checkmark on any day the habit's target was hit.
function buildWeekGrid(habit) {
    const grid = document.createElement("div");
    grid.className = "habit-week-grid";

    const dayLetters = ["S", "M", "T", "W", "T", "F", "S"]; // Date.getDay(): 0 = Sunday

    // Go from 6 days ago up to today, so the grid reads left-to-right.
    for (let i = 6; i >= 0; i--) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        const dateKey = day.toISOString().slice(0, 10);

        const amountThatDay = getAmountForHabitOnDate(habit.id, dateKey);

        let isHit = false;
        if (typeof habit.target === "number" && amountThatDay >= habit.target) {
            isHit = true;
        }

        const dayBox = document.createElement("div");
        dayBox.className = "habit-week-day";
        if (isHit) {
            dayBox.classList.add("is-hit");
        }

        const letterEl = document.createElement("span");
        letterEl.textContent = dayLetters[day.getDay()];
        dayBox.appendChild(letterEl);

        const iconEl = document.createElement("span");
        iconEl.className = "icon";
        iconEl.style.fontSize = "12px";
        if (isHit) {
            iconEl.textContent = "check";
        }
        dayBox.appendChild(iconEl);

        grid.appendChild(dayBox);
    }

    return grid;
}

// Looks up exactly how much was logged for one habit on one specific
// date. getHabits() only gives us TODAY's amount, so for other days we
// read the raw saved data ourselves through getUser().
function getAmountForHabitOnDate(habitId, dateKey) {
    const user = getUser();
    const rawHabits = user.habits;

    for (let i = 0; i < rawHabits.length; i++) {
        const item = rawHabits[i];
        const itemId = typeof item === "string" ? "habit-" + i : item.id;

        if (itemId === habitId) {
            if (item.log && item.log[dateKey]) {
                return item.log[dateKey];
            }
            return 0;
        }
    }

    return 0;
}

/* ------------------------------------------------------------
   CARD ACTIONS
   ------------------------------------------------------------ */

function handleLogClick(habit) {
    let unitText = "";
    if (habit.unit) {
        unitText = " (" + habit.unit + ")";
    }

    const answer = window.prompt("How much did you complete for \"" + habit.name + "\"" + unitText + "?");

    if (answer === null) {
        return; // the user clicked Cancel
    }

    const amount = parseFloat(answer);

    if (isNaN(amount) || amount <= 0) {
        return; // ignore empty or invalid input
    }

    addHabitProgress(habit.id, amount);

    renderStats();
    renderHabitCards();
    renderSidebar();
}

function handleEditClick(habit) {
    editingHabitId = habit.id;

    document.getElementById("habitNameInput").value = habit.name;
    document.getElementById("habitPurposeInput").value = habit.purpose ? habit.purpose : "";
    document.getElementById("habitGoalSelect").value = habit.goalId ? habit.goalId : "";
    document.getElementById("habitTargetInput").value = habit.target ? habit.target : "";
    document.getElementById("habitUnitSelect").value = habit.unit ? habit.unit : "km";

    selectTypeButton(habit.isBinary ? "binary" : "quantity");

    const frequencyToSelect = habit.frequency ? habit.frequency : "everyday";
    selectFrequencyButton(frequencyToSelect);

    document.getElementById("habitFormTitle").textContent = "Edit Habit";
    document.getElementById("habitSaveBtn").textContent = "Save Changes";
    document.getElementById("habitCancelEditBtn").classList.remove("hidden");

    document.getElementById("habitFormPanel").scrollIntoView({ behavior: "smooth" });
}

// Archiving hides the habit from the active list but keeps its logged
// history, unlike deleting it, which would lose that history forever.
function handleArchiveClick(habit) {
    const confirmed = window.confirm('Archive "' + habit.name + '"? You can restore it later from the Archived section.');
    if (!confirmed) {
        return;
    }

    archiveHabit(habit.id);

    renderStats();
    renderHabitCards();
    renderArchivedSection();
    renderSidebar();
}

function handleRestoreClick(habit) {
    restoreHabit(habit.id);

    renderStats();
    renderHabitCards();
    renderArchivedSection();
    renderSidebar();
}

// For a binary habit (target 1, no unit), clicking the button just flips
// today's amount between 0 and 1 — no "how much?" question needed.
function handleBinaryToggleClick(habit) {
    if (habit.completedToday) {
        setTodayHabitAmount(habit.id, 0);
    } else {
        setTodayHabitAmount(habit.id, habit.target);
    }

    renderStats();
    renderHabitCards();
    renderSidebar();
}

// Sends this habit into today's Focus session on the dashboard, then
// navigates there. If a session already exists, the habit is added to
// it; otherwise a new session is started around just this habit.
function handleFocusClick(habit) {
    const existingFocus = getTodayFocus();

    if (existingFocus) {
        const habitIds = existingFocus.habitIds.slice(); // make a copy
        if (habitIds.indexOf(habit.id) === -1) {
            habitIds.push(habit.id);
        }
        setFocus({ title: existingFocus.title, habitIds: habitIds });
    } else {
        setFocus({ title: habit.name, habitIds: [habit.id] });
    }

    window.location.href = "dashboard.html";
}

/* ------------------------------------------------------------
   FREQUENCY BUTTONS
   ------------------------------------------------------------ */

function setupFrequencyButtons() {
    const everydayBtn = document.getElementById("freqEverydayBtn");
    const weekdaysBtn = document.getElementById("freqWeekdaysBtn");

    everydayBtn.addEventListener("click", function () {
        selectFrequencyButton("everyday");
    });

    weekdaysBtn.addEventListener("click", function () {
        selectFrequencyButton("weekdays");
    });
}

function selectFrequencyButton(frequency) {
    selectedFrequency = frequency;

    const everydayBtn = document.getElementById("freqEverydayBtn");
    const weekdaysBtn = document.getElementById("freqWeekdaysBtn");

    if (frequency === "everyday") {
        everydayBtn.classList.add("is-selected");
        weekdaysBtn.classList.remove("is-selected");
    } else {
        weekdaysBtn.classList.add("is-selected");
        everydayBtn.classList.remove("is-selected");
    }
}

/* ------------------------------------------------------------
   TYPE BUTTONS — "Quantity" vs "Complete / Not Complete"
   ------------------------------------------------------------ */

function setupTypeButtons() {
    const quantityBtn = document.getElementById("typeQuantityBtn");
    const binaryBtn = document.getElementById("typeBinaryBtn");

    quantityBtn.addEventListener("click", function () {
        selectTypeButton("quantity");
    });

    binaryBtn.addEventListener("click", function () {
        selectTypeButton("binary");
    });
}

function selectTypeButton(type) {
    selectedType = type;

    const quantityBtn = document.getElementById("typeQuantityBtn");
    const binaryBtn = document.getElementById("typeBinaryBtn");
    const targetFieldWrap = document.getElementById("targetFieldWrap");

    if (type === "quantity") {
        quantityBtn.classList.add("is-selected");
        binaryBtn.classList.remove("is-selected");
        targetFieldWrap.classList.remove("hidden");
    } else {
        binaryBtn.classList.add("is-selected");
        quantityBtn.classList.remove("is-selected");
        // A binary habit doesn't need a target/unit — it's just done or not.
        targetFieldWrap.classList.add("hidden");
    }
}

/* ------------------------------------------------------------
   SAVE / CANCEL
   ------------------------------------------------------------ */

function setupSaveButton() {
    const saveBtn = document.getElementById("habitSaveBtn");
    saveBtn.addEventListener("click", handleSaveClick);
}

function setupCancelButton() {
    const cancelBtn = document.getElementById("habitCancelEditBtn");
    cancelBtn.addEventListener("click", function () {
        resetForm();
    });
}

function handleSaveClick() {
    const name = document.getElementById("habitNameInput").value.trim();
    const purpose = document.getElementById("habitPurposeInput").value.trim();
    const goalId = document.getElementById("habitGoalSelect").value;

    if (name === "") {
        window.alert("Please enter a habit name.");
        return;
    }

    let target;
    let unit;

    if (selectedType === "binary") {
        // Complete / not-complete habits don't need a real target — we
        // just use 1 with no unit, which the rest of the app already
        // understands as "binary" (see normalizeHabit in state.js).
        target = 1;
        unit = "";
    } else {
        const targetText = document.getElementById("habitTargetInput").value;
        target = parseFloat(targetText);

        if (isNaN(target) || target <= 0) {
            window.alert("Please enter a target amount greater than 0.");
            return;
        }

        unit = document.getElementById("habitUnitSelect").value;
    }

    const habitData = {
        name: name,
        purpose: purpose,
        goalId: goalId === "" ? null : goalId,
        target: target,
        unit: unit,
        frequency: selectedFrequency
    };

    if (editingHabitId) {
        // Editing an existing habit — keep its logged history, just
        // change the fields above.
        updateHabit(editingHabitId, habitData);
    } else {
        // Adding a brand new habit — it starts with an empty log.
        habitData.id = generateId("habit");
        habitData.log = {};
        addHabit(habitData);
    }

    resetForm();
    renderStats();
    renderHabitCards();
    renderSidebar();
}

function resetForm() {
    editingHabitId = null;

    document.getElementById("habitNameInput").value = "";
    document.getElementById("habitPurposeInput").value = "";
    document.getElementById("habitGoalSelect").value = "";
    document.getElementById("habitTargetInput").value = "";
    document.getElementById("habitUnitSelect").value = "km";
    selectFrequencyButton("everyday");
    selectTypeButton("quantity");

    document.getElementById("habitFormTitle").textContent = "Add a Habit";
    document.getElementById("habitSaveBtn").textContent = "Add Habit";
    document.getElementById("habitCancelEditBtn").classList.add("hidden");
}