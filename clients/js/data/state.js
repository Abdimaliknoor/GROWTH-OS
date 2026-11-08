/* ╔══════════════════════════════════════════════════════════════╗
   ║  STATE  ·  js/data/state.js                                  ║
   ║  FACTS: read and save what the user told us.                 ║
   ╚══════════════════════════════════════════════════════════════╝

   THE RULES OF THIS FILE
     • Pages NEVER touch localStorage. They call the functions here.
     • This file only reads and SAVES facts (goals, habits, logs…).
     • Anything CALCULATED from the facts (today's plan, progress, pace)
       lives in insight.js, and never saves anything.
     • Load order on every page: storage.js → state.js → insight.js → the page.

   HOW THE DATA FITS TOGETHER
     profile ─── who you are, your direction
     goals ───── the finish lines
       └─ habits ──────── habit.goalId → goal
            ├─ routine ─── item.habitId → habit     (WHEN)
            ├─ logs ────── log.habitId → habit      (WHAT you did)
            └─ focusSessions ── session.habitId → habit
     journal ─── your own written entries (by date)
     notes ───── things to keep (note.folder → your goal or a habit, or none)

   MAP OF THIS FILE
      1. Shape of a new user ..... emptyData
      1b. Upgrade old data ....... DATA_VERSION, upgradeData
      2. Read / reset ............ getData, resetUser
      3. Dates and words ......... generateId, todayDate, weekdayOf, dateOf,
                                   addDaysTo, describeDays, describeHabitAmount
      4. Save into ANY list ...... saveItem, removeItem
      5. Profile ................. name, direction
      6. Onboarding .............. step, complete
      6b. Tips ................... hasSeenTip, markTipSeen, showTipAgain
      7. Goals ................... colours, limit, active / main, save, setMain, finish, milestones
      8. Habits .................. startBreak / endBreak, get, save, replaceGoalHabits, archive / restore
      9. Routine ................. get, day, add / update / remove, replaceRoutinePlan
     10. Logs .................... addLog, setDayAmount, skipHabit
     11. Focus sessions .......... start, pause, resume, stop, finish, cancel
     12. Journal ................. get, add, update, delete
     13. Notes ................... get, add, update, pin, delete
     14. Backup .................. export, read file, restore, undo
   ══════════════════════════════════════════════════════════════════ */


/* ════════════════════ 1. THE SHAPE OF A NEW USER ════════════════════ */

// Each list is like a database table. Each item in it has an id.
function emptyData() {
    return {
        version: DATA_VERSION,                            // which shape this data has (see 1b)
        profile: { name: "", area: "", areaLabel: "", identity: "" },
        onboarding: { step: 1, completed: false },
        goals: [],                                        // the finish lines
        habits: [],                                       // daily amounts           (habit.goalId → goal)
        routine: [],                                      // WHEN things happen      (item.habitId → habit)
        logs: [],                                         // what was actually done  (log.habitId → habit)
        focusSessions: [],                                // focus timers            (session.habitId → habit)
        journal: [],                                      // your own written entries
        notes: [],                                        // things to keep
        tips: []                                          // first-time tips already closed: ["today"]
    };
}


/* ════════════════════ 1b. UPGRADE OLD DATA ════════════════════
   When the SHAPE of the data changes, old users' data must still fit.
   Each step upgrades one version to the next. It runs on every read,
   so a phone with old data (or an old backup file) just works.

     v1 → v2   multiple goals: each goal gets a colour and an order
               (your first goal becomes the main one: order 0) */

const DATA_VERSION = 2;

function upgradeData(data) {
    if ((data.version || 1) < 2) {
        const byAge = [...data.goals].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        data.goals = data.goals.map(goal => ({
            ...goal,
            color: goal.color || GOAL_COLORS[byAge.indexOf(goal) % GOAL_COLORS.length],
            order: goal.order ?? byAge.indexOf(goal)
        }));
        data.version = 2;
    }
    // Next change: if (data.version < 3) { … data.version = 3; }
    return data;
}


