import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/liron/Salino/WELCOME-PAGE";
const SITE = "https://hsr.lirshir.com";
const EMAIL = "haserli@lirshir.com";
const PLAY = "https://play.google.com/store/apps/details?id=com.salino.sali";
const APPSTORE = "https://apps.apple.com/app/id6768352555";
const THEME = "#0d9488";

const ALSO = `            <div class="also-grid">
              <a class="also-card" href="https://origo.lirshir.com/" rel="noreferrer" target="_blank">
                <img src="/assets/also/origo.webp" alt="" width="56" height="56" loading="lazy" />
                <div class="also-card-body">
                  <h3>ORIGO</h3>
                  <span class="also-local" data-i18n="alsoLocalOrigo">SMS phishing detector</span>
                  <p data-i18n="alsoOrigo">Not sure if that SMS is real? Check the message, link, or QR against official sources — a clear pause before you tap.</p>
                </div>
              </a>
              <a class="also-card" href="https://poofcam.lirshir.com/" rel="noreferrer" target="_blank">
                <img src="/assets/also/poofcam.webp" alt="" width="56" height="56" loading="lazy" />
                <div class="also-card-body">
                  <h3>PoofCam</h3>
                  <span class="also-local" data-i18n="alsoLocalPoofcam">Temporary photos</span>
                  <p data-i18n="alsoPoofcam">Snap the parking spot, the receipt, the whiteboard — then let it disappear. A temporary camera that won’t fill your camera roll.</p>
                </div>
              </a>
              <a class="also-card" href="https://aria.lirshir.com/" rel="noreferrer" target="_blank">
                <img src="/assets/also/aria.webp" alt="" width="56" height="56" loading="lazy" />
                <div class="also-card-body">
                  <h3>Aria</h3>
                  <span class="also-local" data-i18n="alsoLocalAria">אריאה</span>
                  <p data-i18n="alsoAria">Baby tracking for mom, dad, and anyone helping out — feeding, sleep, and diapers on one shared timeline.</p>
                </div>
              </a>
              <a class="also-card" href="https://scentofhome.cc/" rel="noreferrer" target="_blank">
                <img src="/assets/also/scent-of-home.webp" alt="" width="56" height="56" loading="lazy" />
                <div class="also-card-body">
                  <h3>Scent of Home</h3>
                  <span class="also-local" data-i18n="alsoLocalScent">ריח של בית</span>
                  <p data-i18n="alsoScent">Turn TikTok, Instagram, and Facebook recipe videos into a real family cookbook — dishes, stories, and cooking together.</p>
                </div>
              </a>
              <a class="also-card" href="https://keepsi.lirshir.com/" rel="noreferrer" target="_blank">
                <img src="/assets/also/keepsi.webp" alt="" width="56" height="56" loading="lazy" />
                <div class="also-card-body">
                  <h3>Keepsi</h3>
                  <span class="also-local" data-i18n="alsoLocalKeepsi">Screenshot organizer</span>
                  <p data-i18n="alsoKeepsi">Your screenshots, finally findable. Review, organize, and search what’s on them — private on your device, no cloud.</p>
                </div>
              </a>
              <a class="also-card" href="https://pend-app.lirshir.com/" rel="noreferrer" target="_blank">
                <img src="/assets/also/pend.webp" alt="" width="56" height="56" loading="lazy" />
                <div class="also-card-body">
                  <h3>PEND</h3>
                  <span class="also-local" data-i18n="alsoLocalPend">קונים חכם יותר</span>
                  <p data-i18n="alsoPend">Want it now? Put it in PEND first. Explore, pause, and decide later — shopping without the impulse checkout.</p>
                </div>
              </a>
              <a class="also-card" href="https://catchi.bylishi.com/" rel="noreferrer" target="_blank">
                <img src="/assets/also/catchi.webp" alt="" width="56" height="56" loading="lazy" />
                <div class="also-card-body">
                  <h3>Catchi</h3>
                  <span class="also-local" data-i18n="alsoLocalCatchi">Party dilemmas</span>
                  <p data-i18n="alsoCatchi">Party dilemmas with a catch. Take it, pass, or skip — then see how friends and the community answered.</p>
                </div>
              </a>
              <a class="also-card" href="https://bylishi.com/games/garden-guardians" rel="noreferrer" target="_blank">
                <img src="/assets/also/garden-guardians.webp" alt="" width="56" height="56" loading="lazy" />
                <div class="also-card-body">
                  <h3>Garden Guardians</h3>
                  <span class="also-local" data-i18n="alsoLocalGarden">Garden survival</span>
                  <p data-i18n="alsoGarden">Defend a lively garden from waves of pests in short, colorful survival runs — upgrade mid-fight and come back stronger.</p>
                </div>
              </a>
              <a class="also-card" href="https://bylishi.com/games/riftstrike" rel="noreferrer" target="_blank">
                <img src="/assets/also/riftstrike.webp" alt="" width="56" height="56" loading="lazy" />
                <div class="also-card-body">
                  <h3>RIFTSTRIKE</h3>
                  <span class="also-local" data-i18n="alsoLocalRift">Space survivor</span>
                  <p data-i18n="alsoRift">Pilot through the swarm in short, high-energy space runs — pick upgrades each round and strengthen the ship between battles.</p>
                </div>
              </a>
            </div>`;

