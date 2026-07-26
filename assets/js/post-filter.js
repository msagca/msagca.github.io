(function () {
  "use strict";
  var chip = document.getElementById("post-filter-chip");
  var chipLabel = document.getElementById("post-filter-label");
  var chipKind = document.getElementById("post-filter-kind");
  var grid = document.querySelector("#page-main-content .card-grid");
  if (!chip || !chipLabel || !chipKind || !grid) return;
  var cards = [].slice.call(grid.querySelectorAll(":scope > .card"));
  function cardTags(card) {
    try {
      return JSON.parse(card.dataset.tags || "[]");
    } catch (e) {
      return [];
    }
  }
  function matches(card, filter) {
    if (!filter) return true;
    if (filter.type === "series") return card.dataset.series === filter.value;
    if (filter.type === "tag")
      return cardTags(card).indexOf(filter.value) !== -1;
    return true;
  }
  function applyFilter(filter) {
    cards.forEach(function (card) {
      card.hidden = !matches(card, filter);
    });
    if (filter) {
      chipLabel.textContent = filter.value;
      chipKind.textContent = filter.type === "series" ? "series" : "tag";
      chip.hidden = false;
    } else {
      chip.hidden = true;
    }
  }
  grid.querySelectorAll(".card-series-filter").forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyFilter({ type: "series", value: btn.dataset.seriesFilter });
    });
  });
  grid.querySelectorAll(".card-tag").forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyFilter({ type: "tag", value: btn.dataset.tagFilter });
    });
  });
  chip.addEventListener("click", function () {
    applyFilter(null);
  });
  var urlTag = new URLSearchParams(window.location.search).get("tag");
  if (urlTag) {
    applyFilter({ type: "tag", value: urlTag });
  }
})();
