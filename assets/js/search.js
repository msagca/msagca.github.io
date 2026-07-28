(function () {
  "use strict";
  var input = document.getElementById("search-inline-input");
  var pageContent = document.getElementById("page-main-content");
  var resultsPage = document.getElementById("search-results-page");
  var grid = document.getElementById("search-results-grid");
  var empty = document.getElementById("search-results-empty");
  var indexUrl = document.currentScript && document.currentScript.dataset.index;
  var data = null;
  if (!input || !pageContent || !resultsPage || !grid) return;
  function loadIndex() {
    if (data) return Promise.resolve(data);
    return fetch(indexUrl)
      .then(function (r) {
        return r.json();
      })
      .then(function (json) {
        data = json;
        return data;
      });
  }
  function excerpt(text) {
    var trimmed = text.trim();
    return trimmed.length > 160
      ? trimmed.slice(0, 160).trim() + "…"
      : trimmed + "…";
  }
  function buildCard(item) {
    var card = document.createElement("div");
    card.className = "card";
    var body = document.createElement("div");
    body.className = "card-body";
    var topRow = document.createElement("div");
    topRow.className = "card-top-row";
    var date = document.createElement("time");
    date.className = "card-date";
    date.textContent = item.date;
    topRow.appendChild(date);
    body.appendChild(topRow);
    var title = document.createElement("h3");
    title.className = "card-title";
    var a = document.createElement("a");
    a.href = item.permalink;
    a.textContent = item.title;
    title.appendChild(a);
    body.appendChild(title);
    var p = document.createElement("p");
    p.className = "card-excerpt";
    p.textContent = excerpt(item.content);
    body.appendChild(p);
    card.appendChild(body);
    return card;
  }
  function render(items) {
    grid.innerHTML = "";
    if (!items.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    items.slice(0, 40).forEach(function (item) {
      grid.appendChild(buildCard(item));
    });
  }
  function showResults() {
    pageContent.hidden = true;
    resultsPage.hidden = false;
  }
  function showPage() {
    resultsPage.hidden = true;
    pageContent.hidden = false;
  }
  function doSearch(query) {
    var q = query.trim().toLowerCase();
    if (!q) {
      showPage();
      return;
    }
    loadIndex().then(function (data) {
      var matches = data.filter(function (item) {
        return (
          item.title.toLowerCase().indexOf(q) !== -1 ||
          item.content.toLowerCase().indexOf(q) !== -1 ||
          (item.tags || []).join(" ").toLowerCase().indexOf(q) !== -1
        );
      });
      render(matches);
      showResults();
      if (window.KodaMasonry) window.KodaMasonry.layout();
    });
  }
  input.addEventListener("input", function () {
    doSearch(input.value);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.activeElement === input) {
      input.value = "";
      showPage();
      input.blur();
      return;
    }
    if ((e.key === "k" || e.key === "/") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      input.focus();
    }
  });
})();
