/* ============================================
   STORAGE.JS
   Handles all onboarding data
============================================ */

const STORAGE_KEY = "growthOSUser";

/* ============================================
   CREATE DEFAULT USER
============================================ */

function createUser() {

    return {

        profile: {
            name: "",
            identity: "",
            createdAt: Date.now()
        },

        habits: [],

        routine: [],

        lifestyle: {
            productiveTime: "",
            notifications: true,
            theme: "dark"
        },

        goals: [],

        stats: {
            streak: 0,
            completedHabits: 0,
            totalDays: 0
        },

        onboarding: {
            currentStep: 1,
            completed: false
        },

        version: 1

    };

}

/* ============================================
   GET USER
============================================ */

function getUser() {

    const savedUser = localStorage.getItem(STORAGE_KEY);

    if (!savedUser) {

        const user = createUser();

        saveUser(user);

        return user;

    }

    return JSON.parse(savedUser);

}

/* ============================================
   SAVE USER
============================================ */

function saveUser(user) {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(user)
    );

}

/* ============================================
   RESET USER
============================================ */

function resetUser() {

    const user = createUser();

    saveUser(user);

    return user;

}

/* ============================================
   CLEAR USER
============================================ */

function clearUser() {

    localStorage.removeItem(STORAGE_KEY);

}

/* ============================================
   PROFILE
============================================ */

function saveName(name) {

    const user = getUser();

    user.profile.name = name;

    saveUser(user);

}

function saveIdentity(identity) {

    const user = getUser();

    user.profile.identity = identity;

    saveUser(user);

}

/* ============================================
   HABITS
============================================ */

function saveHabits(habits) {

    const user = getUser();

    user.habits = habits;

    saveUser(user);

}

/* ============================================
   ROUTINE
============================================ */

function saveRoutine(routine) {

    const user = getUser();

    user.routine = routine;

    saveUser(user);

}

/* ============================================
   LIFESTYLE
============================================ */

function saveLifestyle(lifestyle) {

    const user = getUser();

    user.lifestyle = lifestyle;

    saveUser(user);

}

/* ============================================
   GOALS
============================================ */

function saveGoals(goals) {

    const user = getUser();

    user.goals = goals;

    saveUser(user);

}

/* ============================================
   ONBOARDING
============================================ */

function setCurrentStep(step) {

    const user = getUser();

    user.onboarding.currentStep = step;

    saveUser(user);

}

function completeOnboarding() {
    const user = getUser();
    user.onboarding.completed = true;
    saveUser(user);

}

/* ============================================
   GETTERS
============================================ */

function getName() {

    return getUser().profile.name;

}

function getIdentity() {

    return getUser().profile.identity;

}

function getHabits() {

    return getUser().habits;

}

function getRoutine() {

    return getUser().routine;

}

function getLifestyle() {

    return getUser().lifestyle;

}

function getGoals() {

    return getUser().goals;

}

function getCurrentStep() {

    return getUser().onboarding.currentStep;

}

function isOnboardingComplete() {
    return getUser().onboarding.completed;

}

/* ============================================
   SAVE ENTIRE USER
============================================ */

function saveAll(user) {

    saveUser(user);

}
// update user data at a specific path
function updateUser(path, value) {

    const user = getUser();

    path.split(".").reduce((obj, key, index, array) => {

        if (index === array.length - 1) {

            obj[key] = value;

        } else {

            obj = obj[key];

        }

        return obj;

    }, user);

    saveUser(user);

}