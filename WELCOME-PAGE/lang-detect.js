(function () {
  "use strict";

  function isLikelyFromIsrael() {
    try {
      if (Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Jerusalem") {
        return true;
      }
    } catch (e) {
      /* ignore */
    }

    var preferred =
      Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : [navigator.language || ""];
    for (var i = 0; i < preferred.length; i++) {
      var tag = String(preferred[i] || "").toLowerCase().replace("_", "-");
      if (tag.endsWith("-il")) return true;
    }
    return false;
  }

  window.__haserliLangDetect = {
    isLikelyFromIsrael: isLikelyFromIsrael,
  };
})();
