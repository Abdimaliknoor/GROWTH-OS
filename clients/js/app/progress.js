/* ╔══════════════════════════════════════════════════════════════╗
   ║  PROGRESS  ·  js/app/progress.js                             ║
   ║  Draws the numbers from insight.js. Never calculates them.   ║
   ╚══════════════════════════════════════════════════════════════╝

   Every panel follows the same 3 steps: a question → the answer → one sentence.
   Every colour comes from ONE scale (levelOf): green ≥ 80 · white 60–79 · red < 60.

   LAYOUT  left: one panel per goal (main first), its habits inside it
           right: showing up · focus (split by goal) · skips

   DATA   insight.js section 9: getRange, getConsistency, getHabitRates,
          getFocusTotals, getFocusByGoal, getSkipReasons, getProgressSummary,
          getBestStreak · streaks: getStreak, getStreak(goalId), getHabitStreak

   MAP
     1. Guard     2. Elements     3. Settings     4. Page state
     5. Helpers   6. Renderers    7. Actions      8. Page load    9. Events
   ══════════════════════════════════════════════════════════════════ */


/* ════════════════════ 1. GUARD ════════════════════ */

const progressReady = isOnboardingComplete();
if (!progressReady) {
    window.location.replace("../startup/welcome.html");
}


/* ════════════════════ 2. ELEMENTS ════════════════════ */

// ── Top: range + summary ──
const rangeLabel = document.getElementById("rangeLabel");
const rangeChips = document.getElementById("rangeChips");
const summaryText = document.getElementById("summaryText");
const summaryLink = document.getElementById("summaryLink");
// ── Left: your goals (each with its habits) ──
const goalPanels = document.getElementById("goalPanels");
const goalsEmpty = document.getElementById("goalsEmpty");
const ratesSays = document.getElementById("ratesSays");

// ── 2. Showing up ──
const consistencyPercent = document.getElementById("consistencyPercent");
const scoreBox = document.getElementById("scoreBox");
const scoreRing = document.getElementById("scoreRing");
const scoreWord = document.getElementById("scoreWord");
const consistencySays = document.getElementById("consistencySays");
const streakBox = document.getElementById("streakBox");
const streakNumber = document.getElementById("streakNumber");
const streakLabel = document.getElementById("streakLabel");
const squares = document.getElementById("squares");

// ── 4. Focus ──
const focusTime = document.getElementById("focusTime");
const focusSays = document.getElementById("focusSays");
const focusChange = document.getElementById("focusChange");
const focusSplit = document.getElementById("focusSplit");
const focusStack = document.getElementById("focusStack");
const focusLegend = document.getElementById("focusLegend");

// ── 5. Skips ──
const reasonsSays = document.getElementById("reasonsSays");
const reasonList = document.getElementById("reasonList");
const reasonsEmpty = document.getElementById("reasonsEmpty");

// ── Templates ──
const goalPanelTemplate = document.getElementById("goalPanelTemplate");
const rateTemplate = document.getElementById("rateTemplate");
const reasonTemplate = document.getElementById("reasonTemplate");


/* ════════════════════ 3. SETTINGS ════════════════════ */

const RANGE_LABELS = { week: "This week", month: "Last 30 days", all: "All time" };
const GREAT_PERCENT = 80;                    // at or above: green "Great" / "Strong"
const WEAK_PERCENT = 60;                     // below: red "Tough" / "Needs attention"
const SCORE_RING = 2 * Math.PI * 28;         // the score ring's length (r = 28), same as progress.css


/* ════════════════════ 4. PAGE STATE ════════════════════ */

let rangeName = "month";


/* ════════════════════ 5. HELPERS ════════════════════ */

// The ONE scale for the whole page:  93 → "great" · 70 → "good" · 42 → "tough"
function levelOf(percent) {
    if (percent >= GREAT_PERCENT) return "great";
    if (percent >= WEAK_PERCENT) return "good";
    return "tough";
}

// 400 → "6h 40m"   ·   45 → "45m"   (short: it sits in a big number)
function formatMinutes(total) {
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours === 0) return `${minutes}m`;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

