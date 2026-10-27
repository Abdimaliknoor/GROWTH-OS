/* ╔══════════════════════════════════════════════════════════════╗
   ║  EDIT MODE  ·  js/onboarding/edit-mode.js                    ║
   ║  One onboarding page, two jobs: set up OR edit from Plan.    ║
   ╚══════════════════════════════════════════════════════════════╝

   USED BY  goal.html · habit.html · routine.html
            (load it AFTER state.js, BEFORE the page's own script)

   HOW A PAGE KNOWS
     goal.html             → onboarding   (Step 02 of 04 · Back · Continue → next step)
     goal.html?mode=edit   → edit mode    (no steps · Cancel · Save → Plan)

   WHAT EACH PAGE DOES WITH IT
     if (editMode) applyEditMode("Editing your goal", continueButton);   ← at page load
     if (editMode) { leaveEditMode(); return; }                          ← after saving
   ══════════════════════════════════════════════════════════════════ */


// The sticky note in the address: "?mode=edit" → true.
const editMode = new URLSearchParams(window.location.search).get("mode") === "edit";

// Where edit mode always goes back to.
const PLAN_PAGE = "../app/plan.html";


// Turn the onboarding page into an edit page. Only changes what's ALREADY in the HTML.
function applyEditMode(title, saveButton) {
    document.title = `${title} | Growth OS`;
    document.body.classList.add("is-editing");             // CSS: the top bar gets a line under it
    document.querySelector(".ob-step").textContent = title;
    document.querySelector(".ob-progress").hidden = true;

    const back = document.createElement("a");
    back.className = "ob-brand ob-back";
    back.href = PLAN_PAGE;
    back.innerHTML = '<span class="icon" aria-hidden="true">arrow_back</span> Plan';   // our own fixed text: safe
    document.querySelector(".ob-brand").replaceWith(back);

    const cancel = document.querySelector(".ob-footer .ob-btn-secondary");
    cancel.textContent = "Cancel";
    cancel.href = PLAN_PAGE;

    saveButton.textContent = "Save";                       // also removes the → icon inside

    // "Edit" links in the card at the top (goal ← habit ← routine).
    // identity.html has no edit mode yet, so that link hides.
    document.querySelectorAll(".chain-edit").forEach(link => {
        const page = link.getAttribute("href");
        if (page === "identity.html") link.hidden = true;
        else link.href = `${page}?mode=edit`;
    });
}

// After a Save in edit mode: back to Plan. (Never touches the onboarding step.)
function leaveEditMode() {
    window.location.href = PLAN_PAGE;
}