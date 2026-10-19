// insights.js
// WORKING THINGS OUT: everything here is calculated from the facts in state.js.
// Rule: these functions only READ. They never save anything.
// Load order: storage.js → state.js → insights.js → the page's script.


/* ---------- 1. Logs as totals ---------- */

// Total done on a day: two logs of 7 and 3 → 10.
// Rounded to 2 decimals so 0.1 + 0.2 shows as 0.3, not 0.30000000000000004.
function getDayAmount(habitId, date = todayDate()) {
    const total = getLogs()
        .filter(log => log.habitId === habitId && log.date === date && log.status !== "skipped")
        .reduce((sum, log) => sum + log.amount, 0);
    return Math.round(total * 100) / 100;
}

// The reason if the habit was skipped that day, or null.
function getSkipReason(habitId, date = todayDate()) {
    const skip = getLogs().find(log => log.habitId === habitId && log.date === date && log.status === "skipped");
    return skip ? skip.reason : null;
}


/* ---------- 2. Habit rules ---------- */

// Is the habit planned for this date?   habit.days ["mon","wed"] + a Monday → true
function isDueOn(habit, date = todayDate()) {
    return !habit.archived && habit.days.includes(weekdayOf(date));
}

// How much one "+1" tap adds.
//   done/not-done → 1 (a tick)   time → 5 min   amount → 1, or 0.5 when the target is below 1
function getStep(habit) {
    if (habit.type === "completion") return 1;
    if (habit.type === "time") return 5;
    return habit.target < 1 ? 0.5 : 1;
}

// One habit's state for a day:
//   "skipped" · "done" (reached the target) · "partial" (some, not enough) · "none" (nothing yet)
function getHabitStatus(habit, date = todayDate()) {
    if (getSkipReason(habit.id, date)) return "skipped";
    const amount = getDayAmount(habit.id, date);
    if (amount >= habit.target) return "done";
    if (amount > 0) return "partial";
    return "none";
}


/* ---------- 3. Today ---------- */

// Everything on one day's line, in time order: wake, habits, sleep.
// Habits due that day but with no routine time go at the end ("Anytime today").
//   getDayPlan() → [
//     { kind: "wake",  time: "06:00", label: "Wake up", habit: null },
//     { kind: "habit", time: "05:30", label: "Memorize new", habit: {...}, amount: 1, status: "done" },
//     ...
//   ]
function getDayPlan(date = todayDate()) {
    const habits = getHabits().filter(habit => isDueOn(habit, date));

    // Routine items for that day. Habit items only if the habit still exists and is due.
    const items = getRoutineForDay(date)
        .filter(item => item.kind !== "habit" || habits.some(habit => habit.id === item.habitId))
        .map(item => ({ kind: item.kind, time: item.time, label: item.label, habitId: item.habitId }));

    // Due habits that have no time on this day.
    habits
        .filter(habit => !items.some(item => item.habitId === habit.id))
        .forEach(habit => items.push({ kind: "habit", time: "", label: habit.name, habitId: habit.id }));

    // Fill in each habit's live numbers.
    return items.map(item => {
        if (item.kind !== "habit") return { ...item, habit: null };
        const habit = habits.find(h => h.id === item.habitId);
        return {
            ...item,
            label: habit.name,                        // the habit's current name wins
            habit,
            amount: getDayAmount(habit.id, date),
            status: getHabitStatus(habit, date),
            skipReason: getSkipReason(habit.id, date)
        };
    });
}

// "3 of 5 done" for the header. Skipped habits are not counted as done.
function getDaySummary(date = todayDate()) {
    const habitItems = getDayPlan(date).filter(item => item.kind === "habit");
    return {
        done: habitItems.filter(item => item.status === "done").length,
        total: habitItems.length
    };
}


/* ---------- 4. Goal progress ---------- */

// Which habits add to a goal's number: same unit as the goal,
// unless the habit says countsToGoal: false (e.g. Quran revision pages).
function countsTowardGoal(habit, goal) {
    return habit.goalId === goal.id && habit.countsToGoal !== false && habit.unit === goal.unit;
}

