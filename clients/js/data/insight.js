/* ╔══════════════════════════════════════════════════════════════╗
   ║  INSIGHT  ·  js/data/insight.js                              ║
   ║  Works things out from the facts in state.js.                ║
   ╚══════════════════════════════════════════════════════════════╝

   RULE   These functions only READ. They never save anything.
   LOAD   storage.js → state.js → insight.js → the page's script

   MAP
     1. Logs as totals      getDayAmount, getSkipReason
     2. Habit rules         isDueOn, getStep, getHabitStatus
     3. Days and plans      getDayPlan, getDaySummary, getUpcomingItems, getWeekdayPlan
     4. Goal progress       convertAmount, countsTowardGoal, getGoalProgress, getDaysLeft
     5. Week + streak       getStartDate, getDayResult, getWeek, getStreak
     6. Focus               getFocusElapsed, getFocusStage, getFocusMinutes
     7. Journal             getWriteEntries, getFocusEntries, getSkipEntries, getJournal
     8. Plan page           getHabitWeek, getGoalPace
   ══════════════════════════════════════════════════════════════════ */


/* ════════════════════ 1. LOGS AS TOTALS ════════════════════ */

// Total done on a day: logs of 7 and 3 → 10. Rounded so 0.1 + 0.2 shows 0.3.
function getDayAmount(habitId, date = todayDate()) {
    const total = getLogs()
        .filter(log => log.habitId === habitId && log.date === date && log.status !== "skipped")
        .reduce((sum, log) => sum + log.amount, 0);
    return Math.round(total * 100) / 100;
}

// The skip reason for that day, or null.
function getSkipReason(habitId, date = todayDate()) {
    const skip = getLogs().find(log => log.habitId === habitId && log.date === date && log.status === "skipped");
    return skip ? skip.reason : null;
}


/* ════════════════════ 2. HABIT RULES ════════════════════ */

// Planned for this date?   days ["mon","wed"] + a Monday → true
function isDueOn(habit, date = todayDate()) {
    return !habit.archived && habit.days.includes(weekdayOf(date));
}

// What one "+1" adds:  done/not → 1 · time → 5 min · amount → 1 (0.5 if the target is below 1)
function getStep(habit) {
    if (habit.type === "completion") return 1;
    if (habit.type === "time") return 5;
    return habit.target < 1 ? 0.5 : 1;
}

// "skipped" · "done" (target reached) · "partial" · "none"
function getHabitStatus(habit, date = todayDate()) {
    if (getSkipReason(habit.id, date)) return "skipped";
    const amount = getDayAmount(habit.id, date);
    if (amount >= habit.target) return "done";
    if (amount > 0) return "partial";
    return "none";
}


/* ════════════════════ 3. DAYS AND PLANS ════════════════════ */

// One date's timeline, in time order: wake, habits, activities, sleep.
// Habits with no time go just BEFORE Sleep ("Anytime").
//   → [ { kind: "wake", time: "06:00", label: "Wake up", note: "", habit: null },
//       { kind: "habit", time: "05:30", label: "Memorize new", habit, amount, status }, … ]
function getDayPlan(date = todayDate()) {
    const habits = getHabits().filter(habit => isDueOn(habit, date));

    // Routine items for that date (habit items only if the habit is still due).
    // Every field the page needs must be listed here: anything left out is lost.
    const items = getRoutineForDay(date)
        .filter(item => item.kind !== "habit" || habits.some(habit => habit.id === item.habitId))
        .map(item => ({ id: item.id, kind: item.kind, time: item.time, label: item.label, note: item.note || "", habitId: item.habitId }));

    // Due habits with no time → just before Sleep (or at the end if there's no Sleep)
    const anytime = habits
        .filter(habit => !items.some(item => item.habitId === habit.id))
        .map(habit => ({ kind: "habit", time: "", label: habit.name, note: "", habitId: habit.id }));
    const sleepIndex = items.findIndex(item => item.kind === "sleep");
    items.splice(sleepIndex === -1 ? items.length : sleepIndex, 0, ...anytime);

    // Each habit's live numbers
    return items.map(item => {
        if (item.kind !== "habit") return { ...item, habit: null };
        const habit = habits.find(h => h.id === item.habitId);
        return {
            ...item,
            label: habit.name,                       // the habit's current name wins
            habit,
            amount: getDayAmount(habit.id, date),
            status: getHabitStatus(habit, date),
            skipReason: getSkipReason(habit.id, date)
        };
    });
}

