/* =========================================================
   DIRECTION PAGE (identity.html)
   Saves: area + identity → state.js → saveDirection()
   ========================================================= */

// Redirect guard: no name means they skipped a step.
if (!getName()) {
    window.location.replace("name.html");
}

/* ---------- Elements ---------- */

const directionForm = document.getElementById("directionForm");
const directionTitle = document.getElementById("directionTitle");
const areaGrid = document.getElementById("areaGrid");
const customAreaField = document.getElementById("customAreaField");
const customAreaInput = document.getElementById("customAreaInput");
const identitySection = document.getElementById("identitySection");
const identityChips = document.getElementById("identityChips");
const identityInput = document.getElementById("identityInput");
const directionSummary = document.getElementById("directionSummary");
const summaryIcon = document.getElementById("summaryIcon");
const summaryArea = document.getElementById("summaryArea");
const summaryIdentity = document.getElementById("summaryIdentity");
const continueButton = document.getElementById("continueButton");

/* ---------- Page state ---------- */

const MIN_AREA_LENGTH = 2;
const MIN_IDENTITY_LENGTH = 3;

let selectedAreaId = "";
let shownSuggestions = []; // the chips currently on screen

/* ---------- Reading the current choices ---------- */

function getAreaLabel() {
    if (selectedAreaId === "other") return customAreaInput.value.trim();
    const area = getAreaById(selectedAreaId);
    return area ? area.label : "";
}

function getIdentitySuggestions() {
    if (selectedAreaId === "other") {
        const label = getAreaLabel();
        if (label.length < MIN_AREA_LENGTH) return [];
        return [
            `Someone who makes time for ${label}`,
            `Someone who gets better at ${label} every week`,
            `A consistent student of ${label}`
        ];
    }
    const area = getAreaById(selectedAreaId);
    return area ? area.identities : [];
}

function isFormValid() {
    return getAreaLabel().length >= MIN_AREA_LENGTH
        && identityInput.value.trim().length >= MIN_IDENTITY_LENGTH;
}

/* ---------- Rendering ---------- */

// Area cards come from OUR data (areas.js), so innerHTML is safe here.
function renderAreaCards() {
    areaGrid.innerHTML = AREAS.map(area => `
        <label class="area-card">
            <input class="visually-hidden" type="radio" name="area" value="${area.id}">
            <span class="icon area-icon" aria-hidden="true">${area.icon}</span>
            <span class="area-label">${area.label}</span>
            <span class="icon area-check" aria-hidden="true">check_circle</span>
        </label>
    `).join("");
}

// Chips can contain the USER's text (custom area), so we build them
// with createElement + textContent. Never put user text in innerHTML.
function renderIdentityChips() {
    identityChips.innerHTML = "";
    shownSuggestions = getIdentitySuggestions();

    shownSuggestions.forEach(text => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "identity-chip";
        chip.dataset.text = text;

        const label = document.createElement("span");
        label.textContent = text;

        const check = document.createElement("span");
        check.className = "icon identity-chip-check";
        check.setAttribute("aria-hidden", "true");
        check.textContent = "check_circle";

        chip.append(label, check);
        identityChips.append(chip);
    });
}

function updateChipStates() {
    const typed = identityInput.value.trim();
    identityChips.querySelectorAll(".identity-chip").forEach(chip => {
        const isSelected = chip.dataset.text === typed;
        chip.classList.toggle("is-selected", isSelected);
        chip.setAttribute("aria-pressed", isSelected);
    });
}

// One function brings the whole page in line with the current state.
function updatePage() {
    const area = getAreaById(selectedAreaId);
    const areaLabel = getAreaLabel();
    const identity = identityInput.value.trim();

    customAreaField.hidden = selectedAreaId !== "other";
    identitySection.hidden = selectedAreaId === "";

    directionSummary.hidden = !(areaLabel && identity);
    summaryIcon.textContent = area ? area.icon : "";
    summaryArea.textContent = areaLabel;
    summaryIdentity.textContent = `"${identity}"`;

    continueButton.disabled = !isFormValid();
    updateChipStates();
}

/* ---------- Actions ---------- */

// If the identity is one of the chips on screen, it belongs to the
// old area, so clear it. If the user wrote their own, keep it.
// (We check shownSuggestions, not getIdentitySuggestions(): by the
// time this runs, the inputs may already hold the NEW values.)
function clearIdentityIfSuggestion() {
    if (shownSuggestions.includes(identityInput.value.trim())) {
        identityInput.value = "";
    }
}

function selectArea(areaId) {
    clearIdentityIfSuggestion();
    selectedAreaId = areaId;
    renderIdentityChips();
    updatePage();
}

function loadSavedDirection() {
    const saved = getDirection();
    if (!saved.area) return;

    const radio = areaGrid.querySelector(`input[value="${saved.area}"]`);
    if (!radio) return;

    radio.checked = true;
    if (saved.area === "other") customAreaInput.value = saved.areaLabel;
    selectedAreaId = saved.area;
    renderIdentityChips();
    identityInput.value = saved.identity;
    updatePage();
}

/* ---------- On page load ---------- */

directionTitle.textContent = `${getName()}, what area of your life do you want to improve?`;
renderAreaCards();
loadSavedDirection();

/* ---------- Events ---------- */

// Radios fire "change" (mouse, touch and keyboard arrows).
areaGrid.addEventListener("change", (event) => {
    const isFirstChoice = selectedAreaId === "";
    selectArea(event.target.value);

    // On phones the next question is below the fold. Bring it into view once.
    if (isFirstChoice) {
        const nextField = selectedAreaId === "other" ? customAreaField : identitySection;
        nextField.scrollIntoView({ behavior: "smooth", block: "center" });
    }
});

customAreaInput.addEventListener("input", () => {
    // The generated suggestions depend on this text, so rebuild them.
    clearIdentityIfSuggestion();
    renderIdentityChips();
    updatePage();
});

// Event delegation: one listener on the container handles every chip,
// even chips that get created later.
identityChips.addEventListener("click", (event) => {
    const chip = event.target.closest(".identity-chip");
    if (!chip) return;
    identityInput.value = chip.dataset.text;
    updatePage();
});

identityInput.addEventListener("input", updatePage);

directionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isFormValid()) return;

    saveDirection({
        area: selectedAreaId,
        areaLabel: getAreaLabel(),
        identity: identityInput.value.trim()
    });
    setCurrentStep(3);
    window.location.href = "goal.html";
});