/* ============================================================
   STATE.JS
   All save / get / update logic for Growth OS lives in this
   one file. No other file should touch localStorage directly.
   ============================================================ */

const STORAGE_KEY = "growthOSUser";

/* ------------------------------------------------------------
   DEFAULT SHAPE
   ------------------------------------------------------------ */

function defaultUser() {
    return {
        profile: {
            name: "",
            area: "",        // "health", "money"... or "other"
            areaLabel: "",   // what we display: "Health & Fitness", or the user's own text
            identity: "",
            createdAt: Date.now()
        },
        habits: [],
        routine: [],
        lifestyle: {
            productiveTime: "",
            notifications: true,
            theme: "dark"
        },
        goals: [],
        journal: [],
        // Focus is today's execution session — a title plus the specific
        // habits being worked on right now (e.g. "Morning Training" ->
        // Running + Sprint). Recording progress happens against those
        // habits directly, from inside the Focus card.
        focus: {
            title: "",
            habitIds: [],
            date: "",
            completed: false
        },
        stats: {
            streak: 0,
            completedHabits: 0,
            totalDays: 0
        },
        onboarding: {
            currentStep: 1,
            completed: false
        },
        version: 1
    };
}
/* ------------------------------------------------------------
   CORE READ / WRITE
   ------------------------------------------------------------
   getUser() always returns a complete, safe object, even if an
   older save is missing newer fields (like "journal"). It fills
   in any gaps without touching the data that is already there.
   ------------------------------------------------------------ */

function getUser() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
        const user = defaultUser();
        saveUser(user);
        return user;
    }

    const parsed = JSON.parse(saved);
    const filled = fillMissingFields(parsed);
    return filled;
}

// Lists (goals, habits...) MUST be arrays, because every page calls
// .map / .filter / .push on them. If a list was saved wrong (one object
// instead of an array of objects), repair it here, once, for every page.
function toList(value) {
    if (Array.isArray(value)) return value;                  // correct: keep it
    if (value && typeof value === "object") return [value];  // one object → wrap it in a list
    return [];                                                // missing or broken → empty list
}

function fillMissingFields(user) {
    const fresh = defaultUser();

    return {
        profile: { ...fresh.profile, ...user.profile },
        habits: toList(user.habits),
        routine: toList(user.routine),
        lifestyle: { ...fresh.lifestyle, ...user.lifestyle },
        goals: toList(user.goals),
        journal: toList(user.journal),
        focus: { ...fresh.focus, ...user.focus },
        stats: { ...fresh.stats, ...user.stats },
        onboarding: { ...fresh.onboarding, ...user.onboarding },
        version: user.version || fresh.version
    };
}

