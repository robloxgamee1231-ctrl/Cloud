/* XCloud4 Web — app.js
   Browser edition of XCloud4: catalog, discover, favorites, search, settings,
   gamepad navigation and stream launching for Xbox Cloud Gaming (xbox.com/play).
   GPL-3.0-only — inspired by https://github.com/asp11edgr/XCloud4 */
(function () {
  "use strict";

  var APP_VERSION = "1.3.0";
  var REPO = "https://github.com/asp11edgr/XCloud4";
  var STREAM_BASE = "https://www.xbox.com/play/games/";

  var t = window.X4I18N.t;
  var cat = window.X4I18N.cat;

  /* ---------------- state ---------------- */
  var S = {
    route: "home",
    data: null,
    order: [],          // featured order = collections.all
    favs: [],
    recent: [],
    streamMode: "new",
    reduceMotion: false,
    update: { checked: 0, latest: null },
    catalog: { q: "", cat: "", touch: false, hideF2P: false, sort: "default", shown: 90 },
    discoverTab: "featured",
    searchQ: "",
    padIndex: -1,
    padName: ""
  };

  /* ---------------- storage ---------------- */
  function lsGet(k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }
  function loadSettings() {
    S.favs = lsGet("x4.favs", []);
    S.recent = lsGet("x4.recent", []);
    S.streamMode = lsGet("x4.streamMode", "new");
    S.reduceMotion = lsGet("x4.reduceMotion", false);
    if (S.reduceMotion) document.body.classList.add("reduce-motion");
  }

  /* ---------------- helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function slugify(s) {
    var out = String(s || "").toLowerCase()
      .replace(/[\u00c0-\u00ff]/g, function (ch) {
        var map = { "à": "a", "á": "a", "â": "a", "ã": "a", "ä": "a", "å": "a", "è": "e", "é": "e", "ê": "e", "ë": "e", "ì": "i", "í": "i", "î": "i", "ï": "i", "ò": "o", "ó": "o", "ô": "o", "õ": "o", "ö": "o", "ù": "u", "ú": "u", "û": "u", "ü": "u", "ñ": "n", "ç": "c" };
        return map[ch] || ch;
      })
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return out || "game";
  }
  function product(id) {
    var p = S.data.products[id];
    if (!p) return null;
    return {
      id: id, title: p[0], publisher: p[1],
      tile: S.data.imgBase + p[2],
      cats: p[3], touch: !!(p[4] & 1), own: !!(p[4] & 2)
    };
  }
  function isEA(id) { return S.data.collections.ea.indexOf(id) >= 0; }
  function streamURL(id) { return STREAM_BASE + slugify(product(id).title) + "/" + id; }
  function initials(title) {
    var words = String(title || "?").replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/);
    return words.slice(0, 2).map(function (w) { return (w[0] || "").toUpperCase(); }).join("") || "?";
  }
  function toast(msg) {
    var root = $("#toast-root");
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.classList.add("out"); }, 2600);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3000);
  }

  /* ---------------- cards ---------------- */
  function cardHTML(id) {
    var p = product(id);
    if (!p) return "";
    var badges = "";
    if (p.touch) badges += '<span class="badge touch">TOUCH</span>';
    if (p.own) badges += '<span class="badge f2p">FREE</span>';
    if (isEA(id)) badges += '<span class="badge ea">EA</span>';
    return '<button class="card" data-focusable data-game="' + esc(id) + '" aria-label="' + esc(p.title) + '">' +
      '<span class="thumb">' +
        '<span class="ph">' + esc(initials(p.title)) + '</span>' +
        '<img src="' + esc(p.tile) + '" alt="" loading="lazy" onload="this.classList.add(\'loaded\')" onerror="this.remove()">' +
        '<span class="badges">' + badges + '</span>' +
      '</span>' +
      '<span class="label"><span class="name">' + esc(p.title) + '</span><span class="pub">' + esc(p.publisher) + '</span></span>' +
      '</button>';
  }
  function gridHTML(ids, extra) {
    return '<div class="grid' + (extra ? " " + extra : "") + '">' + ids.map(function (id) { return cardHTML(id); }).join("") + "</div>";
  }
  function rowHTML(ids) {
    return '<div class="row">' + ids.map(function (id) { return cardHTML(id); }).join("") + "</div>";
  }
  function section(title, inner, count, moreId) {
    var countHtml = count != null ? '<span class="count">' + count + '</span>' : "";
    var more = moreId ? '<button class="more" data-focusable data-more="' + esc(moreId) + '">' + esc(t("common.more")) + "</button>" : "";
    return '<section class="sect"><div class="sect-head"><h2>' + esc(title) + "</h2>" + countHtml + more + '</div>' + inner + "</section>";
  }

  /* ---------------- home ---------------- */
  function renderHome() {
    var v = $("#view");
    var html = "";
    if (S.update.latest && isNewer(S.update.latest, APP_VERSION)) {
      html += '<div class="banner update" id="update-banner">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v10m0 4v.01"/><circle cx="12" cy="12" r="9"/></svg>' +
        "<span>" + esc(t("home.updateBanner", { v: S.update.latest })) + "</span>" +
        '<span class="b-actions"><a class="btn btn-ghost" href="' + REPO + '/releases" target="_blank" rel="noopener" data-focusable>' + esc(t("home.updateBtn")) + "</a></span></div>";
    }
    var heroIds = (S.data.collections.recent.length ? S.data.collections.recent : S.order).slice(0, 8)
      .filter(function (id) { return product(id); });
    var heroId = heroIds[Math.floor(Math.random() * heroIds.length)] || S.order[0];
    var hp = product(heroId);
    html += '<div class="hero" data-hero="' + esc(heroId) + '">' +
      '<div class="hero-bg" style="background-image:url(\'' + esc(hp.tile) + '\')"></div>' +
      '<div class="hero-fade"></div>' +
      '<div class="hero-body">' +
        '<div class="hero-kicker">' + esc(t("hero.kicker")) + "</div>" +
        '<h1 class="hero-title">' + esc(hp.title) + "</h1>" +
        '<div class="hero-meta">' + esc(hp.publisher) + (hp.touch ? " · Touch" : "") + (isEA(heroId) ? " · EA Play" : "") + "</div>" +
        '<div class="hero-actions">' +
          '<button class="btn btn-primary" data-focusable data-play="' + esc(heroId) + '">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>' +
            esc(t("common.play")) + "</button>" +
          '<button class="btn btn-ghost" data-focusable data-game="' + esc(heroId) + '">' + esc(t("common.details")) + "</button>" +
        "</div>" +
      "</div></div>";

    var recent = S.data.collections.recent.slice(0, 30);
    if (recent.length) html += section(t("home.recent"), rowHTML(recent), recent.length, "goCatalog");
    html += section(t("home.featured"), rowHTML(S.order.slice(0, 30)), null, "goCatalog");
    html += section(t("home.ea"), rowHTML(S.data.collections.ea.slice(0, 30)), null, "goDiscoverEA");

    var touchIds = S.order.filter(function (id) { var p = product(id); return p && p.touch; }).slice(0, 30);
    if (touchIds.length) html += section(t("home.touch"), rowHTML(touchIds), null, "goCatalogTouch");

    html += section(t("home.howTitle"),
      '<div class="steps">' +
        '<div class="step"><div class="n">1</div><h3>' + esc(t("home.step1t")) + "</h3><p>" + esc(t("home.step1d")) + "</p></div>" +
        '<div class="step"><div class="n">2</div><h3>' + esc(t("home.step2t")) + "</h3><p>" + esc(t("home.step2d")) + "</p></div>" +
        '<div class="step"><div class="n">3</div><h3>' + esc(t("home.step3t")) + "</h3><p>" + esc(t("home.step3d")) + "</p></div>" +
      "</div>");

    var touchCount = S.order.filter(function (id) { var p = product(id); return p && p.touch; }).length;
    html += '<div class="stats">' +
      '<div class="stat"><div class="v">' + S.order.length + '</div><div class="k">' + esc(t("home.statsTitles")) + "</div></div>" +
      '<div class="stat"><div class="v">' + touchCount + '</div><div class="k">' + esc(t("home.statsTouch")) + "</div></div>" +
      '<div class="stat"><div class="v">6</div><div class="k">' + esc(t("home.statsLangs")) + "</div></div>" +
      '<div class="stat"><div class="v">Web</div><div class="k">' + esc(t("home.statsEdition")) + " " + APP_VERSION + "</div></div>" +
      "</div>";

    v.innerHTML = html;
  }

  /* ---------------- discover ---------------- */
  function renderDiscover() {
    var v = $("#view");
    var tab = S.discoverTab;
    var tabs = [
      { id: "featured", label: t("discover.chipFeatured") },
      { id: "recent", label: t("discover.chipRecent") },
      { id: "ea", label: t("discover.chipEA") }
    ];
    var html = '<div class="viewhead"><h1>' + esc(t("discover.title")) + "</h1><p class=\"sub\">" + esc(t("discover.sub")) + "</p></div>";
    html += '<div class="chips" role="tablist">' + tabs.map(function (tb) {
      return '<button class="chip' + (tab === tb.id ? " on" : "") + '" data-focusable data-dtab="' + tb.id + '" role="tab" aria-selected="' + (tab === tb.id) + '">' + esc(tb.label) + "</button>";
    }).join("") + "</div>";
    var ids;
    if (tab === "recent") { ids = S.data.collections.recent; }
    else if (tab === "ea") { ids = S.data.collections.ea; }
    else { ids = S.order.slice(0, 180); }
    var count = ids.length;
    ids = ids.slice(0, Math.max(S.catalog.shown, 90));
    html += gridHTML(ids, "grid-lg");
    if (count > ids.length) html += '<div style="margin-top:16px"><button class="btn btn-ghost" data-focusable id="btn-more-discover">' + esc(t("catalog.showMore")) + "</button></div>";
    v.innerHTML = html;
  }

  /* ---------------- catalog ---------------- */
  function allCategories() {
    var set = {};
    Object.keys(S.data.products).forEach(function (id) {
      (S.data.products[id][3] || []).forEach(function (c) { set[c] = 1; });
    });
    return Object.keys(set).sort();
  }
  function catalogList() {
    var f = S.catalog;
    var q = f.q.trim().toLowerCase();
    var ids = S.order.filter(function (id) {
      var p = product(id);
      if (!p) return false;
      if (f.touch && !p.touch) return false;
      if (f.hideF2P && p.own) return false;
      if (f.cat && p.cats.indexOf(f.cat) < 0) return false;
      if (q) {
        var hay = (p.title + " " + p.publisher).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    if (f.sort === "az") ids = ids.slice().sort(function (a, b) { return product(a).title.localeCompare(product(b).title); });
    else if (f.sort === "za") ids = ids.slice().sort(function (a, b) { return product(b).title.localeCompare(product(a).title); });
    return ids;
  }
  function renderCatalog() {
    var v = $("#view");
    var f = S.catalog;
    var cats = allCategories();
    var html = '<div class="viewhead"><h1>' + esc(t("catalog.title")) + "</h1><p class=\"sub\">" + esc(t("catalog.sub")) + "</p></div>";
    html += '<div class="toolbar">' +
      '<div class="searchbox">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg>' +
        '<input type="text" id="cat-q" data-focusable data-i18n-ph="catalog.searchPh" placeholder="' + esc(t("catalog.searchPh")) + '" value="' + esc(f.q) + '" aria-label="' + esc(t("catalog.searchPh")) + '">' +
      "</div>" +
      '<select class="mini" id="cat-cat" data-focusable aria-label="Category">' +
        '<option value="">' + esc(t("catalog.allCats")) + "</option>" +
        cats.map(function (c) { return '<option value="' + esc(c) + '"' + (f.cat === c ? " selected" : "") + ">" + esc(cat(c)) + "</option>"; }).join("") +
      "</select>" +
      '<select class="mini" id="cat-sort" data-focusable aria-label="Sort">' +
        '<option value="default"' + (f.sort === "default" ? " selected" : "") + ">" + esc(t("catalog.sortDefault")) + "</option>" +
        '<option value="az"' + (f.sort === "az" ? " selected" : "") + ">" + esc(t("catalog.sortAZ")) + "</option>" +
        '<option value="za"' + (f.sort === "za" ? " selected" : "") + ">" + esc(t("catalog.sortZA")) + "</option>" +
      "</select>" +
      '<label class="switch"><input type="checkbox" id="cat-touch" data-focusable' + (f.touch ? " checked" : "") + "> <span>" + esc(t("catalog.touchOnly")) + "</span></label>" +
      '<label class="switch"><input type="checkbox" id="cat-f2p" data-focusable' + (f.hideF2P ? " checked" : "") + "> <span>" + esc(t("catalog.hideF2P")) + "</span></label>" +
    "</div>";

    var ids = catalogList();
    var shown = ids.slice(0, f.shown);
    html += '<div class="sect-head" style="margin-top:6px"><span class="count">' + esc(t("catalog.count", { n: ids.length })) + "</span></div>";
    if (shown.length) {
      html += gridHTML(shown, "grid-lg");
      if (ids.length > shown.length) {
        html += '<div style="margin-top:16px"><button class="btn btn-ghost" data-focusable id="btn-more-catalog">' + esc(t("catalog.showMore")) + " (" + (ids.length - shown.length) + ")</button></div>";
      }
    } else {
      html += '<div class="empty"><div class="big">🔍</div><h3>' + esc(t("search.none", { q: f.q || "—" })) + "</h3></div>";
    }
    v.innerHTML = html;
  }

  /* ---------------- my games ---------------- */
  function renderGames() {
    var v = $("#view");
    var html = '<div class="viewhead"><h1>' + esc(t("games.title")) + "</h1><p class=\"sub\">" + esc(t("games.sub")) + "</p></div>";
    if (!S.favs.length) {
      html += '<div class="empty"><div class="big">♡</div><h3>' + esc(t("games.empty")) + "</h3><p>" + esc(t("games.emptyHint")) + "</p></div>";
    } else {
      html += gridHTML(S.favs.filter(function (id) { return product(id); }), "grid-lg");
    }
    var rec = S.recent.filter(function (id) { return product(id) && S.favs.indexOf(id) < 0; }).slice(0, 30);
    if (rec.length) html += section(t("games.recent"), rowHTML(rec));
    v.innerHTML = html;
  }

  /* ---------------- search ---------------- */
  function searchIds(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var out = [];
    for (var i = 0; i < S.order.length && out.length < 240; i++) {
      var p = product(S.order[i]);
      if (!p) continue;
      var hay = (p.title + " " + p.publisher).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push(S.order[i]);
    }
    return out;
  }
  function renderSearch() {
    var v = $("#view");
    var html = '<div class="viewhead"><h1>' + esc(t("search.title")) + "</h1><p class=\"sub\">" + esc(t("search.sub")) + "</p></div>";
    html += '<div class="toolbar"><div class="searchbox" style="max-width:none">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg>' +
      '<input type="text" id="search-q" data-focusable data-i18n-ph="search.ph" placeholder="' + esc(t("search.ph")) + '" value="' + esc(S.searchQ) + '" aria-label="' + esc(t("search.ph")) + '" autocomplete="off">' +
      "</div></div>";
    var q = S.searchQ.trim();
    if (q) {
      var ids = searchIds(q);
      html += '<div class="sect-head" style="margin-top:6px"><span class="count">' + esc(t("search.results", { n: ids.length })) + "</span></div>";
      html += ids.length ? gridHTML(ids) : '<div class="empty"><div class="big">🔍</div><h3>' + esc(t("search.none", { q: q })) + "</h3></div>";
    } else {
      html += '<p class="note">' + esc(t("search.hint")) + "</p>";
      html += section(t("home.featured"), rowHTML(S.order.slice(0, 24)));
    }
    v.innerHTML = html;
    var input = $("#search-q");
    if (input && !S._skipSearchFocus) {
      setTimeout(function () { input.focus(); input.selectionStart = input.value.length; }, 30);
    }
    S._skipSearchFocus = false;
  }

  /* ---------------- help ---------------- */
  function ctlRow(action, keys, pad) {
    return "<tr><td>" + esc(action) + '</td><td>' + keys + "</td><td>" + pad + "</td></tr>";
  }
  function kchip(txt) { return '<span class="key">' + esc(txt) + "</span>"; }
  function renderHelp() {
    var v = $("#view");
    var html = '<div class="viewhead"><h1>' + esc(t("help.title")) + "</h1><p class=\"sub\">" + esc(t("help.sub")) + "</p></div>";

    html += section(t("help.quick"),
      '<div class="steps">' +
        '<div class="step"><div class="n">1</div><h3>' + esc(t("home.step1t")) + "</h3><p>" + esc(t("home.step1d")) + "</p></div>" +
        '<div class="step"><div class="n">2</div><h3>' + esc(t("home.step2t")) + "</h3><p>" + esc(t("home.step2d")) + "</p></div>" +
        '<div class="step"><div class="n">3</div><h3>' + esc(t("home.step3t")) + "</h3><p>" + esc(t("home.step3d")) + "</p></div>" +
      "</div>");

    html += section(t("help.controls"),
      '<table class="ctl-table"><thead><tr><th></th><th>' + esc(t("help.ctlKeys")) + "</th><th>" + esc(t("help.ctlPad")) + "</th></tr></thead><tbody>" +
      ctlRow(t("help.ctlNav"), kchip("↑ ↓ ← →"), kchip("D-Pad") + " " + kchip("Left stick")) +
      ctlRow(t("help.ctlSelect"), kchip("Enter"), kchip("A / Cross")) +
      ctlRow(t("help.ctlBack"), kchip("Esc"), kchip("B / Circle")) +
      ctlRow(t("help.ctlTabs"), kchip("["), kchip("LB") + " " + kchip("RB")) +
      ctlRow(t("help.ctlSearch"), kchip("/"), kchip("Start")) +
      ctlRow(t("help.ctlHome"), kchip("H"), kchip("Guide")) +
      ctlRow(t("help.ctlFull"), kchip("F"), kchip("—")) +
      "</tbody></table>" +
      '<p class="note">' + esc(t("settings.disclaimer")) + "</p>");

    var faqs = [1, 2, 3, 4, 5, 6].map(function (i) {
      return '<details class="faq"' + (i === 1 ? " open" : "") + '><summary data-focusable tabindex="0">' + esc(t("faq" + i + "q")) + '</summary><div class="faq-body">' + esc(t("faq" + i + "a")) + "</div></details>";
    }).join("");
    html += section(t("help.trouble"), faqs);

    html += section(t("help.region"),
      '<p class="note warn"><strong>' + esc("xbox.com/regions") + "</strong> — " + esc(t("faq5a")) + "</p>" +
      '<p class="note"><a href="https://raw.githubusercontent.com/asp11edgr/XCloud4/main/docs/region-en.md" target="_blank" rel="noopener" data-focusable>Region guide (EN)</a> · <a href="https://raw.githubusercontent.com/asp11edgr/XCloud4/main/docs/region-es.md" target="_blank" rel="noopener" data-focusable>Guía de región (ES)</a></p>');

    v.innerHTML = html;
  }

  /* ---------------- settings ---------------- */
  function renderSettings() {
    var v = $("#view");
    var langs = window.X4I18N.LANGS;
    var names = window.X4I18N.NAMES;
    var html = '<div class="viewhead"><h1>' + esc(t("settings.title")) + "</h1><p class=\"sub\">" + esc(t("settings.sub")) + "</p></div>";
    html += '<div class="setgrid">';

    html += '<div class="panel"><h3>' + esc(t("settings.language")) + "</h3><p class=\"hint\">" + esc(t("settings.languageHint")) + "</p>" +
      '<div class="field"><label for="set-lang">' + esc(t("settings.language")) + '</label><select id="set-lang" data-focusable>' +
      langs.map(function (l) { return '<option value="' + l + '"' + (window.X4I18N.lang === l ? " selected" : "") + ">" + esc(names[l]) + "</option>"; }).join("") +
      "</select></div></div>";

    html += '<div class="panel"><h3>' + esc(t("settings.stream")) + "</h3><p class=\"hint\">" + esc(t("settings.streamHint")) + "</p>" +
      '<div class="field"><label for="set-stream">' + esc(t("settings.stream")) + '</label><select id="set-stream" data-focusable>' +
      '<option value="new"' + (S.streamMode === "new" ? " selected" : "") + ">" + esc(t("settings.streamNew")) + "</option>" +
      '<option value="same"' + (S.streamMode === "same" ? " selected" : "") + ">" + esc(t("settings.streamSame")) + "</option>" +
      "</select></div>" +
      '<label class="switch"><input type="checkbox" id="set-motion" data-focusable' + (S.reduceMotion ? " checked" : "") + "> <span>" + esc(t("settings.motion")) + "</span></label>" +
      "</div>";

    html += '<div class="panel"><h3>' + esc(t("settings.updates")) + "</h3><p class=\"hint\">" + esc(t("settings.updatesHint")) + "</p>" +
      '<div class="kv"><span class="k">' + esc(t("home.statsEdition")) + '</span><span class="v">Web ' + APP_VERSION + "</span></div>" +
      '<div class="kv"><span class="k">GitHub</span><span class="v">' + (S.update.latest ? esc(S.update.latest) : "—") + "</span></div>" +
      '<div class="kv"><span class="k">' + esc(t("settings.check")) + '</span><span class="v" id="update-status">' + esc(t("settings.upToDate")) + "</span></div>" +
      '<div style="margin-top:12px"><button class="btn btn-ghost" data-focusable id="btn-check-update">' + esc(t("settings.check")) + "</button></div></div>";

    html += '<div class="panel"><h3>' + esc(t("settings.data")) + "</h3><p class=\"hint\">" + esc(t("settings.dataHint")) + "</p>" +
      '<div class="kv"><span class="k">' + esc(t("games.title")) + '</span><span class="v">' + S.favs.length + "</span></div>" +
      '<div class="kv"><span class="k">' + esc(t("games.recent")) + '</span><span class="v">' + S.recent.length + "</span></div>" +
      '<div style="margin-top:12px"><button class="btn btn-danger" data-focusable id="btn-clear-data">' + esc(t("settings.clear")) + "</button></div></div>";

    html += '<div class="panel"><h3>' + esc(t("settings.about")) + "</h3><p class=\"hint\">" + esc(t("settings.aboutText")) + "</p>" +
      '<div class="kv"><span class="k">' + esc(t("settings.license")) + '</span><span class="v">GPL-3.0-only</span></div>' +
      '<div class="kv"><span class="k">' + esc(t("settings.editions")) + "</span><span class=\"v\" style=\"max-width:65%\">" + esc(t("settings.editionsText")) + "</span></div>" +
      '<p class="hint" style="margin-top:12px">' + esc(t("settings.disclaimer")) + "</p></div>";

    html += '<div class="panel"><h3>' + esc(t("settings.links")) + "</h3><p class=\"hint\"></p>" +
      '<div class="kv"><span class="k">GitHub</span><span class="v"><a href="' + REPO + '" target="_blank" rel="noopener" data-focusable>asp11edgr/XCloud4</a></span></div>' +
      '<div class="kv"><span class="k">Releases</span><span class="v"><a href="' + REPO + '/releases" target="_blank" rel="noopener" data-focusable>' + REPO + "/releases</a></span></div>" +
      '<div class="kv"><span class="k">README</span><span class="v"><a href="' + REPO + '#readme" target="_blank" rel="noopener" data-focusable>README</a></span></div>' +
      '<div class="kv"><span class="k">Ko-fi</span><span class="v"><a href="https://ko-fi.com/asapedgr" target="_blank" rel="noopener" data-focusable>ko-fi.com/asapedgr</a></span></div>' +
      "</div>";

    html += "</div>";
    v.innerHTML = html;
  }

  /* ---------------- modal ---------------- */
  var modalOpenId = null;
  function openModal(id) {
    var p = product(id);
    if (!p) return;
    modalOpenId = id;
    var fav = S.favs.indexOf(id) >= 0;
    var root = $("#modal-root");
    var tags = p.cats.slice(0, 3).map(function (c) { return '<span class="tag">' + esc(cat(c)) + "</span>"; }).join("");
    var badges = "";
    if (p.touch) badges += '<span class="tag">TOUCH</span>';
    if (p.own) badges += '<span class="tag">FREE</span>';
    if (isEA(id)) badges += '<span class="tag">EA PLAY</span>';
    root.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(p.title) + '">' +
      '<div class="modal-hero">' +
        '<div class="hero-bg" style="background-image:url(\'' + esc(p.tile) + '\')"></div>' +
        '<div class="hero-fade"></div>' +
        '<button class="iconbtn modal-close" data-focusable id="modal-close" aria-label="' + esc(t("common.close")) + '">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
        "</button>" +
        '<div class="modal-hero-inner">' +
          '<img class="modal-poster" src="' + esc(p.tile) + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
          "<div><h2 class=\"modal-title\">" + esc(p.title) + '</h2><div class="modal-pub">' + esc(p.publisher) + '</div><div class="modal-tags">' + badges + tags + "</div></div>" +
        "</div>" +
      "</div>" +
      '<div class="modal-body">' +
        '<div class="modal-actions">' +
          '<button class="btn btn-primary" data-focusable data-play="' + esc(id) + '">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>' + esc(t("modal.play")) + "</button>" +
          '<button class="btn btn-ghost" data-focusable id="modal-fav">' + esc(fav ? t("modal.favRemove") : t("modal.favAdd")) + "</button>" +
          '<button class="btn btn-ghost" data-focusable id="modal-copy">' + esc(t("common.copyLink")) + "</button>" +
          '<a class="btn btn-ghost" data-focusable href="https://www.xbox.com/search?q=' + encodeURIComponent(p.title) + '" target="_blank" rel="noopener">' + esc(t("common.viewOnStore")) + "</a>" +
        "</div>" +
        '<div class="modal-note">' + esc(p.own ? t("modal.ownNote") : t("modal.gpNote")) + " " + esc(t("modal.streamNote")) + "</div>" +
      "</div></div>";
    root.hidden = false;
    document.body.style.overflow = "hidden";
    $("#modal-close").focus();
  }
  function closeModal() {
    var root = $("#modal-root");
    root.hidden = true;
    root.innerHTML = "";
    modalOpenId = null;
    document.body.style.overflow = "";
  }

  /* ---------------- actions ---------------- */
  function play(id) {
    var p = product(id);
    if (!p) return;
    addRecent(id);
    toast(t("toast.playing", { game: p.title }));
    var url = streamURL(id);
    if (S.streamMode === "same") { window.location.href = url; }
    else { window.open(url, "_blank", "noopener"); }
  }
  function toggleFav(id) {
    var i = S.favs.indexOf(id);
    if (i >= 0) { S.favs.splice(i, 1); toast(t("toast.favRemove")); }
    else { S.favs.unshift(id); toast(t("toast.favAdd")); }
    lsSet("x4.favs", S.favs);
    if (modalOpenId === id) {
      var btn = $("#modal-fav");
      if (btn) btn.textContent = (S.favs.indexOf(id) >= 0) ? t("modal.favRemove") : t("modal.favAdd");
    }
    if (S.route === "games") renderRoute();
  }
  function addRecent(id) {
    S.recent = S.recent.filter(function (x) { return x !== id; });
    S.recent.unshift(id);
    S.recent = S.recent.slice(0, 20);
    lsSet("x4.recent", S.recent);
  }

  /* ---------------- update check ---------------- */
  function isNewer(tag, cur) {
    var m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(tag || "");
    if (!m) return false;
    var curM = /^(\d+)\.(\d+)\.(\d+)/.exec(cur || "");
    if (!curM) return false;
    for (var i = 1; i <= 3; i++) {
      var a = parseInt(m[i], 10), b = parseInt(curM[i], 10);
      if (a !== b) return a > b;
    }
    return false;
  }
  function checkUpdates(manual) {
    if (!window.fetch) return Promise.resolve();
    return fetch("https://api.github.com/repos/asp11edgr/XCloud4/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (j) {
        if (j && j.tag_name) {
          S.update.latest = j.tag_name;
          S.update.checked = Date.now();
          var status = $("#update-status");
          if (status) status.textContent = isNewer(j.tag_name, APP_VERSION) ? j.tag_name : t("settings.upToDate");
          if (S.route === "home") {
            var b = $("#update-banner");
            if (!b && isNewer(j.tag_name, APP_VERSION)) renderRoute();
          }
          if (manual) {
            toast(isNewer(j.tag_name, APP_VERSION) ? j.tag_name : t("settings.upToDate"));
          }
        }
      })
      .catch(function () {
        if (manual) toast(t("settings.checkError"));
        var status = $("#update-status");
        if (status && manual) status.textContent = t("settings.checkError");
      });
  }

  /* ---------------- router ---------------- */
  var ROUTES = { home: renderHome, discover: renderDiscover, catalog: renderCatalog, games: renderGames, search: renderSearch, help: renderHelp, settings: renderSettings };
  function setRoute(name) {
    if (!ROUTES[name]) name = "home";
    S.route = name;
    try { location.hash = "#/" + name; } catch (e) { /* ignore */ }
    $$(".navbtn").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-nav") === name); });
    renderRoute();
    window.scrollTo(0, 0);
    closeSidebar();
  }
  function renderRoute() {
    window.X4I18N.apply();
    Focus.reset();
    ROUTES[S.route]();
    window.X4I18N.apply();
    Focus.reset();
  }
  function routeFromHash() {
    var m = /^#\/([a-z]+)/.exec(location.hash || "");
    return m ? m[1] : "home";
  }

  /* ---------------- sidebar (mobile) ---------------- */
  function openSidebar() {
    $("#sidebar").classList.add("open");
    $("#scrim").hidden = false;
    $("#btn-burger").setAttribute("aria-expanded", "true");
  }
  function closeSidebar() {
    $("#sidebar").classList.remove("open");
    $("#scrim").hidden = true;
    $("#btn-burger").setAttribute("aria-expanded", "false");
  }

  /* ---------------- focus / gamepad ---------------- */
  var Focus = {
    items: [], idx: -1,
    visible: function (el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); },
    collect: function () {
      var scope = modalOpenId ? $("#modal-root") : document;
      var list = $$("[data-focusable]", scope).filter(this.visible);
      this.items = list;
      if (this.idx >= list.length) this.idx = list.length - 1;
    },
    reset: function () { this.items = []; this.idx = -1; },
    center: function (el) {
      var r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    },
    set: function (i, scroll) {
      if (!this.items.length) return;
      if (i < 0) i = 0;
      if (i >= this.items.length) i = this.items.length - 1;
      var prev = this.items[this.idx];
      if (prev) prev.classList.remove("gp-focus");
      this.idx = i;
      var el = this.items[i];
      el.classList.add("gp-focus");
      if (scroll !== false) el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: S.reduceMotion ? "auto" : "smooth" });
    },
    move: function (dir) {
      this.collect();
      if (!this.items.length) return;
      if (this.idx < 0) { this.set(0); return; }
      var cur = this.center(this.items[this.idx]);
      var best = -1, bestScore = Infinity;
      for (var i = 0; i < this.items.length; i++) {
        if (i === this.idx) continue;
        var c = this.center(this.items[i]);
        var dx = c.x - cur.x, dy = c.y - cur.y;
        var primary, secondary;
        if (dir === "left") { primary = -dx; secondary = Math.abs(dy); }
        else if (dir === "right") { primary = dx; secondary = Math.abs(dy); }
        else if (dir === "up") { primary = -dy; secondary = Math.abs(dx); }
        else { primary = dy; secondary = Math.abs(dx); }
        if (primary <= 2) continue;
        if (dir === "left" || dir === "right") {
          if (Math.abs(dy) > Math.max(cur.h, c.h) * 0.9 + 14) continue;
        } else {
          if (Math.abs(dx) > Math.max(cur.w, c.w) * 0.9 + 14) continue;
        }
        var score = primary + secondary * 2.2;
        if (score < bestScore) { bestScore = score; best = i; }
      }
      if (best >= 0) this.set(best);
      else if (dir === "down" || dir === "up") {
        this.set(this.idx + (dir === "down" ? 1 : -1));
      }
    },
    select: function () {
      if (this.idx >= 0 && this.items[this.idx]) {
        this.items[this.idx].click();
      }
    }
  };

  var Pad = {
    prev: {},
    axisPrev: { x: 0, y: 0 },
    repUntil: 0,
    poll: function () {
      var pads = navigator.getGamepads ? navigator.getGamepads() : [];
      var gp = null;
      for (var i = 0; i < pads.length; i++) { if (pads[i] && pads[i].connected) { gp = pads[i]; break; } }
      if (!gp) { requestAnimationFrame(Pad.poll); return; }
      var now = performance.now();
      var btn = function (idx) { return !!(gp.buttons[idx] && gp.buttons[idx].pressed); };
      var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      var dir = null;
      if (btn(14) || ax < -0.5) dir = "left";
      else if (btn(15) || ax > 0.5) dir = "right";
      else if (btn(12) || ay < -0.5) dir = "up";
      else if (btn(13) || ay > 0.5) dir = "down";
      if (dir && now >= Pad.repUntil) {
        Focus.move(dir);
        Pad.repUntil = now + ((Pad.axisPrev.x || Pad.axisPrev.y) ? 110 : 260);
      }
      Pad.axisPrev = { x: ax, y: ay };

      var handle = function (code, fn) {
        var was = Pad.prev[code];
        var is = btn(code);
        if (is && !was) fn();
        Pad.prev[code] = is;
      };
      handle(0, function () { Focus.select(); });          // A / Cross
      handle(1, function () {                              // B / Circle
        if (modalOpenId) closeModal();
        else if (S.route !== "home") setRoute("home");
      });
      handle(4, function () { Pad.tab(-1); });             // LB
      handle(5, function () { Pad.tab(1); });              // RB
      handle(9, function () { setRoute("search"); });      // Start
      handle(8, function () { setRoute("home"); });        // Guide
      requestAnimationFrame(Pad.poll);
    },
    tab: function (delta) {
      var names = Object.keys(ROUTES);
      var i = names.indexOf(S.route);
      i = (i + delta + names.length) % names.length;
      setRoute(names[i]);
    }
  };

  function padChip(show, text) {
    var chip = $("#pad-chip");
    if (!chip) return;
    chip.hidden = !show;
    $("#pad-chip-text").textContent = text || "";
    chip.title = text || "";
  }

  window.addEventListener("gamepadconnected", function (e) {
    S.padName = (e.gamepad && e.gamepad.id) || "";
    padChip(true, (S.padName || "Gamepad").slice(0, 28));
    toast(t("toast.padOn", { id: (S.padName || "Gamepad").slice(0, 40) }));
  });
  window.addEventListener("gamepaddisconnected", function () {
    padChip(false, "");
    toast(t("toast.padOff"));
  });

  /* ---------------- keyboard ---------------- */
  document.addEventListener("keydown", function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    var typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

    if (e.key === "Escape") {
      if (modalOpenId) { closeModal(); e.preventDefault(); return; }
      closeSidebar();
      return;
    }
    if (typing) return;

    switch (e.key) {
      case "ArrowLeft": Focus.move("left"); e.preventDefault(); break;
      case "ArrowRight": Focus.move("right"); e.preventDefault(); break;
      case "ArrowUp": Focus.move("up"); e.preventDefault(); break;
      case "ArrowDown": Focus.move("down"); e.preventDefault(); break;
      case "/":
        setRoute("search");
        e.preventDefault();
        break;
      case "f": case "F":
        toggleFullscreen();
        break;
      case "h": case "H":
        setRoute("home");
        break;
      case "[":
        Pad.tab(-1);
        break;
      case "]":
        Pad.tab(1);
        break;
      default: break;
    }
  });

  function toggleFullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen && document.exitFullscreen(); }
    else { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); }
  }

  /* ---------------- global click delegation ---------------- */
  document.addEventListener("click", function (e) {
    var el;
    el = e.target.closest("[data-play]");
    if (el) { play(el.getAttribute("data-play")); return; }

    el = e.target.closest("[data-game]");
    if (el) { openModal(el.getAttribute("data-game")); return; }

    el = e.target.closest("[data-nav]");
    if (el) { setRoute(el.getAttribute("data-nav")); return; }

    el = e.target.closest("[data-more]");
    if (el) {
      var mid = el.getAttribute("data-more");
      if (mid === "goCatalog") { S.catalog.touch = false; S.catalog.cat = ""; setRoute("catalog"); }
      else if (mid === "goCatalogTouch") { S.catalog.touch = true; S.catalog.cat = ""; setRoute("catalog"); }
      else if (mid === "goDiscoverEA") { S.discoverTab = "ea"; setRoute("discover"); }
      return;
    }

    el = e.target.closest("[data-dtab]");
    if (el) {
      S.discoverTab = el.getAttribute("data-dtab");
      S.catalog.shown = 90;
      renderRoute();
      return;
    }

    el = e.target.closest("#btn-more-discover");
    if (el) { S.catalog.shown += 90; renderRoute(); return; }

    el = e.target.closest("#btn-more-catalog");
    if (el) { S.catalog.shown += 90; renderRoute(); return; }

    el = e.target.closest("#modal-close");
    if (el) { closeModal(); return; }

    el = e.target.closest("#modal-fav");
    if (el && modalOpenId) { toggleFav(modalOpenId); return; }

    el = e.target.closest("#modal-copy");
    if (el && modalOpenId) {
      var url = streamURL(modalOpenId);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast(t("common.copied")); }, function () { toast(url); });
      } else { toast(url); }
      return;
    }

    el = e.target.closest("#btn-check-update");
    if (el) {
      el.textContent = t("settings.checking");
      checkUpdates(true);
      return;
    }

    el = e.target.closest("#btn-clear-data");
    if (el) {
      S.favs = []; S.recent = [];
      lsSet("x4.favs", S.favs); lsSet("x4.recent", S.recent);
      renderRoute();
      toast(t("settings.cleared"));
      return;
    }

    el = e.target.closest("#btn-burger");
    if (el) {
      if ($("#sidebar").classList.contains("open")) closeSidebar(); else openSidebar();
      return;
    }

    el = e.target.closest("#btn-fullscreen");
    if (el) { toggleFullscreen(); return; }

    if (e.target.id === "scrim") { closeSidebar(); return; }
    if (e.target.id === "modal-root") { closeModal(); return; }
  });

  /* catalog + search inputs */
  document.addEventListener("input", function (e) {
    if (e.target.id === "cat-q") {
      S.catalog.q = e.target.value;
      S.catalog.shown = 90;
      var scroll = window.pageYOffset;
      renderCatalog();
      window.X4I18N.apply();
      Focus.reset();
      window.scrollTo(0, scroll);
      var input = $("#cat-q");
      if (input) { input.focus(); input.selectionStart = input.value.length; }
    } else if (e.target.id === "search-q") {
      S.searchQ = e.target.value;
      S._skipSearchFocus = true;
      var sc = window.pageYOffset;
      renderSearch();
      window.X4I18N.apply();
      Focus.reset();
      window.scrollTo(0, sc);
      var si = $("#search-q");
      if (si) { si.focus(); si.selectionStart = si.value.length; }
    }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "cat-cat") { S.catalog.cat = e.target.value; S.catalog.shown = 90; renderRoute(); }
    else if (e.target.id === "cat-sort") { S.catalog.sort = e.target.value; renderRoute(); }
    else if (e.target.id === "cat-touch") { S.catalog.touch = e.target.checked; S.catalog.shown = 90; renderRoute(); }
    else if (e.target.id === "cat-f2p") { S.catalog.hideF2P = e.target.checked; S.catalog.shown = 90; renderRoute(); }
    else if (e.target.id === "set-lang") { window.X4I18N.setLang(e.target.value); renderRoute(); toast(window.X4I18N.NAMES[e.target.value]); }
    else if (e.target.id === "set-stream") { S.streamMode = e.target.value; lsSet("x4.streamMode", S.streamMode); }
    else if (e.target.id === "set-motion") {
      S.reduceMotion = e.target.checked;
      document.body.classList.toggle("reduce-motion", S.reduceMotion);
      lsSet("x4.reduceMotion", S.reduceMotion);
    }
  });

  window.addEventListener("hashchange", function () {
    var r = routeFromHash();
    if (r !== S.route) { S.route = r; renderRoute(); $$(".navbtn").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-nav") === r); }); window.scrollTo(0, 0); }
  });

  document.addEventListener("x4:lang", function () {
    $("#foot-version").textContent = "XCloud4 Web " + APP_VERSION;
  });

  /* ---------------- data loading + boot ---------------- */
  function showError() {
    $("#view").innerHTML = '<div class="empty"><div class="big">⚠️</div><h3>XCloud4 Web</h3><p>' +
      esc("The bundled catalog could not be loaded. Check your connection and retry.") + "</p>" +
      '<p style="margin-top:14px"><button class="btn btn-primary" onclick="location.reload()">Retry</button></p></div>';
    $("#splash").classList.add("done");
  }

  function boot() {
    loadSettings();
    window.X4I18N.init();
    window.X4I18N.apply();
    $("#foot-version").textContent = "XCloud4 Web " + APP_VERSION;

    fetch("data/catalog.json")
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .then(function (data) {
        S.data = data;
        S.order = data.collections.all.slice();
        setRoute(routeFromHash());
        $$(".navbtn").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-nav") === S.route); });
        $("#splash").classList.add("done");
        checkUpdates(false);
      })
      .catch(function () { showError(); });

    if (navigator.getGamepads) requestAnimationFrame(Pad.poll);
  }

  boot();
})();
