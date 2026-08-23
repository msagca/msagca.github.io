(function () {
  "use strict";
  var input = document.getElementById("search-inline-input");
  var field = document.getElementById("search-inline-field");
  var toggle = document.getElementById("search-toggle");
  var pageContent = document.getElementById("page-main-content");
  var resultsPage = document.getElementById("search-results-page");
  var grid = document.getElementById("search-results-grid");
  var empty = document.getElementById("search-results-empty");
  var indexUrl = document.currentScript && document.currentScript.dataset.index;
  var data = null;
  var MIN_CH = 18;
  var GROW_CH = 8;
  if (!input || !field || !toggle || !pageContent || !resultsPage || !grid) return;
  input.tabIndex = -1;
  function fitWidth() {
    var ch = Math.max(MIN_CH, input.value.length + GROW_CH);
    field.style.width = ch + "ch";
  }
  function openSearch() {
    field.classList.add("is-open");
    toggle.classList.add("is-active");
    toggle.setAttribute("aria-expanded", "true");
    input.tabIndex = 0;
    fitWidth();
    input.focus();
  }
  function closeSearch() {
    field.classList.remove("is-open");
    toggle.classList.remove("is-active");
    toggle.setAttribute("aria-expanded", "false");
    input.tabIndex = -1;
    field.style.width = "";
  }
  function isOpen() {
    return field.classList.contains("is-open");
  }
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
    if (window.SiteMasonry) window.SiteMasonry.layout();
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
      if (window.SiteMasonry) window.SiteMasonry.layout();
    });
  }
  input.addEventListener("input", function () {
    fitWidth();
    doSearch(input.value);
  });
  toggle.addEventListener("click", function () {
    if (isOpen()) {
      if (input.value) {
        input.value = "";
        showPage();
      }
      closeSearch();
    } else {
      openSearch();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.activeElement === input) {
      input.value = "";
      showPage();
      closeSearch();
      return;
    }
    if ((e.key === "k" || e.key === "/") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      openSearch();
    }
  });
  document.addEventListener("click", function (e) {
    if (!isOpen() || input.value) return;
    if (field.contains(e.target) || toggle.contains(e.target)) return;
    closeSearch();
  });
})();
