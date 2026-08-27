(function () {
  "use strict";
  var ROW_UNIT = 1;
  var MAX_PASSES = 3;
  function layoutGrid(grid) {
    if (grid.offsetParent === null) return;
    var gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    var cards = [].slice.call(grid.children).filter(function (el) {
      return el.classList.contains("card") && !el.hidden;
    });
    for (var pass = 0; pass < MAX_PASSES; pass++) {
      var spans = cards.map(function (card) {
        var height = card.getBoundingClientRect().height;
        return "span " + Math.ceil((height + gap) / ROW_UNIT);
      });
      var changed = false;
      cards.forEach(function (card, i) {
        if (card.style.gridRowEnd === spans[i]) return;
        card.style.gridRowEnd = spans[i];
        changed = true;
      });
      if (!changed) break;
    }
  }
  function layoutAll() {
    document.querySelectorAll(".card-grid").forEach(layoutGrid);
  }
  layoutAll();
  window.addEventListener("load", layoutAll);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(layoutAll);
  }
  var resizeTimer;
  var lastWidth = window.innerWidth;
  window.addEventListener("resize", function () {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutAll, 150);
  });
  window.SiteMasonry = { layout: layoutAll };
})();
