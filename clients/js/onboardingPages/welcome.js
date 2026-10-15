/* =========================================================
   WELCOME PAGE
   ========================================================= */

// Redirect guard: someone who already finished onboarding
// doesn't belong here. Send them to Today, keep their data.
// replace (not href): the Back button won't bring them back to welcome.
if (isOnboardingComplete()) {
    window.location.replace("./welcome.html");
}

const startButton = document.getElementById("startButton");

startButton.addEventListener("click", () => {
    // New user: start from a clean, empty user object.
    resetUser();
    window.location.href = "name.html";
});