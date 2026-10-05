/* ============================================
   GROWTH OS - ONBOARDING LOGIC
============================================ */

/* ============================================
   START / LANDING PAGE
============================================ */
const startBtn = document.getElementById('startButton');

if (startBtn) {
    startBtn.addEventListener('click', () => {
        resetUser();
        setCurrentStep(1);
        window.location.href = './name.html';
        console.log('User reset and redirected to startup page.');
    });
}

/* ============================================
   NAME PAGE
============================================ */
const nameInput = document.getElementById("userName");

if (nameInput) {
    const nameContinueBtn = document.getElementById("continueBtn");
    const nameBackBtn = document.getElementById("backButton");

    console.log("Name page initialized.");

    nameInput.addEventListener("input", () => {
        const name = nameInput.value.trim();
        if (nameContinueBtn) {
            nameContinueBtn.disabled = name.length < 2;
        }
        console.log("Name input:", name);
    });

    if (nameContinueBtn) {
        nameContinueBtn.addEventListener("click", () => {
            const name = nameInput.value.trim();
            if (name.length < 2) return;

            saveName(name);
            setCurrentStep(2);
            console.log("Name saved:", name);
            console.log("Current user data:", getUser());
            window.location.href = "identity.html";
        });
    }

    if (nameBackBtn) {
        nameBackBtn.addEventListener("click", () => {
            window.location.href = "name.html";
        });
    }
}

/* ============================================
   IDENTITY PAGE
============================================ */
const identityCards = document.querySelectorAll(".identity-card");

if (identityCards.length > 0) {
    const identityContinueButton = document.getElementById("continueButton");
    const identityBackButton = document.getElementById("backButton");
    let selectedIdentity = "";

    identityCards.forEach(card => {
        card.addEventListener("click", () => {
            identityCards.forEach(item => item.classList.remove("selected"));
            card.classList.add("selected");
            selectedIdentity = card.dataset.identity;

            if (identityContinueButton) {
                identityContinueButton.disabled = false;
            }
            console.log("Identity selected:", selectedIdentity);
        });
    });

    if (identityContinueButton) {
        identityContinueButton.addEventListener("click", () => {
            if (!selectedIdentity) return;
            saveIdentity(selectedIdentity);
            setCurrentStep(2);
            console.log("Identity saved:", selectedIdentity);
            window.location.href = "habit.html";
        });
    }

    if (identityBackButton) {
        identityBackButton.addEventListener("click", () => {
            window.location.href = "name.html";
        });
    }
}

/* ============================================
   HABITS PAGE
============================================ */
const habitCards = document.querySelectorAll(".habit-card");

if (habitCards.length > 0) {
    habitCards.forEach((card) => {
        const header = card.querySelector(".habit-header");
        if (!header) return;

        header.addEventListener("click", () => {
            card.classList.toggle("selected");
        });
    });

    const habitBackButton = document.getElementById("backButton");
    const habitFooterBackButton = document.getElementById("footerBackButton");
    const habitContinueButton = document.getElementById("continueButton");

    if (habitBackButton) {
        habitBackButton.addEventListener("click", () => {
            window.location.href = "identity.html";
        });
    }

    if (habitFooterBackButton) {
        habitFooterBackButton.addEventListener("click", () => {
            window.location.href = "identity.html";
        });
    }

    if (habitContinueButton) {
        habitContinueButton.addEventListener("click", () => {
            const selectedHabits = [];

            habitCards.forEach((card) => {
                if (!card.classList.contains("selected")) return;

                const habitId = card.dataset.habitId;
                const target = card.querySelector(".target-input");
                const unit = card.querySelector(".unit-input");
                const frequency = card.querySelector(".frequency-input");

                const habit = {
                    id: habitId,
                    target: Number(target ? target.value : 0),
                    unit: unit ? unit.value : "",
                    frequency: frequency ? frequency.value : ""
                };

                selectedHabits.push(habit);
            });

            if (selectedHabits.length === 0) {
                alert("Choose at least one habit.");
                return;
            }

            saveHabits(selectedHabits);
            setCurrentStep(3);
            console.log("Selected habits:", selectedHabits);
            console.log("User data:", getUser());
            window.location.href = "routine.html";
        });
    }
}

/* ============================================
   ROUTINE PAGE
============================================ */
const routineList = document.getElementById("routineList");