function fixAlso(file) {
  let s = readFileSync(file, "utf8");
  s = s.replace(
    /<div class="also-grid">[\s\S]*?<\/div>\s*<p class="also-studio">/,
    ALSO + "\n            <p class=\"also-studio\">",
  );
  writeFileSync(file, s);
  console.log("also fixed", path.relative(ROOT, file));
}

fixAlso(path.join(ROOT, "index.html"));
fixAlso(path.join(ROOT, "he", "index.html"));

function chrome(title, desc, canonical, heCanonical, current, body, lang = "en") {
  const isHe = lang === "he";
  const home = isHe ? "/he/" : "/";
  const about = isHe ? "/he/about/" : "/about/";
  const team = isHe ? "/he/team/" : "/team/";
  const contact = isHe ? "/he/contact/" : "/contact/";
  const privacy = isHe ? "/he/privacy/" : "/privacy/";
  const terms = isHe ? "/he/terms/" : "/terms/";
  const nav = (key, href, label) =>
    `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!DOCTYPE html>
<html lang="${lang}"${isHe ? ' dir="rtl"' : ""}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta name="theme-color" content="${THEME}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" hreflang="en" href="${heCanonical.replace("/he/", "/").replace(/\/he$/, "/")}" />
    <link rel="alternate" hreflang="he" href="${heCanonical}" />
    <link rel="alternate" hreflang="x-default" href="${canonical.includes("/he/") ? canonical.replace("/he/", "/") : canonical}" />
    <link rel="icon" href="/assets/favicon.png" />
    <link rel="apple-touch-icon" href="/assets/app-logo.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap&subset=hebrew,latin" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Haserli · חסרלי" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SITE}/assets/og-image.png" />
  </head>
  <body>
    <header class="site-header">
      <div class="container">
        <a class="brand" href="${home}">
          <img src="/assets/app-logo.png" alt="Haserli logo" />
          <span>Haserli</span>
          <span class="brand-he"> · חסרלי</span>
        </a>
        <div class="header-end">
          <nav class="site-nav" aria-label="Primary">
            ${nav("about", about, isHe ? "אודות" : "About")}
            ${nav("team", team, isHe ? "צוות" : "Team")}
            ${nav("contact", contact, isHe ? "צור קשר" : "Contact")}
          </nav>
          <div class="lang-toggle" role="group" aria-label="Language">
            <button type="button" data-lang="he"${isHe ? ' class="active" aria-pressed="true"' : ""}>עברית</button>
            <button type="button" data-lang="en"${!isHe ? ' class="active" aria-pressed="true"' : ""}>EN</button>
          </div>
        </div>
      </div>
    </header>
    <main>
${body}
    </main>
    <footer class="site-footer">
      <div class="container">
        <span>${isHe ? "© 2026 חסרלי · Haserli · ישראל" : "© 2026 Haserli · חסרלי · Israel"}</span>
        <nav class="footer-links">
          <a href="${about}">${isHe ? "אודות" : "About"}</a>
          <a href="${team}">${isHe ? "צוות" : "Team"}</a>
          <a href="${contact}">${isHe ? "צור קשר" : "Contact"}</a>
          <a href="${privacy}">${isHe ? "מדיניות פרטיות" : "Privacy Policy"}</a>
          <a href="${terms}">${isHe ? "תנאי שימוש" : "Terms of Service"}</a>
          <a href="mailto:${EMAIL}">${EMAIL}</a>
        </nav>
      </div>
    </footer>
    <script src="/lang-nav.js"></script>
  </body>
</html>
`;
}