function saveUser(user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function resetUser() {
    const user = defaultUser();
    saveUser(user);
    return user;
}

function clearUser() {
    localStorage.removeItem(STORAGE_KEY);
}

/* ------------------------------------------------------------
   NORMALIZERS
   ------------------------------------------------------------
   Onboarding may have saved habits/routine/goals as plain
   strings. These helpers turn either shape into one consistent
   object shape so the dashboard never has to guess.
   ------------------------------------------------------------ */

// Habits saved by onboarding look like {id, target, unit, frequency} —
// there is no human-readable name field, so one is built from the id.
const HABIT_LABELS = {
    run: "Run",
    quran: "Quran",
    deepwork: "Deep Work",
    reading: "Reading"
};

function humanizeHabitId(id) {
    if (!id) return "Untitled habit";
    if (HABIT_LABELS[id]) return HABIT_LABELS[id];
    const spaced = id.replace(/[-_]+/g, " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function humanizeFrequency(frequency) {
    if (!frequency) return "";
    if (frequency === "everyday") return "Every day";
    return frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

/* ---------- Days of the week ----------
   Stored as short lowercase names, always in this order.
   (Not numbers: "mon" is readable in localStorage and in a database.) */
const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];
const WEEKEND = ["sat", "sun"];

// Old onboarding saved "everyday" / "weekdays" / "weekends".
// Turn that into the new days array.
function frequencyToDays(frequency) {
    if (frequency === "weekdays") return WEEKDAYS.slice();
    if (frequency === "weekends") return WEEKEND.slice();
    return WEEK_DAYS.slice();   // everyday, custom or unknown → every day
}

// ["mon","wed","fri"] → "Mon, Wed, Fri". Used by Habit, Routine and Dashboard.
function describeDays(days) {
    const sameAs = (list) => days.length === list.length && list.every(day => days.includes(day));
    if (sameAs(WEEK_DAYS)) return "Every day";
    if (sameAs(WEEKDAYS)) return "Weekdays";
    if (sameAs(WEEKEND)) return "Weekends";
    return WEEK_DAYS
        .filter(day => days.includes(day))                      // keep Mon→Sun order
        .map(day => day.charAt(0).toUpperCase() + day.slice(1)) // "mon" → "Mon"
        .join(", ");
}

// A habit's daily amount as text: "1 pages", "30 min", or "Done" for completion habits.
function describeHabitAmount(habit) {
    if (habit.type === "completion") return "Done";
    return `${habit.target} ${habit.unit}`.trim();
}

// Takes a habit in ANY old or new shape and returns the CURRENT shape.
// Like normalizeGoal: every page reads habits through getHabits(),
// so no page has to worry about old saved data.
function normalizeHabit(item, index) {
    if (typeof item === "string") {
        item = { name: item };                 // very old saves were plain text
    }

    const TYPES = ["time", "quantity", "completion"];
    const target = typeof item.target === "number" ? item.target : null;

    // Old habits have no type: target 1 with no unit was a done/not-done habit.
    let type = TYPES.includes(item.type) ? item.type : "quantity";
    if (!item.type && target === 1 && !item.unit) type = "completion";

    const days = Array.isArray(item.days) && item.days.length
        ? WEEK_DAYS.filter(day => item.days.includes(day))      // clean + sorted
        : frequencyToDays(item.frequency);

    const log = item.log || {};
    const todayAmount = log[todayDateString()] || 0;

    const habit = {
        id: item.id || "habit-" + index,
        goalId: item.goalId || null,
        name: item.name || item.title || humanizeHabitId(item.id),
        type: type,
        target: type === "completion" ? 1 : target,
        unit: type === "completion" ? "" : (item.unit || ""),
        days: days,
        log: log,
        archived: !!item.archived,
        createdAt: item.createdAt || Date.now(),
        // Older fields the dashboard still reads:
        frequency: item.frequency || "",
        purpose: item.purpose || "",
        isBinary: type === "completion",
        todayAmount: todayAmount
    };
    habit.detail = `${describeHabitAmount(habit)} · ${describeDays(habit.days)}`;
    habit.completedToday = typeof habit.target === "number" ? todayAmount >= habit.target : false;
    return habit;
}
function normalizeRoutineItem(item, index) {
    if (typeof item === "string") {
        const parts = item.split(/\s+/);
        const looksLikeTime = /^\d{1,2}:\d{2}$/.test(parts[0]);
        return {
            id: "routine-" + index,
            time: looksLikeTime ? parts[0] : "",
            label: looksLikeTime ? parts.slice(1).join(" ") : item,
            habitId: null
        };
    }
    return {
        id: item.id || "routine-" + index,
        time: item.time || "",
        label: item.label || item.name || item.activity || "Untitled",
        habitId: item.habitId || null
    };
}

// Takes a goal in ANY old or new shape and returns the CURRENT shape.
// Every page reads goals through getGoals(), which runs this first,
// so no page ever has to worry about old saved data.
function normalizeGoal(item, index) {
    if (typeof item === "string") {
        item = { title: item };              // very old saves were plain text
    }
    const MEASURES = ["consistency", "total", "level", "milestones"];
    return {
        id: item.id || "goal-" + index,
        title: item.title || item.name || "Untitled goal",
        why: item.why || "",
        deadline: item.deadline || "",                       // "2027-03-31" or ""
        // Unknown or missing measure → the safe default. This line is
        // exactly what was missing and caused your crash.
        measure: MEASURES.includes(item.measure) ? item.measure : "consistency",
        target: typeof item.target === "number" ? item.target : null,
        unit: item.unit || "",
        current: typeof item.current === "number" ? item.current : null,   // "level" only
        milestones: Array.isArray(item.milestones) ? item.milestones : [], // [{ id, title, done }]
        area: item.area || "",
        createdAt: item.createdAt || Date.now(),
        // Older fields the dashboard still reads:
        currentFocus: item.currentFocus || "",
        progress: typeof item.progress === "number" ? item.progress : null
    };
}

/* ------------------------------------------------------------
   PROFILE
   ------------------------------------------------------------ */

function getProfile() {
    console.log(getUser().profile);
    return getUser().profile;
}


function saveName(name) {
    const user = getUser();      
    user.profile.name = name;
    saveUser(user);
}
function saveIdentity(identity) {
    const user = getUser();
    user.profile.identity = identity;
    saveUser(user);
}
function saveDirection({ area, areaLabel, identity }) {
    const user = getUser();
    user.profile.area = area;
    user.profile.areaLabel = areaLabel;
    user.profile.identity = identity;
    saveUser(user);
}

function getDirection() {
    const profile = getUser().profile;
    return { area: profile.area, areaLabel: profile.areaLabel, identity: profile.identity };
}

function getName() { return getUser().profile.name; }
function getIdentity() { return getUser().profile.identity; }

/* ------------------------------------------------------------
   HABITS
   ------------------------------------------------------------ */

function getHabits() {
    return getUser().habits.map(normalizeHabit);
}

// Most of the app should show only habits the user hasn't archived.
function getActiveHabits() {
    return getHabits().filter(function (habit) {
        return !habit.archived;
    });
}

// The Habits page uses this to show a small "Archived" section, so
// archiving never feels like the data is gone forever.
function getArchivedHabits() {
    return getHabits().filter(function (habit) {
        return habit.archived;
    });
}

function saveHabits(habits) {
    const user = getUser();
    user.habits = habits;
    saveUser(user);
}

// Makes a simple unique id, like "habit-1725500000000-4821". Date.now()
// alone isn't safe — two habits added in the same millisecond would get
// the exact same id — so a random number is added as a tiebreaker.
function generateId(prefix) {
    const randomPart = Math.floor(Math.random() * 100000);
    return prefix + "-" + Date.now() + "-" + randomPart;
}

// Adds a brand new habit to the list.
function addHabit(newHabit) {
    const user = getUser();
    user.habits.push(newHabit);
    saveUser(user);
}

// Changes some fields on an existing habit (name, target, unit, etc.)
// without touching the fields we don't pass in, like its logged history.
function updateHabit(habitId, changes) {
    const user = getUser();

    for (let i = 0; i < user.habits.length; i++) {
        const currentItem = user.habits[i];
        const currentId = typeof currentItem === "string" ? "habit-" + i : currentItem.id;

        if (currentId === habitId) {
            const updatedItem = Object.assign({}, currentItem, changes);
            user.habits[i] = updatedItem;
        }
    }

    saveUser(user);
}

// Hides a habit from the active list without losing its history —
// preferred over deleteHabit() for anything the user has already logged.
function archiveHabit(habitId) {
    updateHabit(habitId, { archived: true });
}

function restoreHabit(habitId) {
    updateHabit(habitId, { archived: false });
}

// Removes a habit from the list completely. Kept for cases where the
// user truly wants it gone (e.g. it was added by mistake), but the
// Habits page uses archiveHabit() by default so history isn't lost.
function deleteHabit(habitId) {
    const user = getUser();
    const habitsToKeep = [];

    for (let i = 0; i < user.habits.length; i++) {
        const currentItem = user.habits[i];
        const currentId = typeof currentItem === "string" ? "habit-" + i : currentItem.id;

        if (currentId !== habitId) {
            habitsToKeep.push(currentItem);
        }
    }

    user.habits = habitsToKeep;
    saveUser(user);
}

// Sets today's logged amount to an exact value instead of adding to it.
// Used for binary (complete / not-complete) habits, where clicking again
// should un-complete it rather than push the total higher.
function setTodayHabitAmount(habitId, amount) {
    const user = getUser();
    const today = todayDateString();

    const updatedRaw = user.habits.map((item, index) => {
        const itemId = typeof item === "string" ? "habit-" + index : item.id;
        if (itemId !== habitId) return item;

        const base = typeof item === "string" ? { id: itemId, name: item } : { ...item };
        const log = { ...(base.log || {}) };
        log[today] = amount;
        return { ...base, log };
    });

    user.habits = updatedRaw;
    saveUser(user);
}

// Adds `amount` to today's logged total for a habit (not overwrite —
// recording twice in a day accumulates, matching "7 pages, then 3 more").
function addHabitProgress(habitId, amount) {
    const user = getUser();
    const today = todayDateString();

    const updatedRaw = user.habits.map((item, index) => {
        const itemId = typeof item === "string" ? "habit-" + index : item.id;
        if (itemId !== habitId) return item;

        const base = typeof item === "string" ? { id: itemId, name: item } : { ...item };
        const log = { ...(base.log || {}) };
        log[today] = (log[today] || 0) + amount;
        return { ...base, log };
    });

    user.habits = updatedRaw;
    saveUser(user);
    return updatedRaw.map(normalizeHabit);
}

// How many days per week a habit is expected to occur, used to turn a
// per-day target into a weekly target for goal-progress math.
function frequencyDaysPerWeek(frequency) {
    if (frequency === "weekdays") return 5;
    if (frequency === "everyday") return 7;
    return 7; // unknown/custom frequency defaults to daily
}

function habitWeeklyTarget(habit) {
    if (typeof habit.target !== "number") return null;
    return habit.target * frequencyDaysPerWeek(habit.frequency);
}

// Sums a habit's raw log entries over the last `days` days (default: this
// week, including today).
function getHabitWeeklyTotal(habitId, days = 7) {
    const user = getUser();
    const rawHabit = user.habits.find((item, index) => {
        const itemId = typeof item === "string" ? "habit-" + index : item.id;
        return itemId === habitId;
    });
    if (!rawHabit || typeof rawHabit === "string" || !rawHabit.log) return 0;

    let total = 0;
    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        total += rawHabit.log[key] || 0;
    }
    return total;
}

// The real behavioral progress behind a goal: every habit linked to it,
// with how much was actually done this week vs. its weekly target.
// Habits can have different units, so this returns one row per habit
// rather than a single merged number.
function getGoalProgress(goalId) {
    return getActiveHabits()
        .filter(habit => habit.goalId === goalId)
        .map(habit => ({
            habitId: habit.id,
            name: habit.name,
            unit: habit.unit,
            weeklyTotal: getHabitWeeklyTotal(habit.id),
            weeklyTarget: habitWeeklyTarget(habit)
        }));
}


// A single completion percentage for a goal card's badge — the average
// of each linked habit's (weeklyTotal / weeklyTarget), so it's a real
// derived number, not an invented one. Returns null if no linked habit
// has a numeric target to measure against.
function getGoalCompletionPercent(goalId) {
    const measurable = getGoalProgress(goalId).filter(c => typeof c.weeklyTarget === "number" && c.weeklyTarget > 0);
    if (!measurable.length) return null;

    const avgRatio = measurable.reduce((sum, c) => sum + Math.min(1, c.weeklyTotal / c.weeklyTarget), 0) / measurable.length;
    return Math.round(avgRatio * 100);
}

function getRoutine() {
    return getUser().routine.map(normalizeRoutineItem);
}

// Same routine items, ordered by time — what the Routine page and
// dashboard both actually want to display.
function getSortedRoutine() {
    const routine = getRoutine();
    return routine.slice().sort(function (a, b) {
        if (a.time < b.time) return -1;
        if (a.time > b.time) return 1;
        return 0;
    });
}

function saveRoutine(routine) {
    const user = getUser();
    user.routine = routine;
    saveUser(user);
}

// Adds a new item to the day's routine.
function addRoutineItem(newItem) {
    const user = getUser();
    user.routine.push(newItem);
    saveUser(user);
}

// Changes some fields on an existing routine item.
function updateRoutineItem(routineId, changes) {
    const user = getUser();

    for (let i = 0; i < user.routine.length; i++) {
        const currentItem = user.routine[i];
        const currentId = typeof currentItem === "string" ? "routine-" + i : currentItem.id;

        if (currentId === routineId) {
            const updatedItem = Object.assign({}, currentItem, changes);
            user.routine[i] = updatedItem;
        }
    }

    saveUser(user);
}

// Routine items have no history attached to them (unlike habits), so
// removing one completely is safe — no archive step needed here.
function deleteRoutineItem(routineId) {
    const user = getUser();
    const itemsToKeep = [];

    for (let i = 0; i < user.routine.length; i++) {
        const currentItem = user.routine[i];
        const currentId = typeof currentItem === "string" ? "routine-" + i : currentItem.id;

        if (currentId !== routineId) {
            itemsToKeep.push(currentItem);
        }
    }

    user.routine = itemsToKeep;
    saveUser(user);
}

/* ------------------------------------------------------------
   LIFESTYLE
   ------------------------------------------------------------ */

function getLifestyle() { return getUser().lifestyle; }

function saveLifestyle(lifestyle) {
    const user = getUser();
    user.lifestyle = lifestyle;
    saveUser(user);
}

/* ------------------------------------------------------------
   GOALS
   ------------------------------------------------------------ */
   function replaceGoalHabits(goalId, habits) {
    const user = getUser();
    const otherHabits = user.habits.filter(habit => habit.goalId !== goalId);
    user.habits = otherHabits.concat(habits);
    saveUser(user);
}

function getHabitsForGoal(goalId) {
    return getHabits().filter(habit => habit.goalId === goalId && !habit.archived);
}

/* ------------------------------------------------------------
   GOALS
   ------------------------------------------------------------ */

function getGoals() {
    return getUser().goals.map(normalizeGoal);
}

function saveGoals(goals) {
    const user = getUser();
    user.goals = goals;
    saveUser(user);
}

/* ------------------------------------------------------------
   FOCUS
   ------------------------------------------------------------
   Focus is today's execution session: a title plus the specific
   habits being worked on right now — e.g. "Morning Training"
   containing Running + Sprint. It doesn't invent its own
   progress tracking; recording happens against the habits
   themselves (via addHabitProgress), so Focus is just "which
   habits am I executing in this session." It resets each day: a
   focus set for a past date is treated as stale.
   ------------------------------------------------------------ */

function todayDateString() {
    return new Date().toISOString().slice(0, 10);
}

function getFocus() {
    return getUser().focus;
}

// Returns the focus object only if it was set for today, otherwise null —
// this is what the dashboard should render from.
function getTodayFocus() {
    const focus = getFocus();
    return focus.date === todayDateString() ? focus : null;
}

function setFocus({ title, habitIds }) {
    const user = getUser();
    user.focus = {
        title: title || "",
        habitIds: Array.isArray(habitIds) ? habitIds : [],
        date: todayDateString(),
        completed: false
    };
    saveUser(user);
}

function completeFocus() {
    const user = getUser();
    if (user.focus.date === todayDateString()) {
        user.focus.completed = true;
        saveUser(user);
    }
}

// The full, normalized habit objects for today's focus session — this is
// what the Focus card actually renders and lets the user log progress
// against, one row per habit in the session.
function getTodayFocusHabits() {
    const focus = getTodayFocus();
    if (!focus) return [];
    const allHabits = getActiveHabits();
    return focus.habitIds
        .map(id => allHabits.find(h => h.id === id))
        .filter(Boolean);
}

/* ------------------------------------------------------------
   JOURNAL / REFLECTION
   ------------------------------------------------------------
   Kept intentionally small: an entry is just text plus a date.
   ------------------------------------------------------------ */

function getJournalEntries() {
    return getUser().journal;
}

function getLatestJournalEntry() {
    const entries = getJournalEntries();
    return entries.length ? entries[entries.length - 1] : null;
}

function addJournalEntry(text) {
    const user = getUser();
    user.journal.push({ text, date: Date.now() });
    saveUser(user);
}

/* ------------------------------------------------------------
   STATS
   ------------------------------------------------------------ */

function getStats() { return getUser().stats; }

function updateStats(fields) {
    const user = getUser();
    user.stats = { ...user.stats, ...fields };
    saveUser(user);
}

/* ------------------------------------------------------------
   ONBOARDING
   ------------------------------------------------------------ */

function setCurrentStep(step) {
    const user = getUser();
    user.onboarding.currentStep = step;
    saveUser(user);
}

function getCurrentStep() { return getUser().onboarding.currentStep; }

function completeOnboarding() {
    const user = getUser();
    user.onboarding.completed = true;
    saveUser(user);
}

function isOnboardingComplete() { return getUser().onboarding.completed; }

/* ------------------------------------------------------------
   GENERIC UPDATE
   ------------------------------------------------------------
   Updates a nested field by dot-path, e.g. updateUser("lifestyle.theme", "dark")
   ------------------------------------------------------------ */

function updateUser(path, value) {
    const user = getUser();
    const keys = path.split(".");

    keys.reduce((obj, key, index) => {
        if (index === keys.length - 1) {
            obj[key] = value;
        }
        return obj[key];
    }, user);

    saveUser(user);
}