/* ════════════════════ 2. READ AND RESET EVERYTHING ════════════════════ */

// Everything saved, as one object. Missing parts get their defaults,
// so an older user (saved before "journal" existed) still gets journal: [].
function getData() {
    const saved = readStorage();
    if (!saved) return emptyData();
    return upgradeData({ ...emptyData(), ...saved });
}

// Start over: a brand-new, empty user.
function resetUser() {
    writeStorage(emptyData());
}


/* ════════════════════ 3. DATES AND WORDS (small helpers) ════════════════════ */

// ── Ids ──
// "habit-1760000000000-4821": the time + a random number, so two ids never match.
function generateId(prefix) {
    return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}

// ── Days of the week ──
const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];
const WEEKEND = ["sat", "sun"];

// ── Dates (always LOCAL time, never UTC) ──

// Today as "2026-10-09". (toISOString would give the UTC date: wrong after 21:00 in Nairobi.)
function todayDate() {
    return dateOf(Date.now());
}

// A timestamp → its local date.   1760000000000 → "2025-10-09"
function dateOf(timestamp) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2026-10-09" → "fri"
function weekdayOf(date) {
    const [year, month, day] = date.split("-").map(Number);
    const sundayFirst = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];   // getDay(): 0 = Sunday
    return sundayFirst[new Date(year, month - 1, day).getDay()];
}

// "2026-10-10" + (-3) → "2026-10-07". Handles month ends: "2026-10-31" + 1 → "2026-11-01".
function addDaysTo(date, amount) {
    const [year, month, day] = date.split("-").map(Number);
    return dateOf(new Date(year, month - 1, day + amount).getTime());
}

// ── Words ──

// ["mon","wed"] → "Mon, Wed"     (or "Every day" / "Weekdays" / "Weekends")
function describeDays(days) {
    const same = list => days.length === list.length && list.every(d => days.includes(d));
    if (same(WEEK_DAYS)) return "Every day";
    if (same(WEEKDAYS)) return "Weekdays";
    if (same(WEEKEND)) return "Weekends";
    return WEEK_DAYS.filter(d => days.includes(d))
        .map(d => d[0].toUpperCase() + d.slice(1))
        .join(", ");
}

// { target: 1, unit: "pages" } → "1 pages"     a done/not-done habit → "Done"
function describeHabitAmount(habit) {
    if (habit.type === "completion") return "Done";
    return `${habit.target} ${habit.unit}`.trim();
}


/* ════════════════════ 4. SAVE INTO ANY LIST ════════════════════
   The two functions every section below uses.
   listName = "goals", "habits", "routine", "logs", "focusSessions", "journal" or "notes". */

// Add the item, or replace the one with the same id.
//   saveItem("habits", { id: "h1", … })   new id → added   ·   known id → replaced
function saveItem(listName, item) {
    if (!item || !item.id) throw new Error(`saveItem("${listName}"): item needs an id`);
    const data = getData();
    const list = data[listName];
    const index = list.findIndex(existing => existing.id === item.id);
    if (index === -1) list.push(item);           // new   → add at the end
    else list[index] = item;                     // known → replace in place
    writeStorage(data);
}

// Remove the item with this id.   removeItem("journal", "journal-…")
function removeItem(listName, id) {
    const data = getData();
    data[listName] = data[listName].filter(item => item.id !== id);
    writeStorage(data);
}


/* ════════════════════ 5. PROFILE ════════════════════ */

function getProfile() {
    return getData().profile;
}

// ── Name ──
function getName() {
    return getProfile().name;
}

function saveName(name) {
    const data = getData();
    data.profile.name = name;
    writeStorage(data);
}

// ── Direction: the area of life + "I am someone who…" ──
function getDirection() {
    const { area, areaLabel, identity } = getProfile();
    return { area, areaLabel, identity };
}

function saveDirection({ area, areaLabel, identity }) {
    const data = getData();
    data.profile = { ...data.profile, area, areaLabel, identity };
    writeStorage(data);
}


