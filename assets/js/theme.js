(function () {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const applyTheme = () => {
    const mode = mq.matches ? "dark" : "light";
    document.querySelectorAll("link[data-theme]").forEach((link) => {
      link.disabled = link.dataset.theme !== mode;
    });
  };
  mq.addEventListener("change", applyTheme);
  applyTheme();
})();