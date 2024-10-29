$(document).ready(
  function () {
    'use strict';
    var headerOverlay = $(".header-overlay"),
      searchOpenIcon = $(".nav-icon-search"),
      searchCloseIcon = $(".search-close"),
      searchBox = $(".search");
    searchOpenIcon.click(function () {
      searchOpen();
    });
    searchCloseIcon.click(function () {
      searchClose();
    });
    headerOverlay.click(function () {
      searchClose();
    });
    function searchOpen() {
      searchBox.addClass("is-visible");
    }
    function searchClose() {
      searchBox.removeClass("is-visible");
    }
    $(".post-content, .page-content").fitVids({
      customSelector: ['iframe[src*="ted.com"]']
    });
    $(".page img, .post img").attr("data-action", "zoom");
    $(".page a img, .post a img").removeAttr("data-action", "zoom");
    $(".top").click(function () {
      $("html, body")
        .stop()
        .animate({ scrollTop: 0 }, "slow", "swing");
    });
    $(window).scroll(function () {
      if ($(this).scrollTop() > $(window).height()) {
        $(".top").addClass("is-active");
      } else {
        $(".top").removeClass("is-active");
      }
    });
  }
);