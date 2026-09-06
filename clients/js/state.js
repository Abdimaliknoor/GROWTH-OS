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

function fillMissingFields(user) {
    const fresh = defaultUser();

    return {
        profile: { ...fresh.profile, ...user.profile },
        habits: user.habits || fresh.habits,
        routine: user.routine || fresh.routine,
        lifestyle: { ...fresh.lifestyle, ...user.lifestyle },
        goals: user.goals || fresh.goals,
        journal: user.journal || fresh.journal,
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

function normalizeHabit(item, index) {
    if (typeof item === "string") {
        return {
            id: "habit-" + index, name: item, detail: "",
            goalId: null, target: null, unit: "", frequency: "",
            todayAmount: 0, completedToday: false
        };
    }

    const detailParts = [];
    if (item.target && item.unit) detailParts.push(`${item.target} ${item.unit}`);
    if (item.frequency) detailParts.push(humanizeFrequency(item.frequency));

    const log = item.log || {};
    const todayAmount = log[todayDateString()] || 0;

    return {
        id: item.id || "habit-" + index,
        name: item.name || item.title || humanizeHabitId(item.id),
        detail: detailParts.join(" · "),
        goalId: item.goalId || null,
        target: typeof item.target === "number" ? item.target : null,
        unit: item.unit || "",
        frequency: item.frequency || "",
        todayAmount,
        completedToday: typeof item.target === "number" ? todayAmount >= item.target : false
    };
}

function normalizeRoutineItem(item, index) {
    if (typeof item === "string") {
        const parts = item.split(/\s+/);
        const looksLikeTime = /^\d{1,2}:\d{2}$/.test(parts[0]);
        return {
            id: "routine-" + index,
            time: looksLikeTime ? parts[0] : "",
            label: looksLikeTime ? parts.slice(1).join(" ") : item
        };
    }
    return {
        id: item.id || "routine-" + index,
        time: item.time || "",
        label: item.label || item.name || item.activity || "Untitled"
    };
}

function normalizeGoal(item, index) {
    if (typeof item === "string") {
        return { id: "goal-" + index, title: item, currentFocus: "", progress: null };
    }
    return {
        id: item.id || "goal-" + index,
        title: item.title || item.name || "Untitled goal",
        currentFocus: item.currentFocus || "",
        progress: typeof item.progress === "number" ? item.progress : null
    };
}

/* ------------------------------------------------------------
   PROFILE
   ------------------------------------------------------------ */

function getProfile() {
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

function getName() { return getUser().profile.name; }
function getIdentity() { return getUser().profile.identity; }

/* ------------------------------------------------------------
   HABITS
   ------------------------------------------------------------ */

function getHabits() {
    return getUser().habits.map(normalizeHabit);
}

function saveHabits(habits) {
    const user = getUser();
    user.habits = habits;
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
    return getHabits()
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

function saveRoutine(routine) {
    const user = getUser();
    user.routine = routine;
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
    const allHabits = getHabits();
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