/* ════════════════════ 6. ONBOARDING ════════════════════ */

// Which step the user reached (so they can continue later).
function getCurrentStep() {
    return getData().onboarding.step;
}

function setCurrentStep(step) {
    const data = getData();
    data.onboarding.step = step;
    writeStorage(data);
}

// Finished setup → the app pages open (their Guard checks this).
function completeOnboarding() {
    const data = getData();
    data.onboarding.completed = true;
    writeStorage(data);
}

function isOnboardingComplete() {
    return getData().onboarding.completed;
}


/* ════════════════════ 6b. TIPS (first-time help) ════════════════════ */

// The ids of the tips the user closed with "Got it", like ["today"].
// One list for every tip, so Journal or Plan can get their own later.
function hasSeenTip(tipId) {
    const tips = getData().tips;
    return Array.isArray(tips) && tips.includes(tipId);   // a damaged backup can't break Today
}

function markTipSeen(tipId) {
    const data = getData();
    if (!Array.isArray(data.tips)) data.tips = [];
    if (!data.tips.includes(tipId)) data.tips.push(tipId);
    writeStorage(data);
}

// The "?" button: forget it was closed, so it shows again.
function showTipAgain(tipId) {
    const data = getData();
    data.tips = Array.isArray(data.tips) ? data.tips.filter(id => id !== tipId) : [];
    writeStorage(data);
}


/* ════════════════════ 7. GOALS ════════════════════
   One goal: { id, title, measure, target, …,
               status: "active" | "done",
               color: "sky",          ← its colour everywhere (dots, bars, edges)
               order: 0 }             ← 0 = the MAIN goal, then 1, 2… */

// The colour names. CSS turns each into a real colour (--goal-sky…).
const GOAL_COLORS = ["sky", "violet", "pink", "lime", "sand", "teal"];

// Free plan: this many ACTIVE goals at once. Finished goals don't count.
// Pro (later) lifts it. The ONE place to change the number.
const GOAL_LIMIT = 3;

function getGoals() {
    return getData().goals;
}

// The goals you're working on now, main first.
function getActiveGoals() {
    return getGoals()
        .filter(goal => goal.status === "active")
        .sort((a, b) => a.order - b.order);
}

// The main goal = the first active one.  → the goal, or null
function getMainGoal() {
    return getActiveGoals()[0] || null;
}

// Old name, from when there was only one goal. Pages switch to
// getMainGoal / getActiveGoals step by step; until then this keeps them working.
function getActiveGoal() {
    return getMainGoal();
}

// Room for one more active goal?
function canAddGoal() {
    return getActiveGoals().length < GOAL_LIMIT;
}

// The first colour no active goal is using (so two goals never look the same).
function nextGoalColor() {
    const used = getActiveGoals().map(goal => goal.color);
    return GOAL_COLORS.find(color => !used.includes(color)) || GOAL_COLORS[0];
}

function getGoalById(id) {
    return getGoals().find(goal => goal.id === id) || null;
}

// Save a goal. Fields it doesn't bring are KEPT from the saved one,
// so editing the title never loses the goal's colour or order.
// A brand-new goal gets the next free colour and goes last.
function saveGoal(goal) {
    const saved = getGoalById(goal.id);
    const isNew = !saved;
    saveItem("goals", {
        ...saved,
        ...goal,
        color: goal.color || (saved && saved.color) || nextGoalColor(),
        order: goal.order ?? (saved ? saved.order : getActiveGoals().length)
    });
    return isNew;
}

// Make this the main goal: it moves to the top, the others keep their order.
function setMainGoal(goalId) {
    const data = getData();
    const others = data.goals
        .filter(goal => goal.id !== goalId && goal.status === "active")
        .sort((a, b) => a.order - b.order);
    const order = [goalId, ...others.map(goal => goal.id)];
    data.goals = data.goals.map(goal =>
        order.includes(goal.id) ? { ...goal, order: order.indexOf(goal.id) } : goal);
    writeStorage(data);
}

