/* =========================================================
   NAME PAGE
   ========================================================= */

const nameForm = document.getElementById("nameForm");
const nameInput = document.getElementById("nameInput");
const nameError = document.getElementById("nameError");
const continueButton = document.getElementById("continueButton");

const MIN_LENGTH = 2;

/* ---------- Small helpers ---------- */

function isValidName(name) {
    return name.length >= MIN_LENGTH;
}

function updateContinueButton() {
    continueButton.disabled = !isValidName(nameInput.value.trim());
}

function showError(message) {
    nameError.textContent = message;
    nameError.hidden = false;
    nameInput.setAttribute("aria-invalid", "true");
}

function clearError() {
    nameError.textContent = "";
    nameError.hidden = true;
    nameInput.removeAttribute("aria-invalid");
}

/* ---------- On page load ---------- */

// If the user came back with the Back button, show what they already typed.
nameInput.value = getName();
updateContinueButton();
nameInput.focus();

/* ---------- Events ---------- */

// While typing: hide any old error, enable/disable Continue.
nameInput.addEventListener("input", () => {
    clearError();
    updateContinueButton();
});

// When leaving the field: explain the problem instead of failing silently.
nameInput.addEventListener("blur", () => {
    const name = nameInput.value.trim();
    if (name.length > 0 && !isValidName(name)) {
        showError("Please enter at least 2 characters.");
    }
});

// Continue button or Enter key.
nameForm.addEventListener("submit", (event) => {
    event.preventDefault(); // stop the browser from reloading the page

    const name = nameInput.value.trim();
    if (!isValidName(name)) {
        showError("Please enter at least 2 characters.");
        return;
    }

    saveName(name);
    setCurrentStep(2);
    window.location.href = "identity.html";
});