// "3 of 5 done". Skipped habits don't count as done.
function getDaySummary(date = todayDate()) {
    const habitItems = getDayPlan(date).filter(item => item.kind === "habit");
    return {
        done: habitItems.filter(item => item.status === "done").length,
        total: habitItems.length
    };
}

// One-day items AFTER today, soonest first. Repeating items are in "My week".
//   getUpcomingItems(7, 3) → Today      getUpcomingItems(30) → Plan
function getUpcomingItems(daysAhead, max = Infinity) {
    const today = todayDate();
    const last = addDaysTo(today, daysAhead);
    return getRoutine()
        .filter(item => item.date && item.date > today && item.date <= last)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .slice(0, max);
}

// "2026-10-27" → "Tomorrow"   ·   "2026-11-03" → "Tue 3 Nov"
function describeUpcomingDay(date) {
    if (date === addDaysTo(todayDate(), 1)) return "Tomorrow";
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day)
        .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
        .replace(",", "");
}

// A WEEKDAY's plan for Plan's "My week" ("every Monday", not one date).
// One-day items are left out: they belong to a date, not the week.
function getWeekdayPlan(day) {
    const habits = getHabits().filter(habit => !habit.archived && habit.days.includes(day));

    const items = getRoutine()
        .filter(item => !item.date && item.days.includes(day))
        .filter(item => item.kind !== "habit" || habits.some(habit => habit.id === item.habitId))
        .sort((a, b) => a.time.localeCompare(b.time))
        .map(item => ({
            id: item.id,
            kind: item.kind,
            time: item.time,
            habitId: item.habitId,
            label: item.kind === "habit" ? habits.find(habit => habit.id === item.habitId).name : item.label
        }));

    const anytime = habits
        .filter(habit => !items.some(item => item.habitId === habit.id))
        .map(habit => ({ id: null, kind: "habit", time: "", habitId: habit.id, label: habit.name }));
    const sleepIndex = items.findIndex(item => item.kind === "sleep");
    items.splice(sleepIndex === -1 ? items.length : sleepIndex, 0, ...anytime);
    return items;
}


/* ════════════════════ 4. GOAL PROGRESS ════════════════════ */

// Minutes in each time unit (keys in lower case).
const MINUTES_IN = { min: 1, mins: 1, minute: 1, minutes: 1, h: 60, hr: 60, hrs: 60, hour: 60, hours: 60 };

// convertAmount(127, "min", "hours") → 2.12 · (3, "pages", "pages") → 3 · (1, "pages", "hours") → null
function convertAmount(amount, fromUnit, toUnit) {
    const from = (fromUnit || "").trim().toLowerCase();
    const to = (toUnit || "").trim().toLowerCase();
    if (from === to) return amount;
    if (MINUTES_IN[from] && MINUTES_IN[to]) return amount * MINUTES_IN[from] / MINUTES_IN[to];
    return null;
}

// Does this habit add to the goal's number? Same goal, not unticked, unit converts.
function countsTowardGoal(habit, goal) {
    return habit.goalId === goal.id
        && habit.countsToGoal !== false
        && convertAmount(1, habit.unit, goal.unit) !== null;
}

