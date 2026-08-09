(function () {
  "use strict";
  var btn = document.getElementById("post-share-btn");
  if (!btn) return;
  btn.addEventListener("click", function () {
    if (navigator.share) {
      navigator.share({ title: document.title, url: window.location.href }).catch(function () {});
      return;
    }
    navigator.clipboard.writeText(window.location.href).then(function () {
      btn.classList.add("is-copied");
      setTimeout(function () {
        btn.classList.remove("is-copied");
      }, 1200);
    });
  });
})();
