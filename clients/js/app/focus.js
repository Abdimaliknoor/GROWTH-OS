/* =========================================================
   FOCUS  (app/focus.html)

   What this page does:
     One habit, one timer. Choose 15 / 25 / 45 min, Start,
     Pause / Resume, Finish → the finish sheet saves your progress.

   Where the data comes from:
     startFocus(), pauseFocus()...      → state.js   (save)
     getFocusElapsed(), getFocusStage() → insights.js (calculate)
   This file only DRAWS and reacts to clicks.

   1. Guard   2. Elements   3. Settings   4. Page state
   5. Helpers   6. Renderers   7. Actions   8. Page load   9. Events
   ========================================================= */


/* ---------- 1. Guard ---------- */

// Not finished onboarding? Nothing to focus on yet.
const focusReady = isOnboardingComplete();
if (!focusReady) {
    window.location.replace("../startup/welcome.html");
}

// Which session? An open one ALWAYS wins (only one at a time),
// whatever habit the address says. Otherwise: no session yet.
let currentSession = getActiveFocus();

// Its habit was deleted? That session can never finish: throw it away.
if (currentSession && !getHabitById(currentSession.habitId)) {
    cancelFocus(currentSession.id);
    currentSession = null;
}

// Which habit? The session's, or the one in the address: focus.html?habit=h2
// URLSearchParams reads the part after "?" for us.
const habitIdFromUrl = new URLSearchParams(window.location.search).get("habit");
const currentHabit = getHabitById(currentSession ? currentSession.habitId : habitIdFromUrl);

// No habit at all (bad or missing ?habit=)? Back to Today.
if (focusReady && !currentHabit) {
    window.location.replace("today.html");
}

const pageOk = focusReady && Boolean(currentHabit);


/* ---------- 2. Elements ---------- */

const focusMain = document.querySelector(".focus");
const habitName = document.getElementById("habitName");
const habitProgress = document.getElementById("habitProgress");
const targetChips = document.getElementById("targetChips");
const focusStatus = document.getElementById("focusStatus");
const statusText = document.getElementById("statusText");
const clockRing = document.getElementById("clockRing");
const clockTime = document.getElementById("clockTime");
const clockSub = document.getElementById("clockSub");
const clockText = document.getElementById("clockText");
const clockEdit = document.getElementById("clockEdit");
const clockEditor = document.getElementById("clockEditor");
const targetInput = document.getElementById("targetInput");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const pauseIcon = document.getElementById("pauseIcon");
const pauseText = document.getElementById("pauseText");
const finishButton = document.getElementById("finishButton");
const counter = document.getElementById("counter");
const counterValue = document.getElementById("counterValue");
const finishSheet = document.getElementById("finishSheet");
const sheetTitle = document.getElementById("sheetTitle");
const sheetHabit = document.getElementById("sheetHabit");
const sheetAmount = document.getElementById("sheetAmount");
const amountLabel = document.getElementById("amountLabel");
const amountInput = document.getElementById("amountInput");
const noteInput = document.getElementById("noteInput");
const saveButton = document.getElementById("saveButton");
const skipButton = document.getElementById("skipButton");
const discardButton = document.getElementById("discardButton");


/* ---------- 3. Settings ---------- */

const RING_LENGTH = 678.58;      // the clock ring: 2 × π × 108 (same number as in focus.css)
const DEFAULT_TARGET = 25;       // minutes, chosen when the page opens
const MIN_TARGET = 1;            // the shortest you can type
const MAX_TARGET = 180;          // the longest: 3 hours
const TICK_MS = 500;             // redraw the clock twice a second, so no second is ever skipped


/* ---------- 4. Page state ---------- */

let chosenTarget = DEFAULT_TARGET;   // the chip picked BEFORE starting (no session exists yet)
let tickTimer = null;                // the setInterval that moves the clock (null = not ticking)
let wakeLock = null;                 // the browser's "keep the screen on" handle (null = screen may sleep)

/* ---------- 5. Helpers ---------- */

// Milliseconds → clock text.
//   725000 → "12:05"      3725000 → "1:02:05"
// padStart(2, "0") adds a leading zero: 5 → "05".
function formatClock(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mmss = String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    return hours > 0 ? `${hours}:${mmss}` : mmss;
}