// About HE
writeFileSync(
  path.join(ROOT, "he/about/index.html"),
  chrome(
    "אודות — חסרלי · Haserli",
    "אודות חסרלי — חברה טכנולוגית מישראל מאחורי רשימת קניות משותפת בזמן אמת למשקי בית.",
    `${SITE}/he/about/`,
    `${SITE}/he/about/`,
    "about",
    `      <section class="page-hero">
        <div class="container narrow">
          <p class="page-kicker"><a href="/he/">בית</a> / אודות</p>
          <h1>אודות</h1>
          <p class="section-sub page-lead">
            חסרלי היא מוצר טכנולוגי מישראל. אנחנו בונים רשימת קניות משותפת בזמן אמת
            שעוזרת לזוגות, משפחות ושותפים לקנות יחד בלי בלגן.
          </p>
        </div>
      </section>
      <section class="section">
        <div class="container narrow">
          <h2 class="about-section-title">המשימה שלנו</h2>
          <p class="about-copy">
            תמיד מישהו שוכח את החלב. מישהו אחר קונה פעמיים. חסרלי שומרת רשימה חיה אחת לבית —
            מוסיפים מה שנגמר בבית, מסמנים בסופר, ומשתמשים במצב סופר לקנייה לפי מעברים.
          </p>
          <p class="about-copy">
            האפליקציה זמינה ב־
            <a href="${APPSTORE}" rel="noreferrer">App Store</a>
            וב־
            <a href="${PLAY}" rel="noreferrer">Google Play</a>.
          </p>
        </div>
      </section>
      <section class="section section-alt">
        <div class="container">
          <h2 class="about-section-title about-section-title--center">מייסד</h2>
          <article class="team-card team-card--page">
            <img class="team-avatar-img" src="/assets/founder.png" alt="לירון שריון, מייסד חסרלי" width="224" height="224" loading="lazy" decoding="async" />
            <div class="team-info">
              <h2>Liron Shiryon</h2>
              <p class="team-role">מייסד</p>
              <p class="team-bio">
                מייסד חסרלי. מוביל מוצר והנדסה של רשימת הקניות המשותפת שכבר ב-App Store וב-Google Play.
              </p>
              <div class="team-links">
                <a href="/he/team/">לעמוד הצוות המלא</a>
                <a href="https://www.linkedin.com/in/liron-shiryon-1691911b6/" rel="noopener noreferrer" target="_blank">LinkedIn</a>
                <a href="mailto:${EMAIL}">${EMAIL}</a>
              </div>
            </div>
          </article>
        </div>
      </section>`,
    "he",
  ),
);

