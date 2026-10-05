/* =========================================================
   WELCOME PAGE
   ========================================================= */

// Redirect guard: someone who already finished onboarding
// doesn't belong here. Send them to the dashboard, keep their data.
if (isOnboardingComplete()) {
    window.location.replace("../startup.html");
}

const startButton = document.getElementById("startButton");

startButton.addEventListener("click", () => {
    // New user: start from a clean, empty user object.
    resetUser();
    window.location.href = "name.html";
});