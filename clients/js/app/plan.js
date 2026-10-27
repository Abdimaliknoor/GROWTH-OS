/* ╔══════════════════════════════════════════════════════════════╗
   ║  PLAN  ·  js/app/plan.js                                     ║
   ║  Shows your direction, goal, habits and week.                ║
   ╚══════════════════════════════════════════════════════════════╝

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

// ── Goal ──
const goalTitle = document.getElementById("goalTitle");
const goalFinish = document.getElementById("goalFinish");
const goalBar = document.getElementById("goalBar");
const goalBarFill = document.getElementById("goalBarFill");
const goalNumbers = document.getElementById("goalNumbers");
const goalDeadline = document.getElementById("goalDeadline");
const goalWhy = document.getElementById("goalWhy");
const goalPace = document.getElementById("goalPace");
const goalPaceIcon = document.getElementById("goalPaceIcon");
const goalPaceText = document.getElementById("goalPaceText");
const goalEnd = document.getElementById("goalEnd");
const goalEndIcon = document.getElementById("goalEndIcon");
const goalEndTitle = document.getElementById("goalEndTitle");
const goalEndHint = document.getElementById("goalEndHint");
const goalExtend = document.getElementById("goalExtend");
const newGoalButton = document.getElementById("newGoalButton");
const noGoal = document.getElementById("noGoal");
const planGoal = document.getElementById("planGoal");
const planHabits = document.getElementById("planHabits");
const milestoneList = document.getElementById("milestoneList");
//upcoming
const upcomingList = document.getElementById("upcomingList");
const upcomingEmpty = document.getElementById("upcomingEmpty");
const upcomingTemplate = document.getElementById("upcomingTemplate");
const upcomingAdd = document.getElementById("upcomingAdd");

// ── Habits + archived ──
const habitCount = document.getElementById("habitCount");
const habitList = document.getElementById("habitList");
const habitsEmpty = document.getElementById("habitsEmpty");
const addHabit = document.getElementById("addHabit");
const addHabitText = document.getElementById("addHabitText");
const addHabitLeft = document.getElementById("addHabitLeft");
const habitsFull = document.getElementById("habitsFull");
const archived = document.getElementById("archived");
const archivedCount = document.getElementById("archivedCount");
const archivedList = document.getElementById("archivedList");

// ── My week ──
const weekChips = document.getElementById("weekChips");
const weekList = document.getElementById("weekList");
const weekEmpty = document.getElementById("weekEmpty");

// ── Toast ──
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");

// ── Templates ──
const habitTemplate = document.getElementById("habitTemplate");
const weekItemTemplate = document.getElementById("weekItemTemplate");
const archivedTemplate = document.getElementById("archivedTemplate");
const milestoneTemplate = document.getElementById("milestoneTemplate");

/* ════════════════════ 3. SETTINGS ════════════════════ */

const MAX_HABITS = 5;            // active habits allowed (onboarding allows 3)
const TOAST_MS = 3000;
const WEEK_ICONS = { wake: "wb_sunny", sleep: "bedtime", activity: "event", habit: "radio_button_checked" };
const PACE_ICONS = { done: "celebration", start: "flag", ahead: "trending_up", behind: "warning" };

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
function habitTimes(habitId) {
    const times = getRoutine()
        .filter(item => item.kind === "habit" && item.habitId === habitId)
        .map(item => item.time);
    return [...new Set(times)].sort().join(" / ");
}
// Copy a <template>'s content so we can fill it in.
function copyTemplate(template) {
    return template.content.firstElementChild.cloneNode(true);
}
/* ════════════════════ 6. RENDERERS ════════════════════ */