// Team EN
writeFileSync(
  path.join(ROOT, "team/index.html"),
  chrome(
    "Team — Haserli · חסרלי",
    "Meet the Haserli team. Founder Liron Shiryon leads the Israel-based technology company behind the shared shopping list.",
    `${SITE}/team/`,
    `${SITE}/he/team/`,
    "team",
    `      <section class="page-hero">
        <div class="container narrow">
          <p class="page-kicker"><a href="/">Home</a> / Team</p>
          <h1>Team</h1>
          <p class="section-sub page-lead">
            A small Israel-based team building a calm shared shopping list for real households.
          </p>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <article class="team-card team-card--page">
            <img class="team-avatar-img" src="/assets/founder.png" alt="Liron Shiryon, founder of Haserli" width="224" height="224" loading="lazy" decoding="async" />
            <div class="team-info">
              <h2>Liron Shiryon</h2>
              <p class="team-role">Founder</p>
              <p class="team-bio">
                Founder of Haserli. Leads product and engineering for the shared shopping list on the App Store and Google Play.
              </p>
              <div class="team-links">
                <a href="https://www.linkedin.com/in/liron-shiryon-1691911b6/" rel="noopener noreferrer" target="_blank">LinkedIn</a>
                <a href="mailto:${EMAIL}">${EMAIL}</a>
              </div>
            </div>
          </article>
        </div>
      </section>`,
  ),
);

// Team HE
writeFileSync(
  path.join(ROOT, "he/team/index.html"),
  chrome(
    "צוות — חסרלי · Haserli",
    "הכירו את צוות חסרלי. המייסד לירון שריון מוביל את מוצר הטכנולוגיה מישראל מאחורי רשימת הקניות המשותפת.",
    `${SITE}/he/team/`,
    `${SITE}/he/team/`,
    "team",
    `      <section class="page-hero">
        <div class="container narrow">
          <p class="page-kicker"><a href="/he/">בית</a> / צוות</p>
          <h1>צוות</h1>
          <p class="section-sub page-lead">
            צוות קטן מישראל שבונה רשימת קניות משותפת רגועה לבתים אמיתיים.
          </p>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <article class="team-card team-card--page">
            <img class="team-avatar-img" src="/assets/founder.png" alt="לירון שריון, מייסד חסרלי" width="224" height="224" loading="lazy" decoding="async" />
            <div class="team-info">
              <h2>Liron Shiryon</h2>
              <p class="team-role">מייסד</p>
              <p class="team-bio">
                מייסד חסרלי. מוביל מוצר והנדסה של רשימת הקניות המשותפת ב-App Store וב-Google Play.
              </p>
              <div class="team-links">
                <a href="https://www.linkedin.com/in/liron-shiryon-1691911b6/" rel="noopener noreferrer" target="_blank">LinkedIn</a>
                <a href="mailto:${EMAIL}">${EMAIL}</a>
              </div>
            </div>
          </article>
        </div>
      </section>`,
    "he",
  ),
);

// Contact EN
writeFileSync(
  path.join(ROOT, "contact/index.html"),
  chrome(
    "Contact — Haserli · חסרלי",
    "Contact Haserli · חסרלי, an Israel-based technology company. Email haserli@lirshir.com.",
    `${SITE}/contact/`,
    `${SITE}/he/contact/`,
    "contact",
    `      <section class="page-hero">
        <div class="container narrow">
          <p class="page-kicker"><a href="/">Home</a> / Contact</p>
          <h1>Contact</h1>
          <p class="section-sub page-lead">Questions about Haserli, privacy, or the stores? Reach us by email.</p>
        </div>
      </section>
      <section class="section">
        <div class="container narrow">
          <div class="contact-row">
            <strong>Email</strong>
            <a class="contact-cta" href="mailto:${EMAIL}">${EMAIL}</a>
          </div>
          <div class="contact-row">
            <strong>Location</strong>
            <span>Israel</span>
          </div>
          <div class="contact-row">
            <strong>Stores</strong>
            <span>
              <a href="${APPSTORE}" rel="noreferrer">App Store</a>
              ·
              <a href="${PLAY}" rel="noreferrer">Google Play</a>
            </span>
          </div>
        </div>
      </section>`,
  ),
);

