/* ============================================================
   ROUTINE.JS
   Handles the Routine page: listing today's schedule in time
   order, and the Add/Edit form at the bottom.

   Written the same plain way as habits.js — regular for-loops,
   const/let, named functions, no closures. It only reads/writes
   data through the functions in state.js.
   ============================================================ */

// While this is null, the form is for ADDING a new time slot.
// When it holds a routine item id, we are EDITING that one instead.
let editingRoutineId = null;

document.addEventListener("DOMContentLoaded", function () {
    renderSidebar();
    fillHabitDropdown();
    renderRoutineList();
    setupSaveButton();
    setupCancelButton();
});

/* ------------------------------------------------------------
   SIDEBAR (same idea as dashboard.js / habits.js)
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
   HABIT DROPDOWN — fills the "Linked habit" select with the
   user's real active habits
   ------------------------------------------------------------ */

function fillHabitDropdown() {
    const select = document.getElementById("routineHabitSelect");
    if (!select) return;

    // Remove every option except the first one ("No habit").
    while (select.options.length > 1) {
        select.remove(1);
    }

    const habits = getActiveHabits();

    for (let i = 0; i < habits.length; i++) {
        const option = document.createElement("option");
        option.value = habits[i].id;
        option.textContent = habits[i].name;
        select.appendChild(option);
    }
}

/* ------------------------------------------------------------
   ROUTINE LIST
   ------------------------------------------------------------ */

function renderRoutineList() {
    const routine = getSortedRoutine();
    const listEl = document.getElementById("routineList");
    const emptyEl = document.getElementById("routineEmpty");
    const countEl = document.getElementById("routineCount");

    if (countEl) {
        countEl.textContent = routine.length;
    }

    if (!listEl) return;

    listEl.innerHTML = "";

    if (routine.length === 0) {
        listEl.classList.add("hidden");
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }

    listEl.classList.remove("hidden");
    if (emptyEl) emptyEl.classList.add("hidden");

    for (let i = 0; i < routine.length; i++) {
        const row = buildRoutineRow(routine[i]);
        listEl.appendChild(row);
    }
}

// Builds one row for a single routine item: time, label, the habit
// it's linked to (if any), and Edit/Delete buttons.
function buildRoutineRow(item) {
    const row = document.createElement("div");
    row.className = "routine-row";

    const left = document.createElement("div");
    left.className = "routine-row-left";

    const time = document.createElement("span");
    time.className = "routine-row-time";
    time.textContent = item.time || "—";
    left.appendChild(time);

    const label = document.createElement("span");
    label.className = "routine-row-label";
    label.textContent = item.label;
    left.appendChild(label);

    const habitTag = getHabitTagForRoutineItem(item);
    if (habitTag) {
        const habitTagEl = document.createElement("span");
        habitTagEl.className = "routine-row-habit-tag";
        habitTagEl.textContent = habitTag;
        left.appendChild(habitTagEl);
    }

    row.appendChild(left);

    const actions = document.createElement("div");
    actions.className = "routine-row-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-button";
    editBtn.setAttribute("aria-label", "Edit " + item.label);
    editBtn.innerHTML = '<span class="icon icon-sm">edit</span>';
    editBtn.addEventListener("click", function () {
        handleEditClick(item);
    });
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-button";
    deleteBtn.setAttribute("aria-label", "Delete " + item.label);
    deleteBtn.innerHTML = '<span class="icon icon-sm">delete</span>';
    deleteBtn.addEventListener("click", function () {
        handleDeleteClick(item);
    });
    actions.appendChild(deleteBtn);

    row.appendChild(actions);

    return row;
}

// Looks up the linked habit's name (if any) to show as a small tag,
// e.g. "→ Run".
function getHabitTagForRoutineItem(item) {
    if (!item.habitId) {
        return "";
    }

    const habits = getActiveHabits();

    for (let i = 0; i < habits.length; i++) {
        if (habits[i].id === item.habitId) {
            return "→ " + habits[i].name;
        }
    }

    return "";
}

/* ------------------------------------------------------------
   ROW ACTIONS
   ------------------------------------------------------------ */

function handleEditClick(item) {
    editingRoutineId = item.id;

    document.getElementById("routineTimeInput").value = item.time;
    document.getElementById("routineLabelInput").value = item.label;
    document.getElementById("routineHabitSelect").value = item.habitId ? item.habitId : "";

    document.getElementById("routineFormTitle").textContent = "Edit Time Slot";
    document.getElementById("routineSaveBtn").textContent = "Save Changes";
    document.getElementById("routineCancelEditBtn").classList.remove("hidden");

    document.getElementById("routineFormPanel").scrollIntoView({ behavior: "smooth" });
}

function handleDeleteClick(item) {
    const confirmed = window.confirm('Remove "' + item.label + '" from your routine?');
    if (!confirmed) {
        return;
    }

    deleteRoutineItem(item.id);
    renderRoutineList();
}

/* ------------------------------------------------------------
   SAVE / CANCEL
   ------------------------------------------------------------ */

function setupSaveButton() {
    const saveBtn = document.getElementById("routineSaveBtn");
    saveBtn.addEventListener("click", handleSaveClick);
}

function setupCancelButton() {
    const cancelBtn = document.getElementById("routineCancelEditBtn");
    cancelBtn.addEventListener("click", function () {
        resetForm();
    });
}

function handleSaveClick() {
    const time = document.getElementById("routineTimeInput").value;
    const label = document.getElementById("routineLabelInput").value.trim();
    const habitId = document.getElementById("routineHabitSelect").value;

    if (time === "") {
        window.alert("Please choose a time.");
        return;
    }

    if (label === "") {
        window.alert("Please describe what happens at this time.");
        return;
    }

    const itemData = {
        time: time,
        label: label,
        habitId: habitId === "" ? null : habitId
    };

    if (editingRoutineId) {
        updateRoutineItem(editingRoutineId, itemData);
    } else {
        itemData.id = generateId("routine");
        addRoutineItem(itemData);
    }

    resetForm();
    renderRoutineList();
}

function resetForm() {
    editingRoutineId = null;

    document.getElementById("routineTimeInput").value = "";
    document.getElementById("routineLabelInput").value = "";
    document.getElementById("routineHabitSelect").value = "";

    document.getElementById("routineFormTitle").textContent = "Add a Time Slot";
    document.getElementById("routineSaveBtn").textContent = "Add to Routine";
    document.getElementById("routineCancelEditBtn").classList.add("hidden");
}