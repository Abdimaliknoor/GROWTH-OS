/* ╔══════════════════════════════════════════════════════════════╗
   ║  PLAN  ·  js/app/plan.js                                     ║
   ║  Your direction, your goals (each with ITS habits) and week. ║
   ╚══════════════════════════════════════════════════════════════╝

   WHAT THIS PAGE SHOWS
     • Direction: "I am someone who…"
     • Goals: one block per active goal, main goal first (state.js getActiveGoals)
         the goal card (bar, pace, end box, milestones, why) + ⋯ menu
         its habits (🔥 streak, this week's dots, Archive) + "＋ Add a habit"
         its archived habits (Restore)
     • "＋ Add a goal" while under the limit (state.js GOAL_LIMIT)
     • Coming up + My week (unchanged)

   EVERY GOAL BLOCK IS BUILT FROM ONE <template>
     So there are no ids inside a block (ids must be unique on a page).
     Each block has data-goal-id; ONE listener on #goalList handles
     every button in every block (event delegation, data-action).

   MAP OF THIS FILE
     1. Guard   2. Elements   3. Settings   4. Page state
     5. Helpers   6. Renderers   7. Actions   8. Page load   9. Events
   ══════════════════════════════════════════════════════════════════ */


/* ════════════════════ 1. GUARD ════════════════════ */

const planReady = isOnboardingComplete();
if (!planReady) {
    window.location.replace("../startup/welcome.html");
}


/* ════════════════════ 2. ELEMENTS ════════════════════ */

// ── Top bar + direction ──
const planCount = document.getElementById("planCount");
const direction = document.getElementById("direction");
const directionArea = document.getElementById("directionArea");
const directionIdentity = document.getElementById("directionIdentity");

// ── Goals ──
const noGoal = document.getElementById("noGoal");
const planGoals = document.getElementById("planGoals");
const goalCount = document.getElementById("goalCount");
const goalList = document.getElementById("goalList");
const addGoal = document.getElementById("addGoal");
const addGoalLeft = document.getElementById("addGoalLeft");
const goalsFull = document.getElementById("goalsFull");
const goalsFullText = document.getElementById("goalsFullText");

// ── Coming up ──
const upcomingList = document.getElementById("upcomingList");
const upcomingEmpty = document.getElementById("upcomingEmpty");
const upcomingAdd = document.getElementById("upcomingAdd");

// ── My week ──
const weekChips = document.getElementById("weekChips");
const weekList = document.getElementById("weekList");
const weekEmpty = document.getElementById("weekEmpty");

// ── Toast ──
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");

// ── Templates ──
const goalTemplate = document.getElementById("goalTemplate");
const habitTemplate = document.getElementById("habitTemplate");
const archivedTemplate = document.getElementById("archivedTemplate");
const milestoneTemplate = document.getElementById("milestoneTemplate");
const weekItemTemplate = document.getElementById("weekItemTemplate");
const upcomingTemplate = document.getElementById("upcomingTemplate");


/* ════════════════════ 3. SETTINGS ════════════════════ */

const TOAST_MS = 3000;
const WEEK_ICONS = { wake: "wb_sunny", sleep: "bedtime", activity: "event", habit: "radio_button_checked" };
const PACE_ICONS = { done: "celebration", start: "flag", ahead: "trending_up", behind: "warning" };

// Where each ⋯ link goes. ?goal=… tells the page WHICH goal (startup/edit-mode.js).
const GOAL_PAGE = "../startup/goal.html";
const HABIT_PAGE = "../startup/habit.html";


/* ════════════════════ 4. PAGE STATE ════════════════════ */

let selectedDay = weekdayOf(todayDate());   // "My week" starts on today's weekday
let toastTimer = null;


/* ════════════════════ 5. HELPERS ════════════════════ */

function describeFinish(goal) {
    switch (goal.measure) {
        case "total":      return `${goal.target} ${goal.unit} in total`;
        case "level":      return `Can do ${goal.target} ${goal.unit}`;
        case "milestones": return `${goal.milestones.length} steps to complete`;
        default:           return "Done by staying consistent";
    }
}