// Contact HE
writeFileSync(
  path.join(ROOT, "he/contact/index.html"),
  chrome(
    "צור קשר — חסרלי · Haserli",
    "צרו קשר עם חסרלי · Haserli, חברה טכנולוגית מישראל. אימייל haserli@lirshir.com.",
    `${SITE}/he/contact/`,
    `${SITE}/he/contact/`,
    "contact",
    `      <section class="page-hero">
        <div class="container narrow">
          <p class="page-kicker"><a href="/he/">בית</a> / צור קשר</p>
          <h1>צור קשר</h1>
          <p class="section-sub page-lead">שאלות על חסרלי, פרטיות או החנויות? כתבו לנו במייל.</p>
        </div>
      </section>
      <section class="section">
        <div class="container narrow">
          <div class="contact-row">
            <strong>אימייל</strong>
            <a class="contact-cta" href="mailto:${EMAIL}">${EMAIL}</a>
          </div>
          <div class="contact-row">
            <strong>מיקום</strong>
            <span>ישראל</span>
          </div>
          <div class="contact-row">
            <strong>חנויות</strong>
            <span>
              <a href="${APPSTORE}" rel="noreferrer">App Store</a>
              ·
              <a href="${PLAY}" rel="noreferrer">Google Play</a>
            </span>
          </div>
        </div>
      </section>`,
    "he",
  ),
);

// Privacy EN
writeFileSync(
  path.join(ROOT, "privacy/index.html"),
  chrome(
    "Privacy Policy — Haserli · חסרלי",
    "Privacy Policy for Haserli. How shopping list data syncs through Firebase, home invites work, and how advertising is handled.",
    `${SITE}/privacy/`,
    `${SITE}/he/privacy/`,
    "privacy",
    `      <section class="page-hero">
        <div class="container narrow">
          <p class="page-kicker"><a href="/">Home</a> / Privacy Policy</p>
          <h1>Privacy Policy</h1>
          <p class="legal-meta">
            <strong>Effective date:</strong> 27 September 2026<br />
            <strong>Last updated:</strong> 27 September 2026<br />
            <strong>App name:</strong> Haserli · חסרלי<br />
            <strong>Contact:</strong> <a href="mailto:${EMAIL}">${EMAIL}</a>
          </p>
        </div>
      </section>
      <section class="section">
        <div class="container narrow legal">
          <h2>1. Introduction</h2>
          <p>
            Haserli · חסרלי (“we”, “our”, or “the app”) is a real-time shared shopping list application.
            This Privacy Policy explains what information we collect, how it is stored and synced through
            Firebase, how household sharing works, what advertising partners may collect, and your choices.
            By using the app, you agree to this policy.
          </p>
          <p>We do not sell your personal information.</p>

          <h2>2. Who we are</h2>
          <p>
            Haserli is a technology product based in Israel, founded by Liron Shiryon. For privacy
            questions or requests, contact
            <a href="mailto:${EMAIL}">${EMAIL}</a>.
          </p>

          <h2>3. Account and sign-in</h2>
          <p>
            To use cloud sync and household sharing, you create an account. You can sign in with
            <strong>email and password</strong>, <strong>Google</strong>, or <strong>Apple</strong>.
            When you use Google or Apple sign-in, we receive basic profile information from that
            provider (such as your name and email address) to create and maintain your Haserli account.
            We do not receive your Google or Apple password.
          </p>

          <h2>4. Shopping list and household data</h2>
          <p>
            List and household data are stored in <strong>Google Firebase</strong> so members of the same
            home can stay in sync. This may include:
          </p>
          <ul>
            <li><strong>Home profile:</strong> home name and membership</li>
            <li><strong>List items:</strong> item names, quantities, categories, checked state, and notes</li>
            <li><strong>Invite codes:</strong> short codes used to join a home</li>
            <li><strong>Preferences:</strong> language and display settings</li>
          </ul>
          <p>
            When someone joins with your invite code, they can view and edit the shared list. You are
            responsible for who you invite.
          </p>

          <h2>5. Advertising</h2>
          <p>
            The app may show a banner ad that supports development. Advertising partners may collect
            device identifiers and usage signals under their own policies. Shopping list contents are
            <strong>not sold</strong> to advertisers.
          </p>

          <h2>6. Analytics and diagnostics</h2>
          <p>
            We may use basic analytics and crash reporting to understand performance and fix bugs.
            These tools process technical data such as device type, OS version, and app events.
          </p>

          <h2>7. How we use information</h2>
          <ul>
            <li>Provide shared shopping lists, supermarket mode, and home invites</li>
            <li>Authenticate accounts and keep households in sync</li>
            <li>Improve reliability, security, and product quality</li>
            <li>Show ads that fund free access to the core product</li>
            <li>Respond to support requests</li>
          </ul>

          <h2>8. Data retention and deletion</h2>
          <p>
            Cloud list and household data are kept while your account and home exist. You can request
            deletion by contacting <a href="mailto:${EMAIL}">${EMAIL}</a>. We will delete or anonymize
            personal data unless we must retain it for legal or security reasons.
          </p>

          <h2>9. Your choices</h2>
          <p>
            You may update account details in the app, leave a home, or request account deletion.
            Device OS settings also control advertising identifiers and notification permissions.
          </p>

          <h2>10. Children</h2>
          <p>
            Haserli is not directed at children under 13. If you believe a child provided personal
            data, contact us and we will take appropriate steps.
          </p>

          <h2>11. Changes</h2>
          <p>
            We may update this policy. The “Last updated” date will change when we do. Continued use
            of the app after an update means you accept the revised policy.
          </p>

          <h2>12. Contact</h2>
          <p>
            Privacy questions: <a href="mailto:${EMAIL}">${EMAIL}</a>
          </p>
        </div>
      </section>`,
  ),
);

