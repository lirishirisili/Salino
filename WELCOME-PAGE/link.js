(function () {
  "use strict";

  var APP_NAME = "חסרלי";
  var APP_SCHEME = "haserli://";
  var ANDROID_STORE_URL =
    "https://play.google.com/store/apps/details?id=com.salino.sali&hl=he";
  var IOS_STORE_URL =
    "https://apps.apple.com/il/app/%D7%97%D7%A1%D7%A8%D7%9C%D7%99-%D7%A8%D7%A9%D7%99%D7%9E%D7%AA-%D7%A7%D7%A0%D7%99%D7%95%D7%AA/id6768352555?l=he";
  var SUPPORTED_LANGUAGES = ["he", "en", "ar", "ru", "am", "fr", "es"];
  var RTL_LANGUAGES = { he: true, ar: true };
  var OPEN_APP_DELAY_MS = 250;
  var STORE_FALLBACK_DELAY_MS = 2200;

  function buildAppOpenUrl(code) {
    var encoded = encodeURIComponent(code);
    if (isAndroidDevice()) {
      var fallback = encodeURIComponent(ANDROID_STORE_URL);
      return (
        "intent://join/" +
        encoded +
        "#Intent;scheme=haserli;package=com.salino.sali;S.browser_fallback_url=" +
        fallback +
        ";end"
      );
    }
    return APP_SCHEME + "join/" + encoded;
  }

  function buildStoreUrl() {
    if (isIOSDevice()) {
      return "itms-apps://apps.apple.com/app/id6768352555";
    }
    if (isAndroidDevice()) {
      return ANDROID_STORE_URL;
    }
    return null;
  }

  function isIOSDevice() {
    var userAgent = navigator.userAgent || navigator.vendor || "";
    var platform = navigator.platform || "";
    var isTouchMac = platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return /iPhone|iPad|iPod/i.test(userAgent) || isTouchMac;
  }

  function isAndroidDevice() {
    return /Android/i.test(navigator.userAgent || "");
  }

  function getStoreUrlForCurrentDevice() {
    if (isIOSDevice()) return IOS_STORE_URL;
    if (isAndroidDevice()) return ANDROID_STORE_URL;
    return null;
  }

  var pathParts = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/");
  var mode = pathParts[0];

  if (mode !== "join") {
    return;
  }

  document.documentElement.className = "join-route";

  window.__DEEPLINK_ACTIVE__ = true;

  var landing = document.getElementById("landing");
  if (landing) landing.hidden = true;
  var wrap = document.getElementById("deeplink-wrap");
  if (wrap) wrap.hidden = false;

  var translations = {
    en: {
      joinTitle: "Join this household in the app",
      joinDescription:
        "Open Haserli to accept the invite. If needed, copy the code below and paste it inside the app.",
      openApp: "Open the app",
      copyCode: "Copy code",
      codeCopied: "Code copied",
      inviteCode: "Invite code",
      footer:
        "If the app does not open automatically, use the button above or install it from the store below.",
    },
    he: {
      joinTitle: "הצטרפות לבית באפליקציה",
      joinDescription:
        "פתחו את חסרלי כדי לאשר את ההזמנה. אם צריך, העתיקו את הקוד למטה והדביקו אותו בתוך האפליקציה.",
      openApp: "פתיחת האפליקציה",
      copyCode: "העתקת קוד",
      codeCopied: "הקוד הועתק",
      inviteCode: "קוד הזמנה",
      footer:
        "אם האפליקציה לא נפתחת אוטומטית, השתמשו בכפתור למעלה או התקינו מהחנות למטה.",
    },
    ar: {
      joinTitle: "الانضمام إلى البيت في التطبيق",
      joinDescription:
        "افتح حصرلي لقبول الدعوة. إذا لزم الأمر، انسخ الرمز أدناه والصقه داخل التطبيق.",
      openApp: "افتح التطبيق",
      copyCode: "نسخ الرمز",
      codeCopied: "تم نسخ الرمز",
      inviteCode: "رمز الدعوة",
      footer: "إذا لم يُفتح التطبيق تلقائيًا، استخدم الزر أعلاه أو ثبّت التطبيق من المتجر أدناه.",
    },
    ru: {
      joinTitle: "Присоединиться к дому в приложении",
      joinDescription:
        "Откройте Haserli, чтобы принять приглашение. При необходимости скопируйте код ниже и вставьте его в приложении.",
      openApp: "Открыть приложение",
      copyCode: "Скопировать код",
      codeCopied: "Код скопирован",
      inviteCode: "Код приглашения",
      footer:
        "Если приложение не открылось автоматически, используйте кнопку выше или установите его из магазина ниже.",
    },
    am: {
      joinTitle: "በመተግበሪያው ውስጥ ወደ ቤት ይቀላቀሉ",
      joinDescription:
        "ግብዣውን ለመቀበል Haserli ክፈት። ካስፈለገ ከታች ያለውን ኮድ ቅዳ እና በመተግበሪያው ውስጥ ለጥፍ።",
      openApp: "መተግበሪያውን ክፈት",
      copyCode: "ኮድ ቅዳ",
      codeCopied: "ኮዱ ተቀድቷል",
      inviteCode: "የግብዣ ኮድ",
      footer: "መተግበሪያው በራሱ ካልተከፈተ ከላይ ያለውን አዝራር ይጠቀሙ ወይም ከታች ካለው መደብር ይጫኑት።",
    },
    fr: {
      joinTitle: "Rejoindre ce foyer dans l'application",
      joinDescription:
        "Ouvrez Haserli pour accepter l'invitation. Si besoin, copiez le code ci-dessous et collez-le dans l'application.",
      openApp: "Ouvrir l'application",
      copyCode: "Copier le code",
      codeCopied: "Code copié",
      inviteCode: "Code d'invitation",
      footer:
        "Si l'application ne s'ouvre pas automatiquement, utilisez le bouton ci-dessus ou installez-la depuis la boutique ci-dessous.",
    },
    es: {
      joinTitle: "Unirse a este hogar en la aplicación",
      joinDescription:
        "Abre Haserli para aceptar la invitación. Si hace falta, copia el código de abajo y pégalo dentro de la aplicación.",
      openApp: "Abrir la aplicación",
      copyCode: "Copiar código",
      codeCopied: "Código copiado",
      inviteCode: "Código de invitación",
      footer:
        "Si la aplicación no se abre automáticamente, usa el botón de arriba o instálala desde la tienda de abajo.",
    },
  };

  var language = detectLanguage();
  var strings = translations[language] || translations.en;
  var isRTL = !!RTL_LANGUAGES[language];

  document.documentElement.lang = language;
  document.documentElement.dir = isRTL ? "rtl" : "ltr";

  var title = document.getElementById("dl-title");
  var description = document.getElementById("dl-description");
  var meta = document.getElementById("dl-meta");
  var metaLabel = document.getElementById("dl-meta-label");
  var code = document.getElementById("dl-code");
  var openApp = document.getElementById("dl-open-app");
  var copyCode = document.getElementById("dl-copy-code");
  var footerText = document.getElementById("dl-footer");
  var badge = document.getElementById("app-badge");
  var androidDownload = document.getElementById("dl-android");
  var iosDownload = document.getElementById("dl-ios");

  badge.textContent = APP_NAME;
  openApp.textContent = strings.openApp;
  copyCode.textContent = strings.copyCode;
  footerText.textContent = strings.footer;

  var appUrl = APP_SCHEME;
  var inviteCode = "";
  var appOpened = false;
  var fallbackTimer = null;
  var currentDeviceStoreUrl = getStoreUrlForCurrentDevice();

  if (mode === "join" && pathParts[1]) {
    inviteCode = decodeURIComponent(pathParts[1]).toUpperCase();
    appUrl = buildAppOpenUrl(inviteCode);
    title.textContent = strings.joinTitle;
    description.textContent = strings.joinDescription;
    meta.hidden = false;
    metaLabel.textContent = strings.inviteCode;
    code.hidden = false;
    code.textContent = inviteCode;
    copyCode.hidden = false;
  } else {
    title.textContent = strings.joinTitle;
    description.textContent = strings.joinDescription;
  }

  document.title = title.textContent + " | " + APP_NAME;
  openApp.href = currentDeviceStoreUrl || appUrl;
  androidDownload.href = ANDROID_STORE_URL;
  iosDownload.href = IOS_STORE_URL;

  if (isIOSDevice()) {
    androidDownload.hidden = true;
  } else if (isAndroidDevice()) {
    iosDownload.hidden = true;
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      appOpened = true;
      clearFallbackTimer();
    }
  });

  window.addEventListener("pagehide", function () {
    appOpened = true;
    clearFallbackTimer();
  });

  openApp.addEventListener("click", function (event) {
    event.preventDefault();
    attemptOpenApp(true);
  });

  if (!copyCode.hidden) {
    copyCode.addEventListener("click", function () {
      if (!inviteCode) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(inviteCode).then(
          function () {
            copyCode.textContent = strings.codeCopied;
          },
          function () {
            copyCode.textContent = inviteCode;
          }
        );
      } else {
        copyCode.textContent = inviteCode;
      }
    });
  }

  if (currentDeviceStoreUrl) {
    setTimeout(function () {
      attemptOpenApp(true);
    }, OPEN_APP_DELAY_MS);
  }

  function clearFallbackTimer() {
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
  }

  function attemptOpenApp(allowStoreFallback) {
    clearFallbackTimer();
    appOpened = false;
    var storeUrl = buildStoreUrl();

    if (isAndroidDevice()) {
      window.location.href = appUrl;
      return;
    }

    if (isIOSDevice()) {
      window.location.href = appUrl;
      if (!allowStoreFallback || !storeUrl) return;
      fallbackTimer = window.setTimeout(function () {
        if (!appOpened && !document.hidden) {
          window.location.replace(storeUrl);
        }
      }, STORE_FALLBACK_DELAY_MS);
      return;
    }

    window.location.href = appUrl;
  }

  function detectLanguage() {
    var preferred =
      Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : [navigator.language || "en"];

    for (var i = 0; i < preferred.length; i++) {
      var normalized = String(preferred[i] || "")
        .toLowerCase()
        .replace("_", "-")
        .split("-")[0];
      if (normalized === "iw") normalized = "he";
      if (SUPPORTED_LANGUAGES.indexOf(normalized) !== -1) {
        return normalized;
      }
    }
    return "he";
  }
})();
