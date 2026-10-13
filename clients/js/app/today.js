/* =========================================================
   TODAY  (app/today.html)

   What this page does:
     Draws today as one line (wake up → habits → sleep),
     makes the habit for RIGHT NOW the big card,
     and lets you record progress with one tap (+1),
     with Undo, confetti, and a "Keep going" after the target.

   Where the data comes from:
     getDayPlan(), getDaySummary(), getGoalProgress()  → insights.js
     addLog(), removeItem()                            → state.js

   1. Guard   2. Elements   3. Settings   4. Page state
   5. Helpers (they only work things out, never draw)
   6. Renderers (they draw)   7. Actions (they change data)
   8. Page load   9. Events
   ========================================================= */


/* ---------- 1. Guard ---------- */

// Not finished onboarding? Today has nothing to show yet.
const ready = isOnboardingComplete();
if (!ready) {
    window.location.replace("../startup/welcome.html");
}


/* ---------- 2. Elements ---------- */

const todayDateText = document.getElementById("todayDate");
const greeting = document.getElementById("greeting");
const dayRing = document.getElementById("dayRing");
const dayCount = document.getElementById("dayCount");
const goalStrip = document.getElementById("goalStrip");
const goalTitle = document.getElementById("goalTitle");
const goalDays = document.getElementById("goalDays");
const goalBar = document.getElementById("goalBar");
const goalBarFill = document.getElementById("goalBarFill");
const goalNumbers = document.getElementById("goalNumbers");
const dayLine = document.getElementById("dayLine");
const restDay = document.getElementById("restDay");
const reviewCard = document.getElementById("reviewCard");
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");
const undoButton = document.getElementById("undoButton");
const confetti = document.getElementById("confetti");

const markerTemplate = document.getElementById("markerTemplate");
const rowTemplate = document.getElementById("rowTemplate");
const nowTemplate = document.getElementById("nowTemplate");
const allDoneTemplate = document.getElementById("allDoneTemplate");
const weekDays = document.getElementById("weekDays");
const weekCount = document.getElementById("weekCount");
const weekStreak = document.getElementById("weekStreak");


/* ---------- 3. Settings ---------- */

const RING_LENGTH = 94.25;       // the ring's circle: 2 × π × 15 (same number as in today.css)
const REVIEW_HOUR = 18;          // the "Review your day" card shows from 18:00
const TOAST_MS = 5000;           // the Undo toast stays 5 seconds
const SMALL_CONFETTI = 14;       // pieces when one habit is done
const BIG_CONFETTI = 40;         // pieces when the whole day is done
const MARKER_ICONS = { wake: "wb_sunny", sleep: "bedtime", activity: "radio_button_unchecked" };
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];                  // Monday first, like getWeek()
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];


/* ---------- 4. Page state ---------- */

let lastLogId = null;            // the log Undo would remove
let toastTimer = null;           // so a new toast can cancel the old timer
let justFinishedId = null;       // the habit that JUST hit its target: it stays the big card with "Keep going"


/* ---------- 5. Helpers ---------- */

// The time right now as "HH:MM", e.g. "07:05". Same format as routine times, so we can compare them.
function nowTime() {
    const now = new Date();
    return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}

