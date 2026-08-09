(function () {
  "use strict";
  var STEP = 160;
  function update(wrap, track, prev, next) {
    var overflowing = track.scrollWidth > track.clientWidth + 1;
    if (!overflowing) {
      prev.hidden = true;
      next.hidden = true;
      return;
    }
    prev.hidden = track.scrollLeft <= 0;
    next.hidden = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
  }
  document.querySelectorAll(".row-scroll").forEach(function (wrap) {
    var track = wrap.querySelector(".row-scroll-track");
    var prev = wrap.querySelector(".row-scroll-arrow--prev");
    var next = wrap.querySelector(".row-scroll-arrow--next");
    if (!track || !prev || !next) return;
    var refresh = function () {
      update(wrap, track, prev, next);
    };
    prev.addEventListener("click", function () {
      track.scrollBy({ left: -STEP, behavior: "smooth" });
    });
    next.addEventListener("click", function () {
      track.scrollBy({ left: STEP, behavior: "smooth" });
    });
    track.addEventListener("scroll", refresh, { passive: true });
    if ("ResizeObserver" in window) {
      new ResizeObserver(refresh).observe(track);
    } else {
      window.addEventListener("resize", refresh);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(refresh);
    }
    refresh();
  });
})();