// Close a goal: it gets the "done" sticker, its habits go to the archive.
// Nothing is deleted: logs, focus sessions and journal stay for history.
//   finishGoal("goal-1") → Juz 30 is now { status: "done", finishedAt: … }
function finishGoal(goalId) {
    const data = getData();
    data.goals = data.goals.map(goal =>
        goal.id === goalId ? { ...goal, status: "done", finishedAt: Date.now() } : goal);
    data.habits = data.habits.map(habit =>
        habit.goalId === goalId && !habit.archived ? startBreak(habit) : habit);
    writeStorage(data);
}

// Tick (or untick) one milestone step of a goal.
//   toggleMilestone("goal-…", "step-…") → the updated goal
// Only the matching step flips (done ↔ not done); the others are copied as they are.
function toggleMilestone(goalId, stepId) {
    const goal = getGoalById(goalId);
    if (!goal) return null;
    const milestones = goal.milestones.map(step => step.id === stepId ? { ...step, done: !step.done } : step);
    const updated = { ...goal, milestones };
    saveGoal(updated);
    return updated;
}


/* ════════════════════ 8. HABITS ════════════════════
   archived: true = hidden from Today and Plan's list, but its history (logs) is kept.
   breaks: [{ from, to }] = WHEN it was archived, so past days stay fair (insight.js isDueOn). */

// ── Start / end a break: archived ↔ active, with the date written down ──  archived ↔ active, with the date written down.
function startBreak(habit) {
    return { ...habit, archived: true, breaks: [...(habit.breaks || []), { from: todayDate(), to: null }] };
}

function endBreak(habit) {
    const breaks = (habit.breaks || []).map(gap => gap.to === null ? { ...gap, to: todayDate() } : gap);
    return { ...habit, archived: false, breaks };
}

// ── Read ──
function getHabits() {
    return getData().habits;
}

function getHabitById(id) {
    return getHabits().find(habit => habit.id === id) || null;
}

// A goal's habits still in use (not archived).
function getHabitsForGoal(goalId) {
    return getHabits().filter(habit => habit.goalId === goalId && !habit.archived);
}

// A goal's archived habits (Plan's "Archived" list).
function getArchivedHabits(goalId) {
    return getHabits().filter(habit => habit.goalId === goalId && habit.archived);
}

// ── Save ──
function saveHabit(habit) {
    saveItem("habits", habit);
}

// The habit page: "this is now the full ACTIVE habit list for this goal".
// A habit missing from the new list:
//   has history (logs)  → ARCHIVED: hidden, its history stays, it can come back
//   never used          → deleted for good (nothing to keep)
// Habits already archived stay archived. Other goals' habits are not touched.
function replaceGoalHabits(goalId, habits) {
    const data = getData();
    const keptIds = habits.map(habit => habit.id);
    const usedIds = data.logs.map(log => log.habitId);

    const others = data.habits.filter(habit => habit.goalId !== goalId);
    const leaving = data.habits.filter(habit => habit.goalId === goalId && !keptIds.includes(habit.id));
    const toArchive = leaving
        .filter(habit => habit.archived || usedIds.includes(habit.id))
        .map(habit => habit.archived ? habit : startBreak(habit));

    data.habits = others.concat(habits, toArchive);

    // Routine items of DELETED habits go. Archived habits keep theirs (hidden until restored).
    const ids = data.habits.map(habit => habit.id);
    data.routine = data.routine.filter(item => item.kind !== "habit" || ids.includes(item.habitId));
    writeStorage(data);
}

// ── Archive / restore (flip one switch) ──

// Hide a habit from Today, keep its history.
function archiveHabit(id) {
    const habit = getHabitById(id);
    if (!habit) return null;
    if (habit.archived) return habit;
    const updated = startBreak(habit);
    saveHabit(updated);
    return updated;
}

