/* ╔══════════════════════════════════════════════════════════════╗
   ║  MINI FOCUS BAR  ·  js/app/focus-bar.js                      ║
   ║  A focus session is running? Show it on every page.          ║
   ╚══════════════════════════════════════════════════════════════╝

   Like a music app's mini player:
     ● Practice my skill            ⏸
       12:34 · 25 min
   Tap the bar → back to the Focus page.  ⏸ / ▶ → pause or resume here.

   USED BY  today.html · plan.html · journal.html  (NOT focus.html: it IS the timer)
            Load it LAST: after storage → state → insight → the page's script.

   WHY IT WORKS ANYWHERE
     The timer isn't "running" in a page. The session only stores WHEN it started
     and its pauses (state.js). Any page can work out the time from that:
     getFocusElapsed(session) in insight.js. So leaving Focus loses nothing.

   Every name here starts with "focusBar" so it can't clash with the page's own names.
   ══════════════════════════════════════════════════════════════════ */

   

/* ════════════════════ 1. BUILD THE BAR (once) ════════════════════ */

const focusBar = document.createElement("div");
focusBar.className = "focus-bar";
focusBar.hidden = true;
// Our own fixed markup: safe. The habit name goes in later with textContent.
focusBar.innerHTML = `
    <a class="focus-bar-link" href="focus.html">
        <span class="focus-bar-dot" aria-hidden="true"></span>
        <span class="focus-bar-text">
            <span class="focus-bar-name"></span>
            <span class="focus-bar-time"></span>
        </span>
    </a>
        <button class="focus-bar-button" type="button">
        <svg class="focus-bar-ring" viewBox="0 0 48 48" aria-hidden="true">
            <circle class="focus-bar-ring-track" cx="24" cy="24" r="22" />
            <circle class="focus-bar-ring-fill" cx="24" cy="24" r="22" />
        </svg>
        <span class="icon" aria-hidden="true"></span>
    </button>`;
document.body.append(focusBar);

// Just came from the Focus page (its ✕ or the browser's Back)?
// Slide the bar in, so it feels like the timer moved down here.
if (document.referrer.includes("focus.html")) focusBar.classList.add("is-arriving");

const focusBarName = focusBar.querySelector(".focus-bar-name");
const focusBarTime = focusBar.querySelector(".focus-bar-time");
const focusBarButton = focusBar.querySelector(".focus-bar-button");
const focusBarIcon = focusBarButton.querySelector(".icon");
const focusBarRing = focusBar.querySelector(".focus-bar-ring-fill");
const FOCUS_BAR_RING_LENGTH = 2 * Math.PI * 22;



/* ════════════════════ 2. HELPERS ════════════════════ */

// 754000 ms → "12:34"   ·   3725000 ms → "1:02:05"
function focusBarClock(ms) {
    const total = Math.floor(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, "0");
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
        : `${minutes}:${seconds}`;
}



/* ════════════════════ 3. DRAW ════════════════════ */

// Reads the session and makes the bar match. Runs every second.
function renderFocusBar() {
    const session = getActiveFocus();
    const stage = getFocusStage(session);              // setup / running / paused / finishing / done
    const show = stage === "running" || stage === "paused" || stage === "finishing";

    focusBar.hidden = !show;
    document.body.classList.toggle("has-focus-bar", show);   // CSS: room at the bottom of the page
    if (!show) return;

    const habit = getHabitById(session.habitId);
    focusBarName.textContent = habit ? habit.name : "Focus";
    focusBar.dataset.stage = stage;                    // CSS: the dot pulses only when running

    if (stage === "finishing") {
        focusBarTime.textContent = "Finished · tap to save";
        focusBarButton.hidden = true;                  // nothing to pause any more
        return;
    }

    const elapsed = getFocusElapsed(session);
    focusBarTime.textContent = `${focusBarClock(elapsed)} · ${session.targetMin} min`
        + (stage === "paused" ? " · paused" : "");

    // The green ring around ⏸: how much of the target is done. Full at 25 of 25 min, never more.
    const done = Math.min(1, elapsed / (session.targetMin * 60000));

    focusBarRing.style.strokeDashoffset = FOCUS_BAR_RING_LENGTH * (1 - done);
    focusBarButton.hidden = false;
    focusBarIcon.textContent = stage === "paused" ? "play_arrow" : "pause";
    focusBarButton.setAttribute("aria-label", stage === "paused" ? "Resume focus" : "Pause focus");
}


/* ════════════════════ 4. ACTION ════════════════════ */

// ⏸ / ▶ on the bar: the same functions the Focus page uses.
function toggleFocusBarPause() {
    const session = getActiveFocus();
    if (!session) return;
    if (session.pausedAt) resumeFocus(session.id);
    else pauseFocus(session.id);
    renderFocusBar();
}
// ▶ Start focus, from ANY page. Only ONE session at a time:
//   nothing running       → focus.html?habit=h2   (pick 15 / 25 / 45, then Start)
//   THIS habit running    → focus.html             (Focus finds the running session itself)
//   ANOTHER habit running → ask first; OK opens the running one, so it isn't lost
function focusBarOpen(habitId) {
    const active = getActiveFocus();
    if (active && active.habitId !== habitId) {
        const other = getHabitById(active.habitId);
        const name = other ? other.name : "Another session";
        if (!confirm(`${name} is still running.\n\nFinish it first? OK takes you there.`)) return;
    }
    window.location.href = active ? "focus.html" : `focus.html?habit=${encodeURIComponent(habitId)}`;
}

/* ════════════════════ 5. START + EVENTS ════════════════════ */
renderFocusBar();
setInterval(renderFocusBar, 1000);                     // the seconds tick

focusBarButton.addEventListener("click", toggleFocusBarPause);

// Paused or finished in ANOTHER tab? localStorage changed → redraw.
window.addEventListener("storage", renderFocusBar);