// "2026-12-14" → "14 Dec"
function shortDate(date) {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// The days of the CURRENT streak (newest first), counting back from today:
// done days join it, rest days and an unfinished today are stepped over, anything else ends it.
function getStreakDates(days) {
    const dates = new Set();
    for (let i = days.length - 1; i >= 0; i--) {
        const day = days[i];
        if (countsForStreak(day.state)) dates.add(day.date);       // same rule as the 🔥 number (insight.js)
        else if (pausesStreak(day.state, day.date)) continue;
        else break;
    }
    return dates;
}

function copyTemplate(template) {
    return template.content.firstElementChild.cloneNode(true);
}


/* ════════════════════ 6. RENDERERS ════════════════════ */

// ── Left: one panel per goal (main first), its habits inside ──
function renderGoals(rates) {
    const goals = getActiveGoals();
    goalsEmpty.hidden = goals.length > 0;
    goalPanels.replaceChildren(...goals.map(goal => buildGoalPanel(goal, rates)));
}

// One goal: dot + name + 🔥, bar, "8 of 20 pages", pace badge, then ITS habits
function buildGoalPanel(goal, rates) {
    const panel = copyTemplate(goalPanelTemplate);
    panel.dataset.color = goal.color;                    // app.css → var(--goal): edge, dot, bar

    const progress = getGoalProgress(goal);
    const unit = goal.measure === "milestones" ? "steps" : goal.measure === "consistency" ? "check-ins" : goal.unit;
    panel.querySelector(".goal-name").textContent = goal.title;
    panel.querySelector(".bar-fill").style.width = progress.percent + "%";
    const bar = panel.querySelector(".goal-bar");
    bar.setAttribute("aria-valuenow", progress.percent);
    bar.setAttribute("aria-label", `${goal.title}: ${progress.percent}%`);
    panel.querySelector(".goal-says").textContent = `${progress.done} of ${progress.target} ${unit} done (${progress.percent}%).`;

    // 🔥 goal streak: ALL its habits done, days in a row (insight.js). Hidden at 0.
    const streak = getStreak(goal.id);
    const flame = panel.querySelector(".goal-streak");
    flame.hidden = streak === 0;
    panel.querySelector(".goal-streak-count").textContent = streak === 1 ? "1 day" : `${streak} days`;
    flame.title = "Days in a row with all of this goal's habits done";

    fillPace(panel, goal, unit);

    // Its habits, strongest first (rates is already sorted)
    const own = rates.filter(rate => rate.habit.goalId === goal.id && rate.due > 0);
    panel.querySelector(".goal-rates").replaceChildren(...own.map(buildRate));
    panel.querySelector(".goal-rates-empty").hidden = own.length > 0;
    return panel;
}

// On track? A badge + one line. Same colours as the score.
function fillPace(panel, goal, unit) {
    const pace = getGoalPace(goal);
    const finish = pace.finishDate ? shortDate(pace.finishDate) : "";
    const words = {
        done:   ["Reached", "You hit your finish line 🎉"],
        ahead:  ["On track", `At this pace you finish around ${finish}.`],
        behind: ["Behind", `At this pace you finish around ${finish}. Aim for ${pace.needPerDay} ${unit} a day to make your date.`],
        start:  ["Not started", `Log your first ${unit} to see your pace.`]
    }[pace.state];
    const box = panel.querySelector(".pace");
    box.hidden = !words;
    if (!words) return;
    box.classList.add(`is-${pace.state}`);
    panel.querySelector(".pace-badge").textContent = words[0];
    panel.querySelector(".pace-text").textContent = words[1];
}

// ── 2. Showing up: score ring, 🔥 streak, a square per day ──
function renderConsistency(consistency) {
    const streak = getStreak();
    const best = getBestStreak();

    consistencyPercent.textContent = consistency.planned ? `${consistency.percent}%` : "–";

    // The ring fills to the %, and its colour + word say how good that is
    const level = consistency.planned ? levelOf(consistency.percent) : "";
    const gentle = level === "tough" && isFirstWeek();      // week 1: amber "Warming up", not red "Tough"
    scoreBox.className = `score ${gentle ? "is-warming" : level ? "is-" + level : ""}`;
    scoreWord.textContent = gentle ? "Warming up" : { great: "Great", good: "Good", tough: "Tough", "": "" }[level];
    scoreRing.style.strokeDashoffset = SCORE_RING * (1 - consistency.percent / 100);
    consistencySays.textContent = consistency.planned
        ? `You did ${consistency.done} of the ${consistency.planned} habits you planned. Best streak so far: ${best} ${best === 1 ? "day" : "days"}.`
        : "Nothing to count yet. Your days show up here once they're done.";

    streakNumber.textContent = streak;
    streakBox.classList.toggle("is-cold", streak === 0);
    streakLabel.textContent = streak === 0 ? "Do one habit today to start one" : `${streak === 1 ? "day" : "days"} in a row`;

    // Empty squares before the first day, so it starts under the right weekday
    const firstWeekday = WEEK_DAYS.indexOf(weekdayOf(consistency.days[0].date));
    const blanks = Array.from({ length: firstWeekday }, () => {
        const li = document.createElement("li");
        li.className = "square is-blank";
        return li;
    });

    const today = todayDate();
    const streakDates = getStreakDates(consistency.days);
    const newestStreakDay = [...streakDates][0];          // the Set was filled newest first
    const days = consistency.days.map((day, i) => {
        const li = document.createElement("li");
        li.className = `square is-${day.state}`;
        if (day.date === today) li.classList.add("is-today");
        if (streakDates.has(day.date)) {
            li.classList.add("is-streak");
            const before = consistency.days[i - 1];
            // Joined to the day before, unless it's a Monday (start of a new row)
            if (before && streakDates.has(before.date) && weekdayOf(day.date) !== "mon") li.classList.add("is-linked");
            if (day.date === newestStreakDay) li.classList.add("is-streak-end");
        }
        li.title = `${shortDate(day.date)}: ${day.state === "rest" ? "rest day" : `${day.done} of ${day.due} done`}`;
        return li;
    });
    squares.replaceChildren(...blanks, ...days);
}

// ── One sentence about ALL habits, over the goals (the bars live inside each goal) ──
function renderRatesSentence(rates) {
    const shown = rates.filter(rate => rate.due > 0);

    // One line on top: the best one, and the one to fix (if any)
    const weakest = shown.at(-1);
    ratesSays.hidden = shown.length < 2;
    
     if (isFirstWeek()) {
        ratesSays.hidden = shown.length === 0;
        ratesSays.textContent = "Too early to judge a habit. After your first week, this shows which ones are strong.";
        return;
    }
    ratesSays.textContent = weakest && weakest.percent < WEAK_PERCENT
        ? `${shown[0].habit.name} is your strongest. ${weakest.habit.name} needs attention: try a smaller target or a better time.`
        : `${shown[0]?.habit.name} is your strongest. No habit is below ${WEAK_PERCENT}%.`;
}

function buildRate(rate) {
    const li = copyTemplate(rateTemplate);

    const level = levelOf(rate.percent);
    const gentle = level === "tough" && isFirstWeek();      // week 1: "Early days", not red "Needs attention"
    li.classList.add(gentle ? "is-warming" : `is-${level}`);
    li.querySelector(".rate-name").textContent = rate.habit.name;

    // 🔥 its own streak (insight.js). Hidden at 0.
    const streak = getHabitStreak(rate.habit);
    li.querySelector(".rate-streak").hidden = streak === 0;
    li.querySelector(".rate-streak-count").textContent = streak;
    li.querySelector(".rate-streak").setAttribute("aria-label", `${streak} days in a row`);
    li.querySelector(".rate-word").textContent = gentle ? "Early days" : { great: "Strong", good: "Okay", tough: "Needs attention" }[level];
    li.querySelector(".rate-percent").textContent = `${rate.percent}%`;
    li.querySelector(".rate-days").textContent = `${rate.done} of ${rate.due} days`;

    const bar = li.querySelector(".bar");
    bar.setAttribute("aria-label", `${rate.habit.name}: ${rate.percent}%`);
    bar.setAttribute("aria-valuenow", rate.percent);
    li.querySelector(".bar-fill").style.width = rate.percent + "%";
    return li;
}

// ── 4. Focus: total, sessions, mood, and ↑ / ↓ vs the period before ──
function renderFocus(range) {
    const focus = getFocusTotals(range);
    focusTime.textContent = formatMinutes(focus.minutes);
    focusChange.hidden = true;
    renderFocusSplit(range, focus.minutes);
    if (focus.sessions === 0) {
        focusSays.textContent = "No focus sessions yet. Start one from Today.";
        return;
    }
    const mood = focus.mood ? ` You felt ${focus.mood} / 5 on average.` : "";
    focusSays.textContent = `In ${focus.sessions} ${focus.sessions === 1 ? "session" : "sessions"}.${mood}`;

    const previous = getPreviousRange(range);
    if (!previous || rangeName === "all") return;
    const before = getFocusTotals(previous).minutes;
    const difference = focus.minutes - before;
    if (difference === 0) return;
    const period = { week: "the week before", month: "the 30 days before" }[rangeName];
    focusChange.hidden = false;
    focusChange.className = `change ${difference > 0 ? "is-up" : "is-down"}`;
    focusChange.textContent = `${difference > 0 ? "↑" : "↓"} ${formatMinutes(Math.abs(difference))} ${difference > 0 ? "more" : "less"} than ${period}`;
}

// Which goal got the time: a bar split by colour + "● Quran   5h 35m". Only with 2+ goals.
function renderFocusSplit(range, total) {
    const parts = getFocusByGoal(range);
    focusSplit.hidden = getActiveGoals().length < 2 || total === 0;
    if (focusSplit.hidden) return;

    focusStack.replaceChildren(...parts.map(part => {
        const piece = document.createElement("span");
        piece.dataset.color = part.goal.color;
        piece.style.width = `${(part.minutes / total) * 100}%`;
        return piece;
    }));
    focusLegend.replaceChildren(...parts.map(part => {
        const li = document.createElement("li");
        li.dataset.color = part.goal.color;
        const dot = document.createElement("span");
        dot.className = "goal-dot";
        const name = document.createElement("span");
        name.className = "focus-legend-name";
        name.textContent = part.goal.title;               // textContent: plain text, always safe
        const time = document.createElement("span");
        time.className = "focus-legend-time";
        time.textContent = formatMinutes(part.minutes);
        li.append(dot, name, time);
        return li;
    }));
}

// ── 5. Skips: a sentence, then each reason with its count ──
function renderReasons(range) {
    const reasons = getSkipReasons(range);
    reasonsEmpty.hidden = reasons.length > 0;
    reasonsSays.hidden = reasons.length === 0;
    if (reasons.length) {
        const total = reasons.reduce((sum, item) => sum + item.count, 0);
        reasonsSays.textContent = `${total} ${total === 1 ? "skip" : "skips"}, mostly "${reasons[0].reason}". Skips with a reason never break your streak.`;
    }
    reasonList.replaceChildren(...reasons.map(item => {
        const li = copyTemplate(reasonTemplate);
        li.querySelector(".reason-text").textContent = item.reason;
        li.querySelector(".reason-count").textContent = `×${item.count}`;
        return li;
    }));
}

// ── Redraw everything for the chosen range ──
function updatePage() {
    const range = getRange(rangeName);
    const consistency = getConsistency(range);
    const rates = getHabitRates(range);

    rangeLabel.textContent = RANGE_LABELS[rangeName];
    rangeChips.querySelectorAll("[data-range]").forEach(chip => {
        chip.setAttribute("aria-pressed", chip.dataset.range === rangeName);
    });

    summaryText.textContent = getProgressSummary(rangeName, consistency, rates);
    // Week 1 with nothing done yet → a way straight to Today
    const sinceStart = getConsistency({ from: getStartDate(), to: todayDate() });
    summaryLink.hidden = !(isFirstWeek() && sinceStart.done === 0);
    renderRatesSentence(rates);
    renderGoals(rates);
    renderConsistency(consistency);
    renderFocus(range);
    renderReasons(range);
}


/* ════════════════════ 7. ACTIONS ════════════════════ */

function chooseRange(name) {
    rangeName = name;
    updatePage();
}


/* ════════════════════ 8. PAGE LOAD ════════════════════ */

if (progressReady) {
    updatePage();
}


/* ════════════════════ 9. EVENTS ════════════════════ */

rangeChips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-range]");
    if (chip) chooseRange(chip.dataset.range);
});