// Bring it back: on Today again, with its old routine times.
function restoreHabit(id) {
    const habit = getHabitById(id);
    if (!habit) return null;
    if (!habit.archived) return habit;
    // Archived before breaks were recorded: we don't know when → the whole past is a break
    // (forgiving: it can't break your streak, it just doesn't count before today).
    const known = habit.breaks && habit.breaks.length ? habit : { ...habit, breaks: [{ from: "0000-01-01", to: null }] };
    const updated = endBreak(known);
    saveHabit(updated);
    return updated;
}


/* ════════════════════ 9. ROUTINE ════════════════════
   One item = one thing at one time:
     { id, kind: "wake",     label: "Wake up", time: "06:00", days: [...] }
     { id, kind: "habit",    habitId: "h1",    time: "05:30", days: [...] }
     { id, kind: "activity", label: "Class",   time: "08:00", days: WEEKDAYS }
     { id, kind: "activity", label: "Dentist", time: "15:00", days: [], date: "2026-10-20" }  ← only that day
     { id, kind: "sleep",    label: "Sleep",   time: "22:00", days: [...] } */

// ── Read ──
function getRoutine() {
    return getData().routine;
}

// One date's items, sorted by time.   "2026-10-09" → Friday's items
// An item with a date ("only today") shows on that date only; the others on their weekdays.
function getRoutineForDay(date) {
    const day = weekdayOf(date);
    return getRoutine()
        .filter(item => item.date ? item.date === date : item.days.includes(day))
        .sort((a, b) => a.time.localeCompare(b.time));
}

// ── Change ONE item (Today's "Add to my day" and tapping a marker) ──

// ADD one thing to your day.
//   every week: addRoutineItem({ label: "Class", time: "08:00", days: WEEKDAYS })
//   only once:  addRoutineItem({ label: "Dentist", time: "15:00", date: "2026-10-20" })
function addRoutineItem({ kind = "activity", label, time, days = [], date = null, habitId = null, note = "" }) {
    const item = { id: generateId("routine"), kind, habitId, label: label.trim(), time, days, date, note: note.trim() };
    saveItem("routine", item);
    return item;
}

// CHANGE one item.   updateRoutineItem(id, { time: "09:00" })
function updateRoutineItem(id, changes) {
    const item = getRoutine().find(entry => entry.id === id);
    if (!item) return null;
    const updated = { ...item, ...changes };
    saveItem("routine", updated);
    return updated;
}

// REMOVE one item.
function removeRoutineItem(id) {
    removeItem("routine", id);
}

// ── Save the routine PAGE (wake, sleep, habit times) ──

// The routine page only knows wake, sleep and your active habits' times.
// This replaces ONLY those, and KEEPS everything the page doesn't show:
//   activities (Class, Lunch…)  ·  "only today" items  ·  archived habits' times (for Restore)
//   replaceRoutinePlan([ {kind:"wake",…}, {kind:"habit",…}, {kind:"sleep",…} ])
function replaceRoutinePlan(items) {
    const data = getData();
    const archivedIds = data.habits.filter(habit => habit.archived).map(habit => habit.id);

    const kept = data.routine.filter(item =>
        item.kind === "activity"                                          // Class, Lunch…
        || item.date                                                      // "only today"
        || (item.kind === "habit" && archivedIds.includes(item.habitId))  // archived habit
    );
    data.routine = kept.concat(items);
    writeStorage(data);
}

// ⚠️ OLD: replaces the WHOLE routine (activities too). Only for tests / a full reset.
//    Pages should use replaceRoutinePlan (above) or the add / update / remove functions.
function saveRoutine(items) {
    if (!Array.isArray(items)) throw new Error("saveRoutine needs an array");
    const data = getData();
    data.routine = items;
    writeStorage(data);
}


/* ════════════════════ 10. LOGS (what really happened) ════════════════════
     One log = one record:
     { id, habitId, date: "2026-10-10", amount: 1, status: "done", source: "quick" }
     { id, habitId, date: "2026-10-10", amount: 0, status: "skipped", reason: "travel", source: "record" }
   source = HOW it was recorded:  "quick" (+ on Today) · "record" (the sheet) · "focus" (a session) */

