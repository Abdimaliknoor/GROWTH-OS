/* =========================================================
   COMPLETE PAGE  (startup/setup.html)

   What this page does:
     Shows the system the user just built:
       Direction → Goal → Habits → Routine
     plays the "you did it" moment, and on "Enter Growth OS"
     marks onboarding as finished and opens the dashboard.

   It only READS data. The one thing it saves is
   completeOnboarding() when the button is pressed.

   1. Guard   2. Elements   3. Settings   4. Text helpers
   5. Renderers   6. Animation helpers   7. Page load   8. Events
   ========================================================= */


/* ---------- 1. Guard ---------- */

// Every step must be done. If one is missing, send them to it.
const goal = getGoals()[0] || null;
const habits = goal ? getHabitsForGoal(goal.id) : [];
const routine = getRoutine();

let missingStep = null;
if (!goal) missingStep = "goal.html";
else if (habits.length === 0) missingStep = "habit.html";
else if (routine.length === 0) missingStep = "routine.html";

if (missingStep) {
    window.location.replace(missingStep);   // replace: "Back" won't return here
}


/* ---------- 2. Elements ---------- */

const doneBadge = document.getElementById("doneBadge");
const heroTitle = document.getElementById("heroTitle");
const directionIcon = document.getElementById("directionIcon");
const directionArea = document.getElementById("directionArea");
const directionIdentity = document.getElementById("directionIdentity");
const goalTitle = document.getElementById("goalTitle");
const goalFinish = document.getElementById("goalFinish");
const habitList = document.getElementById("habitList");
const routineList = document.getElementById("routineList");
const statHabits = document.getElementById("statHabits");
const statWeek = document.getElementById("statWeek");
const statWake = document.getElementById("statWake");
const enterButton = document.getElementById("enterButton");


/* ---------- 3. Settings ---------- */

const SPARK_COUNT = 12;
const STATS_DELAY = 2300;        // ms: start counting when the stats card has risen in

// true when the user turned off animations in their device settings
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


/* ---------- 4. Text helpers ---------- */

// The goal's finish line in words.
function describeFinish() {
    switch (goal.measure) {
        case "total":      return `${goal.target} ${goal.unit} in total`;
        case "level":      return `Can do ${goal.target} ${goal.unit}`;
        case "milestones": return `${goal.milestones.length} steps to complete`;
        default:           return "Done by staying consistent";
    }
}

