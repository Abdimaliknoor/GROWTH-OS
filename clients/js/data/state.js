// state.js
// FACTS: read and save what the user told us (goals, habits, routine, logs).
// Pages never touch localStorage. They call these functions.
// Anything CALCULATED from the facts (today's plan, progress) lives in insights.js.


/* ---------- 1. The shape of a new user ---------- */

// Each list is like a database table. Each item has an id.
function emptyData() {
    return {
        version: 1,                                   // bump this when the shape changes
        profile: { name: "", area: "", areaLabel: "", identity: "" },
        onboarding: { step: 1, completed: false },
        goals: [],                                    // the finish lines
        habits: [],                                   // daily amounts (habit.goalId → goal)
        routine: [],                                  // when habits happen (item.habitId → habit)
        logs: []                                      // what was actually done (log.habitId → habit)
    };
}


/* ---------- 2. Read and save everything ---------- */

function getData() {
    const saved = readStorage();
    if (!saved) return emptyData();
    return { ...emptyData(), ...saved };              // missing parts get their defaults
}

function resetUser() {
    writeStorage(emptyData());
}


/* ---------- 3. Small helpers ---------- */

// "habit-1760000000000-4821": time + random, so two ids never match.
function generateId(prefix) {
    return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}

// Today as "2026-10-09", in LOCAL time (toISOString would give the UTC date).
function todayDate() {
    return dateOf(Date.now());
}

const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];
const WEEKEND = ["sat", "sun"];

// "2026-10-09" → "fri"
function weekdayOf(date) {
    const [year, month, day] = date.split("-").map(Number);
    const sundayFirst = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    return sundayFirst[new Date(year, month - 1, day).getDay()];
}

// A timestamp (Date.now()) → its LOCAL date: 1760000000000 → "2025-10-09"
function dateOf(timestamp) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2026-10-10" + (-3) → "2026-10-07". Uses local dates, handles month ends.
function addDaysTo(date, amount) {
    const [year, month, day] = date.split("-").map(Number);
    return dateOf(new Date(year, month - 1, day + amount).getTime());
}

// ["mon","wed"] → "Mon, Wed"   (or "Every day" / "Weekdays" / "Weekends")
function describeDays(days) {
    const same = list => days.length === list.length && list.every(d => days.includes(d));
    if (same(WEEK_DAYS)) return "Every day";
    if (same(WEEKDAYS)) return "Weekdays";
    if (same(WEEKEND)) return "Weekends";
    return WEEK_DAYS.filter(d => days.includes(d))
        .map(d => d[0].toUpperCase() + d.slice(1))
        .join(", ");
}

// { target: 1, unit: "pages" } → "1 pages"   ·   completion habit → "Done"
function describeHabitAmount(habit) {
    if (habit.type === "completion") return "Done";
    return `${habit.target} ${habit.unit}`.trim();
}


/* ---------- 4. One way to save into any list ---------- */

// Add the item, or replace the one with the same id.
function saveItem(listName, item) {
    if (!item || !item.id) throw new Error(`saveItem("${listName}"): item needs an id`);
    const data = getData();
    const list = data[listName];
    const index = list.findIndex(existing => existing.id === item.id);
    if (index === -1) list.push(item);       // new → add
    else list[index] = item;                 // known → replace
    writeStorage(data);
}

function removeItem(listName, id) {
    const data = getData();
    data[listName] = data[listName].filter(item => item.id !== id);
    writeStorage(data);
}


/* ---------- 5. Profile ---------- */

function getProfile() {
    return getData().profile;
}

function getName() {
    return getProfile().name;
}

function saveName(name) {
    const data = getData();
    data.profile.name = name;
    writeStorage(data);
}

function getDirection() {
    const { area, areaLabel, identity } = getProfile();
    return { area, areaLabel, identity };
}

