(function () {
  "use strict";

  var buttons = document.querySelectorAll(".lang-toggle button[data-lang]");
  if (!buttons.length) return;

  var path = window.location.pathname.replace(/\/+$/, "") || "/";
  var isHe = path === "/he" || path.indexOf("/he/") === 0;
  var page = "home";

  if (path.indexOf("/team") !== -1) page = "team";
  else if (path.indexOf("/about") !== -1) page = "about";
  else if (path.indexOf("/privacy") !== -1) page = "privacy";
  else if (path.indexOf("/contact") !== -1) page = "contact";
  else if (path.indexOf("/terms") !== -1) page = "terms";

  var routes = {
    home: { en: "/", he: "/he/" },
    about: { en: "/about/", he: "/he/about/" },
    team: { en: "/team/", he: "/he/team/" },
    privacy: { en: "/privacy/", he: "/he/privacy/" },
    contact: { en: "/contact/", he: "/he/contact/" },
    terms: { en: "/terms/", he: "/he/terms/" },
  };

  for (var i = 0; i < buttons.length; i++) {
    var lang = buttons[i].getAttribute("data-lang");
    var active = (lang === "he") === isHe;
    buttons[i].classList.toggle("active", active);
    buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    buttons[i].addEventListener("click", function () {
      var next = this.getAttribute("data-lang");
      var target = routes[page][next] || routes.home[next];
      if (target && target !== window.location.pathname) {
        window.location.href = target;
      }
    });
  }
})();