// Privacy HE (concise accurate version)
writeFileSync(
  path.join(ROOT, "he/privacy/index.html"),
  chrome(
    "מדיניות פרטיות — חסרלי · Haserli",
    "מדיניות הפרטיות של חסרלי. איך נתוני רשימת הקניות מסתנכרנים דרך Firebase, איך עובדות הזמנות לבית, ואיך מטופל פרסום.",
    `${SITE}/he/privacy/`,
    `${SITE}/he/privacy/`,
    "privacy",
    `      <section class="page-hero">
        <div class="container narrow">
          <p class="page-kicker"><a href="/he/">בית</a> / מדיניות פרטיות</p>
          <h1>מדיניות פרטיות</h1>
          <p class="legal-meta">
            <strong>תאריך תוקף:</strong> 27 בספטמבר 2026<br />
            <strong>עודכן לאחרונה:</strong> 27 בספטמבר 2026<br />
            <strong>שם האפליקציה:</strong> חסרלי · Haserli<br />
            <strong>יצירת קשר:</strong> <a href="mailto:${EMAIL}">${EMAIL}</a>
          </p>
        </div>
      </section>
      <section class="section">
        <div class="container narrow legal">
          <h2>1. מבוא</h2>
          <p>
            חסרלי · Haserli („אנחנו”, „שלנו” או „האפליקציה”) היא אפליקציית רשימת קניות משותפת בזמן אמת.
            מדיניות זו מסבירה איזה מידע נאסף, איך הוא נשמר ומסתנכרן דרך Firebase, איך שיתוף בית עובד,
            מה שותפי פרסום עשויים לאסוף, ומה האפשרויות שלכם. השימוש באפליקציה מהווה הסכמה למדיניות זו.
          </p>
          <p>אנחנו לא מוכרים את המידע האישי שלכם.</p>

          <h2>2. מי אנחנו</h2>
          <p>
            חסרלי הוא מוצר טכנולוגי מישראל, שנוסד על ידי לירון שריון. לשאלות פרטיות:
            <a href="mailto:${EMAIL}">${EMAIL}</a>.
          </p>

          <h2>3. חשבון והתחברות</h2>
          <p>
            לשימוש בסנכרון ענן ובשיתוף בית יוצרים חשבון. אפשר להתחבר עם
            <strong>אימייל וסיסמה</strong>, <strong>Google</strong> או <strong>Apple</strong>.
            בהתחברות עם Google או Apple אנחנו מקבלים פרטי פרופיל בסיסיים (כגון שם ואימייל)
            ליצירה ולתחזוקה של חשבון חסרלי. אנחנו לא מקבלים את סיסמת Google או Apple שלכם.
          </p>

          <h2>4. נתוני רשימה ובית</h2>
          <p>
            נתוני רשימה ובית נשמרים ב־<strong>Google Firebase</strong> כדי שבני הבית יישארו מסונכרנים.
            זה עשוי לכלול שם בית, פריטי רשימה, כמויות, קטגוריות, סימון קנייה, הערות וקודי הזמנה.
            מי שמצטרף עם הקוד יכול לצפות ולערוך את הרשימה המשותפת.
          </p>

          <h2>5. פרסום</h2>
          <p>
            האפליקציה עשויה להציג באנר שמממן את הפיתוח. שותפי פרסום עשויים לאסוף מזהי מכשיר
            לפי המדיניות שלהם. תוכן רשימת הקניות <strong>לא נמכר</strong> למפרסמים.
          </p>

          <h2>6. שימוש במידע</h2>
          <ul>
            <li>לספק רשימות משותפות, מצב סופר והזמנות לבית</li>
            <li>לאמת חשבונות ולשמור על סנכרון</li>
            <li>לשפר אמינות, אבטחה ואיכות המוצר</li>
            <li>להציג מודעות שמממנות גישה חינמית לליבה</li>
            <li>לענות לפניות תמיכה</li>
          </ul>

          <h2>7. מחיקה</h2>
          <p>
            אפשר לבקש מחיקת חשבון בפנייה ל־
            <a href="mailto:${EMAIL}">${EMAIL}</a>.
          </p>

          <h2>8. יצירת קשר</h2>
          <p><a href="mailto:${EMAIL}">${EMAIL}</a></p>
        </div>
      </section>`,
    "he",
  ),
);