// Progress → { done, target, percent }  (percent 0–100)
//   total       everything so far ÷ target        12 / 20 pages
//   level       best single day ÷ target          6 / 10 km
//   milestones  steps done ÷ all steps            2 / 4 steps
//   consistency check-ins ÷ planned, last 28 days 18 / 24
function getGoalProgress(goal) {
    const logs = getLogs().filter(log => log.status !== "skipped");

    // Counting habits and their units: { h1: "min", h2: "pages" }
    const unitOf = {};
    getHabits().filter(habit => countsTowardGoal(habit, goal)).forEach(habit => { unitOf[habit.id] = habit.unit; });

    // Their logs, each turned into the goal's unit (60 min → 1 hour)
    const counted = logs
        .filter(log => log.habitId in unitOf)
        .map(log => ({ date: log.date, amount: convertAmount(log.amount, unitOf[log.habitId], goal.unit) }));

    let done = 0;
    let target = 0;

    if (goal.measure === "total") {
        done = counted.reduce((sum, log) => sum + log.amount, 0);
        target = goal.target;
    } else if (goal.measure === "level") {
        const byDay = {};
        counted.forEach(log => { byDay[log.date] = (byDay[log.date] || 0) + log.amount; });
        done = Math.max(goal.current || 0, ...Object.values(byDay));
        target = goal.target;
    } else if (goal.measure === "milestones") {
        done = goal.milestones.filter(step => step.done).length;
        target = goal.milestones.length;
    } else {
        // consistency: every habit of the goal, only days since the goal began
        const goalHabits = getHabitsForGoal(goal.id);
        const start = dateOf(goal.createdAt);
        for (let back = 0; back < 28; back++) {
            const date = addDaysTo(todayDate(), -back);
            if (date < start) break;
            goalHabits.filter(habit => isDueOn(habit, date)).forEach(habit => {
                target++;
                if (getHabitStatus(habit, date) === "done") done++;
            });
        }
    }

    done = Math.round(done * 100) / 100;
    const percent = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
    return { done, target, percent };
}

// Days to the deadline: 0 = today, negative = passed, null = no deadline.
function getDaysLeft(goal) {
    if (!goal.deadline) return null;
    const [y1, m1, d1] = todayDate().split("-").map(Number);
    const [y2, m2, d2] = goal.deadline.split("-").map(Number);
    const ms = new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
    return Math.round(ms / 86400000);                // ms in a day
}


/* ════════════════════ 5. WEEK + STREAK ════════════════════ */

// The day you started: when your first habit was made.
function getStartDate() {
    const times = getHabits().map(habit => habit.createdAt).filter(Boolean);
    return times.length ? dateOf(Math.min(...times)) : todayDate();
}

// One day's result → { date, due, done, state }
//   state: done · partial · missed · none (today, not yet) · rest · before · future
// A skip is excused: it leaves the plan for that day, so it can't break the streak.
function getDayResult(date, start = getStartDate()) {
    const today = todayDate();
    const planned = getHabits().filter(habit => isDueOn(habit, date));
    const due = planned.filter(habit => date > today || getHabitStatus(habit, date) !== "skipped");
    const done = date > today ? 0 : due.filter(habit => getHabitStatus(habit, date) === "done").length;

    let state;
    if (date > today) state = "future";
    else if (date < start) state = "before";
    else if (due.length === 0) state = "rest";
    else if (done === due.length) state = "done";
    else if (done > 0) state = "partial";
    else state = date === today ? "none" : "missed";

    return { date, due: due.length, done, state };
}

// Monday → Sunday of the week with `date` in it.
function getWeek(date = todayDate()) {
    const monday = addDaysTo(date, -WEEK_DAYS.indexOf(weekdayOf(date)));
    const start = getStartDate();
    return WEEK_DAYS.map((_, i) => getDayResult(addDaysTo(monday, i), start));
}

// Days in a row with every planned habit done, counting back from today.
// Today unfinished doesn't break it. Rest days don't break or add. A missed past day ends it.
function getStreak() {
    const today = todayDate();
    const start = getStartDate();
    let streak = 0;
    let date = today;

    while (date >= start) {
        const result = getDayResult(date, start);
        if (result.state === "done") streak++;
        else if (result.state !== "rest" && date !== today) break;
        date = addDaysTo(date, -1);
    }
    return streak;
}


/* ════════════════════ 6. FOCUS ════════════════════ */

// Real focus time in ms: since the start, minus pauses.
function getFocusElapsed(session, now = Date.now()) {
    const end = session.endedAt || now;
    const pausedNow = session.pausedAt ? end - session.pausedAt : 0;
    return Math.max(0, end - session.startedAt - session.pausedMs - pausedNow);
}

// Which Focus screen: setup · running · paused · finishing · done (worked out, never saved)
function getFocusStage(session) {
    if (!session) return "setup";
    if (session.savedAt) return "done";
    if (session.endedAt) return "finishing";
    if (session.pausedAt) return "paused";
    return "running";
}

// Whole minutes to log, at least 1.   12 min 40 s → 13
function getFocusMinutes(session, now = Date.now()) {
    return Math.max(1, Math.round(getFocusElapsed(session, now) / 60000));
}


