(function () {
  "use strict";

  var STORAGE_KEY = "haserli_lang";
  var DEFAULT_LANG = "en";
  var PLAY_URL = "https://play.google.com/store/apps/details?id=com.salino.sali";
  var APP_STORE_URL = "https://apps.apple.com/app/id6768352555";

  var content = {
    en: {
      dir: "ltr",
      docTitle: "Haserli · חסרלי — Shared Shopping List",
      metaDescription:
        "Haserli is a real-time shared shopping list for couples, families, and roommates. Add what ran out at home, check it off at the store — free on the App Store and Google Play.",
      ogDescription:
        "The household shopping list that updates for everyone in real time — supermarket mode by category, invite home with a code.",
      appName: "Haserli",
      appNameHe: "חסרלי",
      heroBadge: "On iOS & Android",
      heroTitle: "One list. Everyone in sync.",
      heroLead:
        "Haserli is the household shopping list that updates for everyone in real time — add what ran out at home, check it off at the store. Free for couples, families, and roommates.",
      featuresTitle: "Built for shared households",
      featuresSub:
        "Less forgotten milk, fewer duplicate carts — one live list for everyone who shops for the home.",
      feat1Title: "Real-time sync",
      feat1Body:
        "When someone adds milk or checks off bread, everyone sees it instantly on their phone.",
      feat2Title: "Invite home with a code",
      feat2Body:
        "Create a home, share a short invite code, and family or roommates join in seconds.",
      feat3Title: "Supermarket mode",
      feat3Body:
        "Sort the list by aisle categories — dairy, produce, pantry, cleaning — so shopping goes faster.",
      feat4Title: "Smart suggestions",
      feat4Body:
        "Favorites, recent items, and recurring staples make adding to the list almost automatic.",
      feat5Title: "Multilingual",
      feat5Body:
        "Hebrew, English, Arabic, Russian, French, Spanish, Amharic — and more as the household needs.",
      feat6Title: "Free to use",
      feat6Body: "Download and use Haserli for free on the App Store and Google Play.",
      shotsTitle: "Inside the app",
      shotsSub: "Real screens — shared list, add items, and supermarket mode by category.",
      shotAltList: "Haserli — shared shopping list",
      shotAltAdd: "Haserli — add items to the list",
      shotAltSuper: "Haserli — supermarket mode by category",
      navAbout: "About",
      navTeam: "Team",
      navContact: "Contact",
      companyTitle: "The app is already out",
      companySub:
        "Haserli · חסרלי is a technology product from Israel. The shared shopping list is available on the App Store and Google Play.",
      model1Title: "Available now",
      model1Body:
        "Haserli is on the App Store and Google Play with real-time lists, home invites, supermarket mode, and multilingual support.",
      model2Title: "Business model",
      model2Body:
        "The app is free to download. A modest ad banner supports development so shared lists stay free for households.",
      model3Title: "What's next",
      model3Body:
        "We keep improving sync, supermarket flow, and the calm experience of shopping together.",
      ctaTitle: "Download Haserli",
      ctaSub: "Free on the App Store and Google Play. One list for the whole home.",
      alsoTitle: "Try also",
      alsoSub: "More apps and games from ByLiShi — the same studio behind Haserli.",
      alsoStudio: "See everything on ByLiShi.com",
      alsoCatchi:
        "Party dilemmas with a catch. Take it, pass, or skip — then see how friends and the community answered.",
      alsoLocalCatchi: "Party dilemmas",
      alsoOrigo:
        "Not sure if that SMS is real? Check the message, link, or QR against official sources — a clear pause before you tap.",
      alsoLocalOrigo: "SMS phishing detector",
      alsoPoofcam:
        "Snap the parking spot, the receipt, the whiteboard — then let it disappear. A temporary camera that won’t fill your camera roll.",
      alsoLocalPoofcam: "Temporary photos",
      alsoAria:
        "Baby tracking for mom, dad, and anyone helping out — feeding, sleep, and diapers on one shared timeline.",
      alsoLocalAria: "אריאה",
      alsoScent:
        "Turn TikTok, Instagram, and Facebook recipe videos into a real family cookbook — dishes, stories, and cooking together.",
      alsoLocalScent: "ריח של בית",
      alsoKeepsi:
        "Your screenshots, finally findable. Review, organize, and search what’s on them — private on your device, no cloud.",
      alsoLocalKeepsi: "Screenshot organizer",
      alsoPend:
        "Want it now? Put it in PEND first. Explore, pause, and decide later — shopping without the impulse checkout.",
      alsoLocalPend: "קונים חכם יותר",
      alsoGarden:
        "Defend a lively garden from waves of pests in short, colorful survival runs — upgrade mid-fight and come back stronger.",
      alsoLocalGarden: "Garden survival",
      alsoRift:
        "Pilot through the swarm in short, high-energy space runs — pick upgrades each round and strengthen the ship between battles.",
      alsoLocalRift: "Space survivor",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      footerLegal: "© 2026 Haserli · חסרלי · Israel",
    },
    he: {
      dir: "rtl",
      docTitle: "חסרלי · Haserli — רשימת קניות משותפת",
      metaDescription:
        "חסרלי היא אפליקציית רשימת קניות משותפת בזמן אמת לזוג, משפחה ושותפים. מצב סופר לפי קטגוריות, הזמנה לבית בקוד. חינם לאייפון ואנדרואיד.",
      ogDescription:
        "רשימת קניות משותפת בזמן אמת, מצב סופר לפי קטגוריות והזמנה לבית בקוד. הורידו חינם לאייפון ואנדרואיד.",
      appName: "Haserli",
      appNameHe: "חסרלי",
      heroBadge: "ב-iOS וב-Android",
      heroTitle: "רשימה אחת. כולם מסונכרנים.",
      heroLead:
        "חסרלי היא רשימת הקניות של הבית שמתעדכנת לכולם בזמן אמת — מוסיפים מה שנגמר בבית, מסמנים בסופר. חינם לזוגות, משפחות ושותפים.",
      featuresTitle: "נבנה לבתים משותפים",
      featuresSub:
        "פחות חלב שנשכח, פחות כפילויות בסל — רשימה חיה אחת לכל מי שקונה לבית.",
      feat1Title: "סנכרון מיידי",
      feat1Body: "כשמישהו מוסיף חלב או מסמן לחם — כולם רואים את זה מיד בטלפון.",
      feat2Title: "הזמנה לבית בקוד",
      feat2Body: "יוצרים בית, משתפים קוד הצטרפות קצר, ומשפחה או שותפים מצטרפים בשניות.",
      feat3Title: "מצב סופר",
      feat3Body:
        "מסדרים את הרשימה לפי קטגוריות במעברים — חלב, ירקות, מזווה, ניקיון — כדי לקנות מהר יותר.",
      feat4Title: "הצעות חכמות",
      feat4Body: "מועדפים, פריטים אחרונים ופריטים שחוזרים עושים את ההוספה כמעט אוטומטית.",
      feat5Title: "רב־לשוני",
      feat5Body: "עברית, אנגלית, ערבית, רוסית, צרפתית, ספרדית, אמהרית — ועוד לפי הצורך של הבית.",
      feat6Title: "חינם לשימוש",
      feat6Body: "מורידים ומשתמשים בחסרלי בחינם מ-App Store ומ-Google Play.",
      shotsTitle: "בתוך האפליקציה",
      shotsSub: "מסכים אמיתיים — רשימה משותפת, הוספת פריטים ומצב סופר לפי קטגוריות.",
      shotAltList: "חסרלי — רשימת קניות משותפת",
      shotAltAdd: "חסרלי — הוספת פריטים לרשימה",
      shotAltSuper: "חסרלי — מצב סופר לפי קטגוריות",
      navAbout: "אודות",
      navTeam: "צוות",
      navContact: "צור קשר",
      companyTitle: "האפליקציה כבר באוויר",
      companySub:
        "חסרלי · Haserli היא מוצר טכנולוגי מישראל. רשימת הקניות המשותפת זמינה ב-App Store וב-Google Play.",
      model1Title: "זמין עכשיו",
      model1Body:
        "חסרלי כבר בחנויות, עם רשימות בזמן אמת, הזמנות לבית, מצב סופר ותמיכה רב־לשונית.",
      model2Title: "מודל עסקי",
      model2Body:
        "האפליקציה חינמית להורדה. באנר צנוע מממן את הפיתוח כדי שהרשימות המשותפות יישארו חינם למשקי בית.",
      model3Title: "מה הלאה",
      model3Body: "אנחנו ממשיכים לשפר סנכרון, חוויית סופר וקניות יחד בלי בלגן.",
      ctaTitle: "הורידו את חסרלי",
      ctaSub: "חינם ב-App Store וב-Google Play. רשימה אחת לכל הבית.",
      alsoTitle: "נסו גם",
      alsoSub: "עוד אפליקציות ומשחקים של ByLiShi — אותו סטודיו מאחורי חסרלי.",
      alsoStudio: "הכול ב־ByLiShi.com",
      alsoCatchi:
        "דילמות מסיבה עם קאצ׳. לוקחים, מוותרים או מדלגים — ואז רואים איך חברים והקהילה ענו.",
      alsoLocalCatchi: "משחק הדילמות",
      alsoOrigo:
        "לא בטוחים אם ההודעה אמיתית? בודקים SMS, קישור או QR מול מקורות רשמיים — רגע של בדיקה לפני שלוחצים.",
      alsoLocalOrigo: "זיהוי פישינג ב-SMS",
      alsoPoofcam:
        "מצלמים את החניה, את הקבלה, את הלוח — ואז נותנים לתמונה להיעלם. מצלמה זמנית שלא ממלאת את הגלריה.",
      alsoLocalPoofcam: "תמונות זמניות",
      alsoAria:
        "מעקב אחרי התינוק לאמא, לאבא ולכל מי שעוזר — האכלה, שינה וחיתולים בציר זמן משותף אחד.",
      alsoLocalAria: "אריאה",
      alsoScent:
        "הופכים סרטוני מתכונים מטיקטוק, אינסטגרם ופייסבוק לספר בישול משפחתי אמיתי — מנות, סיפורים ובישול ביחד.",
      alsoLocalScent: "ריח של בית",
      alsoKeepsi:
        "צילומי המסך סוף־סוף במקום שאפשר למצוא. סוקרים, מסדרים ומחפשים בתוכם — פרטי במכשיר, בלי ענן.",
      alsoLocalKeepsi: "ארגון צילומי מסך",
      alsoPend:
        "רוצים משהו עכשיו? שמים ב־PEND קודם. בודקים, עוצרים ומחליטים אחר כך — קניות בלי דחף לקופה.",
      alsoLocalPend: "קונים חכם יותר",
      alsoGarden:
        "מגנים על גינה תוססת מגלים של מזיקים בריצות הישרדות קצרות וצבעוניות — משדרגים באמצע וחוזרים חזקים יותר.",
      alsoLocalGarden: "הגנה על הגינה",
      alsoRift:
        "טסים דרך הנחיל בריצות חלל קצרות ואנרגטיות — בוחרים שדרוגים בכל סיבוב ומחזקים את הספינה בין קרבות.",
      alsoLocalRift: "הישרדות בחלל",
      privacy: "מדיניות פרטיות",
      terms: "תנאי שימוש",
      footerLegal: "© 2026 חסרלי · Haserli · ישראל",
    },
  };

  var landing = document.getElementById("landing");
  var buttons = document.querySelectorAll(".lang-toggle button");
  var SITE_ORIGIN = "https://hsr.lirshir.com";

  function pathLanguage() {
    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/he" || path.indexOf("/he/") === 0) return "he";
    return null;
  }

  function syncUrlWithLanguage(lang) {
    var params = new URLSearchParams(window.location.search);
    var hasLangQuery = params.has("lang");
    var path = window.location.pathname;

    // Never rewrite /join/* or subpages
    if (path.indexOf("/join") === 0) return;
    if (path !== "/" && path !== "/he" && path !== "/he/") return;

    if (lang === "he") {
      if (hasLangQuery || path !== "/he/") {
        window.history.replaceState(null, "", "/he/");
      }
      return;
    }

    if (hasLangQuery || path === "/he/" || path === "/he") {
      window.history.replaceState(null, "", "/");
    }
  }

  function updateShareMeta(lang, strings) {
    var url = lang === "he" ? SITE_ORIGIN + "/he/" : SITE_ORIGIN + "/";
    var shareDescription = strings.ogDescription || strings.metaDescription;

    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", url);

    var shareTags = [
      ['meta[property="og:title"]', "content", strings.docTitle],
      ['meta[property="og:description"]', "content", shareDescription],
      ['meta[property="og:url"]', "content", url],
      ['meta[property="og:site_name"]', "content", "Haserli · חסרלי"],
      ['meta[name="twitter:title"]', "content", strings.docTitle],
      ['meta[name="twitter:description"]', "content", shareDescription],
    ];

    for (var t = 0; t < shareTags.length; t++) {
      var tag = document.querySelector(shareTags[t][0]);
      if (tag) tag.setAttribute(shareTags[t][1], shareTags[t][2]);
    }
  }

  function resolveInitialLanguage() {
    var fromPath = pathLanguage();
    if (fromPath) return fromPath;

    var params = new URLSearchParams(window.location.search);
    var fromQuery = (params.get("lang") || "").toLowerCase();
    if (content[fromQuery]) return fromQuery;

    var stored = "";
    try {
      stored = (window.localStorage.getItem(STORAGE_KEY) || "").toLowerCase();
    } catch (e) {
      stored = "";
    }
    if (content[stored]) return stored;

    if (window.__haserliLangDetect && window.__haserliLangDetect.isLikelyFromIsrael()) {
      return "he";
    }

    var preferred =
      Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : [navigator.language || DEFAULT_LANG];
    for (var i = 0; i < preferred.length; i++) {
      var normalized = String(preferred[i] || "")
        .toLowerCase()
        .split("-")[0];
      if (content[normalized]) return normalized;
    }
    return DEFAULT_LANG;
  }

  function applyLanguage(lang) {
    var strings = content[lang] || content[DEFAULT_LANG];

    document.documentElement.lang = lang;
    document.documentElement.dir = strings.dir;
    document.title = strings.docTitle;

    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", strings.metaDescription);
    updateShareMeta(lang, strings);

    var nodes = landing.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute("data-i18n");
      if (strings[key] != null) nodes[i].textContent = strings[key];
    }

    var brandHe = landing.querySelector("[data-i18n-brand-he]");
    if (brandHe && strings.appNameHe) {
      brandHe.textContent = " · " + strings.appNameHe;
    }

    var hrefNodes = landing.querySelectorAll("[data-i18n-href-en]");
    for (var h = 0; h < hrefNodes.length; h++) {
      var href =
        lang === "he"
          ? hrefNodes[h].getAttribute("data-i18n-href-he")
          : hrefNodes[h].getAttribute("data-i18n-href-en");
      if (href) hrefNodes[h].setAttribute("href", href);
    }

    var shotAlts = [
      { id: "hero-shot", alt: "shotAltList" },
      { id: "shot-list", alt: "shotAltList" },
      { id: "shot-add", alt: "shotAltAdd" },
      { id: "shot-super", alt: "shotAltSuper" },
    ];
    for (var s = 0; s < shotAlts.length; s++) {
      var img = document.getElementById(shotAlts[s].id);
      if (img && strings[shotAlts[s].alt] != null) img.alt = strings[shotAlts[s].alt];
    }

    for (var j = 0; j < buttons.length; j++) {
      var isActive = buttons[j].getAttribute("data-lang") === lang;
      buttons[j].classList.toggle("active", isActive);
      buttons[j].setAttribute("aria-pressed", isActive ? "true" : "false");
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* ignore */
    }

    syncUrlWithLanguage(lang);
  }

  if (!landing) return;

  for (var b = 0; b < buttons.length; b++) {
    buttons[b].addEventListener("click", function () {
      applyLanguage(this.getAttribute("data-lang"));
    });
  }

  landing.hidden = false;
  applyLanguage(resolveInitialLanguage());
})();