function getLogs() {
    return getData().logs;
}

// +1: add progress.   addLog("h1", 1) → 1 page today.
// Returns the log, so the page can offer Undo: removeItem("logs", log.id).
function addLog(habitId, amount, date = todayDate(), source = "quick") {
    const log = { id: generateId("log"), habitId, amount, date, status: "done", source, createdAt: Date.now() };
    saveItem("logs", log);
    return log;
}

// Set a day's total to an EXACT number (the Record sheet, or untick).
// That day's logs for the habit are removed first, so 12 means 12, not "12 more".
function setDayAmount(habitId, amount, date = todayDate()) {
    const data = getData();
    data.logs = data.logs.filter(log => !(log.habitId === habitId && log.date === date));
    if (amount > 0) {
        data.logs.push({ id: generateId("log"), habitId, amount, date, status: "done", source: "record", createdAt: Date.now() });
    }
    writeStorage(data);
}

// Skip a day, with a reason ("sick", "travel"). That day's logs → one "skipped" log.
function skipHabit(habitId, reason, date = todayDate()) {
    const data = getData();
    data.logs = data.logs.filter(log => !(log.habitId === habitId && log.date === date));
    data.logs.push({ id: generateId("log"), habitId, amount: 0, date, status: "skipped", reason, source: "record", createdAt: Date.now() });
    writeStorage(data);
}


/* ════════════════════ 11. FOCUS SESSIONS ════════════════════
   We save TIMES (startedAt, pausedAt…), never "seconds so far".
   The clock is always worked out as now − startedAt − pauses (insight.js),
   so a reload or a locked phone can't break it. */

// ── Read ──

// All sessions, oldest first.
function getFocusSessions() {
    return getData().focusSessions;
}

// One session by its id, or null.
function getFocusById(id) {
    return getFocusSessions().find(session => session.id === id) || null;
}

// The session still going (Save/Skip not pressed yet). Only one at a time.
//   getActiveFocus() → { id: "focus-…", habitId: "h2", … }  or  null
function getActiveFocus() {
    return getFocusSessions().find(session => !session.savedAt) || null;
}

// Is THIS habit in focus right now, on this day?   getFocusFor("h2") → the session, or null
// While it is, the session owns the habit's numbers: Today sends you there instead of counting twice.
function getFocusFor(habitId, date = todayDate()) {
    const active = getActiveFocus();
    return active && active.habitId === habitId && active.date === date ? active : null;
}

// ── Change ──

// Start a new session NOW.   startFocus("h2", 25) → the new session
function startFocus(habitId, targetMin) {
    const session = {
        id: generateId("focus"),
        habitId,
        date: todayDate(),           // the day it counts for: the day it STARTED
        startedAt: Date.now(),       // a timestamp, e.g. 1760518800000
        targetMin,                   // 15 / 25 / 45
        pausedAt: null,              // a timestamp while paused, otherwise null
        pausedMs: 0,                 // all finished pauses, added up
        endedAt: null,               // set when you tap Finish
        amount: 0,                   // the − 7 pages + counter
        logId: null,                 // the log it created
        mood: null,                  // 1–5 from the finish sheet
        note: "",
        savedAt: null                // set on Save or Skip = the session is done
    };
    saveItem("focusSessions", session);
    return session;
}

// Change some fields and save.   updateFocus(id, { amount: 7 })
// "..." copies all the old fields first, then the changes overwrite just those.
function updateFocus(id, changes) {
    const session = getFocusById(id);
    if (!session) return null;
    const updated = { ...session, ...changes };
    saveItem("focusSessions", updated);
    return updated;
}