// "Sunday 11 October"   (en-GB writes it without a comma)
function formatToday() {
    return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// 05:00–11:59 morning, 12:00–16:59 afternoon, the rest evening.
function greetingWord(hour) {
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
}

// What to show as a habit's progress.
//   amount habit     → "4 / 10 pages"
//   done/not-done    → "Done" or "Not done yet"
function formatAmount(item) {
    const habit = item.habit;
    if (habit.type === "completion") return item.status === "done" ? "Done" : "Not done yet";
    return `${item.amount} / ${habit.target} ${habit.unit}`.trim();
}

// How far a habit is, as a percent for a bar: 4 of 10 → 40. Never above 100.
function percentOf(item) {
    return Math.min(100, Math.round((item.amount / item.habit.target) * 100));
}

// Anything above the target: did 2 pages, target 1 → 1. Otherwise 0.
function extraOf(item) {
    const extra = item.amount - item.habit.target;
    return extra > 0 ? Math.round(extra * 100) / 100 : 0;
}

// A habit still waiting for you today (not done, not skipped)?
function isOpen(item) {
    return item.kind === "habit" && item.status !== "done" && item.status !== "skipped";
}

// Which habit is NOW? Returns { habitId, badge } or null when nothing is open.
//   1. The habit you JUST finished stays now (so "Keep going" has a place).
//   2. The earliest open habit whose time has passed  → "Still to do"
//   3. Otherwise the next open habit coming up         → "Up next"
//   4. Otherwise an open habit with no time            → "Anytime"
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

// Copy a <template>'s content so we can fill it in.
function copyTemplate(template) {
    return template.content.firstElementChild.cloneNode(true);
}


/* ---------- 6. Renderers ---------- */

// Date, greeting, "2 of 5 done" and the ring.
function renderHeader(summary) {
    todayDateText.textContent = formatToday();
    const name = getName();
    const word = greetingWord(new Date().getHours());
    greeting.textContent = name ? `${word}, ${name}` : word;

    if (summary.total === 0) {
        dayCount.textContent = "Rest day";
        dayRing.style.strokeDashoffset = RING_LENGTH;            // empty ring
        return;
    }
    dayCount.textContent = `${summary.done} of ${summary.total} done`;
    dayRing.style.strokeDashoffset = RING_LENGTH * (1 - summary.done / summary.total);
}

// The goal card. Hidden if there's no goal (shouldn't happen after onboarding, but never crash).
function renderGoal() {
    const goal = getGoals()[0];
    goalStrip.hidden = !goal;
    if (!goal) return;

    const progress = getGoalProgress(goal);
    const daysLeft = getDaysLeft(goal);
    goalTitle.textContent = goal.title;
    goalBarFill.style.width = progress.percent + "%";
    goalBar.setAttribute("aria-valuenow", progress.percent);

    if (daysLeft === null) goalDays.textContent = "";
    else if (daysLeft > 0) goalDays.textContent = `${daysLeft} days left`;
    else if (daysLeft === 0) goalDays.textContent = "Due today";
    else goalDays.textContent = "Past the date";

    const unit = goal.measure === "milestones" ? "steps" : goal.measure === "consistency" ? "check-ins" : goal.unit;
    goalNumbers.textContent = `${progress.done} / ${progress.target} ${unit} · ${progress.percent}%`;
}

// Wake up / Sleep marker.
function buildMarker(item) {
    const li = copyTemplate(markerTemplate);
    li.querySelector(".line-dot").textContent = MARKER_ICONS[item.kind] || MARKER_ICONS.activity;
    li.querySelector(".item-time").textContent = item.time;
    li.querySelector(".marker-label").textContent = item.label;
    return li;
}

// A small habit row. late = its time has passed and nothing is logged.
function buildRow(item, late) {
    const li = copyTemplate(rowTemplate);
    const habit = item.habit;
    li.dataset.habitId = habit.id;
    li.querySelector(".row-name").textContent = item.label;
    li.querySelector(".item-time").textContent = item.time || "Anytime";

    // Status text and the class the CSS uses for the dot
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

    // "+1 extra" tag
    const extra = extraOf(item);
    if (extra > 0) {
        const tag = li.querySelector(".row-extra");
        tag.hidden = false;
        tag.textContent = `+${extra} extra`;
    }

    // The round button: "+" for amounts, a tick for done/not-done. None when skipped or ticked.
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
    return li;
}

// The big NOW card.
function buildNow(item, badge) {
    const li = copyTemplate(nowTemplate);
    const habit = item.habit;
    const finished = badge === "Done";
    li.dataset.habitId = habit.id;
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
    if (finished) {
        // Just hit the target: "Next" moves on, "Keep going +1" adds extra
        focusButton.disabled = false;
        focusButton.dataset.action = "next";
        focusButton.textContent = "Next";
        addButton.textContent = `Keep going +${getStep(habit)}`;
    } else if (habit.type === "completion") {
        addButton.textContent = "Mark done";
    } else {
        addButton.textContent = `+${getStep(habit)}`;
        addButton.setAttribute("aria-label", `Add ${getStep(habit)} ${habit.unit} to ${habit.name}`);
    }
    return li;
}

// "All done today" card.
function buildAllDone(summary) {
    const li = copyTemplate(allDoneTemplate);
    li.querySelector(".all-done-text").textContent = `${summary.done} of ${summary.total} habits. Great work.`;
    return li;
}

// The whole line, top to bottom.
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
            // Nothing open left: the "All done" card goes just before Sleep
            if (!now && !allDoneShown && item.kind === "sleep") {
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

    // No Sleep marker in the routine? Put "All done" at the end.
    if (!now && !allDoneShown) dayLine.append(buildAllDone(summary));
}
// The week card: 7 dots (Mon → Sun), "9 / 20 check-ins", and the streak.
function renderWeek() {
    const week = getWeek();
    const today = todayDate();
    weekDays.innerHTML = "";

    week.forEach((day, i) => {
        const li = document.createElement("li");
        li.className = `week-day is-${day.state}`;           // is-done, is-partial, is-missed... → CSS colours the dot
        if (day.date === today) li.classList.add("is-today");

        // What a screen reader says, e.g. "Monday: 3 of 4 done" or "Saturday: rest day"
        let words;
        if (day.state === "rest") words = "rest day";
        else if (day.state === "future" || day.state === "before") words = "nothing yet";
        else words = `${day.done} of ${day.due} done`;
        li.setAttribute("aria-label", `${DAY_NAMES[i]}: ${words}`);

        const letter = document.createElement("span");
        letter.className = "week-letter";
        letter.textContent = DAY_LETTERS[i];
        letter.setAttribute("aria-hidden", "true");           // the aria-label already says the day

        const dot = document.createElement("span");
        dot.className = "week-dot";

        li.append(letter, dot);
        weekDays.append(li);
    });

    // Check-ins: every habit on every day of the week, from your start day on.
    // Future days count in the total: "9 / 20" = 20 planned this week, 9 done so far.
    const counted = week.filter(day => day.state !== "before");
    const done = counted.reduce((sum, day) => sum + day.done, 0);
    const due = counted.reduce((sum, day) => sum + day.due, 0);
    weekCount.textContent = `${done} / ${due} check-ins`;

    // 0 → an encouraging line instead of "0-day streak"
    const streak = getStreak();
    if (streak === 0) weekStreak.textContent = "Finish today to start a streak";
    else if (streak === 1) weekStreak.textContent = "1-day streak";
    else weekStreak.textContent = `${streak}-day streak`;
}

// "Review your day" from 18:00.
function renderReviewCard() {
    reviewCard.hidden = new Date().getHours() < REVIEW_HOUR;
}

// Redraw everything from the saved data. Called after every change.
function updatePage() {
    const plan = getDayPlan();
    const summary = getDaySummary();
    renderHeader(summary);
    renderGoal();
    renderWeek();         
    renderLine(plan, summary);
    renderReviewCard();
}


/* ---------- 7. Actions ---------- */

// +1 (or a tick) on a habit.
function addOne(habitId) {
    const habit = getHabitById(habitId);
    if (!habit) return;
    if (habitId !== justFinishedId) justFinishedId = null;   // working on another habit: the old "Done" card can shrink

    const before = getHabitStatus(habit);
    const step = getStep(habit);
    const log = addLog(habitId, step);
    const after = getHabitStatus(habit);
    lastLogId = log.id;

    // Just reached the target: celebrate, and keep it as the big card (except tick habits)
    if (before !== "done" && after === "done") {
        justFinishedId = habit.type === "completion" ? null : habit.id;
        const summary = getDaySummary();
        throwConfetti(summary.done === summary.total ? BIG_CONFETTI : SMALL_CONFETTI);
    }

    showToast(habit.type === "completion" ? `${habit.name} done` : `Added ${step} ${habit.unit}`.trim());
    updatePage();
    focusHabit(habitId);
}

// Undo the last +1.
function undoLast() {
    if (!lastLogId) return;
    const log = getLogs().find(item => item.id === lastLogId);
    removeItem("logs", lastLogId);
    lastLogId = null;

    // Still done after the undo (e.g. 2 pages → 1, target 1)? Keep the "Done" card. Otherwise let it go.
    const habit = log ? getHabitById(log.habitId) : null;
    if (!habit || getHabitStatus(habit) !== "done") justFinishedId = null;

    hideToast();
    updatePage();
}

// "Next" after finishing: let the big card move on.
function moveOn() {
    justFinishedId = null;
    updatePage();
}

// After a redraw the old buttons are gone. Put the keyboard focus back on the same habit.
function focusHabit(habitId) {
    const button = dayLine.querySelector(`[data-habit-id="${habitId}"] [data-action="add"]:not([hidden])`);
    if (button) button.focus();
}

function showToast(message) {
    toastText.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);                          // a new toast restarts the 5 seconds
    toastTimer = setTimeout(hideToast, TOAST_MS);
}