// The target right now: the session's once started, the chosen chip before.
function currentTarget() {
    return currentSession ? currentSession.targetMin : chosenTarget;
}

// Keep a typed number inside 1–180, in whole minutes.
//   "40" → 40     "500" → 180     "0" → 1     "abc" → null (not a number: ignore it)
function cleanTarget(text) {
    const minutes = Math.round(Number(text));
    if (!text || Number.isNaN(minutes)) return null;
    return Math.min(MAX_TARGET, Math.max(MIN_TARGET, minutes));
}

// The line under the habit name.
//   amount / time habit → "4 / 10 pages today"
//   done/not-done habit → "Done today" or "Not done yet today"
function progressText() {
    const done = getDayAmount(currentHabit.id);
    if (currentHabit.type === "completion") return done >= 1 ? "Done today" : "Not done yet today";
    return `${done} / ${currentHabit.target} ${currentHabit.unit} today`;
}


/* ---------- 6. Renderers ---------- */

// "Revise last hizb" + "4 / 10 pages today"
function renderHabit() {
    habitName.textContent = currentHabit.name;          // textContent: the user's own text, never HTML
    const progress = progressText();
    habitProgress.textContent = progress;
}

// The white chip = the chosen target. aria-pressed tells CSS AND screen readers.
function renderTargets() {
    targetChips.querySelectorAll("[data-target]").forEach(chip => {
        const pressed = Number(chip.dataset.target) === currentTarget();
        chip.setAttribute("aria-pressed", String(pressed));
    });
}

// Show the right parts for the stage. CSS reads data-stage for the look.
//   setup     → chips + Start
//   running   → "Recording" + Pause + Finish
//   paused    → "Paused"    + Resume + Finish
//   finishing → "Finished", no buttons (the finish sheet is on top)
function renderStage() {
    const stage = getFocusStage(currentSession);
    const before = stage === "setup";
    const live = stage === "running" || stage === "paused";
    focusMain.dataset.stage = stage;

    targetChips.hidden = !before;
    startButton.hidden = !before;
    focusStatus.hidden = before;
    pauseButton.hidden = !live;
    finishButton.hidden = !live;

    const paused = stage === "paused";
    if (paused) statusText.textContent = "Paused";
    else if (stage === "finishing") statusText.textContent = "Finished";
    else statusText.textContent = "Recording";
    pauseIcon.textContent = paused ? "play_arrow" : "pause";
    pauseText.textContent = paused ? "Resume" : "Pause";
}

// The big time and the ring.
//   before start → the target ("25:00"), full ring
//   started      → time focused so far, ring fills up toward the target
//   past target  → keeps counting, full ring, "Target reached"
function renderClock() {
    if (!currentSession) {
        clockTime.textContent = formatClock(chosenTarget * 60000);
        clockSub.textContent = "Tap to change";
        clockRing.style.strokeDashoffset = 0;
        focusMain.classList.remove("is-over");
        clockEdit.setAttribute("aria-label", `Focus length: ${chosenTarget} minutes. Change`);
        return;
    }

    const elapsed = getFocusElapsed(currentSession);
    const target = currentSession.targetMin * 60000;
    const over = elapsed >= target;

    clockTime.textContent = formatClock(elapsed);
    clockSub.textContent = over ? "Target reached" : `of ${formatClock(target)}`;
    clockRing.style.strokeDashoffset = RING_LENGTH * (1 - Math.min(1, elapsed / target));
    focusMain.classList.toggle("is-over", over);      // toggle(name, true/false) = add or remove
    clockEdit.setAttribute("aria-label", `Focus length: ${currentSession.targetMin} minutes. Change`);
}

// Redraw everything from the saved data.
// The − 7 pages + counter. Only for amount habits (pages, km...), and only after Start.
// The − button is disabled at 0: you can't read −1 pages.
function renderCounter() {
    const stage = getFocusStage(currentSession);
    const started = stage === "running" || stage === "paused";
    counter.hidden = !(started && currentHabit.type === "quantity");
    if (counter.hidden) return;

    counterValue.textContent = `${currentSession.amount} ${currentHabit.unit}`;
    counter.querySelector('[data-action="less"]').disabled = currentSession.amount <= 0;
}

