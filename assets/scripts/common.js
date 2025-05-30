$(document).ready(function () {
  "use strict";
  $(".post-content, .page-content").fitVids({
    customSelector: ['iframe[src*="ted.com"]'],
  });
  $(".page img, .post img").attr("data-action", "zoom");
  $(".page a img, .post a img").removeAttr("data-action", "zoom");
});