// Pause: remember WHEN the pause started (the clock freezes while pausedAt is set).
// Already paused or finished? Do nothing, so a double tap can't break it.
function pauseFocus(id) {
    const session = getFocusById(id);
    if (!session || session.pausedAt || session.endedAt) return session;
    return updateFocus(id, { pausedAt: Date.now() });
}

// Resume: add this pause's length to pausedMs, then clear pausedAt.
//   paused 10:00, resumed 10:02 → pausedMs grows by 120000 (2 min)
function resumeFocus(id) {
    const session = getFocusById(id);
    if (!session || !session.pausedAt) return session;
    return updateFocus(id, {
        pausedMs: session.pausedMs + (Date.now() - session.pausedAt),
        pausedAt: null
    });
}

// Finish tapped: freeze the clock (endedAt = now).
// Paused at that moment? Close the pause first, so it's counted.
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
// amount 0 → nothing logged, but the session still closes.
// The log goes on the day the session STARTED, even if you finish after midnight.
function finishFocus(id, { amount, mood = null, note = "" }) {
    let session = getFocusById(id);
    if (!session || session.savedAt) return session;
    if (!session.endedAt) session = stopFocus(id);              // Save without Finish? Stop the clock first

    const log = amount > 0 ? addLog(session.habitId, amount, session.date, "focus") : null;
    return updateFocus(id, {
        amount,
        mood,
        note: note.trim(),
        logId: log ? log.id : null,
        savedAt: Date.now()
    });
}
// ••• on a focus entry in the Journal → "Remove reflection".
// The mood and note go; the minutes and pages STAY (they're your progress).
function removeFocusReflection(id) {
    return updateFocus(id, { mood: null, note: "" });
}

// ••• → "Undo this session": the session AND the pages it logged are removed.
// Progress goes down, so the page asks "Are you sure?" first.
function undoFocus(id) {
    const session = getFocusById(id);
    if (!session) return false;
    const data = getData();
    data.focusSessions = data.focusSessions.filter(item => item.id !== id);
    data.logs = data.logs.filter(log => log.id !== session.logId);
    writeStorage(data);
    return true;
}
// "Discard this session": delete it, nothing logged.
// Only while it's still open: a saved session has a log, and that's history now.
function cancelFocus(id) {
    const session = getFocusById(id);
    if (!session || session.savedAt) return false;
    removeItem("focusSessions", id);
    return true;
}


/* ════════════════════ 12. JOURNAL (your own written entries) ════════════════════
     One entry: { id, date: "2026-10-17", createdAt: 1760…, text: "Long day", mood: 4 or null, photos: ["photo-…"] }
   photos = ids only. The pictures themselves live in photos.js (IndexedDB): too big for here.
   Focus moods and skip reasons are NOT saved here: insight.js reads them from
   focusSessions and logs, and mixes them in (getJournal). */

// All your written entries, oldest first.
function getJournalEntries() {
    return getData().journal;
}

// ADD an entry, written right now.   addJournalEntry("Long day at uni", 4, ["photo-…"])
// No words AND no photos → nothing saved, returns null. (A photo alone is fine.)
function addJournalEntry(text, mood = null, photos = []) {
    if (!text.trim() && photos.length === 0) return null;

    const now = Date.now();
    const entry = {
        id: generateId("journal"),
        date: dateOf(now),              // which day: "2026-10-17"
        createdAt: now,                 // the exact moment: gives "21:02" and the order
        text: text.trim(),              // "  hi  " → "hi"
        mood,                            // 1–5, or null
        photos                           // array of photo IDs
    };
    saveItem("journal", entry);
    return entry;
}

// CHANGE the text or mood.   updateJournalEntry(id, { text: "New words" })
function updateJournalEntry(id, changes) {
    const entry = getJournalEntries().find(item => item.id === id);
    if (!entry) return null;
    const updated = { ...entry, ...changes };
    saveItem("journal", updated);
    return updated;
}

// DELETE an entry for good.
function deleteJournalEntry(id) {
    removeItem("journal", id);
}


