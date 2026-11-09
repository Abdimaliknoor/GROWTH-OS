/* ╔══════════════════════════════════════════════════════════════╗
   ║  TODAY  ·  js/app/today.js                                   ║
   ║  Draws your day as one timeline and lets you record it.      ║
   ╚══════════════════════════════════════════════════════════════╝

   WHAT THIS PAGE DOES
     • Timeline: wake up → habits → activities → sleep
     • The habit to do NOW is the big card
     • +1 in one tap (Undo, confetti, "Keep going" after the target)
     • Record sheet: exact amount, yesterday, start focus, skip
     • Item sheet: add / change activities (note, time, one day or repeat)
     • Coming up: the next one-day items this week

   DATA
     insight.js → getDayPlan, getDaySummary, getGoalProgress, getWeek, getStreak, getUpcomingItems
     state.js   → addLog, setDayAmount, skipHabit, addRoutineItem, updateRoutineItem, removeRoutineItem
     focus-bar.js → focusBarOpen (loaded after this file, used on click)

   MAP
     1. Guard        2. Elements     3. Settings     4. Page state
     5. Helpers      6. Renderers    7. Actions      8. Page load    9. Events

   THE LOOP   click → action → change data → updatePage()
   ══════════════════════════════════════════════════════════════════ */


/* ════════════════════ 1. GUARD ════════════════════ */

const ready = isOnboardingComplete();
if (!ready) {
    window.location.replace("../startup/welcome.html");
}


/* ════════════════════ 2. ELEMENTS ════════════════════ */

// ── Header ──
const todayDateText = document.getElementById("todayDate");
const greeting = document.getElementById("greeting");
const dayRing = document.getElementById("dayRing");
const dayCount = document.getElementById("dayCount");
const dayCountBox = document.getElementById("dayCountBox");

// ── Tip (first visit) + the ? that brings it back ──
const todayTip = document.getElementById("todayTip");
const tipName = document.getElementById("tipName");
const tipHabit = document.getElementById("tipHabit");
const tipOk = document.getElementById("tipOk");
const tipHelp = document.getElementById("tipHelp");
// ── Side: goal, week, coming up ──
const goalStrip = document.getElementById("goalStrip");
const goalsTitle = document.getElementById("goalsTitle");
const goalRows = document.getElementById("goalRows");
const goalRowTemplate = document.getElementById("goalRowTemplate");
const weekDays = document.getElementById("weekDays");
const weekCount = document.getElementById("weekCount");
const weekStreak = document.getElementById("weekStreak");
const upcoming = document.getElementById("upcoming");
const upcomingList = document.getElementById("upcomingList");

// ── Day line + evening card ──
const dayLine = document.getElementById("dayLine");
const addItemButton = document.getElementById("addItemButton");
const restDay = document.getElementById("restDay");
const reviewCard = document.getElementById("reviewCard");

// ── Toast + confetti ──
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");
const undoButton = document.getElementById("undoButton");
const confetti = document.getElementById("confetti");

// ── Record sheet ──
const recordSheet = document.getElementById("recordSheet");
const recordTitle = document.getElementById("recordTitle");
const recordDays = document.getElementById("recordDays");
const recordNow = document.getElementById("recordNow");
const recordAmountBox = document.getElementById("recordAmountBox");
const recordAmountLabel = document.getElementById("recordAmountLabel");
const recordAmount = document.getElementById("recordAmount");
const recordDoneBox = document.getElementById("recordDoneBox");
const recordDone = document.getElementById("recordDone");
const recordFocus = document.getElementById("recordFocus");
const recordFocusText = document.getElementById("recordFocusText");
const recordSkipBox = document.querySelector(".record-skip");
const skipReason = document.getElementById("skipReason");
const recordSkip = document.getElementById("recordSkip");
const recordCancel = document.getElementById("recordCancel");
const recordSave = document.getElementById("recordSave");


// ── Templates ──
const markerTemplate = document.getElementById("markerTemplate");
const rowTemplate = document.getElementById("rowTemplate");
const nowTemplate = document.getElementById("nowTemplate");
const allDoneTemplate = document.getElementById("allDoneTemplate");
const upcomingTemplate = document.getElementById("upcomingTemplate");