function formatDate(dateText) {
    const [year, month, day] = dateText.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function describeDeadline(goal) {
    const daysLeft = getDaysLeft(goal);
    if (daysLeft === null) return "";
    const date = formatDate(goal.deadline);
    if (daysLeft > 0) return `${daysLeft} days left · ${date}`;
    if (daysLeft === 0) return "Due today";
    return `Past the date · ${date}`;
}

function describePace(goal, pace) {
    const unit = goal.unit;
    switch (pace.state) {
        case "done":   return "Goal reached. Well done!";
        case "start":  return `Log your first ${unit} to see your pace.`;
        case "ahead":  return goal.deadline
            ? `On track: about ${pace.perDay} ${unit} a day → done around ${formatDate(pace.finishDate)}.`
            : `At about ${pace.perDay} ${unit} a day you'll be done around ${formatDate(pace.finishDate)}.`;
        case "behind": return `Behind: at ${pace.perDay} ${unit} a day you'd finish around ${formatDate(pace.finishDate)}. `
            + `Aim for ${pace.needPerDay} a day to make it.`;
        default:       return "";
    }
}

// "05:30" or "05:30 / 18:00" (a habit can sit at two times)
function habitTimes(habitId) {
    const times = getRoutine()
        .filter(item => item.kind === "habit" && item.habitId === habitId)
        .map(item => item.time);
    return [...new Set(times)].sort().join(" / ");
}

// "1 goal" / "3 goals"
function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// Copy a <template>'s content so we can fill it in.
function copyTemplate(template) {
    return template.content.firstElementChild.cloneNode(true);
}

// Inside one goal block: block.querySelector, shorter.
function part(block, selector) {
    return block.querySelector(selector);
}


/* ════════════════════ 6. RENDERERS ════════════════════ */

// ── Direction: "QURAN" + "I am someone who…". Hidden if there's none. ──
function renderDirection() {
    const { areaLabel, identity } = getDirection();
    direction.hidden = !identity && !areaLabel;
    directionArea.textContent = areaLabel || "";
    directionIdentity.textContent = identity || "";
}

// ── All goals: one block each (main first), the counts, "＋ Add a goal" ──
function renderGoals() {
    const goals = getActiveGoals();

    noGoal.hidden = goals.length > 0;
    planGoals.hidden = goals.length === 0;
    goalList.replaceChildren(...goals.map((goal, index) => buildGoalBlock(goal, index === 0)));

    goalCount.textContent = `${goals.length} / ${GOAL_LIMIT}`;
    const habitTotal = goals.reduce((sum, goal) => sum + getHabitsForGoal(goal.id).length, 0);
    planCount.textContent = `${plural(goals.length, "goal")} · ${plural(habitTotal, "habit")}`;

    // "＋ Add a goal ……… 1 left"   ·   at the limit → the hint instead
    const left = GOAL_LIMIT - goals.length;
    addGoal.hidden = !canAddGoal();
    addGoalLeft.textContent = left === 1 ? "1 left" : `${left} left`;
    goalsFull.hidden = canAddGoal();
    goalsFullText.textContent = `${GOAL_LIMIT} / ${GOAL_LIMIT} goals. Close one to start another.`;
}

// ── ONE goal block: the card on top, its habits under it ──
function buildGoalBlock(goal, isMain) {
    const block = copyTemplate(goalTemplate);
    block.dataset.goalId = goal.id;
    block.dataset.color = goal.color;                    // app.css → var(--goal) for the dot, edge and bar

    fillGoalCard(block, goal);
    fillGoalMenu(block, goal, isMain);
    fillGoalHabits(block, goal);
    return block;
}

// The card: title, finish line, bar, numbers, pace, end box, milestones, why
function fillGoalCard(block, goal) {
    const progress = getGoalProgress(goal);
    const unit = goal.measure === "milestones" ? "steps" : goal.measure === "consistency" ? "check-ins" : goal.unit;

    part(block, ".goal-title").textContent = goal.title;
    part(block, ".goal-card-finish").textContent = describeFinish(goal);
    part(block, ".goal-bar .bar-fill").style.width = progress.percent + "%";
    part(block, ".goal-bar").setAttribute("aria-valuenow", progress.percent);
    part(block, ".goal-bar").setAttribute("aria-label", `${goal.title}: ${progress.percent}%`);
    part(block, ".goal-numbers").textContent = `${progress.done} / ${progress.target} ${unit} · ${progress.percent}%`;
    part(block, ".goal-deadline").textContent = describeDeadline(goal);

    const why = part(block, ".goal-card-why");
    why.textContent = goal.why ? `“${goal.why}”` : "";
    why.hidden = !goal.why;

    // On track? (total goals only)
    const pace = getGoalPace(goal);
    const sentence = describePace(goal, pace);
    const paceLine = part(block, ".goal-pace");
    paceLine.hidden = !sentence;
    paceLine.classList.add(`is-${pace.state}`);
    part(block, ".goal-pace-icon").textContent = PACE_ICONS[pace.state] || "";
    part(block, ".goal-pace-text").textContent = sentence;

    fillGoalEnd(block, goal, progress);

    // Milestone goals: the steps, tickable
    const steps = part(block, ".milestone-list");
    steps.hidden = goal.measure !== "milestones";
    steps.replaceChildren(...goal.milestones.map(buildMilestone));
}

// The end: reached 🎉 or the date has passed → close it (or change the date)
function fillGoalEnd(block, goal, progress) {
    const reached = goal.measure !== "consistency" && progress.percent >= 100;
    const daysLeft = getDaysLeft(goal);
    const datePassed = daysLeft !== null && daysLeft < 0;

    const end = part(block, ".goal-end");
    end.hidden = !reached && !datePassed;
    if (end.hidden) return;

    end.classList.toggle("is-reached", reached);
    part(block, ".goal-extend").hidden = reached;        // reached: no need for more time
    if (reached) {
        part(block, ".goal-end-icon").textContent = "celebration";
        part(block, ".goal-end-title").textContent = "You reached this goal";
        part(block, ".goal-end-hint").textContent = "Close it to free a place for your next one. Your history stays.";
    } else {
        part(block, ".goal-end-icon").textContent = "event_busy";
        part(block, ".goal-end-title").textContent = "The date has passed";
        part(block, ".goal-end-hint").textContent = `You got to ${progress.percent}%. Give it more time, or close it.`;
    }
}

// ⋯ menu: the links know WHICH goal (?goal=…). The main goal has no "Make main".
function fillGoalMenu(block, goal, isMain) {
    const editGoal = `${GOAL_PAGE}?mode=edit&goal=${encodeURIComponent(goal.id)}`;
    const editHabits = `${HABIT_PAGE}?mode=edit&goal=${encodeURIComponent(goal.id)}`;

    block.querySelectorAll("[data-link='goal']").forEach(link => { link.href = editGoal; });
    part(block, "[data-link='habits']").href = editHabits;
    part(block, "[data-link='add-habit']").href = `${editHabits}&add=1`;

    part(block, ".goal-main-tag").hidden = !isMain || getActiveGoals().length < 2;   // "Main" only matters with 2+
    part(block, "[data-action='make-main']").hidden = isMain;
    part(block, ".goal-menu-button").setAttribute("aria-label", `Options for ${goal.title}`);
}

// Its habits (🔥, this week) + "No habits yet" + its archived habits
function fillGoalHabits(block, goal) {
    const habits = getHabitsForGoal(goal.id);
    const old = getArchivedHabits(goal.id);

    part(block, ".goal-habit-list").replaceChildren(...habits.map(habit => buildHabit(habit, goal)));
    part(block, ".goal-habits-empty").hidden = habits.length > 0;

    part(block, ".goal-archived").hidden = old.length === 0;
    part(block, ".goal-archived-count").textContent = old.length;
    part(block, ".goal-archived-list").replaceChildren(...old.map(buildArchived));
}

// One milestone step: a checkbox + its title.
function buildMilestone(step) {
    const li = copyTemplate(milestoneTemplate);
    li.dataset.stepId = step.id;
    li.querySelector(".milestone-check").checked = step.done;
    li.querySelector(".milestone-title").textContent = step.title;
    return li;
}

// ── One active habit: name (+ tag) + 🔥, "1 page · Every day · 05:30", this week, Archive ──
function buildHabit(habit, goal) {
    const li = copyTemplate(habitTemplate);
    li.dataset.habitId = habit.id;
    li.querySelector(".habit-item-title").textContent = habit.name;
    const time = habitTimes(habit.id) || "Anytime";
    li.querySelector(".habit-item-detail").textContent = `${describeHabitAmount(habit)} · ${describeDays(habit.days)} · ${time}`;
    li.querySelector(".habit-item-tag").hidden = !countsTowardGoal(habit, goal);

    // 🔥 its own streak (insight.js). Hidden at 0: no "🔥 0" shaming.
    const streak = getHabitStreak(habit);
    li.querySelector(".habit-streak").hidden = streak === 0;
    li.querySelector(".habit-streak-count").textContent = streak;
    li.querySelector(".habit-streak").setAttribute("aria-label", `${streak} days in a row`);

    // This week: 7 dots + "4 / 5"
    const week = getHabitWeek(habit);
    const dots = week.days.map(day => {
        const dot = document.createElement("li");
        dot.className = `habit-dot is-${day.state}`;
        return dot;
    });
    li.querySelector(".habit-dots").replaceChildren(...dots);
    li.querySelector(".habit-week-count").textContent = `${week.done} / ${week.due} this week`;
    li.querySelector("[data-action='archive']").setAttribute("aria-label", `Archive ${habit.name}`);
    return li;
}

// ── One archived habit: name + Restore ──
function buildArchived(habit) {
    const li = copyTemplate(archivedTemplate);
    li.dataset.habitId = habit.id;
    li.querySelector(".habit-item-title").textContent = habit.name;
    li.querySelector(".habit-item-detail").textContent = `${describeHabitAmount(habit)} · ${describeDays(habit.days)}`;
    li.querySelector("[data-action='restore']").setAttribute("aria-label", `Restore ${habit.name}`);
    return li;
}

// ── One line of "My week" ──
function buildWeekItem(item) {
    const li = copyTemplate(weekItemTemplate);
    if (item.kind === "habit") li.classList.add("is-habit");
    li.querySelector(".week-item-time").textContent = item.time || "Any";
    li.querySelector(".week-item-icon").textContent = WEEK_ICONS[item.kind] || WEEK_ICONS.activity;
    li.querySelector(".week-item-label").textContent = item.label;
    return li;
}

// ── My week: white chip on the chosen day, then that day's list ──
function renderWeek() {
    weekChips.querySelectorAll("[data-day]").forEach(chip => {
        chip.setAttribute("aria-pressed", chip.dataset.day === selectedDay);
    });
    const items = getWeekdayPlan(selectedDay);
    weekList.replaceChildren(...items.map(buildWeekItem));
    weekEmpty.hidden = items.length > 0;
}

// ── Coming up: every one-day item in the next 30 days ──
function renderUpcoming() {
    const items = getUpcomingItems(30);
    upcomingList.replaceChildren(...items.map(buildUpcoming));
    upcomingEmpty.hidden = items.length > 0;
}

function buildUpcoming(item) {
    const li = copyTemplate(upcomingTemplate);
    li.dataset.itemId = item.id;
    li.querySelector(".upcoming-when").textContent = `${describeUpcomingDay(item.date)} ${item.time}`;
    li.querySelector(".upcoming-label").textContent = item.label;
    const note = li.querySelector(".upcoming-note");
    note.textContent = item.note || "";
    note.hidden = !item.note;
    return li;
}

// ── Redraw everything ──
function updatePage() {
    renderDirection();
    renderGoals();
    renderWeek();
    renderUpcoming();
}


/* ════════════════════ 7. ACTIONS ════════════════════ */

// Archive: hidden from Today, history kept, can come back.
function archive(habitId) {
    const habit = getHabitById(habitId);
    if (!habit) return;
    if (!confirm(`Archive "${habit.name}"?\n\nIt leaves Today, but its history stays. You can restore it any time.`)) return;
    archiveHabit(habitId);
    updatePage();
    showToast(`${habit.name} archived`);
}

// Restore: back on Today with its old times. (No habit limit any more.)
function restore(habitId) {
    const habit = getHabitById(habitId);
    if (!habit) return;
    restoreHabit(habitId);
    updatePage();
    showToast(`${habit.name} is back on Today`);
}

// Tick / untick a milestone step → that goal's bar and "2 / 4 steps" update.
function tickMilestone(goalId, stepId) {
    const updated = toggleMilestone(goalId, stepId);
    if (!updated) return;
    updatePage();
    const step = updated.milestones.find(item => item.id === stepId);
    showToast(step.done ? `"${step.title}" done` : `"${step.title}" not done`);
}

// ⋯ → Make it my main goal: it moves to the top (and to Today's first place).
function makeMain(goalId) {
    const goal = getGoalById(goalId);
    if (!goal) return;
    setMainGoal(goalId);
    updatePage();
    showToast(`"${goal.title}" is your main goal`);
}

// ⋯ → Close this goal: it gets the "done" sticker, its habits go to the archive.
// A place frees up for a new goal. All history stays.
function closeGoal(goalId) {
    const goal = getGoalById(goalId);
    if (!goal) return;
    if (!confirm(`Close "${goal.title}"?\n\nIts habits leave Today and go to the archive. All your history stays.`)) return;
    finishGoal(goalId);
    updatePage();
    showToast(`"${goal.title}" closed`);
}

// The schedule sheet (item-sheet.js) calls this after Save / Remove.
function afterItemChange(message) {
    updatePage();
    showToast(message);
}

// A day chip: show that weekday.
function chooseDay(day) {
    selectedDay = day;
    renderWeek();
}

function showToast(message) {
    toastText.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, TOAST_MS);
}