// Terms EN
writeFileSync(
  path.join(ROOT, "terms/index.html"),
  chrome(
    "Terms of Service — Haserli · חסרלי",
    "Terms of Service for the Haserli shared shopping list app, operated from Israel.",
    `${SITE}/terms/`,
    `${SITE}/he/terms/`,
    "terms",
    `      <section class="page-hero">
        <div class="container narrow">
          <p class="page-kicker"><a href="/">Home</a> / Terms of Service</p>
          <h1>Terms of Service</h1>
          <p class="legal-meta">
            <strong>Effective date:</strong> 27 September 2026<br />
            <strong>Last updated:</strong> 27 September 2026<br />
            <strong>Contact:</strong> <a href="mailto:${EMAIL}">${EMAIL}</a>
          </p>
        </div>
      </section>
      <section class="section">
        <div class="container narrow legal">
          <h2>1. Agreement</h2>
          <p>
            Haserli · חסרלי is a shared shopping list application for iOS and Android. These Terms
            govern your use of the app and related services. By using Haserli, you agree to these Terms.
          </p>

          <h2>2. The service</h2>
          <p>
            Haserli lets households create shared shopping lists, invite members with a code, sync
            updates in real time, and use supermarket mode by category. Features may change over time.
          </p>

          <h2>3. Accounts and households</h2>
          <p>
            You are responsible for the accuracy of shopping lists and items you add. Cloud sync stores
            this data so invited members can collaborate. Invite only people you trust — members can
            view and edit the shared list.
          </p>

          <h2>4. Acceptable use</h2>
          <p>
            Do not use Haserli to harass others, attempt to access another household without permission,
            disrupt the service, or violate applicable law.
          </p>

          <h2>5. Ads and free access</h2>
          <p>
            The app is free to download. A banner ad may support development so core list features stay free.
          </p>

          <h2>6. Disclaimer</h2>
          <p>
            Haserli is provided “as is” for shopping convenience. We do not guarantee uninterrupted
            availability or error-free operation.
          </p>

          <h2>7. Privacy</h2>
          <p>
            How account, household, list, and advertising data are handled is described in our
            <a href="/privacy/">Privacy Policy</a>.
          </p>

          <h2>8. Contact</h2>
          <p><a href="mailto:${EMAIL}">${EMAIL}</a></p>
        </div>
      </section>`,
  ),
);

