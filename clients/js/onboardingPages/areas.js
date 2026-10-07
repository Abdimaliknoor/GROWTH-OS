/* =========================================================
   LIFE AREAS
   The content behind the Direction, Goal and Habit pages.
   To add or change an area, edit this list only.

   Each suggested goal says how it is measured:
     consistency → no number, progress = doing the habits
     total       → amounts add up to a target (20 pages)
     level       → reach a value (run 10 km in one go)
     milestones  → a checklist of big steps

   units  → the unit chips shown on the Goal and Habit pages
   habits → suggested daily habits for the Habit page.
            type: "time" | "quantity" | "completion"
            days: optional, every day when left out
   ========================================================= */

const AREAS = [
    {
        id: "career", icon: "work", label: "Career & Skills",
        identities: [
            "Someone who keeps getting better at their craft",
            "A skilled professional people rely on",
            "Someone who learns something new every week"
        ],
        goals: [
            { title: "Finish an online course", measure: "total", target: 20, unit: "lessons" },
            { title: "Build a portfolio project", measure: "milestones" },
            { title: "Practice my craft consistently", measure: "consistency" }
        ],
        units: ["hours", "lessons", "projects"],
        habits: [
            { name: "Practice my skill",   type: "time",       target: 60, unit: "min" },
            { name: "Work on my project",  type: "time",       target: 90, unit: "min", days: ["mon", "tue", "wed", "thu", "fri"] },
            { name: "Read about my field", type: "quantity",   target: 10, unit: "pages" }
        ]
    },
    {
        id: "education", icon: "school", label: "Education",
        identities: [
            "A focused student who studies consistently",
            "Someone who understands, not just memorizes",
            "A student who finishes strong"
        ],
        goals: [
            { title: "Score 80% in my exams", measure: "level", target: 80, unit: "%" },
            { title: "Study 100 hours this semester", measure: "total", target: 100, unit: "hours" },
            { title: "Study every day", measure: "consistency" }
        ],
        units: ["hours", "%", "chapters"],
        habits: [
            { name: "Study",               type: "time",       target: 2,  unit: "hours", days: ["mon", "tue", "wed", "thu", "fri"] },
            { name: "Revise my notes",     type: "time",       target: 30, unit: "min" },
            { name: "Do practice questions", type: "quantity", target: 10, unit: "questions" }
        ]
    },
    {
        id: "health", icon: "fitness_center", label: "Health & Fitness",
        identities: [
            "Someone who moves every day",
            "Someone with energy and strength",
            "Someone who takes care of their body"
        ],
        goals: [
            { title: "Run 10 km without stopping", measure: "level", target: 10, unit: "km" },
            { title: "Reach 70 kg", measure: "level", target: 70, unit: "kg" },
            { title: "Exercise regularly", measure: "consistency" }
        ],
        units: ["km", "kg", "minutes"],
        habits: [
            { name: "Run",                 type: "quantity",   target: 3,  unit: "km", days: ["mon", "wed", "fri"] },
            { name: "Work out",            type: "time",       target: 30, unit: "min" },
            { name: "Walk",                type: "quantity",   target: 8000, unit: "steps" }
        ]
    },
    {
        id: "mind", icon: "self_improvement", label: "Mind & Wellbeing",
        identities: [
            "Someone who stays calm under pressure",
            "Someone who rests well and thinks clearly",
            "Someone who takes care of their mind"
        ],
        goals: [
            { title: "Sleep 7+ hours every night", measure: "consistency" },
            { title: "Reflect on my day every evening", measure: "consistency" },
            { title: "Read 12 books this year", measure: "total", target: 12, unit: "books" }
        ],
        units: ["hours", "books", "minutes"],
        habits: [
            { name: "Sleep by 11 PM",      type: "completion", target: 1,  unit: "" },
            { name: "Journal",             type: "completion", target: 1,  unit: "" },
            { name: "Read",                type: "quantity",   target: 10, unit: "pages" }
        ]
    },
    {
        id: "faith", icon: "spa", label: "Faith & Spirit",
        identities: [
            "Someone with a consistent spiritual practice",
            "Someone whose actions match their values",
            "Someone who grows in faith every day"
        ],
        goals: [
            { title: "Pray consistently", measure: "consistency" },
            { title: "Read scripture every day", measure: "consistency" },
            { title: "Memorize new passages", measure: "total", target: 10, unit: "passages" }
        ],
        units: ["pages", "passages", "minutes"],
        habits: [
            { name: "Pray on time",        type: "completion", target: 1,  unit: "" },
            { name: "Read scripture",      type: "time",       target: 15, unit: "min" },
            { name: "Reflect",             type: "completion", target: 1,  unit: "" }
        ]
    },
    {
        id: "quran", icon: "menu_book", label: "Quran",
        identities: [
            "Someone who carries the Quran in their heart",
            "Someone who never lets their memorization fade",
            "Someone who recites the Quran every day"
        ],
        goals: [
            { title: "Memorize a new juz", measure: "total", target: 20, unit: "pages" },
            { title: "Complete my memorization of the Quran", measure: "milestones" },
            { title: "Strengthen my revision", measure: "consistency" },
            { title: "Recite the whole Quran this month", measure: "total", target: 30, unit: "juz" }
        ],
        units: ["pages", "rub'", "hizb", "juz"],
        habits: [
            { name: "Memorize new",              type: "quantity",   target: 1,  unit: "pages" },
            { name: "Revise last hizb",          type: "quantity",   target: 10, unit: "pages" },
            { name: "Revise whole memorization", type: "quantity",   target: 2,  unit: "rub'" },
            { name: "Recite with a teacher",     type: "completion", target: 1,  unit: "", days: ["mon", "wed"] }
        ]
    },
    {
        id: "money", icon: "savings", label: "Money",
        identities: [
            "Someone in control of their money",
            "Someone who saves before they spend",
            "Someone building long-term security"
        ],
        goals: [
            { title: "Build an emergency fund", measure: "total", target: 50000, unit: "KES" },
            { title: "Pay off a debt", measure: "milestones" },
            { title: "Track every expense", measure: "consistency" }
        ],
        units: ["KES", "USD"],
        habits: [
            { name: "Track my spending",   type: "completion", target: 1,  unit: "" },
            { name: "Save money",          type: "quantity",   target: 200, unit: "KES" },
            { name: "No impulse buying",   type: "completion", target: 1,  unit: "" }
        ]
    },
    {
        id: "relationships", icon: "favorite", label: "Relationships & Family",
        identities: [
            "Someone who shows up for the people they love",
            "A present and patient family member",
            "A friend people can count on"
        ],
        goals: [
            { title: "Spend more time with family", measure: "consistency" },
            { title: "Reconnect with 10 old friends", measure: "total", target: 10, unit: "friends" },
            { title: "Be more present at home", measure: "consistency" }
        ],
        units: ["calls", "visits", "hours"],
        habits: [
            { name: "Call my family",      type: "completion", target: 1,  unit: "", days: ["sat", "sun"] },
            { name: "Quality time",        type: "time",       target: 60, unit: "min" },
            { name: "Message a friend",    type: "completion", target: 1,  unit: "" }
        ]
    },
    {
        id: "business", icon: "storefront", label: "Business",
        identities: [
            "Someone who builds and ships",
            "A business owner who serves customers well",
            "Someone who turns ideas into income"
        ],
        goals: [
            { title: "Get my first 10 customers", measure: "total", target: 10, unit: "customers" },
            { title: "Launch my product", measure: "milestones" },
            { title: "Work on my business daily", measure: "consistency" }
        ],
        units: ["customers", "KES", "sales"],
        habits: [
            { name: "Work on my business", type: "time",       target: 2,  unit: "hours" },
            { name: "Contact customers",   type: "quantity",   target: 5,  unit: "customers", days: ["mon", "tue", "wed", "thu", "fri"] },
            { name: "Post content",        type: "completion", target: 1,  unit: "" }
        ]
    },
    {
        // The user names this area themselves, so it has no suggestions.
        id: "other", icon: "edit", label: "Something else",
        identities: [], goals: [], units: [], habits: []
    }
];

function getAreaById(areaId) {
    return AREAS.find(area => area.id === areaId) || null;
}