/* ════════════════════ 7. JOURNAL ════════════════════
   Three kinds of entries on one timeline:
     write  your own words   ·   focus  a session's mood + note   ·   skip  why you skipped
   Each function turns one list into the same card shape. */

function habitNameOf(habitId) {
    const habit = getHabitById(habitId);
    return habit ? habit.name : "Deleted habit";
}

function getWriteEntries() {
    return getJournalEntries().map(entry => ({
        kind: "write",
        id: entry.id,
        date: entry.date,
        time: entry.createdAt,
        text: entry.text,
        mood: entry.mood
    }));
}

// Finished sessions only
function getFocusEntries() {
    return getFocusSessions()
        .filter(session => session.savedAt)
        .map(session => {
            const habit = getHabitById(session.habitId);
            return {
                kind: "focus",
                id: session.id,
                date: session.date,
                time: session.startedAt,
                habitName: habitNameOf(session.habitId),
                minutes: getFocusMinutes(session),
                amount: session.amount,
                unit: habit ? habit.unit : "",
                mood: session.mood,
                note: session.note
            };
        });
}

// Skips have no time (null)
function getSkipEntries() {
    return getLogs()
        .filter(log => log.status === "skipped")
        .map(log => ({
            kind: "skip",
            id: log.id,
            date: log.date,
            time: null,
            habitName: habitNameOf(log.habitId),
            reason: log.reason
        }));
}

// All entries grouped by day, newest day first. Inside a day: timed first, skips last.
function getJournal() {
    const all = [...getWriteEntries(), ...getFocusEntries(), ...getSkipEntries()];

    const byDate = {};
    all.forEach(entry => {
        if (!byDate[entry.date]) byDate[entry.date] = [];
        byDate[entry.date].push(entry);
    });

    return Object.keys(byDate).sort().reverse().map(date => ({
        date,
        entries: byDate[date].sort((a, b) => {
            if (a.time === null) return 1;
            if (b.time === null) return -1;
            return a.time - b.time;
        })
    }));
}


/* ════════════════════ 8. PLAN PAGE ════════════════════ */

// One habit, Monday → Sunday → { days: [{ date, state }], done, due }
//   state: done · partial · skipped · missed · open (today) · future · off · before
function getHabitWeek(habit, date = todayDate()) {
    const today = todayDate();
    const monday = addDaysTo(date, -WEEK_DAYS.indexOf(weekdayOf(date)));
    const created = habit.createdAt ? dateOf(habit.createdAt) : "";
    let done = 0;
    let due = 0;

    const days = WEEK_DAYS.map((_, i) => {
        const day = addDaysTo(monday, i);
        if (!habit.days.includes(weekdayOf(day))) return { date: day, state: "off" };
        if (day < created) return { date: day, state: "before" };
        if (day > today) { due++; return { date: day, state: "future" }; }

        const status = getHabitStatus(habit, day);
        if (status === "skipped") return { date: day, state: "skipped" };
        due++;
        if (status === "done") { done++; return { date: day, state: "done" }; }
        if (status === "partial") return { date: day, state: "partial" };
        return { date: day, state: day === today ? "open" : "missed" };
    });
    return { days, done, due };
}

// Is a "total" goal on track? → { state, perDay, finishDate, needPerDay }
//   state: done · start (nothing logged) · ahead · behind · none (not a total goal)
function getGoalPace(goal) {
    if (goal.measure !== "total") return { state: "none" };
    const { done, target } = getGoalProgress(goal);
    if (done >= target) return { state: "done" };
    if (done === 0) return { state: "start" };

    // Days since the goal began (today counts, so at least 1)
    const [y1, m1, d1] = dateOf(goal.createdAt).split("-").map(Number);
    const [y2, m2, d2] = todayDate().split("-").map(Number);
    const daysSoFar = Math.max(1, Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000) + 1);

    const perDay = done / daysSoFar;
    const finishDate = addDaysTo(todayDate(), Math.ceil((target - done) / perDay));
    const daysLeft = getDaysLeft(goal);
    const needPerDay = daysLeft > 0 ? (target - done) / daysLeft : null;
    const state = !goal.deadline || finishDate <= goal.deadline ? "ahead" : "behind";

    return {
        state,
        perDay: Math.round(perDay * 10) / 10,
        finishDate,
        needPerDay: needPerDay && Math.ceil(needPerDay * 10) / 10
    };
}