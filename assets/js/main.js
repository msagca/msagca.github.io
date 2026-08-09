(function () {
  "use strict";
  var header = document.getElementById("site-header");
  if (header) {
    var lastY = window.scrollY;
    var ticking = false;
    var onScroll = function () {
      var maxY = document.documentElement.scrollHeight - window.innerHeight;
      var y = Math.max(0, Math.min(window.scrollY, maxY));
      if (y > lastY && y > header.offsetHeight) {
        header.classList.add("site-header--hidden");
      } else {
        header.classList.remove("site-header--hidden");
      }
      lastY = y;
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(onScroll);
          ticking = true;
        }
      },
      { passive: true },
    );
  }
  var schemeName = document.getElementById("scheme-name");
  var modeToggle = document.getElementById("scheme-mode-toggle");
  var iconDark = document.getElementById("scheme-icon-dark");
  var iconLight = document.getElementById("scheme-icon-light");
  var root = document.documentElement;
  var STORE_KEY = "theme";
  var SCHEME_LABELS = {
    light: "Light",
    glade: "Glade",
    latte: "Latte",
    summer: "Summer",
    melange: "Melange",
    dark: "Dark",
    moss: "Moss",
    mocha: "Mocha",
    fall: "Fall",
  };
  var SCHEME_GROUPS = {
    light: ["light", "glade", "latte", "summer", "melange"],
    dark: ["dark", "moss", "mocha", "fall", "melange"],
  };
  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function savePrefs(prefs) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }
  function applyPrefs(prefs) {
    var mode = prefs.mode || root.getAttribute("data-mode") || "dark";
    var light =
      prefs.light || root.getAttribute("data-scheme-light") || "light";
    var dark = prefs.dark || root.getAttribute("data-scheme-dark") || "dark";
    root.setAttribute("data-mode", mode);
    root.setAttribute("data-scheme-light", light);
    root.setAttribute("data-scheme-dark", dark);
    if (iconDark && iconLight) {
      iconDark.style.display = mode === "dark" ? "" : "none";
      iconLight.style.display = mode === "light" ? "" : "none";
    }
    var current = mode === "light" ? light : dark;
    if (schemeName) {
      schemeName.textContent = SCHEME_LABELS[current] || current;
    }
  }
  applyPrefs(loadPrefs());
  if (modeToggle) {
    modeToggle.addEventListener("click", function () {
      var prefs = loadPrefs();
      var currentMode = root.getAttribute("data-mode") || "dark";
      prefs.mode = currentMode === "dark" ? "light" : "dark";
      prefs.osMode = window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
      savePrefs(prefs);
      applyPrefs(prefs);
    });
  }
  if (schemeName) {
    schemeName.addEventListener("click", function () {
      var prefs = loadPrefs();
      var mode = root.getAttribute("data-mode") || "dark";
      var group = SCHEME_GROUPS[mode];
      var current =
        mode === "light"
          ? prefs.light || root.getAttribute("data-scheme-light") || "light"
          : prefs.dark || root.getAttribute("data-scheme-dark") || "dark";
      var next = group[(group.indexOf(current) + 1) % group.length];
      prefs.mode = mode;
      if (mode === "light") {
        prefs.light = next;
      } else {
        prefs.dark = next;
      }
      savePrefs(prefs);
      applyPrefs(prefs);
    });
  }
  document.querySelectorAll(".highlight").forEach(function (highlight) {
    var pre = highlight.querySelector("pre");
    if (!pre) return;
    highlight.addEventListener("click", function (e) {
      if (e.target.closest("span")) return;
      var selection = window.getSelection();
      if (selection && selection.toString().length) return;
      navigator.clipboard.writeText(pre.innerText).then(function () {
        highlight.classList.add("is-copied");
        setTimeout(function () {
          highlight.classList.remove("is-copied");
        }, 1000);
      });
    });
  });
})();
