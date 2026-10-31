/* =========================================================
   NAME PAGE  (startup/name.html)

   What this page does:
     Asks for a first name, saves it with saveName(),
     then goes to identity.html (Step 01: Direction).

   How this file is organized:
     1. Guard  2. Elements  3. Settings  4. Readers
     5. Renderers  6. Actions  7. Page load  8. Events
   ========================================================= */


/* ---------- 1. Guard ---------- */

// Already set up → this page has nothing to do.
if (isOnboardingComplete()) {
    window.location.replace("../app/today.html");
}


/* ---------- 2. Elements ---------- */

const nameForm = document.getElementById("nameForm");
const nameInput = document.getElementById("nameInput");
const namePreview = document.getElementById("namePreview");
const namePreviewText = document.getElementById("namePreviewText");
const continueButton = document.getElementById("continueButton");


/* ---------- 3. Settings ---------- */

const NEXT_PAGE = "identity.html";


/* ---------- 4. Readers ---------- */

// "  amina  " → "amina". Spaces alone don't count as a name.
function readName() {
    return nameInput.value.trim();
}


/* ---------- 5. Renderers ---------- */

function renderForm() {
    const name = readName();
    continueButton.disabled = name === "";

    namePreview.hidden = name === "";
    namePreviewText.textContent = name;        // textContent: whatever they type stays plain text
}


/* ---------- 6. Actions ---------- */

function submitName(event) {
    event.preventDefault();                    // stop the browser reloading the page
    const name = readName();
    if (!name) return;

    saveName(name);
    setCurrentStep(2);
    window.location.href = NEXT_PAGE;
}


/* ---------- 7. Page load ---------- */

// Came back with Back? Their name is still there.
nameInput.value = getName() || "";
renderForm();
nameInput.focus();


/* ---------- 8. Events ---------- */

nameInput.addEventListener("input", renderForm);
nameForm.addEventListener("submit", submitName);