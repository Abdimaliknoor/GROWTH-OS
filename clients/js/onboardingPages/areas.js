/* =========================================================
   LIFE AREAS
   The content behind the Direction page (and, next, the
   Goal page's suggestions). To add or change an area,
   edit this list only. No logic lives here.
   ========================================================= */

const AREAS = [
    {
        id: "career",
        icon: "work",
        label: "Career & Skills",
        identities: [
            "Someone who keeps getting better at their craft",
            "A skilled professional people rely on",
            "Someone who learns something new every week"
        ],
        goals: ["Learn a new professional skill", "Build a portfolio project", "Get a better job"]
    },
    {
        id: "education",
        icon: "school",
        label: "Education",
        identities: [
            "A focused student who studies consistently",
            "Someone who understands, not just memorizes",
            "A student who finishes strong"
        ],
        goals: ["Pass all my exams", "Raise my grades", "Finish my course"]
    },
    {
        id: "health",
        icon: "fitness_center",
        label: "Health & Fitness",
        identities: [
            "Someone who moves every day",
            "Someone with energy and strength",
            "Someone who takes care of their body"
        ],
        goals: ["Run a 10K race", "Lose 5 kg", "Exercise 4 times a week"]
    },
    {
        id: "mind",
        icon: "self_improvement",
        label: "Mind & Wellbeing",
        identities: [
            "Someone who stays calm under pressure",
            "Someone who rests well and thinks clearly",
            "Someone who takes care of their mind"
        ],
        goals: ["Sleep 7+ hours a night", "Reduce my stress", "Reflect on my day every evening"]
    },
    {
        id: "faith",
        icon: "spa",
        label: "Faith & Spirit",
        identities: [
            "Someone with a consistent spiritual practice",
            "Someone whose actions match their values",
            "Someone who grows in faith every day"
        ],
        goals: ["Pray consistently", "Read scripture every day", "Memorize new passages"]
    },
    {
        id: "money",
        icon: "savings",
        label: "Money",
        identities: [
            "Someone in control of their money",
            "Someone who saves before they spend",
            "Someone building long-term security"
        ],
        goals: ["Build an emergency fund", "Pay off a debt", "Track every expense"]
    },
    {
        id: "relationships",
        icon: "favorite",
        label: "Relationships & Family",
        identities: [
            "Someone who shows up for the people they love",
            "A present and patient family member",
            "A friend people can count on"
        ],
        goals: ["Spend more time with family", "Reconnect with old friends", "Be more present at home"]
    },
    {
        id: "business",
        icon: "storefront",
        label: "Business",
        identities: [
            "Someone who builds and ships",
            "A business owner who serves customers well",
            "Someone who turns ideas into income"
        ],
        goals: ["Get my first 10 customers", "Launch my product", "Grow monthly revenue"]
    },
    {
        id: "quran",
        icon: "menu_book",
        label: "Quran",
        identities: [
            "Someone who carries the Quran in their heart",
            "Someone who never lets their memorization fade",
            "Someone who recites the Quran every day"
        ],
        goals: [
            "Memorize a new juz",
            "Complete my memorization of the Quran",
            "Strengthen my revision",
            "Recite the whole Quran this month"
        ],
        // Used by the Habit page: tapping one pre-fills the habit form.
        habits: [
            { name: "Memorize new",              type: "quantity",   target: 5, unit: "lines" },
            { name: "Revise last hizb",          type: "quantity",   target: 1, unit: "rub'" },
            { name: "Revise whole memorization", type: "quantity",   target: 1, unit: "juz" },
            { name: "Recite with a teacher",     type: "completion", target: 1, unit: "" }
        ]
    },
    {
        // The user names this area themselves, so suggestions
        // are generated from their text in identity.js.
        id: "other",
        icon: "edit",
        label: "Something else",
        identities: [],
        goals: []
    }
];

function getAreaById(areaId) {
    return AREAS.find(area => area.id === areaId) || null;
}