/* ════════════════════ 8. PAGE LOAD ════════════════════ */

if (planReady) {
    updatePage();
}


/* ════════════════════ 9. EVENTS ════════════════════
   All at the top level. Lists use event delegation (one listener each). */

// Every button in every goal block: one listener. data-action says what to do,
// the closest [data-goal-id] / [data-habit-id] says on WHICH goal / habit.
goalList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const goalId = button.closest("[data-goal-id]").dataset.goalId;
    const habitRow = button.closest("[data-habit-id]");
    const action = button.dataset.action;

    button.closest(".goal-menu")?.removeAttribute("open");   // close the ⋯ menu after a choice

    if (action === "archive") archive(habitRow.dataset.habitId);
    if (action === "restore") restore(habitRow.dataset.habitId);
    if (action === "make-main") makeMain(goalId);
    if (action === "close-goal") closeGoal(goalId);
});

// "change" (not "click"): a checkbox changes by click, Space key or a screen reader.
goalList.addEventListener("change", (event) => {
    const step = event.target.closest("[data-step-id]");
    if (!step) return;
    tickMilestone(step.closest("[data-goal-id]").dataset.goalId, step.dataset.stepId);
});

// Click anywhere else → any open ⋯ menu closes.
document.addEventListener("click", (event) => {
    document.querySelectorAll(".goal-menu[open]").forEach(menu => {
        if (!menu.contains(event.target)) menu.removeAttribute("open");
    });
});

weekChips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-day]");
    if (chip) chooseDay(chip.dataset.day);
});

// Coming up: ＋ Add, or tap a row to change it (the shared schedule sheet)
upcomingAdd.addEventListener("click", () => openAddItem(afterItemChange));
upcomingList.addEventListener("click", (event) => {
    const line = event.target.closest("[data-item-id]");
    if (line) openEditItem(line.dataset.itemId, afterItemChange);
});