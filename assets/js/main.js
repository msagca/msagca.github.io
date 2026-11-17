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
  // Display formulas scroll inside their own box (see base.css). Inline
  // ones cannot, so any that is wider than its line becomes a scrollable
  // inline block rather than pushing the page sideways.
  function fitMath() {
    document
      .querySelectorAll("mjx-container:not([display='true'])")
      .forEach(function (m) {
        m.classList.remove("math-scroll");
        var parent = m.parentElement;
        var cs = getComputedStyle(parent);
        var avail =
          parent.clientWidth -
          parseFloat(cs.paddingLeft) -
          parseFloat(cs.paddingRight);
        if (m.getBoundingClientRect().width > avail) {
          m.classList.add("math-scroll");
        }
      });
  }
  if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
    MathJax.startup.promise.then(fitMath);
  }
  window.SiteMath = { fit: fitMath };
  var fitWidth = window.innerWidth;
  window.addEventListener("resize", function () {
    if (window.innerWidth === fitWidth) return;
    fitWidth = window.innerWidth;
    fitMath();
  });
  var toc = document.getElementById("post-toc");
  if (toc) {
    // Kept in step with the wide-screen breakpoint in toc.css: always open
    // as a side rail there, folded by default above the post otherwise.
    var wide = window.matchMedia("(min-width: 1280px)");
    var syncToc = function () {
      toc.open = wide.matches;
    };
    syncToc();
    wide.addEventListener("change", syncToc);
    toc.querySelector("summary").addEventListener("click", function (e) {
      if (wide.matches) e.preventDefault();
    });
    toc.querySelector(".rail-body").addEventListener("click", function (e) {
      var link = e.target.closest("a");
      if (wide.matches || !link) return;
      var target = document.getElementById(
        decodeURIComponent(link.hash.slice(1)),
      );
      if (!target) return;
      // Fold first, then scroll: folding moves everything below it up, so
      // the browser's own jump would land in the wrong place.
      e.preventDefault();
      toc.open = false;
      history.pushState(null, "", link.hash);
      target.scrollIntoView();
    });
  }
})();
