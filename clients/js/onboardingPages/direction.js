/* =========================================================
   DIRECTION PAGE  (startup/identity.html)  ·  Step 01 of 04

   What this page does:
     1. The user picks ONE area of life (cards from AREAS).
     2. Then picks who they want to become in it, or writes their own.
     We save both with saveDirection(), then go to goal.html.

   How this file is organized:
     1. Guard  2. Elements  3. Settings  4. State  5. Helpers
     6. Readers  7. Renderers  8. Actions  9. Page load  10. Events
   ========================================================= */


/* ---------- 1. Guard ---------- */

// Already set up → straight to the app.
// No name yet → they skipped the Name page.
if (isOnboardingComplete()) {
    window.location.replace("../app/today.html");
} else if (!getName()) {
    window.location.replace("name.html");
}


/* ---------- 2. Elements ---------- */

const directionForm = document.getElementById("directionForm");
const greeting = document.getElementById("greeting");
const areaGrid = document.getElementById("areaGrid");
const identityBlock = document.getElementById("identityBlock");
const identityList = document.getElementById("identityList");
const identityOwn = document.getElementById("identityOwn");
const identityInput = document.getElementById("identityInput");
const continueButton = document.getElementById("continueButton");
const areaTemplate = document.getElementById("areaTemplate");
const identityTemplate = document.getElementById("identityTemplate");


/* ---------- 3. Settings ---------- */

const NEXT_PAGE = "goal.html";
const OWN = "own";                      // the value of the "Write my own" option


/* ---------- 4. State ---------- */

// What the user has picked so far. Starts from what's saved,
// so Back from the Goal page keeps their choice.
const picked = {
    areaId: null,
    identity: null,                     // a suggested sentence, or OWN
};


/* ---------- 5. Helpers ---------- */

function copyTemplate(template) {
    return template.content.firstElementChild.cloneNode(true);
}


/* ---------- 6. Readers ---------- */

// The final sentence: the chosen suggestion, or what they typed.
function readIdentity() {
    if (picked.identity === OWN) return identityInput.value.trim();
    return picked.identity || "";
}

function isReady() {
    return picked.areaId !== null && readIdentity() !== "";
}


/* ---------- 7. Renderers ---------- */

function renderAreas() {
    areaGrid.replaceChildren();

    AREAS.forEach(area => {
        const card = copyTemplate(areaTemplate);
        const input = card.querySelector("input");
        input.value = area.id;
        input.checked = area.id === picked.areaId;
        card.querySelector(".area-icon").textContent = area.icon;
        card.querySelector(".area-name").textContent = area.label;
        areaGrid.append(card);
    });
}

function renderIdentities() {
    const area = getAreaById(picked.areaId);
    identityBlock.hidden = !area;
    if (!area) return;

    identityList.replaceChildren();

    // Suggestions first, then "Write my own" at the end
    const options = [...area.identities, OWN];
    options.forEach(sentence => {
        const row = copyTemplate(identityTemplate);
        const input = row.querySelector("input");
        input.value = sentence;
        input.checked = sentence === picked.identity;
        row.querySelector(".identity-text").textContent =
            sentence === OWN ? "Write my own…" : sentence;
        if (sentence === OWN) row.classList.add("is-own");
        identityList.append(row);
    });

    identityOwn.hidden = picked.identity !== OWN;
}

function renderButton() {
    continueButton.disabled = !isReady();
}


/* ---------- 8. Actions ---------- */

function pickArea(areaId) {
    if (areaId === picked.areaId) return;
    picked.areaId = areaId;

    // A new area has different suggestions, so the old choice no longer fits.
    // "Something else" has none, so it goes straight to writing.
    const area = getAreaById(areaId);
    picked.identity = area.identities.length === 0 ? OWN : null;

    renderIdentities();
    renderButton();

    // On a phone the list opens below the fold: bring it into view.
    identityBlock.scrollIntoView({ behavior: "smooth", block: "start" });
    if (picked.identity === OWN) identityInput.focus({ preventScroll: true });
}

function pickIdentity(value) {
    picked.identity = value;
    identityOwn.hidden = value !== OWN;
    if (value === OWN) identityInput.focus();
    renderButton();
}

function submitDirection(event) {
    event.preventDefault();
    if (!isReady()) return;

    const area = getAreaById(picked.areaId);
    saveDirection({
        area: area.id,
        areaLabel: area.label,
        identity: readIdentity(),
    });
    setCurrentStep(3);                  // 1 welcome · 2 name · 3 direction · 4 goal…
    window.location.href = NEXT_PAGE;
}


/* ---------- 9. Page load ---------- */

// "Hi Amina." — textContent keeps their name as plain text
greeting.textContent = `Hi ${getName()}`;

// Came back from the Goal page? Show what they chose before.
const saved = getDirection();
const savedArea = getAreaById(saved.area);
if (savedArea) {
    picked.areaId = savedArea.id;
    if (savedArea.identities.includes(saved.identity)) {
        picked.identity = saved.identity;
    } else if (saved.identity) {
        picked.identity = OWN;
        identityInput.value = saved.identity;
    }
}

renderAreas();
renderIdentities();
renderButton();


/* ---------- 10. Events ---------- */

// One listener for the whole form (event delegation):
// a radio changing tells us which group it belongs to by its name.
directionForm.addEventListener("change", event => {
    const input = event.target;
    if (input.name === "area") pickArea(input.value);
    if (input.name === "identity") pickIdentity(input.value);
});

identityInput.addEventListener("input", renderButton);
directionForm.addEventListener("submit", submitDirection);