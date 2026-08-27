(function () {
  "use strict";
  var header = document.getElementById("site-header");
  var meta = document.querySelector(".post-meta");
  if (!header || !meta) return;
  var groups = meta.querySelectorAll(".post-meta-group");
  function update() {
    if (groups.length < 2) return;
    var wrapped = groups[groups.length - 1].offsetTop > groups[0].offsetTop;
    meta.classList.toggle("post-meta--wrapped", wrapped);
  }
  if ("ResizeObserver" in window) {
    var observer = new ResizeObserver(update);
    observer.observe(header);
    observer.observe(meta);
  } else {
    window.addEventListener("resize", update);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(update);
  }
  update();
})();