// The finish sheet. Opens when the stage is "finishing" (also after a reload).
// Already open? Leave it alone: redrawing would wipe what you typed.
//   amount habit → "How many pages?" pre-filled with the counter
//   time habit   → no question: the minutes are logged for you
//   tick habit   → no question: it's logged as done
function renderSheet() {
    if (getFocusStage(currentSession) !== "finishing") return;
    if (finishSheet.open) return;

    const minutes = getFocusMinutes(currentSession);
    sheetTitle.textContent = `You focused for ${minutes} min`;
    sheetHabit.textContent = currentHabit.name;

    const askAmount = currentHabit.type === "quantity";
    sheetAmount.hidden = !askAmount;
    amountLabel.textContent = `How many ${currentHabit.unit}?`;
    amountInput.value = currentSession.amount;

    document.querySelectorAll('input[name="mood"]').forEach(radio => { radio.checked = false; });
    noteInput.value = "";

    finishSheet.showModal();             // opens on top, dims the page, keeps the keyboard inside
}

// Redraw everything from the saved data, then start or stop the ticking.
function updatePage() {
    renderHabit();
    renderTargets();
    renderStage();
    renderClock();
    renderCounter();
    syncTicker();
    renderSheet();
}
/* ---------- 7. Actions ---------- */

// Set the focus length. Before start: just remember it.
// While running: save it in the session (the time already focused stays).
//   25 → 40 after 20 min: "20:00 of 40:00"
function setTarget(minutes) {
    if (currentSession) currentSession = updateFocus(currentSession.id, { targetMin: minutes });
    else chosenTarget = minutes;
    updatePage();
}

// Tap the clock: swap the time for a number box with the current target in it.
function openTargetEditor() {
    targetInput.value = currentTarget();
    clockText.hidden = true;
    clockEdit.hidden = true;
    clockEditor.hidden = false;
    targetInput.focus();
    targetInput.select();                 // the old number is selected: just type the new one
}

// Close the box. save = true (Enter / tap away) keeps the number, false (Esc) throws it away.
// Hidden already? Then it's closed: do nothing. (Closing makes the box lose focus,
// which calls this again — this line stops it running twice.)
function closeTargetEditor(save) {
    if (clockEditor.hidden) return;
    clockEditor.hidden = true;
    clockText.hidden = false;
    clockEdit.hidden = false;

    const minutes = cleanTarget(targetInput.value);
    if (save && minutes) setTarget(minutes);
    clockEdit.focus();                    // keyboard users land back on the clock
}

// Start: create the session (saves startedAt = now), then redraw.
function start() {
    currentSession = startFocus(currentHabit.id, chosenTarget);
    updatePage();
}
// Pause ⇄ Resume. The data functions do the maths (state.js), we just redraw.
function togglePause() {
    if (getFocusStage(currentSession) === "paused") currentSession = resumeFocus(currentSession.id);
    else currentSession = pauseFocus(currentSession.id);
    updatePage();
}

// − / + on the counter. direction is -1 or +1.
// One step = getStep() from insights.js: 1 page, or 0.5 when the target is below 1.
// Saved straight away, so a reload keeps it.
function changeCount(direction) {
    const step = getStep(currentHabit);
    const next = Math.max(0, currentSession.amount + direction * step);
    const amount = Math.round(next * 100) / 100;           // 0.1 + 0.2 → 0.3, not 0.30000000000000004
    currentSession = updateFocus(currentSession.id, { amount });
    renderCounter();
}
// Finish: freeze the clock (stopFocus) → the stage becomes "finishing" → the sheet opens.
function finish() {
    currentSession = stopFocus(currentSession.id);
    updatePage();
}

// What to log, by habit type:
//   amount habit → the number in the box (empty / nonsense / negative → 0)
//   time habit   → the minutes focused
//   tick habit   → 1 (done)
function amountToLog() {
    if (currentHabit.type === "time") return getFocusMinutes(currentSession);
    if (currentHabit.type === "completion") return 1;
    const typed = Number(amountInput.value);
    if (Number.isNaN(typed) || typed < 0) return 0;
    return Math.round(typed * 100) / 100;
}

// The mood radio that's checked, as a number (1–5), or null if none.
function chosenMood() {
    const checked = document.querySelector('input[name="mood"]:checked');
    return checked ? Number(checked.value) : null;
}

