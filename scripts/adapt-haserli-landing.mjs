/**
 * One-shot: adapt Aria-scaffolded WELCOME-PAGE files into Haserli branding.
 * Run: node scripts/adapt-haserli-landing.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "WELCOME-PAGE");
const SITE = "https://hsr.lirshir.com";
const EMAIL = "haserli@lirshir.com";
const PLAY = "https://play.google.com/store/apps/details?id=com.salino.sali";
const APPSTORE = "https://apps.apple.com/app/id6768352555";
const THEME = "#0d9488";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function replaceAll(s, pairs) {
  let out = s;
  for (const [a, b] of pairs) out = out.split(a).join(b);
  return out;
}

const ALSO_HTML = `            <div class="also-grid">
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

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Haserli · חסרלי — Shared Shopping List</title>
    <meta
      name="description"
      content="Haserli is a real-time shared shopping list for couples, families, and roommates. Add what ran out at home, check it off at the store — free on the App Store and Google Play."
    />
    <meta name="theme-color" content="${THEME}" />
    <meta name="apple-itunes-app" content="app-id=6768352555" />

    <link rel="canonical" href="${SITE}/" />
    <link rel="alternate" hreflang="en" href="${SITE}/" />
    <link rel="alternate" hreflang="he" href="${SITE}/he/" />
    <link rel="alternate" hreflang="x-default" href="${SITE}/" />

    <link rel="icon" href="/assets/favicon.png" />
    <link rel="apple-touch-icon" href="/assets/app-logo.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap&subset=hebrew,latin"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/styles.css" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Haserli · חסרלי" />
    <meta property="og:title" content="Haserli · חסרלי — Shared Shopping List" />
    <meta
      property="og:description"
      content="The household shopping list that updates for everyone in real time — supermarket mode by category, invite home with a code."
    />
    <meta property="og:url" content="${SITE}/" />
    <meta property="og:image" content="${SITE}/assets/og-image.png" />
    <meta property="og:image:secure_url" content="${SITE}/assets/og-image.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:image:alt" content="Haserli · חסרלי — shared shopping list for iOS and Android" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:locale:alternate" content="he_IL" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Haserli · חסרלי — Shared Shopping List" />
    <meta
      name="twitter:description"
      content="The household shopping list that updates for everyone in real time — supermarket mode by category, invite home with a code."
    />
    <meta name="twitter:image" content="${SITE}/assets/og-image.png" />

    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "name": "Haserli",
            "alternateName": "חסרלי",
            "url": "${SITE}/",
            "logo": "${SITE}/assets/app-logo.png",
            "email": "${EMAIL}",
            "address": {
              "@type": "PostalAddress",
              "addressCountry": "IL"
            },
            "founder": {
              "@type": "Person",
              "name": "Liron Shiryon",
              "jobTitle": "Founder",
              "image": "${SITE}/assets/founder.png",
              "sameAs": ["https://www.linkedin.com/in/liron-shiryon-1691911b6/"]
            },
            "sameAs": ["https://www.linkedin.com/in/liron-shiryon-1691911b6/"]
          },
          {
            "@type": "SoftwareApplication",
            "name": "Haserli: Shared Shopping List",
            "alternateName": ["חסרלי", "Haserli"],
            "operatingSystem": "iOS, Android",
            "applicationCategory": "LifestyleApplication",
            "description": "A real-time shared shopping list for couples, families, and roommates. Supermarket mode by category and home invites with a code. Available on the App Store and Google Play.",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "downloadUrl": [
              "${PLAY}",
              "${APPSTORE}"
            ]
          }
        ]
      }
    </script>
  </head>
  <body>
    <script>
      (function () {
        var parts = location.pathname.replace(/^\\/+|\\/+$/g, "").split("/");
        if (parts[0] === "join") {
          document.documentElement.className = "join-route-pending";
        }
      })();
    </script>
    <div id="landing">
      <header class="site-header">
        <div class="container">
          <a class="brand" href="/">
            <img src="/assets/app-logo.png" alt="Haserli logo" />
            <span data-i18n="appName">Haserli</span>
            <span class="brand-he" data-i18n-brand-he> · חסרלי</span>
          </a>
          <div class="header-end">
            <nav class="site-nav" aria-label="Primary">
              <a href="/about/" data-i18n="navAbout" data-i18n-href-en="/about/" data-i18n-href-he="/he/about/">About</a>
              <a href="/team/" data-i18n="navTeam" data-i18n-href-en="/team/" data-i18n-href-he="/he/team/">Team</a>
              <a href="/contact/" data-i18n="navContact" data-i18n-href-en="/contact/" data-i18n-href-he="/he/contact/">Contact</a>
            </nav>
            <div class="lang-toggle" role="group" aria-label="Language">
              <button type="button" data-lang="he">עברית</button>
              <button type="button" data-lang="en" class="active" aria-pressed="true">EN</button>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section class="hero">
          <div class="container">
            <div class="hero-text">
              <span class="hero-badge" data-i18n="heroBadge">On iOS &amp; Android</span>
              <h1 data-i18n="heroTitle">One list. Everyone in sync.</h1>
              <p class="hero-lead" data-i18n="heroLead">
                Haserli is the household shopping list that updates for everyone in real time —
                add what ran out at home, check it off at the store. Free for couples, families, and roommates.
              </p>
              <div class="store-links">
                <a
                  class="store-badge store-badge--google"
                  href="${PLAY}"
                  rel="noreferrer"
                  aria-label="Get it on Google Play"
                >
                  <img src="/assets/google-play-badge.png" alt="Get it on Google Play" />
                </a>
                <a
                  class="store-badge store-badge--apple"
                  href="${APPSTORE}"
                  rel="noreferrer"
                  aria-label="Download on the App Store"
                >
                  <img src="/assets/app-store-badge.png" alt="Download on the App Store" />
                </a>
              </div>
            </div>
            <div class="hero-art">
              <figure class="phone-frame">
                <img
                  id="hero-shot"
                  src="/assets/screenshots/screen-list.png"
                  alt="Haserli — shared shopping list"
                  width="390"
                  height="844"
                  decoding="async"
                />
              </figure>
            </div>
          </div>
        </section>

        <section class="section section-alt">
          <div class="container">
            <h2 data-i18n="featuresTitle">Built for shared households</h2>
            <p class="section-sub" data-i18n="featuresSub">
              Less forgotten milk, fewer duplicate carts — one live list for everyone who shops for the home.
            </p>
            <div class="features">
              <article class="feature">
                <div class="feature-icon" aria-hidden="true">⚡</div>
                <h3 data-i18n="feat1Title">Real-time sync</h3>
                <p data-i18n="feat1Body">
                  When someone adds milk or checks off bread, everyone sees it instantly on their phone.
                </p>
              </article>
              <article class="feature">
                <div class="feature-icon" aria-hidden="true">🏠</div>
                <h3 data-i18n="feat2Title">Invite home with a code</h3>
                <p data-i18n="feat2Body">
                  Create a home, share a short invite code, and family or roommates join in seconds.
                </p>
              </article>
              <article class="feature">
                <div class="feature-icon" aria-hidden="true">🛒</div>
                <h3 data-i18n="feat3Title">Supermarket mode</h3>
                <p data-i18n="feat3Body">
                  Sort the list by aisle categories — dairy, produce, pantry, cleaning — so shopping goes faster.
                </p>
              </article>
              <article class="feature">
                <div class="feature-icon" aria-hidden="true">✨</div>
                <h3 data-i18n="feat4Title">Smart suggestions</h3>
                <p data-i18n="feat4Body">
                  Favorites, recent items, and recurring staples make adding to the list almost automatic.
                </p>
              </article>
              <article class="feature">
                <div class="feature-icon" aria-hidden="true">🌍</div>
                <h3 data-i18n="feat5Title">Multilingual</h3>
                <p data-i18n="feat5Body">
                  Hebrew, English, Arabic, Russian, French, Spanish, Amharic — and more as the household needs.
                </p>
              </article>
              <article class="feature">
                <div class="feature-icon" aria-hidden="true">🎁</div>
                <h3 data-i18n="feat6Title">Free to use</h3>
                <p data-i18n="feat6Body">
                  Download and use Haserli for free on the App Store and Google Play.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section class="section" id="product">
          <div class="container">
            <h2 data-i18n="shotsTitle">Inside the app</h2>
            <p class="section-sub" data-i18n="shotsSub">
              Real screens — shared list, add items, and supermarket mode by category.
            </p>
            <div class="shots">
              <figure>
                <img
                  id="shot-list"
                  src="/assets/screenshots/screen-list.png"
                  alt="Haserli — shared shopping list"
                  width="390"
                  height="844"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <figure>
                <img
                  id="shot-add"
                  src="/assets/screenshots/screen-add.png"
                  alt="Haserli — add items to the list"
                  width="390"
                  height="844"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <figure>
                <img
                  id="shot-super"
                  src="/assets/screenshots/screen-supermarket.png"
                  alt="Haserli — supermarket mode by category"
                  width="390"
                  height="844"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </div>
          </div>
        </section>

        <section class="section section-alt" id="company">
          <div class="container">
            <h2 data-i18n="companyTitle">The app is already out</h2>
            <p class="section-sub" data-i18n="companySub">
              Haserli · חסרלי is a technology product from Israel. The shared shopping list is available
              on the App Store and Google Play.
            </p>
            <div class="model-grid">
              <article class="model-card">
                <h3 data-i18n="model1Title">Available now</h3>
                <p data-i18n="model1Body">
                  Haserli is on the App Store and Google Play with real-time lists, home invites,
                  supermarket mode, and multilingual support.
                </p>
              </article>
              <article class="model-card">
                <h3 data-i18n="model2Title">Business model</h3>
                <p data-i18n="model2Body">
                  The app is free to download. A modest ad banner supports development so shared lists stay free for households.
                </p>
              </article>
              <article class="model-card">
                <h3 data-i18n="model3Title">What’s next</h3>
                <p data-i18n="model3Body">
                  We keep improving sync, supermarket flow, and the calm experience of shopping together.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section class="section cta">
          <div class="container">
            <div class="cta-card">
              <h2 data-i18n="ctaTitle">Download Haserli</h2>
              <p class="section-sub" data-i18n="ctaSub">
                Free on the App Store and Google Play. One list for the whole home.
              </p>
              <div class="store-links">
                <a
                  class="store-badge store-badge--google"
                  href="${PLAY}"
                  rel="noreferrer"
                  aria-label="Get it on Google Play"
                >
                  <img src="/assets/google-play-badge.png" alt="Get it on Google Play" />
                </a>
                <a
                  class="store-badge store-badge--apple"
                  href="${APPSTORE}"
                  rel="noreferrer"
                  aria-label="Download on the App Store"
                >
                  <img src="/assets/app-store-badge.png" alt="Download on the App Store" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section class="section section-alt" id="also">
          <div class="container">
            <h2 data-i18n="alsoTitle">Try also</h2>
            <p class="section-sub" data-i18n="alsoSub">
              More apps and games from ByLiShi — the same studio behind Haserli.
            </p>
${ALSO_HTML}
            <p class="also-studio">
              <a href="https://bylishi.com/" rel="noreferrer" target="_blank" data-i18n="alsoStudio">See everything on ByLiShi.com</a>
            </p>
          </div>
        </section>

      </main>

      <footer class="site-footer">
        <div class="container">
          <span data-i18n="footerLegal">© 2026 Haserli · חסרלי · Israel</span>
          <nav class="footer-links">
            <a href="/about/" data-i18n="navAbout" data-i18n-href-en="/about/" data-i18n-href-he="/he/about/">About</a>
            <a href="/team/" data-i18n="navTeam" data-i18n-href-en="/team/" data-i18n-href-he="/he/team/">Team</a>
            <a href="/contact/" data-i18n="navContact" data-i18n-href-en="/contact/" data-i18n-href-he="/he/contact/">Contact</a>
            <a href="/privacy/" data-i18n="privacy" data-i18n-href-en="/privacy/" data-i18n-href-he="/he/privacy/">Privacy Policy</a>
            <a href="/terms/" data-i18n="terms" data-i18n-href-en="/terms/" data-i18n-href-he="/he/terms/">Terms of Service</a>
            <a href="mailto:${EMAIL}">${EMAIL}</a>
          </nav>
        </div>
      </footer>
    </div>

    <div id="deeplink-wrap" class="deeplink-wrap" hidden>
      <main class="deeplink-card">
        <span id="app-badge" class="badge">חסרלי</span>
        <h1 id="dl-title">הצטרפות לבית באפליקציה</h1>
        <p id="dl-description" class="about">פתחו את חסרלי כדי לאשר את ההזמנה.</p>

        <section id="dl-meta" class="meta" hidden>
          <p id="dl-meta-label"></p>
          <div id="dl-code" class="code" hidden></div>
        </section>

        <div class="actions">
          <a id="dl-open-app" class="primary" href="haserli://">פתיחת האפליקציה</a>
          <button id="dl-copy-code" class="secondary" type="button" hidden>העתקת קוד</button>

          <div class="store-links">
            <a
              class="store-badge store-badge--apple"
              id="dl-ios"
              href="${APPSTORE}"
              rel="noopener"
              aria-label="הורידו את חסרלי מ-App Store"
            >
              <img src="/assets/app-store-badge.png" alt="הורידו את חסרלי ב-App Store" width="180" height="60" />
            </a>
            <a
              class="store-badge store-badge--google"
              id="dl-android"
              href="${PLAY}"
              rel="noopener"
              aria-label="הורידו את חסרלי מ-Google Play"
            >
              <img src="/assets/google-play-badge.png" alt="הורידו את חסרלי ב-Google Play" width="180" height="60" />
            </a>
          </div>
        </div>

        <p id="dl-footer" class="footer-text">
          אם האפליקציה לא נפתחת אוטומטית, השתמשו בכפתור למעלה או התקינו מהחנות למטה.
        </p>
      </main>
    </div>

    <script src="/lang-detect.js"></script>
    <script src="/landing.js"></script>
    <script src="/link.js"></script>
  </body>
</html>
`;

writeFileSync(path.join(ROOT, "index.html"), INDEX_HTML, "utf8");

const LANDING_JS = `(function () {
  "use strict";

  var STORAGE_KEY = "haserli_lang";
  var DEFAULT_LANG = "en";
  var PLAY_URL = "${PLAY}";
  var APP_STORE_URL = "${APPSTORE}";

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
  var SITE_ORIGIN = "${SITE}";

  function pathLanguage() {
    var path = window.location.pathname.replace(/\\/+$/, "") || "/";
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
`;

writeFileSync(path.join(ROOT, "landing.js"), LANDING_JS, "utf8");

// lang-detect: rename global
{
  let s = readFileSync(path.join(ROOT, "lang-detect.js"), "utf8");
  s = s.replace(/__keepsiLangDetect/g, "__haserliLangDetect").replace(/__ariaLangDetect/g, "__haserliLangDetect");
  writeFileSync(path.join(ROOT, "lang-detect.js"), s, "utf8");
}

// styles: teal palette + deeplink + mint/peach glows
{
  let css = readFileSync(path.join(ROOT, "styles.css"), "utf8");
  css = css.replace(
    /:root \{[\s\S]*?--radius: 22px;\n\}/,
    `:root {
  color-scheme: light;
  --bg: #f6f9f8;
  --bg-soft: #edf5f2;
  --bg-warm: rgba(45, 212, 168, 0.18);
  --card: rgba(255, 255, 255, 0.78);
  --text: #161e1c;
  --muted: #4b5b56;
  --accent: #0d9488;
  --accent-strong: #0f766e;
  --border: rgba(255, 255, 255, 0.85);
  --shadow: 0 20px 55px rgba(13, 148, 136, 0.18);
  --shadow-soft: 0 8px 22px rgba(16, 52, 45, 0.08);
  --radius: 22px;
  --glow-mint: rgba(45, 212, 168, 0.27);
  --glow-peach: rgba(255, 153, 102, 0.27);
}`
  );
  css = css.replace(
    /body \{[\s\S]*?-webkit-font-smoothing: antialiased;\n\}/,
    `body {
  margin: 0;
  min-height: 100vh;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background:
    radial-gradient(38% 30% at -10% -2%, var(--glow-mint) 0%, transparent 65%),
    radial-gradient(36% 28% at 110% 4%, var(--glow-peach) 0%, transparent 65%),
    radial-gradient(900px 500px at 10% 90%, rgba(13, 148, 136, 0.1), transparent 55%),
    linear-gradient(180deg, #edf5f2 0%, #f6f9f8 42%, #f6f9f8 100%);
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}`
  );

  // Ensure also-studio lime button
  if (!css.includes("background: #b8ff3c")) {
    css += `
.also-studio a {
  background: #b8ff3c;
}
`;
  }

  css += `

/* Deeplink join overlay */
html.join-route-pending #landing { display: none !important; }
html.join-route-pending #deeplink-wrap { display: flex !important; }
.deeplink-wrap {
  min-height: 100dvh;
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}
.deeplink-wrap[hidden] { display: none !important; }
.deeplink-card {
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 24px 22px 26px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255,255,255,.97), rgba(241,253,252,.97));
  border: 1px solid rgba(13, 148, 136, 0.12);
  box-shadow: 0 14px 34px rgba(2, 6, 23, 0.1);
  text-align: center;
}
.deeplink-card .badge {
  display: inline-block;
  margin-bottom: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(13, 148, 136, 0.12);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
}
.deeplink-card h1 {
  margin: 0 0 10px;
  font-size: 22px;
  line-height: 1.35;
  color: var(--text);
}
.deeplink-card .about {
  margin: 0;
  font-size: 15px;
  color: var(--muted);
}
.deeplink-card .meta {
  margin-top: 18px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(13, 148, 136, 0.14);
}
.deeplink-card .meta p {
  font-size: 13px;
  color: var(--muted);
  margin: 0 0 8px;
}
.deeplink-card .code {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--accent);
}
.deeplink-card .actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.deeplink-card .primary,
.deeplink-card .secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 18px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  border: none;
  cursor: pointer;
  width: min(100%, 320px);
}
.deeplink-card .primary {
  background: var(--accent);
  color: #fff;
}
.deeplink-card .secondary {
  background: rgba(255, 255, 255, 0.85);
  color: var(--text);
  border: 1px solid rgba(13, 148, 136, 0.18);
}
.deeplink-card .footer-text {
  margin-top: 18px;
  font-size: 13px;
  color: var(--muted);
}
.deeplink-card .store-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 4px;
}
`;
  writeFileSync(path.join(ROOT, "styles.css"), css, "utf8");
}

// Bulk-adapt secondary HTML pages (about/team/contact/privacy/terms + he variants)
const pagePairs = [
  ["https://aria.lirshir.com", SITE],
  ["aria.lirshir.com", "hsr.lirshir.com"],
  ["aria@lirshir.com", EMAIL],
  ["#F2A07B", THEME],
  ["#f2a07b", THEME],
  ["Aria · אריאה", "Haserli · חסרלי"],
  ["Aria · אריאה", "Haserli · חסרלי"],
  [">Aria</span>", ">Haserli</span>"],
  [" · אריאה", " · חסרלי"],
  ["alt=\"Aria logo\"", "alt=\"Haserli logo\""],
  ["founder of Aria", "founder of Haserli"],
  ["of Aria", "of Haserli"],
  ["Aria team", "Haserli team"],
  ["Aria is a", "Haserli is a"],
  ["Aria,", "Haserli,"],
  [" Aria ", " Haserli "],
  ["“Aria”", "“Haserli”"],
  ["'Aria'", "'Haserli'"],
  ["shared newborn care", "shared shopping list"],
  ["newborn care tracker", "shared shopping list"],
  ["baby tracking", "shopping list"],
  ["baby event", "shopping list"],
  ["newborn and baby tracking", "shared shopping list"],
  ["feeding, sleep, diapers", "items, supermarket mode, home invites"],
  ["com.aria.newborn", "com.salino.sali"],
  ["id6785000120", "id6768352555"],
  ["https://play.google.com/store/apps/details?id=com.aria.newborn", PLAY],
  ["https://apps.apple.com/app/id6785000120", APPSTORE],
];

// More careful content replacements for about/team/contact
const aboutEn = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>About Us — Haserli · חסרלי</title>
    <meta
      name="description"
      content="About Haserli — an Israel-based technology company behind a real-time shared shopping list for households."
    />
    <meta name="theme-color" content="${THEME}" />
    <link rel="canonical" href="${SITE}/about/" />
    <link rel="alternate" hreflang="en" href="${SITE}/about/" />
    <link rel="alternate" hreflang="he" href="${SITE}/he/about/" />
    <link rel="alternate" hreflang="x-default" href="${SITE}/about/" />
    <link rel="icon" href="/assets/favicon.png" />
    <link rel="apple-touch-icon" href="/assets/app-logo.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap&subset=hebrew,latin" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Haserli · חסרלי" />
    <meta property="og:title" content="About Us — Haserli · חסרלי" />
    <meta property="og:description" content="Haserli is a technology company in Israel building a real-time shared shopping list for couples, families, and roommates." />
    <meta property="og:url" content="${SITE}/about/" />
    <meta property="og:image" content="${SITE}/assets/og-image.png" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Haserli",
        "alternateName": "חסרלי",
        "url": "${SITE}/",
        "email": "${EMAIL}",
        "address": { "@type": "PostalAddress", "addressCountry": "IL" },
        "founder": {
          "@type": "Person",
          "name": "Liron Shiryon",
          "jobTitle": "Founder",
          "image": "${SITE}/assets/founder.png",
          "sameAs": ["https://www.linkedin.com/in/liron-shiryon-1691911b6/"]
        }
      }
    </script>
  </head>
  <body>
    <header class="site-header">
      <div class="container">
        <a class="brand" href="/">
          <img src="/assets/app-logo.png" alt="Haserli logo" />
          <span>Haserli</span>
          <span class="brand-he"> · חסרלי</span>
        </a>
        <div class="header-end">
          <nav class="site-nav" aria-label="Primary">
            <a href="/about/" aria-current="page">About</a>
            <a href="/team/">Team</a>
            <a href="/contact/">Contact</a>
          </nav>
          <div class="lang-toggle" role="group" aria-label="Language">
            <button type="button" data-lang="he">עברית</button>
            <button type="button" data-lang="en" class="active" aria-pressed="true">EN</button>
          </div>
        </div>
      </div>
    </header>
    <main>
      <section class="page-hero">
        <div class="container narrow">
          <p class="page-kicker"><a href="/">Home</a> / About Us</p>
          <h1>About Us</h1>
          <p class="section-sub page-lead">
            Haserli is a technology product from Israel. We build a real-time shared shopping list
            that helps couples, families, and roommates shop together without the chaos.
          </p>
        </div>
      </section>
      <section class="section">
        <div class="container narrow">
          <h2 class="about-section-title">Our mission</h2>
          <p class="about-copy">
            Someone always forgets the milk. Someone else buys it twice. Haserli keeps one live list
            for the household — add what ran out at home, check it off at the store, and use supermarket
            mode to shop by aisle.
          </p>
          <p class="about-copy">
            The app is on the
            <a href="${APPSTORE}" rel="noreferrer">App Store</a>
            and
            <a href="${PLAY}" rel="noreferrer">Google Play</a>.
          </p>
        </div>
      </section>
      <section class="section section-alt">
        <div class="container">
          <h2 class="about-section-title about-section-title--center">Founder</h2>
          <article class="team-card team-card--page">
            <img class="team-avatar-img" src="/assets/founder.png" alt="Liron Shiryon, founder of Haserli" width="224" height="224" loading="lazy" decoding="async" />
            <div class="team-info">
              <h2>Liron Shiryon</h2>
              <p class="team-role">Founder</p>
              <p class="team-bio">
                Founder of Haserli. Leads product and engineering for the shared shopping list now on
                the App Store and Google Play.
              </p>
              <div class="team-links">
                <a href="/team/">Full team page</a>
                <a href="https://www.linkedin.com/in/liron-shiryon-1691911b6/" rel="noopener noreferrer" target="_blank">LinkedIn (public profile)</a>
                <a href="mailto:${EMAIL}">${EMAIL}</a>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
    <footer class="site-footer">
      <div class="container">
        <span>© 2026 Haserli · חסרלי · Israel</span>
        <nav class="footer-links">
          <a href="/about/">About</a>
          <a href="/team/">Team</a>
          <a href="/contact/">Contact</a>
          <a href="/privacy/">Privacy Policy</a>
          <a href="/terms/">Terms of Service</a>
          <a href="mailto:${EMAIL}">${EMAIL}</a>
        </nav>
      </div>
    </footer>
    <script src="/lang-nav.js"></script>
  </body>
</html>
`;
writeFileSync(path.join(ROOT, "about", "index.html"), aboutEn, "utf8");