function saveDirection({ area, areaLabel, identity }) {
    const data = getData();
    data.profile = { ...data.profile, area, areaLabel, identity };
    writeStorage(data);
}


/* ---------- 6. Onboarding ---------- */

function getCurrentStep() {
    return getData().onboarding.step;
}

function setCurrentStep(step) {
    const data = getData();
    data.onboarding.step = step;
    writeStorage(data);
}

function completeOnboarding() {
    const data = getData();
    data.onboarding.completed = true;
    writeStorage(data);
}

function isOnboardingComplete() {
    return getData().onboarding.completed;
}


/* ---------- 7. Goals ---------- */

function getGoals() {
    return getData().goals;
}

function getGoalById(id) {
    return getGoals().find(goal => goal.id === id) || null;
}

function saveGoal(goal) {
    saveItem("goals", goal);
}


/* ---------- 8. Habits ---------- */

function getHabits() {
    return getData().habits;
}

function getHabitById(id) {
    return getHabits().find(habit => habit.id === id) || null;
}

// A goal's habits that are still in use.
function getHabitsForGoal(goalId) {
    return getHabits().filter(habit => habit.goalId === goalId && !habit.archived);
}

function saveHabit(habit) {
    saveItem("habits", habit);
}

// Habit page: "this is now the full habit list for this goal".
function replaceGoalHabits(goalId, habits) {
    const data = getData();
    const otherGoals = data.habits.filter(habit => habit.goalId !== goalId);
    data.habits = otherGoals.concat(habits);

    // Routine items of removed habits must go too.
    const ids = data.habits.map(habit => habit.id);
    data.routine = data.routine.filter(item => item.kind !== "habit" || ids.includes(item.habitId));
    writeStorage(data);
}


/* ---------- 9. Routine ---------- */

function getRoutine() {
    return getData().routine;
}

// Routine page saves the whole list at once.
function saveRoutine(items) {
    if (!Array.isArray(items)) throw new Error("saveRoutine needs an array");
    const data = getData();
    data.routine = items;
    writeStorage(data);
}

// One day's items, sorted by time. "2026-10-09" → Friday's items.
function getRoutineForDay(date) {
    const day = weekdayOf(date);
    return getRoutine()
        .filter(item => item.days.includes(day))
        .sort((a, b) => a.time.localeCompare(b.time));
}


/* ---------- 10. Logs (the actual result) ---------- */

// A log = one record of what really happened.
//   { id, habitId, date: "2026-10-10", amount: 1, status: "done" }
//   { id, habitId, date: "2026-10-10", amount: 0, status: "skipped", reason: "travel" }
// Reading logs as totals ("how much today?") is a calculation, so it lives in insights.js.

function getLogs() {
    return getData().logs;
}

// Record progress: addLog("h1", 1) → 1 page today.
// Returns the log, so the page can offer "Undo" (removeItem("logs", log.id)).
function addLog(habitId, amount, date = todayDate()) {
    const log = { id: generateId("log"), habitId, amount, date, status: "done" };
    saveItem("logs", log);
    return log;
}

// Set a day's total to an exact number (Record sheet "fix it", or untick).
// Removes that day's logs for the habit, then saves one log with the new total.
function setDayAmount(habitId, amount, date = todayDate()) {
    const data = getData();
    data.logs = data.logs.filter(log => !(log.habitId === habitId && log.date === date));
    if (amount > 0) {
        data.logs.push({ id: generateId("log"), habitId, amount, date, status: "done" });
    }
    writeStorage(data);
}

// Skip a habit for a day, with a reason ("sick", "travel", "forgot").
// Same idea: that day's logs are replaced by one "skipped" log.
function skipHabit(habitId, reason, date = todayDate()) {
    const data = getData();
    data.logs = data.logs.filter(log => !(log.habitId === habitId && log.date === date));
    data.logs.push({ id: generateId("log"), habitId, amount: 0, date, status: "skipped", reason });
    writeStorage(data);
}