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
          7. Journal             getWriteEntries, getFocusEntries, getSkipEntries, getRecordLines,
                            getJournalDayStats, getWriteStreak, getJournal
     8. Plan page           getHabitWeek, getGoalPace
     9. Progress page       getRange … getProgressSummary
    10. Notes               getNoteTitle, describeNoteFolder, getNoteFolders, getNoteList
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
// Due on that day? Only if the habit EXISTED then, wasn't on a break, and it's one of its weekdays.
// So adding a habit today never turns past days into "missed" (that used to break the streak).
function isDueOn(habit, date = todayDate()) {
    if (habit.createdAt && date < dateOf(habit.createdAt)) return false;   // not made yet
    if (isOnBreak(habit, date)) return false;                               // archived then
    return habit.days.includes(weekdayOf(date));
}

// breaks: [{ from: "2026-11-01", to: "2026-11-05" }]   to: null = still archived
// Older data: archived with no breaks → treat as off on every day (as before).
function isOnBreak(habit, date) {
    const breaks = habit.breaks || [];
    if (habit.archived && breaks.length === 0) return true;
    return breaks.some(gap => date >= gap.from && (gap.to === null || date < gap.to));
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
// goalId: only that goal's habits (Progress → each goal). null = all habits.
function getDayResult(date, start = getStartDate(), goalId = null) {
    const today = todayDate();
    const planned = getHabits().filter(habit => isDueOn(habit, date) && (!goalId || habit.goalId === goalId));
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

// ── Streaks. THE rules, in one place (Today, Progress and the calendar all use them) ──
//   🔥 main streak:  a day counts if you did AT LEAST ONE habit ("done" or "partial")
//      goal streak:  a day counts only if ALL that goal's habits were done ("done")
//   Both: rest days don't break or add · today unfinished doesn't break · a missed past day ends it.
function countsForStreak(state, strict = false) {
    return strict ? state === "done" : state === "done" || state === "partial";
}

function pausesStreak(state, date) {
    return state === "rest" || state === "before" || (date === todayDate() && state === "none");
}

// Days in a row, counting back from today.  getStreak() → main · getStreak("goal-1") → that goal's
function getStreak(goalId = null) {
    const start = getStartDate();
    const strict = goalId !== null;
    let streak = 0;
    let date = todayDate();

    while (date >= start) {
        const state = getDayResult(date, start, goalId).state;
        if (countsForStreak(state, strict)) streak++;
        else if (!pausesStreak(state, date)) break;
        date = addDaysTo(date, -1);
    }
    return streak;
}

// One habit's streak: days in a row it was done. Skipped days are excused (don't break or add).
function getHabitStreak(habit) {
    const start = getStartDate();
    let streak = 0;
    let date = todayDate();

    while (date >= start) {
        if (isDueOn(habit, date)) {
            const status = getHabitStatus(habit, date);
            if (status === "done") streak++;
            else if (status !== "skipped" && date !== todayDate()) break;
        }
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
   One day on the timeline:
     write   your own words (+ photos)   ·   focus   a session's mood + note
     skip    why you skipped             ·   records what you logged with + or the sheet (one line per habit)
   Plus a small summary on top: "3 of 4 habits · 25 min focus". */
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
        mood: entry.mood,
        photos: entry.photos || [] 
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
// What you logged WITHOUT focus (+1 on Today, or the record sheet), added up per habit per day.
// Focus logs are left out: the focus entry already shows them.
//   → { "2026-10-27": [ { habitName: "Memorize new", amount: 3, unit: "pages", tick: false } ] }
function getRecordLines() {
    const focusLogIds = getFocusSessions().map(session => session.logId);
    const byDate = {};
    getLogs()
        .filter(log => log.status === "done" && log.source !== "focus" && !focusLogIds.includes(log.id))
        .forEach(log => {
            if (!byDate[log.date]) byDate[log.date] = [];
            const line = byDate[log.date].find(item => item.habitId === log.habitId);
            if (line) { line.amount += log.amount; return; }
            const habit = getHabitById(log.habitId);
            byDate[log.date].push({
                habitId: log.habitId,
                habitName: habitNameOf(log.habitId),
                amount: log.amount,
                unit: habit ? habit.unit : "",
                tick: habit ? habit.type === "completion" : false
            });
        });
    return byDate;
}

// The small summary on top of a day: "3 of 4 habits · 25 min focus · Good"
//   habits null = nothing was due that day (a rest day)
function getJournalDayStats(date, entries) {
    const summary = getDaySummary(date);
    const focusMinutes = entries.filter(entry => entry.kind === "focus").reduce((sum, entry) => sum + entry.minutes, 0);
    const lastMood = entries.filter(entry => entry.kind === "write" && entry.mood).map(entry => entry.mood).at(-1) || null;
    return { habits: summary.total ? summary : null, focusMinutes, mood: lastMood };
}

// How many days in a row you WROTE something, up to today.
// Not written yet today? Counting from yesterday still keeps it alive (the day isn't over).
//   wrote Mon, Tue, Wed · today Wed → 3     ·     wrote Mon, Tue · today Wed → 2     ·     last Sun → 0
function getWriteStreak() {
    const written = new Set(getJournalEntries().map(entry => entry.date));
    let day = written.has(todayDate()) ? todayDate() : addDaysTo(todayDate(), -1);
    let streak = 0;
    while (written.has(day)) {
        streak++;
        day = addDaysTo(day, -1);
    }
    return streak;
}

// Every day that has something, newest first.
//   → [ { date, stats, entries: [timed first, skips last], records: [lines] } ]
function getJournal() {
    const all = [...getWriteEntries(), ...getFocusEntries(), ...getSkipEntries()];
    const records = getRecordLines();

    const byDate = {};
    all.forEach(entry => {
        if (!byDate[entry.date]) byDate[entry.date] = [];
        byDate[entry.date].push(entry);
    });
    Object.keys(records).forEach(date => { if (!byDate[date]) byDate[date] = []; });

    return Object.keys(byDate).sort().reverse().map(date => {
        const entries = byDate[date].sort((a, b) => {
            if (a.time === null) return 1;
            if (b.time === null) return -1;
            return a.time - b.time;
        });
        return { date, entries, records: records[date] || [], stats: getJournalDayStats(date, entries) };
    });
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


/* ════════════════════ 9. PROGRESS PAGE ════════════════════
   One function per question. Each takes a range { from, to } and returns plain data,
   so you can check every number in the console before drawing anything.

   DEFINITIONS (decided once, used everywhere)
     Showing up %    habits done ÷ habits planned (like Today's week card)
                     · skips are excused, rest days and days before you started don't count
                     · today counts once it's fully done
     Habit rate %    days the habit hit its target ÷ days it was due (from the day it was made)
     Best streak     longest run of fully done days (rest days don't break it)
     Focus time      saved sessions only */

     // "week" → Monday…today · "month" → the last 30 days · "all" → since you started
// Never before your start day.
function getRange(name) {
    const today = todayDate();
    const start = getStartDate();
    let from;
    if (name === "week") from = addDaysTo(today, -WEEK_DAYS.indexOf(weekdayOf(today)));
    else if (name === "month") from = addDaysTo(today, -29);
    else from = start;
    return { from: from < start ? start : from, to: today };
}


// The same number of days just BEFORE a range (for "↑ more than last month").
//   null if that's before you started.
function getPreviousRange({ from, to }) {
    const length = datesBetween(from, to).length;
    const prevTo = addDaysTo(from, -1);
    const prevFrom = addDaysTo(from, -length);
    return prevTo < getStartDate() ? null : { from: prevFrom, to: prevTo };
}
// ── First week: kind words, no red. Judging needs a few days of data. ──
const FIRST_WEEK_DAYS = 7;

// Day 1 = the day you started.  → 5 on your fifth day
function getDaysSinceStart() {
    return datesBetween(getStartDate(), todayDate()).length;
}

function isFirstWeek() {
    return getDaysSinceStart() <= FIRST_WEEK_DAYS;
}

// Every date from → to:  ("2026-10-26", "2026-10-28") → ["…26", "…27", "…28"]
function datesBetween(from, to) {
    const dates = [];
    for (let date = from; date <= to; date = addDaysTo(date, 1)) dates.push(date);
    return dates;
}
// Q2 · Am I showing up? Counted in HABITS, the same as Today's week card.
//   → { done: 11, planned: 15, percent: 73, days: [{ date, state, done, due }] }
// Today counts only once everything is done (the day isn't over).
function getConsistency({ from, to }) {
    const start = getStartDate();
    const days = datesBetween(from, to).map(date => getDayResult(date, start));
    const counted = days.filter(day => ["done", "partial", "missed"].includes(day.state));
    const done = counted.reduce((sum, day) => sum + day.done, 0);
    const planned = counted.reduce((sum, day) => sum + day.due, 0);
    const percent = planned ? Math.round((done / planned) * 100) : 0;
    return { done, planned, percent, days };
}

// The longest run of fully done days, ever.
function getBestStreak() {
    const today = todayDate();
    const start = getStartDate();
    let best = 0;
    let run = 0;
    datesBetween(start, today).forEach(date => {
        const state = getDayResult(date, start).state;
        if (countsForStreak(state)) { run++; best = Math.max(best, run); }
        else if (pausesStreak(state, date)) { /* doesn't break it */ }
        else run = 0;
    });
    return best;
}

// Q3 · Which habits are strong / weak? → [{ habit, done, due, percent }], best first
function getHabitRates({ from, to }) {
    const today = todayDate();
    return getHabits()
        .filter(habit => !habit.archived)
        .map(habit => {
            const created = habit.createdAt ? dateOf(habit.createdAt) : from;
            let done = 0;
            let due = 0;
            datesBetween(from < created ? created : from, to).forEach(date => {
                if (!isDueOn(habit, date)) return;
                const status = getHabitStatus(habit, date);
                if (status === "skipped") return;                       // excused
                if (date === today && status !== "done") return;         // today isn't over
                due++;
                if (status === "done") done++;
            });
            return { habit, done, due, percent: due ? Math.round((done / due) * 100) : 0 };
        })
        .sort((a, b) => b.percent - a.percent);
}

// Q4a · Where did my time go? → { sessions, minutes, mood }   (mood = average 1–5, or null)
function getFocusTotals({ from, to }) {
    const sessions = getFocusSessions().filter(s => s.savedAt && s.date >= from && s.date <= to);
    const minutes = sessions.reduce((sum, s) => sum + getFocusMinutes(s), 0);
    const moods = sessions.map(s => s.mood).filter(mood => mood);
    const mood = moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null;
    return { sessions: sessions.length, minutes, mood };
}

// Q4c · Which goal got the focus time? → [{ goal, minutes }], most first (goals with time only)
//   Each session belongs to a habit, and each habit to a goal: that's how we know.
function getFocusByGoal({ from, to }) {
    const minutes = {};
    getFocusSessions()
        .filter(session => session.savedAt && session.date >= from && session.date <= to)
        .forEach(session => {
            const habit = getHabitById(session.habitId);
            if (!habit) return;
            minutes[habit.goalId] = (minutes[habit.goalId] || 0) + getFocusMinutes(session);
        });
    return getGoals()
        .filter(goal => minutes[goal.id] > 0)
        .map(goal => ({ goal, minutes: minutes[goal.id] }))
        .sort((a, b) => b.minutes - a.minutes);
}

// Q4b · Why do I miss? → [{ reason: "travelling", count: 3 }], most first
function getSkipReasons({ from, to }) {
    const counts = {};
    getLogs()
        .filter(log => log.status === "skipped" && log.date >= from && log.date <= to)
        .forEach(log => {
            const reason = (log.reason || "no reason").trim().toLowerCase();
            counts[reason] = (counts[reason] || 0) + 1;
        });
    return Object.entries(counts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);
}


// The one-sentence summary on top. Simple rules, worked out from the numbers above.
function getProgressSummary(rangeName, consistency, rates) {
    const word = { week: "week", month: "month", all: "run" }[rangeName];

       // New user: too few days to judge anything yet
    const sinceStart = getConsistency({ from: getStartDate(), to: todayDate() });
    const countedDays = sinceStart.days.filter(day => ["done", "partial", "missed"].includes(day.state)).length;
    if (countedDays < 3) {
        return "You're just getting started. After a few days, this page shows how it's going.";
    }

    // First week: count from day 1 (not "a tough month"), and one kind next step
    if (isFirstWeek()) {
        const text = `Your first ${getDaysSinceStart()} days: ${sinceStart.done} of ${sinceStart.planned} habits done.`;
        return sinceStart.done === 0
            ? `${text} One check-in today starts your streak.`
            : `${text} Keep going: habits take a few weeks to settle.`;
    }
    if (consistency.planned === 0) return "Nothing to count yet in this range. Today counts once it's done.";

    let text;
    if (consistency.percent >= 80) text = `Great ${word}: you did ${consistency.percent}% of your habits.`;
    else if (consistency.percent >= 60) text = `Good ${word}: you did ${consistency.percent}% of your habits.`;
    else text = `A tough ${word}: you did ${consistency.percent}% of your habits. Smaller targets can help.`;

    const weakest = rates.filter(rate => rate.due >= 3).at(-1);
    if (weakest && weakest.percent < 60) text += ` ${weakest.habit.name} needs attention.`;

    const streak = getStreak();
    if (streak >= 3) text += ` You're on a ${streak}-day streak 🔥`;
    return text;
}

/* ════════════════════ 10. NOTES ════════════════════
   Notes are things to keep (not tied to a day). Your goal and its habits work as folders. */

// The name on a card: the title, or the first line of the text, or "Untitled".
function getNoteTitle(note) {
    if (note.title.trim()) return note.title.trim();
    const firstLine = note.text.trim().split("\n")[0];
    return firstLine || "Untitled";
}

// { kind: "habit", id: "h2" } → { name: "Revise last hizb", icon: "repeat" }     gone / none → null
function describeNoteFolder(folder) {
    if (!folder) return null;
    if (folder.kind === "goal") {
        const goal = getGoalById(folder.id);
        return goal ? { name: goal.title, icon: "flag" } : null;
    }
    const habit = getHabitById(folder.id);
    return habit ? { name: habit.name, icon: "repeat" } : null;
}

// Same folder?  sameFolder({kind:"habit",id:"h2"}, {kind:"habit",id:"h2"}) → true
function sameFolder(a, b) {
    return Boolean(a && b && a.kind === b.kind && a.id === b.id);
}

// The chips on top of Notes: your goal, then its habits, each with how many notes it has.
//   → [ { folder: { kind: "goal", id }, name, icon, count }, … ]
function getNoteFolders() {
    const goal = getActiveGoal();
    if (!goal) return [];
    const notes = getNotes();
    const folders = [{ kind: "goal", id: goal.id }, ...getHabitsForGoal(goal.id).map(habit => ({ kind: "habit", id: habit.id }))];
    return folders.map(folder => ({
        folder,
        ...describeNoteFolder(folder),
        count: notes.filter(note => sameFolder(note.folder, folder)).length
    }));
}

// The notes to show: in this folder (null = all), matching the search, newest change first.
//   getNoteList(null, "tajweed") → { pinned: [...], others: [...] }
function getNoteList(folder = null, search = "") {
    const words = search.trim().toLowerCase();
    const notes = getNotes()
        .filter(note => !folder || sameFolder(note.folder, folder))
        .filter(note => !words || `${note.title} ${note.text}`.toLowerCase().includes(words))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    return {
        pinned: notes.filter(note => note.pinned),
        others: notes.filter(note => !note.pinned)
    };
}