/* ════════════════════ 3. SETTINGS ════════════════════ */

const RING_LENGTH = 94.25;           // the day ring: 2 × π × 15 (same as today.css)
const REVIEW_HOUR = 18;              // "Review your day" from 18:00
const TOAST_MS = 5000;
const SMALL_CONFETTI = 14;           // one habit done
const BIG_CONFETTI = 40;             // whole day done
const UPCOMING_DAYS = 7;             // Coming up: look one week ahead…
const UPCOMING_MAX = 3;              // …and show at most 3
const TIP_ID = "today";              // this page's tip, in state.js's tips list

const MARKER_ICONS = { wake: "wb_sunny", sleep: "bedtime", activity: "event" };

// Week card, Monday first
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];


/* ════════════════════ 4. PAGE STATE ════════════════════ */

let lastLogId = null;                // the log Undo would remove
let toastTimer = null;
let justFinishedId = null;           // just hit its target: stays the big card ("Keep going")
let recordHabitId = null;            // record sheet: which habit
let recordDate = null;               // record sheet: today or yesterday


/* ════════════════════ 5. HELPERS ════════════════════
   Work things out. Never draw, never save. */

// "07:05": same format as routine times, so they compare as text
function nowTime() {
    const now = new Date();
    return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}

// "Sunday 25 October"
function formatToday() {
    return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// "Abdimalik Noor Sheikh Ali" → "Abdimalik": a greeting uses the first name only.
function firstName() {
    return (getName() || "").trim().split(/\s+/)[0];
}

function greetingWord(hour) {
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
}

// "4 / 10 pages"   ·   "Done" / "Not done yet"
function formatAmount(item) {
    const habit = item.habit;
    if (habit.type === "completion") return item.status === "done" ? "Done" : "Not done yet";
    return `${item.amount} / ${habit.target} ${habit.unit}`.trim();
}

// 4 of 10 → 40 (never above 100)
function percentOf(item) {
    return Math.min(100, Math.round((item.amount / item.habit.target) * 100));
}

// Above the target: did 2, target 1 → 1
function extraOf(item) {
    const extra = item.amount - item.habit.target;
    return extra > 0 ? Math.round(extra * 100) / 100 : 0;
}

// A habit still waiting today (not done, not skipped)
function isOpen(item) {
    return item.kind === "habit" && item.status !== "done" && item.status !== "skipped";
}

// Which habit is NOW? → { habitId, badge } or null
//   1. just finished      → "Done"  (so "Keep going" has a place)
//   2. time passed, open  → "Still to do"
//   3. next one coming    → "Up next"
//   4. no time, open      → "Anytime"
function pickNow(plan, time) {
    if (justFinishedId && plan.some(item => item.habitId === justFinishedId)) {
        return { habitId: justFinishedId, badge: "Done" };
    }
    const open = plan.filter(isOpen);
    const late = open.find(item => item.time && item.time <= time);
    if (late) return { habitId: late.habitId, badge: "Still to do" };
    const next = open.find(item => item.time && item.time > time);
    if (next) return { habitId: next.habitId, badge: "Up next" };
    const anytime = open.find(item => !item.time);
    if (anytime) return { habitId: anytime.habitId, badge: "Anytime" };
    return null;
}

function copyTemplate(template) {
    return template.content.firstElementChild.cloneNode(true);
}


/* ════════════════════ 6. RENDERERS ════════════════════
   Draw from the data. updatePage() calls them all. */

// ── Header: date, greeting, "2 of 5 done", ring, ✓ ──
function renderHeader(summary) {
    todayDateText.textContent = formatToday();
    const name = firstName();
    const word = greetingWord(new Date().getHours());
    greeting.textContent = name ? `${word}, ${name}` : word;

    if (summary.total === 0) {
        dayCount.textContent = "Rest day";
        dayCountBox.classList.remove("is-complete");
        dayRing.style.strokeDashoffset = RING_LENGTH;
        return;
    }
    const allDone = summary.done === summary.total;
    dayCount.textContent = allDone ? "All done" : `${summary.done} of ${summary.total} done`;
    dayCountBox.classList.toggle("is-complete", allDone);
    dayRing.style.strokeDashoffset = RING_LENGTH * (1 - summary.done / summary.total);
}

// ── Your goals: one row each, main first (hidden when there are none) ──
function renderGoals() {
    const goals = getActiveGoals();
    goalStrip.hidden = goals.length === 0;
    goalsTitle.hidden = goals.length < 2;               // one goal: no title needed
    goalRows.replaceChildren(...goals.map(buildGoalRow));
}

// One goal: dot + title + days left, the bar, "6 / 12 pages · 50%"
function buildGoalRow(goal) {
    const li = copyTemplate(goalRowTemplate);
    li.dataset.color = goal.color;                      // app.css → var(--goal) for the dot and bar
    const progress = getGoalProgress(goal);
    const daysLeft = getDaysLeft(goal);

    li.querySelector(".goal-strip-title").textContent = goal.title;
    li.querySelector(".bar-fill").style.width = progress.percent + "%";
    const bar = li.querySelector(".bar");
    bar.setAttribute("aria-valuenow", progress.percent);
    bar.setAttribute("aria-label", `${goal.title} progress`);

    let days = "";
    if (daysLeft === null) days = "";
    else if (daysLeft > 0) days = `${daysLeft} days left`;
    else if (daysLeft === 0) days = "Due today";
    else days = "Past the date";
    li.querySelector(".goal-strip-days").textContent = days;

    const unit = goal.measure === "milestones" ? "steps" : goal.measure === "consistency" ? "check-ins" : goal.unit;
    li.querySelector(".goal-strip-numbers").textContent = `${progress.done} / ${progress.target} ${unit} · ${progress.percent}%`;
    return li;
}

// A habit row or the Now card: its goal's colour, and (with 2+ goals) "● Goal name".
function markGoal(li, habit) {
    const goal = getGoalById(habit.goalId);
    if (!goal) return;
    li.dataset.color = goal.color;
    const tag = li.querySelector(".goal-tag");
    tag.hidden = getActiveGoals().length < 2;
    tag.textContent = goal.title;
}

// ── Week card: 7 dots, "9 / 20 check-ins", streak ──
function renderWeek() {
    const week = getWeek();
    const today = todayDate();
    weekDays.innerHTML = "";

    week.forEach((day, i) => {
        const li = document.createElement("li");
        li.className = `week-day is-${day.state}`;
        if (day.date === today) li.classList.add("is-today");

        let words;
        if (day.state === "rest") words = "rest day";
        else if (day.state === "future" || day.state === "before") words = "nothing yet";
        else words = `${day.done} of ${day.due} done`;
        li.setAttribute("aria-label", `${DAY_NAMES[i]}: ${words}`);

        const letter = document.createElement("span");
        letter.className = "week-letter";
        letter.textContent = DAY_LETTERS[i];
        letter.setAttribute("aria-hidden", "true");

        const dot = document.createElement("span");
        dot.className = "week-dot";

        li.append(letter, dot);
        weekDays.append(li);
    });

    const counted = week.filter(day => day.state !== "before");
    const done = counted.reduce((sum, day) => sum + day.done, 0);
    const due = counted.reduce((sum, day) => sum + day.due, 0);
    weekCount.textContent = `${done} / ${due} check-ins`;

    const streak = getStreak();
    if (streak === 0) weekStreak.textContent = "Do one habit today to start a streak";
    else if (streak === 1) weekStreak.textContent = "1-day streak";
    else weekStreak.textContent = `${streak}-day streak`;
}

// ── Coming up: next one-day items this week (hidden when none) ──
function renderUpcoming() {
    const items = getUpcomingItems(UPCOMING_DAYS, UPCOMING_MAX);
    upcoming.hidden = items.length === 0;
    upcomingList.replaceChildren(...items.map(buildUpcoming));
}

function buildUpcoming(item) {
    const li = copyTemplate(upcomingTemplate);
        li.dataset.itemId = item.id;                     
    li.querySelector(".upcoming-day").textContent = `${describeUpcomingDay(item.date)} ${item.time}`;
    li.querySelector(".upcoming-label").textContent = item.label;
    const note = li.querySelector(".upcoming-note");
    note.textContent = item.note || "";
    note.hidden = !item.note;
    return li;
}

// ── Builders: copy a template → fill → return ──

// Marker: Wake up / Sleep / activity (+ its note). Tap → item sheet.
function buildMarker(item) {
    const li = copyTemplate(markerTemplate);
    li.dataset.itemId = item.id;
    li.querySelector(".line-dot").textContent = MARKER_ICONS[item.kind] || MARKER_ICONS.activity;
    li.querySelector(".item-time").textContent = item.time;
    li.querySelector(".marker-label").textContent = item.label;

    const note = li.querySelector(".marker-note");
    note.textContent = item.note || "";
    note.hidden = !item.note;
    return li;
}

// Row: a small habit. late = time passed, nothing logged.
function buildRow(item, late) {
    const li = copyTemplate(rowTemplate);
    const habit = item.habit;
    li.dataset.habitId = habit.id;
    markGoal(li, habit);
    li.querySelector(".row-name").textContent = item.label;
    li.querySelector(".item-time").textContent = item.time || "Anytime";

    const status = li.querySelector(".row-status");
    if (item.status === "skipped") {
        li.classList.add("is-skipped");
        status.textContent = `Skipped · ${item.skipReason}`;
    } else if (item.status === "done") {
        li.classList.add("is-done");
        status.textContent = formatAmount(item);
    } else if (late) {
        li.classList.add("is-late");
        status.textContent = "Not logged yet";
    } else {
        if (item.status === "partial") li.classList.add("is-partial");
        status.textContent = formatAmount(item);
    }

    const extra = extraOf(item);
    if (extra > 0) {
        const tag = li.querySelector(".row-extra");
        tag.hidden = false;
        tag.textContent = `+${extra} extra`;
    }

    // Round button: "+" for amounts, ✓ for done/not. None when skipped or ticked.
    const button = li.querySelector(".row-button");
    if (item.status === "skipped" || (habit.type === "completion" && item.status === "done")) {
        button.hidden = true;
    } else if (habit.type === "completion") {
        button.textContent = "check";
        button.setAttribute("aria-label", `Mark ${habit.name} done`);
    } else {
        button.textContent = "add";
        button.setAttribute("aria-label", `Add ${getStep(habit)} ${habit.unit} to ${habit.name}`);
    }
     // In focus right now: the session owns the numbers, so the button opens it instead
    if (getFocusFor(habit.id)) {
        li.classList.add("is-focusing");
        status.textContent = "In focus now";
        button.hidden = false;
        button.dataset.action = "focus";
        button.textContent = "timer";
        button.setAttribute("aria-label", `Open focus for ${habit.name}`);
    }
    return li;
}

// Now card: the big one.
function buildNow(item, badge) {
    const li = copyTemplate(nowTemplate);
    const habit = item.habit;
    const finished = badge === "Done";
    li.dataset.habitId = habit.id;
    markGoal(li, habit);
    li.querySelector(".now-badge").textContent = badge;
    li.querySelector(".item-time").textContent = item.time;
    li.querySelector(".now-name").textContent = item.label;
    li.querySelector(".now-amount").textContent = finished ? `${formatAmount(item)} · target reached` : formatAmount(item);

    const bar = li.querySelector(".bar");
    bar.setAttribute("aria-label", `${habit.name} progress`);
    bar.setAttribute("aria-valuenow", percentOf(item));
    li.querySelector(".bar-fill").style.width = percentOf(item) + "%";

    const focusButton = li.querySelector('[data-action="focus"]');
    const addButton = li.querySelector('[data-action="add"]');

    // Target just reached: "Next" + "Keep going +1"
    if (finished) {
        focusButton.dataset.action = "next";
        focusButton.textContent = "Next";
        addButton.textContent = `Keep going +${getStep(habit)}`;
        return li;
    }

    // In focus right now: only "Resume focus". No +1 here, or the same pages count twice.
    if (getFocusFor(habit.id)) {
        li.classList.add("is-focusing");
        li.querySelector(".now-amount").textContent = `${formatAmount(item)} · in focus now`;
        focusButton.querySelector(".focus-label").textContent = "Resume focus";
        addButton.hidden = true;
        return li;
    }

    if (habit.type === "completion") {
        addButton.textContent = "Mark done";
    } else {
        addButton.textContent = `+${getStep(habit)}`;
        addButton.setAttribute("aria-label", `Add ${getStep(habit)} ${habit.unit} to ${habit.name}`);
    }
    return li;
}

// All done: replaces the now card.
function buildAllDone(summary) {
    const li = copyTemplate(allDoneTemplate);
    li.querySelector(".all-done-text").textContent = `${summary.done} of ${summary.total} habits. Great work.`;
    return li;
}

// ── The whole line, top to bottom ──
function renderLine(plan, summary) {
    dayLine.innerHTML = "";
    const hasHabits = summary.total > 0;
    restDay.hidden = hasHabits;
    dayLine.hidden = !hasHabits;
    if (!hasHabits) return;

    const time = nowTime();
    const now = pickNow(plan, time);
    let allDoneShown = false;

    plan.forEach(item => {
        if (item.kind !== "habit") {
            if (!now && !allDoneShown && item.kind === "sleep") {      // "All done" just before Sleep
                dayLine.append(buildAllDone(summary));
                allDoneShown = true;
            }
            dayLine.append(buildMarker(item));
        } else if (now && item.habitId === now.habitId) {
            dayLine.append(buildNow(item, now.badge));
        } else {
            const late = isOpen(item) && item.time && item.time <= time && item.status === "none";
            dayLine.append(buildRow(item, late));
        }
    });

    if (!now && !allDoneShown) dayLine.append(buildAllDone(summary));   // no Sleep: at the end
}
// ── Tip: shown until "Got it". The example is THEIR first habit today. ──
function renderTip(plan) {
    todayTip.hidden = hasSeenTip(TIP_ID);
    if (todayTip.hidden) return;

    const firstItem = plan.find(item => item.kind === "habit");
    const firstHabit = firstItem ? getHabitById(firstItem.habitId) : null;   // the habit's own name, even if renamed
    tipName.textContent = firstName() || "friend";                            // textContent: names stay plain text
    tipHabit.textContent = firstHabit ? firstHabit.name : "a habit";
}
function renderReviewCard() {
    reviewCard.hidden = new Date().getHours() < REVIEW_HOUR;
}

// ── Redraw everything. Every action ends here. ──
function updatePage() {
    const plan = getDayPlan();
    const summary = getDaySummary();
    renderHeader(summary);
    renderGoals();
    renderWeek();
    renderUpcoming();
    renderLine(plan, summary);
    renderTip(plan);
    renderReviewCard();
}


/* ════════════════════ 7. ACTIONS ════════════════════
   Change the data, then call updatePage(). */

/* ── 7a. +1 and Undo ── */

function addOne(habitId) {
    const habit = getHabitById(habitId);
    if (!habit) return;
    if (getFocusFor(habitId)) return openFocus(habitId);   // a timer is running: open it instead
    if (habitId !== justFinishedId) justFinishedId = null;

    const before = getHabitStatus(habit);
    const step = getStep(habit);
    const log = addLog(habitId, step);
    const after = getHabitStatus(habit);
    lastLogId = log.id;

    // Target just reached: celebrate, keep it as the big card (not for tick habits)
    if (before !== "done" && after === "done") {
        justFinishedId = habit.type === "completion" ? null : habit.id;
        const summary = getDaySummary();
        throwConfetti(summary.done === summary.total ? BIG_CONFETTI : SMALL_CONFETTI);
    }

    showToast(habit.type === "completion" ? `${habit.name} done` : `Added ${step} ${habit.unit}`.trim());
    updatePage();
    focusHabit(habitId);
}

function undoLast() {
    if (!lastLogId) return;
    const log = getLogs().find(item => item.id === lastLogId);
    removeItem("logs", lastLogId);
    lastLogId = null;

    const habit = log ? getHabitById(log.habitId) : null;
    if (!habit || getHabitStatus(habit) !== "done") justFinishedId = null;

    hideToast();
    updatePage();
}

// "Next" after finishing: the big card moves on.
function moveOn() {
    justFinishedId = null;
    updatePage();
}


/* ── 7b. Record sheet ── */

function openRecord(habitId) {
    recordHabitId = habitId;
    recordDate = todayDate();
    recordSkipBox.open = false;
    skipReason.value = "";
    fillRecord();
    recordSheet.showModal();
}

// Fill the sheet for the current habit + day.
function fillRecord() {
    const habit = getHabitById(recordHabitId);
    const amount = getDayAmount(habit.id, recordDate);
    const reason = getSkipReason(habit.id, recordDate);

    recordTitle.textContent = habit.name;

    recordDays.querySelectorAll("[data-day]").forEach(chip => {
        const day = chip.dataset.day === "today" ? todayDate() : addDaysTo(todayDate(), -1);
        chip.setAttribute("aria-pressed", String(day === recordDate));
    });

    if (reason) recordNow.textContent = `Skipped · ${reason}`;
    else if (habit.type === "completion") recordNow.textContent = amount >= 1 ? "Done" : "Not done yet";
    else recordNow.textContent = `Logged: ${amount} / ${habit.target} ${habit.unit}`;

    const tick = habit.type === "completion";
    recordAmountBox.hidden = tick;
    recordDoneBox.hidden = !tick;
    recordAmountLabel.textContent = `How many ${habit.unit}?`;
    recordAmount.value = amount;
    recordDone.checked = amount >= 1;

       recordFocus.hidden = recordDate !== todayDate();
    recordFocusText.textContent = "Start focus";

    // In focus right now: nothing to type here. The session records it when you finish.
    const inFocus = getFocusFor(habit.id, recordDate);
    recordSheet.classList.toggle("is-focusing", Boolean(inFocus));
    if (inFocus) {
        recordNow.textContent = "In focus now. It's recorded when you finish the session.";
        recordAmountBox.hidden = true;
        recordDoneBox.hidden = true;
        recordFocusText.textContent = "Resume focus";
    }
}

function chooseRecordDay(day) {
    recordDate = day === "today" ? todayDate() : addDaysTo(todayDate(), -1);
    fillRecord();
}

// − / + in the number box
function changeRecordAmount(direction) {
    const habit = getHabitById(recordHabitId);
    const current = Number(recordAmount.value) || 0;
    const next = Math.max(0, current + direction * getStep(habit));
    recordAmount.value = Math.round(next * 100) / 100;
}

// Save REPLACES the day's amount (12 means 12, not 12 more).
function saveRecord() {
    const habit = getHabitById(recordHabitId);
        if (getFocusFor(habit.id, recordDate)) return;           // the session owns it
    let amount;
    if (habit.type === "completion") {
        amount = recordDone.checked ? 1 : 0;
    } else {
        const typed = Number(recordAmount.value);
        amount = Number.isNaN(typed) || typed < 0 ? 0 : Math.round(typed * 100) / 100;
    }
    setDayAmount(habit.id, amount, recordDate);
    finishRecord(`${habit.name} saved`);
}

// Skip needs a reason (that's what makes it "excused", not "missed").
function skipRecord() {
    const reason = skipReason.value.trim();
    if (!reason) {
        skipReason.focus();
        return;
    }
    const habit = getHabitById(recordHabitId);
    skipHabit(habit.id, reason, recordDate);
    finishRecord(`${habit.name} skipped`);
}

function finishRecord(message) {
    recordSheet.close();
    lastLogId = null;                    // the day was rewritten: the old +1 can't be undone
    justFinishedId = null;
    updatePage();
    showToast(message, false);
}


//* ── 7c. Schedule sheet (item-sheet.js) ── */

// The sheet calls this after Save / Remove: redraw, then say what happened.
function afterItemChange(message) {
    updatePage();
    showToast(message, false);
}

/* ── 7d. Small things ── */

// Start focus. focusBarOpen (focus-bar.js) also handles "another session is running".
function openFocus(habitId) {
    focusBarOpen(habitId);
}

// Back from Focus with ?done=h1? Confetti if it's now done, then clean the address.
function celebrateReturn() {
    const doneId = new URLSearchParams(window.location.search).get("done");
    if (!doneId) return;
    const habit = getHabitById(doneId);
    if (habit && getHabitStatus(habit) === "done") throwConfetti(SMALL_CONFETTI);
    history.replaceState(null, "", "today.html");
}

// After a redraw, put keyboard focus back on the same habit.
function focusHabit(habitId) {
    const button = dayLine.querySelector(`[data-habit-id="${habitId}"] [data-action="add"]:not([hidden])`);
    if (button) button.focus();
}

// Redraw without losing keyboard focus (minute timer, back to the tab).
function refresh() {
    if (!ready) return;
    const focused = document.activeElement.closest("[data-habit-id]");
    updatePage();
    if (focused) focusHabit(focused.dataset.habitId);
}
// ── Tip ──
function closeTip() {
    markTipSeen(TIP_ID);
    todayTip.hidden = true;
    showToast("Tip hidden. Tap ? at the top to see it again.", false);
}

function openTip() {
    showTipAgain(TIP_ID);
    renderTip(getDayPlan());
    todayTip.scrollIntoView({ behavior: "smooth", block: "center" });
    tipOk.focus({ preventScroll: true });       // keyboard users land on "Got it"
}

// canUndo = false hides Undo (sheet saves can't be undone with it).
function showToast(message, canUndo = true) {
    toastText.textContent = message;
    undoButton.hidden = !canUndo;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_MS);
}