const aboutHe = aboutEn
  .replace('<html lang="en">', '<html lang="he" dir="rtl">')
  .replace("About Us — Haserli · חסרלי", "אודות — חסרלי · Haserli")
  .replace(
    "About Haserli — an Israel-based technology company behind a real-time shared shopping list for households.",
    "אודות חסרלי — חברה טכנולוגית מישראל מאחורי רשימת קניות משותפת בזמן אמת למשקי בית."
  )
  .replace(`${SITE}/about/`, `${SITE}/he/about/`)
  .replace(`hreflang="en" href="${SITE}/he/about/"`, `hreflang="en" href="${SITE}/about/"`)
  .replace(`hreflang="he" href="${SITE}/he/about/"`, `hreflang="he" href="${SITE}/he/about/"`)
  .replace('class="active" aria-pressed="true">EN', ">EN")
  .replace('data-lang="he">עברית', 'data-lang="he" class="active" aria-pressed="true">עברית')
  .replace('aria-current="page">About</a>', 'aria-current="page">אודות</a>')
  .replace(">Team</a>", ">צוות</a>")
  .replace(">Contact</a>", ">צור קשר</a>")
  .replace("<h1>About Us</h1>", "<h1>אודות</h1>")
  .replace("Home</a> / About Us", "בית</a> / אודות")
  .replace(
    "Haserli is a technology product from Israel. We build a real-time shared shopping list that helps couples, families, and roommates shop together without the chaos.",
    "חסרלי היא מוצר טכנולוגי מישראל. אנחנו בונים רשימת קניות משותפת בזמן אמת שעוזרת לזוגות, משפחות ושותפים לקנות יחד בלי בלגן."
  )
  .replace("Our mission", "המשימה שלנו")
  .replace(
    "Someone always forgets the milk. Someone else buys it twice. Haserli keeps one live list for the household — add what ran out at home, check it off at the store, and use supermarket mode to shop by aisle.",
    "תמיד מישהו שוכח את החלב. מישהו אחר קונה פעמיים. חסרלי שומרת רשימה חיה אחת לבית — מוסיפים מה שנגמר בבית, מסמנים בסופר, ומשתמשים במצב סופר לקנייה לפי מעברים."
  )
  .replace("The app is on the", "האפליקציה זמינה ב-")
  .replace("and", "וב-")
  .replace("Founder</h2>", "מייסד</h2>")
  .replace('<p class="team-role">Founder</p>', '<p class="team-role">מייסד</p>')
  .replace(
    "Founder of Haserli. Leads product and engineering for the shared shopping list now on the App Store and Google Play.",
    "מייסד חסרלי. מוביל מוצר והנדסה של רשימת הקניות המשותפת שכבר ב-App Store וב-Google Play."
  )
  .replace("Full team page", "לעמוד הצוות המלא")
  .replace("LinkedIn (public profile)", "LinkedIn (פרופיל ציבורי)")
  .replace(">About</a>", ">אודות</a>")
  .replace(">Privacy Policy</a>", ">מדיניות פרטיות</a>")
  .replace(">Terms of Service</a>", ">תנאי שימוש</a>")
  .replace("© 2026 Haserli · חסרלי · Israel", "© 2026 חסרלי · Haserli · ישראל")
  .replace('href="/"', 'href="/he/"')
  .replace('href="/about/"', 'href="/he/about/"')
  .replace('href="/team/"', 'href="/he/team/"')
  .replace('href="/contact/"', 'href="/he/contact/"')
  .replace('href="/privacy/"', 'href="/he/privacy/"')
  .replace('href="/terms/"', 'href="/he/terms/"');