// ── Direction: "QURAN" + "I am someone who…". Hidden if there's none. ──
function renderDirection() {
    const { areaLabel, identity } = getDirection();
    direction.hidden = !identity && !areaLabel;
    directionArea.textContent = areaLabel || "";
    directionIdentity.textContent = identity || "";
}
// ── Goal card ──
function renderGoal(goal) {
    const progress = getGoalProgress(goal);
    const unit = goal.measure === "milestones" ? "steps" : goal.measure === "consistency" ? "check-ins" : goal.unit;

    goalTitle.textContent = goal.title;
    goalFinish.textContent = describeFinish(goal);
    goalBarFill.style.width = progress.percent + "%";
    goalBar.setAttribute("aria-valuenow", progress.percent);
    goalNumbers.textContent = `${progress.done} / ${progress.target} ${unit} · ${progress.percent}%`;
    goalDeadline.textContent = describeDeadline(goal);
    goalWhy.textContent = goal.why ? `“${goal.why}”` : "";
    goalWhy.hidden = !goal.why;

    // On track? (total goals only)
    const pace = getGoalPace(goal);
    const sentence = describePace(goal, pace);
    goalPace.hidden = !sentence;
    goalPace.className = `goal-pace is-${pace.state}`;
    goalPaceIcon.textContent = PACE_ICONS[pace.state] || "";
    goalPaceText.textContent = sentence;

    // The end: reached 🎉 or the date has passed → offer the next goal
    renderGoalEnd(goal, progress);

    // Milestone goals: the steps, tickable
    milestoneList.hidden = goal.measure !== "milestones";
    milestoneList.replaceChildren(...goal.milestones.map(buildMilestone));
}

function renderGoalEnd(goal, progress) {
    const reached = goal.measure !== "consistency" && progress.percent >= 100;
    const daysLeft = getDaysLeft(goal);
    const datePassed = daysLeft !== null && daysLeft < 0;

    goalEnd.hidden = !reached && !datePassed;
    if (goalEnd.hidden) return;

    goalEnd.classList.toggle("is-reached", reached);
    goalExtend.hidden = reached;                     // reached: no need for more time
    if (reached) {
        goalEndIcon.textContent = "celebration";
        goalEndTitle.textContent = "You reached your goal";
        goalEndHint.textContent = "Close it and pick your next one. Your history stays.";
    } else {
        goalEndIcon.textContent = "event_busy";
        goalEndTitle.textContent = "The date has passed";
        goalEndHint.textContent = `You got to ${progress.percent}%. Give it more time, or close it and start fresh.`;
    }
}