function hideToast() {
    toast.hidden = true;
    clearTimeout(toastTimer);
}

// Pieces fall from the middle of the screen, then remove themselves.
function throwConfetti(count) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < count; i++) {
        const piece = document.createElement("span");
        piece.className = "confetti-piece";
        piece.style.left = (35 + Math.random() * 30) + "%";
        piece.style.top = (10 + Math.random() * 15) + "%";
        piece.style.setProperty("--x", (Math.random() * 160 - 80) + "px");
        piece.style.setProperty("--turn", (Math.random() * 720 - 360) + "deg");
        piece.style.animationDelay = (Math.random() * 150) + "ms";
        piece.addEventListener("animationend", () => piece.remove());
        confetti.append(piece);
    }
}


/* ════════════════════ 8. PAGE LOAD ════════════════════ */

if (ready) {
    updatePage();
    celebrateReturn();
}


/* ════════════════════ 9. EVENTS ════════════════════
   All at the top level, never inside another listener. */

// ── Day line: one listener for every button (event delegation) ──
//    data-action = WHAT · closest data-habit-id / data-item-id = WHICH
dayLine.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    const habitId = button.closest("[data-habit-id]")?.dataset.habitId;

    if (action === "add" && habitId) addOne(habitId);
    if (action === "next") moveOn();
    if (action === "focus" && habitId) openFocus(habitId);
    if (action === "record" && habitId) openRecord(habitId);
    if (action === "edit-item") openEditItem(button.closest("[data-item-id]").dataset.itemId, afterItemChange);
});
// ── Coming up: tap a line → the same item sheet ──
upcomingList.addEventListener("click", (event) => {
    const line = event.target.closest("[data-item-id]");
     if (line) openEditItem(line.dataset.itemId, afterItemChange);
});

// ── Toast ──
undoButton.addEventListener("click", undoLast);

// ── Record sheet ──
recordDays.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-day]");
    if (chip) chooseRecordDay(chip.dataset.day);
});
recordSheet.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "record-less") changeRecordAmount(-1);
    if (button.dataset.action === "record-more") changeRecordAmount(+1);
});
recordFocus.addEventListener("click", () => openFocus(recordHabitId));
recordSave.addEventListener("click", saveRecord);
recordSkip.addEventListener("click", skipRecord);
recordCancel.addEventListener("click", () => recordSheet.close());

// ── Tip ──
tipOk.addEventListener("click", closeTip);
tipHelp.addEventListener("click", openTip);

// ── Schedule ──
addItemButton.addEventListener("click", () => openAddItem(afterItemChange));

// ── Time ──
setInterval(refresh, 60 * 1000);                           // "now" follows the clock
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
});