writeFileSync(path.join(ROOT, "he", "about", "index.html"), aboutHe, "utf8");

console.log("Wrote index, landing.js, styles, about EN/HE");
console.log("Remaining pages will be adapted via bulk replace…");

// Adapt remaining HTML via bulk replace from Aria scaffold
for (const file of walk(ROOT).filter((f) => f.endsWith(".html") || f.endsWith(".xml") || f.endsWith(".txt"))) {
  const rel = path.relative(ROOT, file).replace(/\\\\/g, "/");
  if (rel === "index.html" || rel === "about/index.html" || rel === "he/about/index.html") continue;
  let s = readFileSync(file, "utf8");
  const before = s;
  s = replaceAll(s, pagePairs);
  // Extra cleanup leftovers
  s = s.replace(/אריאה/g, "חסרלי");
  s = s.replace(/\\bAria\\b/g, "Haserli");
  if (s !== before) {
    writeFileSync(file, s, "utf8");
    console.log("adapted", rel);
  }
}

writeFileSync(
  path.join(ROOT, "robots.txt"),
  `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`,
  "utf8"
);

writeFileSync(
  path.join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>2026-09-27</lastmod></url>
  <url><loc>${SITE}/he/</loc><lastmod>2026-09-27</lastmod></url>
  <url><loc>${SITE}/about/</loc><lastmod>2026-09-27</lastmod></url>
  <url><loc>${SITE}/he/about/</loc><lastmod>2026-09-27</lastmod></url>
  <url><loc>${SITE}/team/</loc><lastmod>2026-09-27</lastmod></url>
  <url><loc>${SITE}/he/team/</loc><lastmod>2026-09-27</lastmod></url>
  <url><loc>${SITE}/contact/</loc><lastmod>2026-09-27</lastmod></url>
  <url><loc>${SITE}/he/contact/</loc><lastmod>2026-09-27</lastmod></url>
  <url><loc>${SITE}/privacy/</loc><lastmod>2026-09-27</lastmod></url>
  <url><loc>${SITE}/he/privacy/</loc><lastmod>2026-09-27</lastmod></url>
  <url><loc>${SITE}/terms/</loc><lastmod>2026-09-27</lastmod></url>
  <url><loc>${SITE}/he/terms/</loc><lastmod>2026-09-27</lastmod></url>
</urlset>
`,
  "utf8"
);

console.log("Done.");