// One milestone step: a checkbox + its title.
function buildMilestone(step) {
    const li = copyTemplate(milestoneTemplate);
    li.dataset.stepId = step.id;
    li.querySelector(".milestone-check").checked = step.done;
    li.querySelector(".milestone-title").textContent = step.title;
    return li;
}
// ── One active habit: name, "1 page · Every day · 05:30", tag, this week, Archive ──
function buildHabit(habit, goal) {
    const li = copyTemplate(habitTemplate);
    li.dataset.habitId = habit.id;
    li.querySelector(".habit-item-title").textContent = habit.name;
    const time = habitTimes(habit.id) || "Anytime";
    li.querySelector(".habit-item-detail").textContent = `${describeHabitAmount(habit)} · ${describeDays(habit.days)} · ${time}`;
    li.querySelector(".habit-item-tag").hidden = !countsTowardGoal(habit, goal);

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

// ── Habits + archived lists, and the counts ──
function renderHabits(goal) {
    const habits = getHabitsForGoal(goal.id);
    const old = getArchivedHabits(goal.id);

    habitList.replaceChildren(...habits.map(habit => buildHabit(habit, goal)));
    habitsEmpty.hidden = habits.length > 0;
    habitCount.textContent = `${habits.length} / ${MAX_HABITS}`;
    planCount.textContent = habits.length === 1 ? "1 habit" : `${habits.length} habits`;

    // "＋ Add a habit ……… 4 spots left"   ·   full → the "Archive one" hint instead
    const spots = MAX_HABITS - habits.length;
    addHabit.hidden = spots <= 0;
    habitsFull.hidden = spots > 0;s
    addHabitText.textContent = habits.length === 0 ? "Add your first habit" : "Add a habit";
    addHabitLeft.textContent = spots === 1 ? "1 spot left" : `${spots} spots left`;

    archivedList.replaceChildren(...old.map(buildArchived));
    archivedCount.textContent = old.length;
    archived.hidden = old.length === 0;
}
// ── One active habit: name, "1 page · Every day · 05:30", tag, this week, Archive ──
function buildHabit(habit, goal) {
    const li = copyTemplate(habitTemplate);
    li.dataset.habitId = habit.id;
    li.querySelector(".habit-item-title").textContent = habit.name;
    const time = habitTimes(habit.id) || "Anytime";
    li.querySelector(".habit-item-detail").textContent = `${describeHabitAmount(habit)} · ${describeDays(habit.days)} · ${time}`;
    li.querySelector(".habit-item-tag").hidden = !countsTowardGoal(habit, goal);

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

// ── Habits + archived lists, and the counts ──
function renderHabits(goal) {
    const habits = getHabitsForGoal(goal.id);
    const old = getArchivedHabits(goal.id);

    habitList.replaceChildren(...habits.map(habit => buildHabit(habit, goal)));
    habitsEmpty.hidden = habits.length > 0;
    habitCount.textContent = `${habits.length} / ${MAX_HABITS}`;
    planCount.textContent = habits.length === 1 ? "1 habit" : `${habits.length} habits`;

    archivedList.replaceChildren(...old.map(buildArchived));
    archivedCount.textContent = old.length;
    archived.hidden = old.length === 0;
}
// weekday plan: all routine items for that day, sorted by time. Habit items only if the habit still exists and is due.

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
   const goal = getActiveGoal();
    renderDirection();
    noGoal.hidden = !!goal;
    planGoal.hidden = !goal;
    planHabits.hidden = !goal;

    if (goal) {
        renderGoal(goal);
        renderHabits(goal);
    }
    renderWeek();
    renderUpcoming();
}
/* ════════════════════ 8. PAGE LOAD ════════════════════ */

if (planReady) {
    updatePage();
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
// Restore: back on Today with its old times. Not past the limit.
function restore(habitId) {
    const habit = getHabitById(habitId);
    if (!habit) return;
    if (getHabitsForGoal(habit.goalId).length >= MAX_HABITS) {
        showToast(`You have ${MAX_HABITS} habits. Archive one first.`);
        return;
    }
    restoreHabit(habitId);
    updatePage();
    showToast(`${habit.name} is back on Today`);
}
// Tick / untick a milestone step → the bar and "2 / 4 steps" update.
function tickMilestone(stepId) {
    const goal = getActiveGoal();
    const updated = toggleMilestone(goal.id, stepId);
    updatePage();
    const step = updated.milestones.find(item => item.id === stepId);
    showToast(step.done ? `"${step.title}" done` : `"${step.title}" not done`);
}
// Start a new goal: close this one (habits → archive), then fill in the next.
// goal.html?mode=edit finds no active goal, so it opens empty ("Your next goal").
function startNewGoal() {
    const goal = getActiveGoal();
    if (!goal) return;
    if (!confirm(`Close "${goal.title}" and start a new goal?\n\nIts habits go to the archive. All your history stays.`)) return;
    finishGoal(goal.id);
    window.location.href = "../startup/goal.html?mode=edit";
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

/* ════════════════════ 9. EVENTS ════════════════════
   All at the top level. Lists use event delegation (one listener each). */

habitList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='archive']");
    if (button) archive(button.closest("[data-habit-id]").dataset.habitId);
});

archivedList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='restore']");
    if (button) restore(button.closest("[data-habit-id]").dataset.habitId);
});

// "change" (not "click"): a checkbox changes by click, Space key or a screen reader.
milestoneList.addEventListener("change", (event) => {
    const step = event.target.closest("[data-step-id]");
    if (step) tickMilestone(step.dataset.stepId);
});

weekChips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-day]");
    if (chip) chooseDay(chip.dataset.day);
});

// "Start a new goal" in the end box
newGoalButton.addEventListener("click", startNewGoal);


// Coming up: ＋ Add, or tap a row to change it (the shared schedule sheet)
upcomingAdd.addEventListener("click", () => openAddItem(afterItemChange));
upcomingList.addEventListener("click", (event) => {
    const line = event.target.closest("[data-item-id]");
    if (line) openEditItem(line.dataset.itemId, afterItemChange);
});