function hideToast() {
    toast.hidden = true;
    clearTimeout(toastTimer);
}

// Small pieces fall from the top middle of the screen, then remove themselves.
function throwConfetti(count) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < count; i++) {
        const piece = document.createElement("span");
        piece.className = "confetti-piece";
        piece.style.left = (35 + Math.random() * 30) + "%";            // somewhere in the middle third
        piece.style.top = (10 + Math.random() * 15) + "%";
        piece.style.setProperty("--x", (Math.random() * 160 - 80) + "px");  // drift left or right
        piece.style.setProperty("--turn", (Math.random() * 720 - 360) + "deg");
        piece.style.animationDelay = (Math.random() * 150) + "ms";
        piece.addEventListener("animationend", () => piece.remove());
        confetti.append(piece);
    }
}


/* ---------- 8. Page load ---------- */

if (ready) {
    updatePage();
}


/* ---------- 9. Events ---------- */

// One listener for the whole line (event delegation): which button, which habit?
dayLine.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const habitId = button.closest("[data-habit-id]")?.dataset.habitId;
    if (button.dataset.action === "add" && habitId) addOne(habitId);
    if (button.dataset.action === "next") moveOn();
});

undoButton.addEventListener("click", undoLast);

// Redraw without losing the keyboard focus (used by the timer and when you come back to the tab).
function refresh() {
    if (!ready) return;
    const focused = document.activeElement.closest("[data-habit-id]");
    updatePage();
    if (focused) focusHabit(focused.dataset.habitId);
}

// Time moves: redraw every minute so "now" follows the clock (and a new day starts at midnight).
setInterval(refresh, 60 * 1000);

// Coming back to the tab after a while: redraw straight away.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
});