// Terms HE
writeFileSync(
  path.join(ROOT, "he/terms/index.html"),
  chrome(
    "תנאי שימוש — חסרלי · Haserli",
    "תנאי שימוש לאפליקציית רשימת הקניות המשותפת חסרלי · Haserli, המופעלת מישראל.",
    `${SITE}/he/terms/`,
    `${SITE}/he/terms/`,
    "terms",
    `      <section class="page-hero">
        <div class="container narrow">
          <p class="page-kicker"><a href="/he/">בית</a> / תנאי שימוש</p>
          <h1>תנאי שימוש</h1>
          <p class="legal-meta">
            <strong>תאריך תוקף:</strong> 27 בספטמבר 2026<br />
            <strong>עודכן לאחרונה:</strong> 27 בספטמבר 2026<br />
            <strong>יצירת קשר:</strong> <a href="mailto:${EMAIL}">${EMAIL}</a>
          </p>
        </div>
      </section>
      <section class="section">
        <div class="container narrow legal">
          <h2>1. הסכמה</h2>
          <p>
            חסרלי · Haserli היא אפליקציית רשימת קניות משותפת ל־iOS ול־Android. תנאים אלה
            חלים על השימוש באפליקציה ובשירותים הקשורים. השימוש בחסרלי מהווה הסכמה לתנאים אלה.
          </p>

          <h2>2. השירות</h2>
          <p>
            חסרלי מאפשרת ליצור רשימות קניות משותפות, להזמין חברים בקוד, לסנכרן עדכונים בזמן אמת,
            ולהשתמש במצב סופר לפי קטגוריות. ייתכן שינוי בתכונות לאורך זמן.
          </p>

          <h2>3. חשבונות ובתים</h2>
          <p>
            אתם אחראים לדיוק הרשימות והפריטים שאתם מוסיפים. סנכרון ענן שומר נתונים אלה
            כדי שחברים מוזמנים יוכלו לשתף פעולה. הזמינו רק אנשים שאתם סומכים עליהם.
          </p>

          <h2>4. שימוש מקובל</h2>
          <p>
            אין להשתמש בחסרלי כדי להטריד אחרים, לנסות לגשת לבית אחר ללא הרשאה, לשבש
            את השירות או להפר חוק.
          </p>

          <h2>5. מודעות וגישה חינמית</h2>
          <p>
            האפליקציה חינמית להורדה. באנר עשוי לממן את הפיתוח כדי שתכונות הליבה יישארו חינם.
          </p>

          <h2>6. פרטיות</h2>
          <p>
            אופן הטיפול בנתוני חשבון, בית, רשימה ופרסום מתואר ב־
            <a href="/he/privacy/">מדיניות הפרטיות</a>.
          </p>

          <h2>7. יצירת קשר</h2>
          <p><a href="mailto:${EMAIL}">${EMAIL}</a></p>
        </div>
      </section>`,
    "he",
  ),
);

console.log("secondary pages rewritten");