/* ════════════════════ 13. NOTES (things to keep) ════════════════════
   One note:
     { id, title: "Hizb 12 · mistakes", text: "Page 3 keeps…",
       folder: { kind: "habit", id: "h2" }  or  { kind: "goal", id: "g1" }  or  null (none),
       pinned: false, photos: ["photo-…"], createdAt: 1761…, updatedAt: 1761… }
   A note is NOT tied to a day (that's the journal). updatedAt decides the order.
   Your goal and habits work as folders automatically. Folders you make yourself: later.
   ({ kind: "folder", id } will fit in the same field, so nothing has to change then.) */

// All notes, as saved (oldest first). Sorting and search live in insight.js.
function getNotes() {
    return getData().notes;
}

function getNoteById(id) {
    return getNotes().find(note => note.id === id) || null;
}

// A NEW note, empty, ready to type in.   addNote({ kind: "habit", id: "h2" })
// The page opens it straight away. If you leave it empty, the page deletes it.
function addNote(folder = null) {
    const now = Date.now();
    const note = { id: generateId("note"), title: "", text: "", folder, pinned: false, photos: [], createdAt: now, updatedAt: now };
    saveItem("notes", note);
    return note;
}

// Change any fields; updatedAt moves to NOW, so it jumps to the top of "Recent".
//   updateNote(id, { title: "Tajweed rules" })
function updateNote(id, changes) {
    const note = getNoteById(id);
    if (!note) return null;
    const updated = { ...note, ...changes, updatedAt: Date.now() };
    saveItem("notes", updated);
    return updated;
}

// 📌 on / off. Doesn't touch updatedAt: pinning isn't editing.
function togglePinNote(id) {
    const note = getNoteById(id);
    if (!note) return null;
    const updated = { ...note, pinned: !note.pinned };
    saveItem("notes", updated);
    return updated;
}

// Delete for good. Returns the note, so the page can delete its photos too (photos.js).
function deleteNote(id) {
    const note = getNoteById(id);
    removeItem("notes", id);
    return note;
}


/* ════════════════════ 14. BACKUP (save a copy / bring it back) ════════════════════
   Until accounts exist, your data lives on ONE phone. A backup is a file you keep.
   Photos are NOT in it (too big): they stay on the phone they were taken on.

   The file:  { app: "growth-os", version: 1, savedAt: "2026-10-30T10:15:00.000Z", data: { …everything… } } */

const BACKUP_APP = "growth-os";
const BACKUP_LISTS = ["goals", "habits", "routine", "logs", "focusSessions", "journal", "notes"];

// Everything, as the text of one file.  null, 2 = nicely indented, so a person can read it.
function exportData() {
    const data = getData();
    return JSON.stringify({ app: BACKUP_APP, version: data.version, savedAt: new Date().toISOString(), data }, null, 2);
}

// A file's text → its data, ONLY if it's really one of our backups.  Anything else → null.
// A file is a stranger: anyone can edit it in Notepad. So we check before we trust it.
function readBackupFile(text) {
    let file;
    try {
        file = JSON.parse(text);
    } catch {
        return null;                                         // not JSON at all
    }
    if (!file || file.app !== BACKUP_APP || !file.data || typeof file.data !== "object") return null;

    const data = upgradeData({ ...emptyData(), ...file.data });   // an old backup gets today's shape
    const listsOk = BACKUP_LISTS.every(name => Array.isArray(data[name]));
    const profileOk = Boolean(data.profile) && typeof data.profile === "object";
    return listsOk && profileOk ? { data, savedAt: file.savedAt || null } : null;
}

// Replace everything on this phone with the backup. What was here is kept once, for Undo.
function restoreData(data) {
    keepSafetyCopy(getData());
    writeStorage(data);
}

// Put back what was here before the last restore.  → true if there was something to put back
function undoRestore() {
    const before = readSafetyCopy();
    if (!before) return false;
    writeStorage(before);
    clearSafetyCopy();
    return true;
}

function canUndoRestore() {
    return readSafetyCopy() !== null;
}