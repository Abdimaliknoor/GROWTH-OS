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
        // Focus is its own lightweight daily-planning object — not derived
        // from goals[0]. It can optionally point at a goal via goalId, but
        // it always has its own title/next-action for today.
        focus: {
            goalId: null,
            title: "",
            nextAction: "",
            estimatedMinutes: null,
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
        return { id: "habit-" + index, name: item, detail: "", completed: false };
    }

    const detailParts = [];
    if (item.target && item.unit) detailParts.push(`${item.target} ${item.unit}`);
    if (item.frequency) detailParts.push(humanizeFrequency(item.frequency));

    return {
        id: item.id || "habit-" + index,
        name: item.name || item.title || humanizeHabitId(item.id),
        detail: detailParts.join(" · "),
        completed: !!item.completed
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

function toggleHabit(habitId) {
    const user = getUser();

    // Toggle "completed" directly on the raw saved objects so fields like
    // target/unit/frequency that aren't part of the display shape survive.
    const updatedRaw = user.habits.map((item, index) => {
        const itemId = typeof item === "string" ? "habit-" + index : item.id;
        if (itemId !== habitId) return item;

        if (typeof item === "string") {
            return { id: itemId, name: item, completed: true };
        }
        return { ...item, completed: !item.completed };
    });

    user.habits = updatedRaw;
    saveUser(user);
    return updatedRaw.map(normalizeHabit);
}

/* ------------------------------------------------------------
   ROUTINE
   ------------------------------------------------------------ */

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
   Focus answers "what deserves attention right now" — it is set
   deliberately by the user, not guessed from goals[0]. It can
   optionally reference a goal via goalId, but always carries its
   own title/nextAction. It resets each day: a focus set for a
   past date is treated as stale rather than shown as today's.
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

function setFocus({ goalId, title, nextAction, estimatedMinutes }) {
    const user = getUser();
    user.focus = {
        goalId: goalId || null,
        title: title || "",
        nextAction: nextAction || "",
        estimatedMinutes: estimatedMinutes || null,
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