// − / + in the sheet: change the number in the box by one step.
function changeSheetAmount(direction) {
    const current = Number(amountInput.value) || 0;
    const next = Math.max(0, current + direction * getStep(currentHabit));
    amountInput.value = Math.round(next * 100) / 100;
}

// Save: log the progress + keep the mood and note. Then back to Today.
function save() {
    finishFocus(currentSession.id, { amount: amountToLog(), mood: chosenMood(), note: noteInput.value });
    leave();
}

// Skip: log the progress only (no mood, no note). Then back to Today.
function skip() {
    finishFocus(currentSession.id, { amount: amountToLog() });
    leave();
}

// Discard: ask first (it can't be undone), then delete the session. Nothing is logged.
function discard() {
    if (!window.confirm("Discard this session? Nothing will be saved.")) return;
    cancelFocus(currentSession.id);
    window.location.replace("today.html");
}

// Back to Today. "?done=h1" tells Today which habit we just worked on
// (so it can celebrate if that habit is now done).
// replace: the Back button won't bring you back to a finished session.
function leave() {
    window.location.replace(`today.html?done=${encodeURIComponent(currentHabit.id)}`);
}

// Keep the clock moving while running, and only then.
//   running → make sure a setInterval is going (renderClock twice a second)
//   anything else → stop it (paused = frozen, no need to redraw)
// The clock's TIME never comes from counting ticks: renderClock always asks
// getFocusElapsed(), so a slow or skipped tick can't make it wrong.
function syncTicker() {
    const running = getFocusStage(currentSession) === "running";
    if (running && !tickTimer) {
        tickTimer = setInterval(renderClock, TICK_MS);
    }
    if (!running && tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
    }
    if (running) keepAwake()
       else letSleep();
}
// Ask the browser to keep the screen on while you focus.
// async + await: asking takes a moment, "await" waits for the answer.
// try / catch: if the browser says no (old browser, battery saver), don't crash.
async function keepAwake() {
    if (!("wakeLock" in navigator) || wakeLock) return;      // can't, or already on
    try {
        wakeLock = await navigator.wakeLock.request("screen");
        // The browser drops the lock when you leave the  tab. Forget it, so we ask again when you're back.
        wakeLock.addEventListener("release", () => { wakeLock = null; });
    } catch {
        wakeLock = null;                                     // said no: fine, the timer still works
    }
}

// Let the screen sleep again (paused, finished).
function letSleep() {
    if (wakeLock) wakeLock.release();
    wakeLock = null;
}
/* ---------- 8. Page load ---------- */

if (pageOk) {
    updatePage();
}


/* ---------- 9. Events ---------- */

// One listener for all 3 chips (event delegation, like Today's line).
targetChips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-target]");
    if (chip) setTarget(Number(chip.dataset.target));       // data-target="45" is TEXT: Number() makes it 45
});

// The clock: tap = edit. Enter = save, Esc = cancel, tapping away = save.
clockEdit.addEventListener("click", openTargetEditor);

clockEditor.addEventListener("submit", (event) => {
    event.preventDefault();               // a form would normally reload the page: stop that
    closeTargetEditor(true);
});

targetInput.addEventListener("blur", () => closeTargetEditor(true));

targetInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTargetEditor(false);
});

startButton.addEventListener("click", start);
pauseButton.addEventListener("click", togglePause);
finishButton.addEventListener("click", finish);

// The finish sheet's buttons
saveButton.addEventListener("click", save);
skipButton.addEventListener("click", skip);
discardButton.addEventListener("click", discard);

finishSheet.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "sheet-less") changeSheetAmount(-1);
    if (button.dataset.action === "sheet-more") changeSheetAmount(+1);
});

// Esc normally closes a <dialog>. Here that would leave you stuck with no buttons,
// so we say no: the only ways out are Save, Skip or Discard.
finishSheet.addEventListener("cancel", (event) => event.preventDefault());

// One listener for − and + (event delegation again).
counter.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    if (button.dataset.action === "less") changeCount(-1);
    if (button.dataset.action === "more") changeCount(+1);
});

// Back to this tab (or the phone unlocked)? Browsers slow timers down in the background,
// so redraw straight away instead of waiting for the next tick.
document.addEventListener("visibilitychange", () => {
    if (pageOk && document.visibilityState === "visible") updatePage();
});