(function () {
  const themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  function updateTheme() {
    const isDark = themeMediaQuery.matches;
    document.querySelectorAll("link[data-theme]").forEach((link) => {
      link.disabled = link.dataset.theme !== (isDark ? "dark" : "light");
    });
  }
  updateTheme();
  themeMediaQuery.addEventListener("change", updateTheme);
  function highlightUnprocessedBlocks() {
    document
      .querySelectorAll("pre code:not([data-highlighted])")
      .forEach((el) => {
        hljs.highlightElement(el);
        el.setAttribute("data-highlighted", "true");
      });
  }
  function initializeHighlighting() {
    if (typeof hljs !== "undefined") {
      hljs.registerLanguage("antlr", antlrLanguage);
      highlightUnprocessedBlocks();
    }
  }
  window.refreshHighlighting = highlightUnprocessedBlocks;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeHighlighting);
  } else {
    initializeHighlighting();
  }
})();