// Progress toward the finish line, one rule per measure:
//   total       → everything done so far ÷ target          (12 / 20 pages)
//   level       → the best single day ÷ target              (6 / 10 km)
//   milestones  → steps done ÷ all steps                    (2 / 4 steps)
//   consistency → check-ins done ÷ planned, last 28 days    (18 / 24)
// Returns { done, target, percent }   percent is 0–100, never above 100.
function getGoalProgress(goal) {
    const logs = getLogs().filter(log => log.status !== "skipped");
    const ids = getHabits().filter(habit => countsTowardGoal(habit, goal)).map(habit => habit.id);
    let done = 0;
    let target = 0;

    if (goal.measure === "total") {
        done = logs.filter(log => ids.includes(log.habitId)).reduce((sum, log) => sum + log.amount, 0);
        target = goal.target;
    } else if (goal.measure === "level") {
        const byDay = {};                             // "2026-10-10" → amount that day
        logs.filter(log => ids.includes(log.habitId))
            .forEach(log => { byDay[log.date] = (byDay[log.date] || 0) + log.amount; });
        done = Math.max(goal.current || 0, ...Object.values(byDay));
        target = goal.target;
    } else if (goal.measure === "milestones") {
        done = goal.milestones.filter(step => step.done).length;
        target = goal.milestones.length;
    } else {
        // consistency: every habit of the goal counts, whatever its unit.
        // Only days since the goal was created: a new goal must not start at 2%.
        const goalHabits = getHabitsForGoal(goal.id);
        const start = dateOf(goal.createdAt);
        for (let back = 0; back < 28; back++) {
            const date = addDaysTo(todayDate(), -back);
            if (date < start) break;                  // "YYYY-MM-DD" text compares like dates
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

// Days until the deadline: 0 = today, negative = passed, null = no deadline.
function getDaysLeft(goal) {
    if (!goal.deadline) return null;
    const [y1, m1, d1] = todayDate().split("-").map(Number);
    const [y2, m2, d2] = goal.deadline.split("-").map(Number);
    const ms = new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
    return Math.round(ms / 86400000);              // ms in one day = 24 × 60 × 60 × 1000
}
/* ---------- 5. This week + streak ---------- */

// The day the user started: the day their first habit was made.
// Days before it are "before" (not "missed": you can't miss a day before you began).
function getStartDate() {
    const times = getHabits().map(habit => habit.createdAt).filter(Boolean);
    return times.length ? dateOf(Math.min(...times)) : todayDate();
}

// One day's result.
//   getDayResult("2026-10-12") → { date, due: 4, done: 3, state: "partial" }
// state:
//   "done"    every planned habit reached its target
//   "partial" some done, not all
//   "missed"  a past day with nothing done
//   "none"    today, nothing done YET (not missed: the day isn't over)
//   "rest"    nothing was planned that day
//   "before"  before the user started
//   "future"  hasn't happened yet
function getDayResult(date, start = getStartDate()) {
    const today = todayDate();
    const planned = getHabits().filter(habit => isDueOn(habit, date));
    // A skip (it always has a reason) is excused: it leaves the plan for that day,
    // so it can't break the streak. All skipped → the day counts as a rest day.
    const due = planned.filter(habit => date > today || getHabitStatus(habit, date) !== "skipped");    const done = date > today ? 0 : due.filter(habit => getHabitStatus(habit, date) === "done").length;

    let state;
    if (date > today) state = "future";
    else if (date < start) state = "before";
    else if (due.length === 0) state = "rest";
    else if (done === due.length) state = "done";
    else if (done > 0) state = "partial";
    else state = date === today ? "none" : "missed";

    return { date, due: due.length, done, state };
}

// Monday → Sunday of the week that has `date` in it. 7 day results.
function getWeek(date = todayDate()) {
    const monday = addDaysTo(date, -WEEK_DAYS.indexOf(weekdayOf(date)));   // a Wednesday goes back 2 days
    const start = getStartDate();
    return WEEK_DAYS.map((_, i) => getDayResult(addDaysTo(monday, i), start));
}

// Days in a row with EVERY planned habit done, counting back from today.
//   - Today not finished yet? It doesn't break the streak, it just doesn't count yet.
//   - Rest days (nothing planned) don't break it and don't add to it.
//   - A past day that wasn't fully done ends it.
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
/* ---------- 6. Focus ---------- */

// How long you REALLY focused, in milliseconds: time since the start, minus the pauses.
//   started 14 min ago, paused 2 min → 720000 (12 min)
function getFocusElapsed(session, now = Date.now()) {
    const end = session.endedAt || now;                                  // finished? the clock stopped at endedAt
    const pausedNow = session.pausedAt ? end - session.pausedAt : 0;     // paused right now? that part doesn't count either
    return Math.max(0, end - session.startedAt - session.pausedMs - pausedNow);
}
// Which screen the Focus page should show. Worked out from the data, never saved:
//   no session                 → "setup"      (the 15 / 25 / 45 chips + Start)
//   pausedAt set               → "paused"
//   still going                → "running"
//   Finish tapped, not saved   → "finishing"  (the finish sheet)
//   Save or Skip pressed       → "done"       (back to Today)
function getFocusStage(session) {
    if (!session) return "setup";
    if (session.savedAt) return "done";
    if (session.endedAt) return "finishing";
    if (session.pausedAt) return "paused";
    return "running";
}
// Whole minutes to log for a time habit. At least 1: you did start.
//   12 min 40 s → 13      20 s → 1
function getFocusMinutes(session, now = Date.now()) {
    return Math.max(1, Math.round(getFocusElapsed(session, now) / 60000));
}
/* ---------- 7. Journal: 3 kinds of entries, one timeline ----------
   ✍️ write  your own words                 (journal list)
   🎯 focus  a focus session's mood + note  (focusSessions)
   ⏭ skip   why you skipped a habit         (logs with status "skipped")
   Each function copies ONE notebook onto the same kind of card. */

// The habit's name, or "Deleted habit" if it's gone.
function habitNameOf(habitId) {
    const habit = getHabitById(habitId);
    return habit ? habit.name : "Deleted habit";
}

// ✍️ Card for each of your own entries.
function getWriteEntries() {
    return getJournalEntries().map(entry => ({
        kind: "write",
        id: entry.id,
        date: entry.date,
        time: entry.createdAt,          // renamed to "time"
        text: entry.text,
        mood: entry.mood
    }));
}

// 🎯 Card for each FINISHED focus session.
function getFocusEntries() {
    return getFocusSessions()
        .filter(session => session.savedAt)        // still running? leave it out
        .map(session => {
            const habit = getHabitById(session.habitId);
            return {
                kind: "focus",
                id: session.id,
                date: session.date,
                time: session.startedAt,           // renamed to "time"
                habitName: habitNameOf(session.habitId),
                minutes: getFocusMinutes(session),
                amount: session.amount,
                unit: habit ? habit.unit : "",
                mood: session.mood,
                note: session.note
            };
        });
}

// ⏭ Card for each skip. Skips saved no time, so time is null.
function getSkipEntries() {
    return getLogs()
        .filter(log => log.status === "skipped")   // only the skips
        .map(log => ({
            kind: "skip",
            id: log.id,
            date: log.date,
            time: null,
            habitName: habitNameOf(log.habitId),
            reason: log.reason
        }));
}
// Everything together, grouped by day, newest day first.
// Inside a day: timed entries earliest first; skips (no time) at the end.
function getJournal() {
    // A. Pour all the cards into one pile
    const all = [...getWriteEntries(), ...getFocusEntries(), ...getSkipEntries()];

    // B. Drop each card into its day's envelope
    const byDate = {};
    all.forEach(entry => {
        if (!byDate[entry.date]) byDate[entry.date] = [];   // no envelope for this day? make one
        byDate[entry.date].push(entry);                     // put the card in
    });

    // C. The envelope names (dates), newest first
    const dates = Object.keys(byDate).sort().reverse();

    // D. One { date, entries } per day, cards in time order
    return dates.map(date => ({
        date,
        entries: byDate[date].sort((a, b) => {
            if (a.time === null) return 1;      // a has no time → a goes after
            if (b.time === null) return -1;     // b has no time → b goes after
            return a.time - b.time;             // both have a time → earliest first
        })
    }));
}