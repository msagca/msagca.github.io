(function () {
  "use strict";
  var ROW_UNIT = 1;
  function layoutGrid(grid) {
    var gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    var cards = [].slice.call(grid.children).filter(function (el) {
      return el.classList.contains("card");
    });
    cards.forEach(function (card) {
      card.style.gridRowEnd = "";
    });
    cards.forEach(function (card) {
      var height = card.getBoundingClientRect().height;
      var span = Math.ceil((height + gap) / ROW_UNIT);
      card.style.gridRowEnd = "span " + span;
    });
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
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutAll, 150);
  });
  window.KodaMasonry = { layout: layoutAll };
})();