if (routineList) {
    const addRoutineBtn = document.getElementById("addRoutineBtn");
    const routineContinueBtn = document.getElementById("continueBtn");
    const routineFooterBackButton = document.getElementById("footerBackButton");
    const activityForm = document.getElementById("activityForm");
    const activityName = document.getElementById("activityName");
    const activityTime = document.getElementById("activityTime");
    const saveActivityBtn = document.getElementById("saveActivityBtn");

    let routine = [];

    // Helper function to capitalize the first letter of each word
    function capitalizeWords(str) {
        if (!str) return "";
        return str
            .toLowerCase()
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    function initializeRoutine() {
        const habits = getHabits() || [];

        routine = [
            {
                name: "Wake Up",
                time: "06:00",
                type: "default",
                icon: "wb_sunny"
            }
        ];

        habits.forEach(habit => {
            routine.push({
                name: habit.id,
                time: "",
                type: "habit",
                icon: "check_circle"
            });
        });

        routine.push({
            name: "Sleep",
            time: "22:00",
            type: "default",
            icon: "bedtime"
        });

        renderRoutine();
        console.log("Routine initialized:", routine);
    }

    function renderRoutine() {
        routineList.innerHTML = "";

        routine.forEach((item, index) => {
            const routineItem = document.createElement("div");
            routineItem.className = "routine-item";

            // Format routine type (Capitalize first letter)
            const rawType = item.type === "default" ? "Daily" : item.type === "habit" ? "Habit" : "Activity";
            const formattedType = capitalizeWords(rawType);

            // Format routine name (Capitalize first letter of each word)
            const formattedName = capitalizeWords(item.name);

            routineItem.innerHTML = `
                <div class="routine-info">
                    <span class="material-symbols-outlined routine-icon">
                        ${item.icon}
                    </span>
                    <div>
                        <div class="routine-name">${formattedName}</div>
                        <div class="routine-type">${formattedType}</div>
                    </div>
                </div>

                <input
                    type="time"
                    class="routine-time"
                    value="${item.time}"
                    data-index="${index}"
                >
                ${
                    item.type === "default"
                    ? ""
                    : `
                        <button
                            type="button"
                            class="remove-routine"
                            data-index="${index}"
                        >
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    `
                }
            `;

            routineList.appendChild(routineItem);
        });
    }

    routineList.addEventListener("change", event => {
        if (!event.target.classList.contains("routine-time")) return;
        const index = event.target.dataset.index;
        routine[index].time = event.target.value;
        console.log("Time updated:", routine[index]);
    });

    routineList.addEventListener("click", event => {
        const removeButton = event.target.closest(".remove-routine");
        if (!removeButton) return;
        const index = removeButton.dataset.index;
        routine.splice(index, 1);
        renderRoutine();
        console.log("Routine item removed.");
    });

    if (addRoutineBtn) {
        addRoutineBtn.addEventListener("click", () => {
            if (activityForm) activityForm.hidden = false;
            if (activityName) activityName.focus();
        });
    }

    if (saveActivityBtn) {
        saveActivityBtn.addEventListener("click", () => {
            const name = activityName.value.trim();
            if (!name) {
                activityName.focus();
                return;
            }

            routine.splice(routine.length - 1, 0, {
                name: name,
                time: activityTime.value,
                type: "activity",
                icon: "event"
            });

            activityName.value = "";
            activityTime.value = "";
            if (activityForm) activityForm.hidden = true;

            renderRoutine();
            console.log("Activity added:", name);
        });
    }

    if (routineFooterBackButton) {
        routineFooterBackButton.addEventListener("click", () => {
            window.location.href = "habit.html";
        });
    }

    if (routineContinueBtn) {
        routineContinueBtn.addEventListener("click", () => {
            saveRoutine(routine);
            setCurrentStep(4);
            console.log("Routine saved:", routine);
            window.location.href = "goal.html";
        });
    }

    // Initialize Page
    initializeRoutine();
}
/* ============================================
   GOAL CALIBRATION PAGE
============================================ */
document.addEventListener("DOMContentLoaded", () => {
    const goalList = document.getElementById("goalList");

    // Only run if on goal page
    if (!goalList) return;

    const addGoalBtn = document.getElementById("addGoalBtn");
    const goalForm = document.getElementById("goalForm");
    const saveGoalBtn = document.getElementById("saveGoalBtn");
    const goalTitleInput = document.getElementById("goalTitleInput");
    const goalDescInput = document.getElementById("goalDescInput");

    const backButton = document.getElementById("backButton");
    const footerBackButton = document.getElementById("footerBackButton");
    const continueBtn = document.getElementById("continueBtn");

    let selectedGoals = [];

    function init() {
        const savedGoals = typeof getGoals === "function" ? getGoals() : [];
        if (savedGoals && savedGoals.length > 0) {
            savedGoals.forEach((saved) => {
                const existingCard = document.querySelector(`[data-goal-id="${saved.id}"]`);
                if (existingCard) {
                    existingCard.classList.add("selected");
                    selectedGoals.push(saved);
                } else {
                    createAndAppendGoalCard(saved.id, saved.title, saved.description, true);
                }
            });
        }
        attachExistingCardListeners();
    }

    function attachExistingCardListeners() {
        const cards = goalList.querySelectorAll(".goal-card");
        cards.forEach((card) => {
            card.addEventListener("click", () => toggleGoalSelection(card));
        });
    }

    function toggleGoalSelection(card) {
        const goalId = card.dataset.goalId;
        const title = card.dataset.title;
        const desc = card.dataset.desc;

        if (card.classList.contains("selected")) {
            card.classList.remove("selected");
            selectedGoals = selectedGoals.filter((g) => g.id !== goalId);
        } else {
            card.classList.add("selected");
            selectedGoals.push({
                id: goalId,
                title: title,
                description: desc
            });
        }
    }

    if (addGoalBtn && goalForm) {
        addGoalBtn.addEventListener("click", () => {
            goalForm.hidden = false;
            addGoalBtn.style.display = "none";
            if (goalTitleInput) goalTitleInput.focus();
        });
    }

    if (saveGoalBtn) {
        saveGoalBtn.addEventListener("click", handleAddCustomGoal);
    }

    if (goalTitleInput) {
        goalTitleInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustomGoal();
            }
        });
    }

    function handleAddCustomGoal() {
        const title = goalTitleInput.value.trim();
        const desc = goalDescInput.value.trim() || "Custom Goal";

        if (!title) {
            goalTitleInput.focus();
            return;
        }

        const newId = "custom_" + Date.now();
        createAndAppendGoalCard(newId, title, desc, true);

        goalTitleInput.value = "";
        goalDescInput.value = "";
        goalForm.hidden = true;
        if (addGoalBtn) addGoalBtn.style.display = "flex";
    }

    function createAndAppendGoalCard(id, title, desc, autoSelect = false) {
        const card = document.createElement("div");
        card.className = "goal-card" + (autoSelect ? " selected" : "");
        card.dataset.goalId = id;
        card.dataset.title = title;
        card.dataset.desc = desc;

        card.innerHTML = `
            <div class="goal-icon">
                <span class="material-symbols-outlined">flag</span>
            </div>
            <div class="goal-info">
                <span class="goal-name">${escapeHTML(title)}</span>
                <span class="goal-desc">${escapeHTML(desc)}</span>
            </div>
        `;

        card.addEventListener("click", () => toggleGoalSelection(card));
        goalList.appendChild(card);
        if (autoSelect) {
            selectedGoals.push({
                id: id,
                title: title,
                description: desc
            });
        }
    }

    function handleBack() {
        window.location.href = "routine.html";
    }

    if (backButton) backButton.addEventListener("click", handleBack);
    if (footerBackButton) footerBackButton.addEventListener("click", handleBack);

    if (continueBtn) {
        continueBtn.addEventListener("click", () => {
            if (selectedGoals.length === 0) {
                alert("Please select or create at least 1 goal to proceed.");
                return;
            }

            if (typeof saveGoals === "function") {
                saveGoals(selectedGoals);
            }
            if (typeof setCurrentStep === "function") {
                setCurrentStep(5);
                setOnboardingCompleted = true;
            }

            window.location.href = "setup.html";
        });
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    init();
});
document.addEventListener("DOMContentLoaded", () => {
    const completeSetupBtn = document.getElementById("completeSetupBtn");
    if (!completeSetupBtn) return;

    // Elements
    const backButton = document.getElementById("backButton");
    const footerBackButton = document.getElementById("footerBackButton");
    const energyCards = document.querySelectorAll(".energy-card");
    const notificationToggle = document.getElementById("notificationToggle");

    const userName = document.getElementById("userName");
    const userIdentity = document.getElementById("userIdentity");
    const statHabits = document.getElementById("statHabits");
    const statGoals = document.getElementById("statGoals");

    let selectedWindow = "morning";

    // Populate data from getUser()
    if (typeof getUser === "function") {
        const user = getUser();
        if (user) {
            console.log(user)
            if (userName) userName.textContent = user.profile.name || "User";
            if (userIdentity) userIdentity.textContent = user.profile.identity || "Disciplined Builder";
            if (statHabits) statHabits.textContent = `${user.habits ? user.habits.length : 0} Tracked`;
            if (statGoals) statGoals.textContent = `${user.goals ? user.goals.length : 0} Anchored`;
        }
    }

    // Energy card interaction
    energyCards.forEach(card => {
        card.addEventListener("click", () => {
            energyCards.forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            selectedWindow = card.dataset.value;
        });
    });

    // Back handling
    function goBack() {
        window.location.href = "goal.html";
    }

    if (backButton) backButton.addEventListener("click", goBack);
    if (footerBackButton) footerBackButton.addEventListener("click", goBack);

    // Save and redirect
    completeSetupBtn.addEventListener("click", () => {
        const setupData = {
            productiveWindow: selectedWindow,
            notifications: notificationToggle ? notificationToggle.checked : true
        };

        if (typeof saveLifestyle === "function") {
            saveLifestyle(setupData);

        }

        if (typeof setOnboardingCompleted === "function") {
            setOnboardingCompleted(true);
        }   
        window.location.href = "../startup.html";
    });
});


