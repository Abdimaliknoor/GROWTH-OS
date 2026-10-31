/* ╔══════════════════════════════════════════════════════════════╗
   ║  NAV  ·  js/app/nav.js                                       ║
   ║  The menu for every app page, written ONCE.                  ║
   ╚══════════════════════════════════════════════════════════════╝

   USED BY  today · plan · journal · progress · me
            (load it AFTER state.js, BEFORE the page's own script)

   EACH PAGE ONLY HAS
     <nav class="app-nav" id="appNav" data-page="today" aria-label="Main"></nav>
     data-page = which tab is lit up. This file draws everything inside.

   WHAT IT DRAWS
     phone   → bottom bar:  Today · Plan · Journal · Progress · (A) Me
     desktop → sidebar:     logo + Beta
                            Today / Plan / Journal / Progress
                            ……… (empty space) ………
                            [ (A)  Amina        ]   ← Me, at the bottom
                            [      Quran      › ]

   MAP
     1. Settings    the tabs, in order
     2. Helpers     navMake(), navIcon(), navInitial(), navMarkCurrent()
                    (all start with "nav": every script on the page shares one
                     set of names, so a page can't accidentally overwrite them)
     3. Renderers   renderNav(), renderNavProfile()
     4. Load
   ══════════════════════════════════════════════════════════════════ */


/* ═══════════ 1. SETTINGS ═══════════ */

// To add, remove or reorder a tab: change this list only.
const NAV_TABS = [
    { page: "today",    label: "Today",    icon: "today" },
    { page: "plan",     label: "Plan",     icon: "checklist" },
    { page: "journal",  label: "Journal",  icon: "edit_note" },
    { page: "progress", label: "Progress", icon: "trending_up" },
];


/* ═══════════ 2. HELPERS ═══════════ */

// navMake("a", "app-tab", "Today") → <a class="app-tab">Today</a>
// textContent, never innerHTML: a name like "<b>Ali" stays plain text.
function navMake(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

function navIcon(name) {
    const icon = navMake("span", "icon", name);
    icon.setAttribute("aria-hidden", "true");
    return icon;
}

// "amina" → "A". [...name] keeps letters like "Ä" or an emoji whole.
function navInitial(name) {
    const letters = [...(name || "").trim()];
    return letters.length ? letters[0].toUpperCase() : "?";
}

// The lit-up tab: aria-current="page" — CSS and screen readers both read it.
function navMarkCurrent(link, page, currentPage) {
    if (page === currentPage) link.setAttribute("aria-current", "page");
}


/* ═══════════ 3. RENDERERS ═══════════ */

function renderNav() {
    const nav = document.getElementById("appNav");
    if (!nav) return;
    const currentPage = nav.dataset.page;

    // ── Logo (desktop only, CSS hides it on phone) ──
    const brand = navMake("a", "app-brand");
    brand.href = "today.html";
    const logo = navMake("img", "app-brand-mark");
    logo.src = "../assets/icons/unnamed.png";
    logo.alt = "";
    brand.append(logo, "Growth OS", navMake("span", "app-beta", "Beta"));

    // ── The 4 main tabs ──
    const list = navMake("ul", "app-tabs");
    NAV_TABS.forEach(tab => {
        const link = navMake("a", "app-tab");
        link.href = `${tab.page}.html`;
        link.append(navIcon(tab.icon), navMake("span", "app-tab-label", tab.label));
        navMarkCurrent(link, tab.page, currentPage);

        const item = navMake("li");
        item.append(link);
        list.append(item);
    });

    // ── Me: a tab on phone, a profile card at the bottom on desktop ──
    const me = navMake("a", "app-tab app-me");
    me.href = "me.html";
    me.id = "navMe";
    navMarkCurrent(me, "me", currentPage);

    const text = navMake("span", "app-me-text");
    text.append(
        navMake("span", "app-me-name"),         // filled by renderNavProfile()
        navMake("span", "app-me-area")
    );
    me.append(
        navMake("span", "app-me-avatar"),
        text,
        navMake("span", "app-tab-label app-me-short", "Me"),   // the word under the circle on phone
        navIcon("chevron_right")
    );

    const meItem = navMake("li", "app-me-item");
    meItem.append(me);
    list.append(meItem);

    nav.replaceChildren(brand, list);
    renderNavProfile();
}

// Just the name part. Me calls this after "Your name" is saved,
// so the sidebar changes at once, without a reload.
function renderNavProfile() {
    const me = document.getElementById("navMe");
    if (!me) return;

    const name = getName();
    const { areaLabel } = getDirection();

    me.querySelector(".app-me-avatar").textContent = navInitial(name);
    me.querySelector(".app-me-name").textContent = name || "You";
    me.querySelector(".app-me-area").textContent = areaLabel || "Your profile";
    me.setAttribute("aria-label", `Me, ${name || "your profile"}`);
}


/* ═══════════ 4. LOAD ═══════════ */

renderNav();