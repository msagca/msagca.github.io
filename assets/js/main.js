(function () {
  "use strict";
  var header = document.getElementById("site-header");
  if (header) {
    var lastY = window.scrollY;
    var ticking = false;
    var onScroll = function () {
      var y = window.scrollY;
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
  var STORE_KEY = "koda-theme";
  var SCHEME_LABELS = {
    light: "Light",
    glade: "Glade",
    latte: "Latte",
    dark: "Dark",
    moss: "Moss",
    macchiato: "Macchiato",
  };
  var SCHEME_GROUPS = {
    light: ["light", "glade", "latte"],
    dark: ["dark", "moss", "macchiato"],
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
  document.querySelectorAll("pre").forEach(function (pre) {
    if (pre.closest(".highlight") === null && !pre.querySelector("code"))
      return;
    if (pre.querySelector(".copy-btn")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.innerHTML =
      '<i class="fa-regular fa-clipboard" aria-hidden="true"></i>';
    btn.setAttribute("aria-label", "Copy code to clipboard");
    btn.addEventListener("click", function () {
      var code = pre.innerText;
      navigator.clipboard.writeText(code).then(function () {
        btn.innerHTML =
          '<i class="fa-regular fa-paste" aria-hidden="true"></i>';
        btn.classList.add("is-copied");
        btn.setAttribute("aria-label", "Copied");
        setTimeout(function () {
          btn.innerHTML =
            '<i class="fa-regular fa-clipboard" aria-hidden="true"></i>';
          btn.classList.remove("is-copied");
          btn.setAttribute("aria-label", "Copy code to clipboard");
        }, 1600);
      });
    });
    pre.style.position = "relative";
    pre.appendChild(btn);
  });
})();