// "2027-03-31" → "31 Mar 2027". Split by hand = local date, no UTC surprise.
function formatDate(dateText) {
    const [year, month, day] = dateText.split("-").map(Number);
    return new Date(year, month - 1, day)
        .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Routine items grouped per thing: one habit can have several items.
//   [wake 06:00, memo 05:30 weekdays, memo 08:00 weekends, sleep 22:00]
//   → [ { label: "Wake up", items: [...] }, { label: "Memorize new", items: [2 items] }, ... ]
// Order: wake, habits (in habit order), other activities, sleep.
function groupRoutine() {
    const groups = [];
    const keyOf = item => item.kind === "habit" ? item.habitId : item.kind;

    routine.forEach(item => {
        const found = groups.find(group => group.key === keyOf(item));
        if (found) found.items.push(item);
        else groups.push({ key: keyOf(item), kind: item.kind, label: item.label, items: [item] });
    });

    const rank = group => {
        if (group.kind === "wake") return -1;
        if (group.kind === "sleep") return 1000;
        const index = habits.findIndex(habit => habit.id === group.key);
        return index === -1 ? 500 : index;           // activities after habits
    };
    return groups.sort((a, b) => rank(a) - rank(b));
}

// One group's times: "05:30 Weekdays / 08:00 Weekends"
function describeTimes(items) {
    return items
        .map(item => `${item.time || "--:--"} ${describeDays(item.days)}`)
        .join(" / ");
}


/* ---------- 5. Renderers ---------- */

// A row: name on the left, small text on the right.
// textContent everywhere: names are the user's own text.
function createRow(name, extra, side) {
    const row = document.createElement("li");
    row.className = "row";

    const left = document.createElement("span");
    left.className = "row-name";
    left.textContent = name;
    if (extra) {
        const small = document.createElement("small");
        small.textContent = ` · ${extra}`;
        left.append(small);
    }

    const right = document.createElement("span");
    right.className = "row-side";
    right.textContent = side;

    row.append(left, right);
    return row;
}

function renderHero() {
    const name = getName();
    if (name) heroTitle.textContent = `${name}, your growth system is ready`;
}

function renderDirection() {
    const direction = getDirection();
    const area = getAreaById(direction.area);         // from areas.js, null for "Other"
    directionIcon.textContent = area ? area.icon : "explore";
    directionArea.textContent = direction.areaLabel || (area ? area.label : "Your direction");
    directionIdentity.textContent = direction.identity;
    directionIdentity.hidden = !direction.identity;  // no empty line if there's no identity
}

function renderGoal() {
    goalTitle.textContent = goal.title;
    const deadline = goal.deadline ? ` · By ${formatDate(goal.deadline)}` : "";
    goalFinish.textContent = describeFinish() + deadline;
}

function renderHabits() {
    habitList.innerHTML = "";
    habits.forEach(habit => {
        // A done/not-done habit has no amount to show.
        const amount = habit.type === "completion" ? "" : describeHabitAmount(habit);
        habitList.append(createRow(habit.name, amount, describeDays(habit.days)));
    });
}

function renderRoutine() {
    routineList.innerHTML = "";
    groupRoutine().forEach(group => {
        routineList.append(createRow(group.label, "", describeTimes(group.items)));
    });
}

function renderStats() {
    // Check-ins a week: a habit on 5 days = 5 check-ins.
    const perWeek = habits.reduce((sum, habit) => sum + habit.days.length, 0);
    const wake = getRoutineForDay(todayDate()).find(item => item.kind === "wake");

    statWake.textContent = wake && wake.time ? wake.time : "--:--";
    countUp(statHabits, habits.length);
    countUp(statWeek, perWeek);
}


/* ---------- 6. Animation helpers ---------- */

// Count from 0 to the target, after the stats card has appeared.
// requestAnimationFrame = "run this before the next screen paint" (about 60 times a second).
function countUp(element, target) {
    if (reduceMotion) {
        element.textContent = target;
        return;
    }
    const duration = 700;
    setTimeout(() => {
        const start = performance.now();
        function step(now) {
            const progress = Math.min((now - start) / duration, 1);   // 0 → 1
            element.textContent = Math.round(target * progress);
            if (progress < 1) requestAnimationFrame(step);            // not done: next frame
        }
        requestAnimationFrame(step);
    }, STATS_DELAY);
}

// 12 sparks around the badge, every 30 degrees. CSS does the flying.
// --angle and --distance are CSS variables the @keyframes spark reads.
function addSparks() {
    if (reduceMotion) return;
    for (let i = 0; i < SPARK_COUNT; i++) {
        const spark = document.createElement("span");
        spark.className = "spark";
        spark.style.setProperty("--angle", `${i * (360 / SPARK_COUNT)}deg`);
        spark.style.setProperty("--distance", i % 2 === 0 ? "-80px" : "-64px");  // long, short, long...
        doneBadge.append(spark);
    }
}


/* ---------- 7. Page load ---------- */

// Wrapped: location.replace() doesn't stop this script, and goal may be null.
if (!missingStep) {
    renderHero();
    renderDirection();
    renderGoal();
    renderHabits();
    renderRoutine();
    renderStats();
    addSparks();
}


/* ---------- 8. Events ---------- */

enterButton.addEventListener("click", () => {
    enterButton.disabled = true;             // no double clicks
    completeOnboarding();
    window.location.replace("../startup.html");   // the dashboard; Back won't return to setup
});