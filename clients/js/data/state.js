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
        logs: [],                                    // what was actually done (log.habitId → habit)
        focusSessions: []  
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

/* ---------- 11. Focus sessions ---------- */

// All sessions, oldest first.
function getFocusSessions() {
    return getData().focusSessions;
}

// One session by its id, or null.
function getFocusById(id) {
    return getFocusSessions().find(session => session.id === id) || null;
}

// The session still going: not saved yet (no Save/Skip pressed). Only one at a time.
//   getActiveFocus() → { id: "focus-…", habitId: "h2", ... }  or  null
function getActiveFocus() {
    return getFocusSessions().find(session => !session.savedAt) || null;
}

// Start a new session NOW. We save the start TIME, never "seconds so far":
// the clock is always worked out as now − startedAt, so a reload or a locked phone can't break it.
//   startFocus("h2", 25) → the new session
function startFocus(habitId, targetMin) {
    const session = {
        id: generateId("focus"),
        habitId,
        date: todayDate(),           // the day it counts for: the day it STARTED
        startedAt: Date.now(),       // timestamp, e.g. 1760518800000
        targetMin,                   // 15 / 25 / 45
        pausedAt: null,              // a timestamp while paused, otherwise null
        pausedMs: 0,                 // all finished pauses, added up
        endedAt: null,               // set when you tap Finish
        amount: 0,                   // the − 7 pages + counter
        logId: null,                 // the log it created (Journal will link them later)
        mood: null,                  // 1–5 from the finish sheet
        note: "",
        savedAt: null                // set when you press Save or Skip = the session is done
    };
    saveItem("focusSessions", session);
    return session;
}
// Change some fields of a session and save it. Returns the updated session.
//   updateFocus(id, { amount: 7 }) → the session with amount 7
// The "..." copies all the old fields first, then the changes overwrite just those.
function updateFocus(id, changes) {
    const session = getFocusById(id);
    if (!session) return null;
    const updated = { ...session, ...changes };
    saveItem("focusSessions", updated);
    return updated;
}

// Pause: remember WHEN the pause started. The clock freezes because
// getFocusElapsed() subtracts "now − pausedAt" while pausedAt is set.
// Already paused or finished? Do nothing (a double tap can't break it).
function pauseFocus(id) {
    const session = getFocusById(id);
    if (!session || session.pausedAt || session.endedAt) return session;
    return updateFocus(id, { pausedAt: Date.now() });
}

// Resume: add this pause's length to pausedMs, then clear pausedAt.
//   paused at 10:00, resume at 10:02 → pausedMs grows by 120000 (2 min)
function resumeFocus(id) {
    const session = getFocusById(id);
    if (!session || !session.pausedAt) return session;
    return updateFocus(id, {
        pausedMs: session.pausedMs + (Date.now() - session.pausedAt),
        pausedAt: null
    });
}
// Finish tapped: freeze the clock (endedAt = now).
// Paused at that moment? Close the pause first, so it's counted in pausedMs.
// Already stopped? Do nothing.
function stopFocus(id) {
    const session = getFocusById(id);
    if (!session || session.endedAt) return session;
    const now = Date.now();
    const pausedMs = session.pausedAt ? session.pausedMs + (now - session.pausedAt) : session.pausedMs;
    return updateFocus(id, { pausedMs, pausedAt: null, endedAt: now });
}

// Save or Skip on the finish sheet: log the progress, keep the reflection, close the session.
//   finishFocus(id, { amount: 25, mood: 4, note: "Easy today" })   ← Save
//   finishFocus(id, { amount: 25 })                                ← Skip (no mood, no note)
// The amount is decided by the page: minutes for a time habit, pages for an amount habit, 1 for a tick.
// amount 0 → nothing to log, but the session is still closed.
// The log goes on the day the session STARTED (session.date), even if you finish after midnight.
function finishFocus(id, { amount, mood = null, note = "" }) {
    let session = getFocusById(id);
    if (!session || session.savedAt) return session;
    if (!session.endedAt) session = stopFocus(id);              // Save without Finish? Stop the clock first

    const log = amount > 0 ? addLog(session.habitId, amount, session.date) : null;
    return updateFocus(id, {
        amount,
        mood,
        note: note.trim(),
        logId: log ? log.id : null,
        savedAt: Date.now()
    });
}

// "Discard this session": delete it, nothing is logged.
// Only while it's still open: a saved session has a log, and that's history now.
function cancelFocus(id) {
    const session = getFocusById(id);
    if (!session || session.savedAt) return false;
    removeItem("focusSessions", id);
    return true;
}