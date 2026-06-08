/* =========================================================================
   Sport Veille — logique de l'application (PWA, sans dependance)
   ========================================================================= */

const STORE = {
  read: "sv_read_ids",
  settings: "sv_settings",
};

const state = {
  data: null, // recap du jour
  view: "today", // today | history | settings
  filter: "all", // topic id ou "all"
  topicsMap: {}, // id -> {label, emoji}
};

/* ---------- Persistance locale (privee, sur le telephone) ---------- */
function getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(STORE.read) || "[]")); }
  catch { return new Set(); }
}
function setReadIds(set) {
  localStorage.setItem(STORE.read, JSON.stringify([...set]));
}
function getSettings() {
  try { return { theme: "light", notifyTime: "09:00", ...JSON.parse(localStorage.getItem(STORE.settings) || "{}") }; }
  catch { return { theme: "light", notifyTime: "09:00" }; }
}
function saveSettings(s) {
  localStorage.setItem(STORE.settings, JSON.stringify(s));
  applyTheme(s.theme);
}
function applyTheme(theme) {
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

/* ---------- Utilitaires d'affichage ---------- */
/** Jour/mois court, ex. « 03/06 ». */
function formatDayMonth(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** Date + heure de publication, ex. « 2 juin · 23h45 ». */
function formatDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
    return `${date} · ${time}`;
  } catch { return ""; }
}
function formatDateLong(key) {
  try {
    const s = new Date(key + "T12:00:00").toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch { return key; }
}
function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}
function topicInfo(id) {
  return state.topicsMap[id] || { label: "Sport", emoji: "🏆" };
}
/** Clé de suivi « lu » = URL de l'article (stable partout, jamais recalculée). */
function readKey(item) {
  return item.url || item.id || "";
}
/** Place les articles deja lus en bas (tri stable, conserve l'ordre par date). */
function sortReadLast(items, readIds) {
  return [...items].sort((a, b) => (readIds.has(readKey(a)) ? 1 : 0) - (readIds.has(readKey(b)) ? 1 : 0));
}
function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
/** Minuscule sans accents ni ponctuation (pour la recherche). */
function normalize(s = "") {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/* ---------- Chargement des donnees ---------- */
async function loadToday() {
  const res = await fetch(`data/news.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("news.json introuvable");
  return res.json();
}
async function loadHistoryIndex() {
  try {
    const res = await fetch(`data/history/index.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}
async function loadHistoryDay(dateKey) {
  const res = await fetch(`data/history/${dateKey}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error("jour introuvable");
  return res.json();
}

function indexTopics(data) {
  state.topicsMap = {};
  for (const cat of data.categories || []) {
    for (const t of cat.topics || []) state.topicsMap[t.id] = t;
  }
}

/* ---------- Rendu des cartes ---------- */
function cardHtml(item, readIds) {
  const t = topicInfo(item.topic);
  const key = escapeHtml(readKey(item));
  const isRead = readIds.has(readKey(item));
  const img = item.image
    ? `<img class="card__img" src="${escapeHtml(item.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'card__img card__img--placeholder',textContent:'${t.emoji}'}))" />`
    : `<div class="card__img card__img--placeholder">${t.emoji}</div>`;
  return `
    <article class="card ${isRead ? "is-read" : ""}" data-key="${key}">
      <div class="card__link" data-open="${key}">
        ${img}
        <div class="card__body">
          <div class="card__meta">
            <span class="badge">${t.emoji} ${escapeHtml(t.label)}</span>
            <span>${formatDateTime(item.publishedAt)}</span>
          </div>
          <h3 class="card__title">${escapeHtml(item.title)}</h3>
          <p class="card__summary">${escapeHtml(item.summary || "")}</p>
        </div>
      </div>
      <div class="card__footer">
        <span class="card__source">${escapeHtml(item.source || "")}</span>
        <button class="read-btn ${isRead ? "is-read" : ""}" data-read="${key}">
          ${isRead ? "✓ Lu" : "Marquer comme lu"}
        </button>
      </div>
    </article>`;
}

/* ---------- Vues ---------- */
function renderFilters() {
  const el = document.getElementById("filters");
  if (state.view !== "today") { el.innerHTML = ""; return; }
  const present = new Set((state.data?.items || []).map((i) => i.topic));
  const chips = [`<button class="chip ${state.filter === "all" ? "is-active" : ""}" data-filter="all">Tout</button>`];
  for (const id of Object.keys(state.topicsMap)) {
    if (!present.has(id)) continue;
    const t = state.topicsMap[id];
    chips.push(`<button class="chip ${state.filter === id ? "is-active" : ""}" data-filter="${id}"><span class="emoji">${t.emoji}</span> ${escapeHtml(t.label)}</button>`);
  }
  el.innerHTML = chips.join("");
  el.querySelectorAll("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => { state.filter = b.dataset.filter; render(); })
  );
}

function renderToday() {
  const readIds = getReadIds();
  let items = state.data?.items || [];
  if (state.filter !== "all") items = items.filter((i) => i.topic === state.filter);
  const banner = state.data?.demo
    ? `<div class="banner">🛈 Contenu de démonstration. Une fois déployé sur GitHub, les vraies actualités s'afficheront ici chaque matin.</div>`
    : "";
  if (!items.length) {
    return banner + `<div class="empty"><span class="empty__emoji">📭</span>Aucune actualité pour ce filtre.</div>`;
  }
  const updated = state.data?.generatedAt ? ` · mis à jour à ${formatTime(state.data.generatedAt)}` : "";
  const unread = items.filter((i) => !readIds.has(readKey(i))).length;
  const meta = `<p class="list-meta">${items.length} actualité${items.length > 1 ? "s" : ""} <strong>(${unread} non lu${unread > 1 ? "s" : ""})</strong>${updated}</p>`;
  items = sortReadLast(items, readIds); // articles lus en bas
  return banner + meta + items.map((i) => cardHtml(i, readIds)).join("");
}

async function renderHistory() {
  const idx = await loadHistoryIndex();
  if (!idx.length) {
    return `<div class="empty"><span class="empty__emoji">🗓️</span>L'historique se remplira au fil des jours.</div>`;
  }
  return idx.map((d) => `
    <div class="history-item" data-history="${d.date}">
      <span class="history-item__date">${formatDateLong(d.date)}</span>
      <span class="history-item__count">${d.count} actus ›</span>
    </div>`).join("");
}

function renderSettings() {
  const s = getSettings();
  return `
    <h2 class="section-title">⚙️ Réglages</h2>
    <div class="setting">
      <div>
        <div class="setting__label">Thème</div>
        <div class="setting__hint">Apparence de l'application</div>
      </div>
      <select id="set-theme">
        <option value="auto" ${s.theme === "auto" ? "selected" : ""}>Automatique</option>
        <option value="light" ${s.theme === "light" ? "selected" : ""}>Clair</option>
        <option value="dark" ${s.theme === "dark" ? "selected" : ""}>Sombre</option>
      </select>
    </div>
    <div class="setting">
      <div>
        <div class="setting__label">Notifications du matin</div>
        <div class="setting__hint">Un rappel chaque matin quand le récap est prêt</div>
      </div>
      <button class="read-btn" id="enable-notif">Activer</button>
    </div>
    <button class="btn-block" id="mark-all" style="margin-top:12px;">✓ Tout marquer comme lu</button>
    <button class="btn-block" id="clear-read" style="margin-top:10px;">↺ Réinitialiser les "lus"</button>`;
}

/* ---------- Vue détail d'un article (in-app) ---------- */
function renderArticle(item) {
  if (!item) return `<div class="empty"><span class="empty__emoji">🔍</span>Article introuvable.</div>`;
  const t = topicInfo(item.topic);
  const img = item.image
    ? `<img class="article__img" src="${escapeHtml(item.image)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'article__img article__img--placeholder',textContent:'${t.emoji}'}))" />`
    : `<div class="article__img article__img--placeholder">${t.emoji}</div>`;
  const src = escapeHtml(item.source || "le site");
  const paras = (item.detail || item.summary || "")
    .split(/\n+/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p class="article__para">${escapeHtml(p)}</p>`).join("");
  return `
    <article class="article">
      ${img}
      <div class="article__body">
        <div class="article__meta">
          <span class="badge">${t.emoji} ${escapeHtml(t.label)}</span>
          <span>${formatDateTime(item.publishedAt)}</span>
        </div>
        <h1 class="article__title">${escapeHtml(item.title)}</h1>
        <div class="article__text">${paras}</div>
        <a class="article__source" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
          Lire l'article sur ${src} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>`;
}

/* ---------- Orchestration ---------- */
async function render(opts = {}) {
  const content = document.getElementById("content");
  document.body.classList.toggle("is-article", state.view === "article");
  renderFilters();
  if (state.view === "today") content.innerHTML = renderToday();
  else if (state.view === "history") { content.innerHTML = `<div class="loader">…</div>`; content.innerHTML = await renderHistory(); }
  else if (state.view === "settings") { content.innerHTML = renderSettings(); bindSettings(); }
  else if (state.view === "article") { content.innerHTML = renderArticle(state.article); }
  bindReadButtons();
  bindHistory();
  bindCardLinks();
  if (!opts.keepScroll) window.scrollTo({ top: 0 });
}

/** Marque un article lu/non-lu. forceRead = true/false pour imposer l'état. */
function toggleRead(id, forceRead) {
  const set = getReadIds();
  const willRead = forceRead === undefined ? !set.has(id) : forceRead;
  willRead ? set.add(id) : set.delete(id);
  setReadIds(set);
  return willRead;
}

function bindReadButtons() {
  document.querySelectorAll("[data-read]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleRead(btn.dataset.read);
      render({ keepScroll: true }); // re-trie : les lus passent en bas
    });
  });
}

/** Clic sur une carte -> ouvre la page détail in-app (et marque lu). */
function bindCardLinks() {
  document.querySelectorAll("[data-open]").forEach((el) => {
    el.addEventListener("click", () => openDetailByKey(el.dataset.open));
  });
}
function openDetailByKey(key) {
  const item = (state.data?.items || []).find((i) => readKey(i) === key);
  if (item) openDetail(item);
}
function openDetail(item) {
  closeSearch(); // au cas où on vient de la recherche
  state.returnView = state.view === "article" ? state.returnView : state.view;
  state.returnScroll = window.scrollY;
  state.article = item;
  state.view = "article";
  toggleRead(readKey(item), true); // consulté -> marqué lu
  render();
}
function goBackFromArticle() {
  state.view = state.returnView || "today";
  setActiveTab(state.view);
  render({ keepScroll: true });
  requestAnimationFrame(() => window.scrollTo(0, state.returnScroll || 0));
}

function bindHistory() {
  document.querySelectorAll("[data-history]").forEach((el) => {
    el.addEventListener("click", async () => {
      try {
        const day = await loadHistoryDay(el.dataset.history);
        state.data = day;
        indexTopics(day);
        state.view = "today";
        state.filter = "all";
        setActiveTab("today");
        setHeaderDate(day.date);
        render();
      } catch { /* ignore */ }
    });
  });
}

function bindSettings() {
  const s = getSettings();
  document.getElementById("set-theme")?.addEventListener("change", (e) => {
    saveSettings({ ...s, theme: e.target.value });
  });
  document.getElementById("mark-all")?.addEventListener("click", () => {
    const set = getReadIds();
    (state.data?.items || []).forEach((i) => set.add(readKey(i)));
    setReadIds(set);
    alert("Toutes les actualités sont marquées comme lues.");
  });
  document.getElementById("clear-read")?.addEventListener("click", () => {
    setReadIds(new Set());
    alert("Statut « lu » réinitialisé.");
  });
  document.getElementById("enable-notif")?.addEventListener("click", enableNotifications);
}

/* ---------- Notifications push (via OneSignal) ----------
   OneSignal gère l'abonnement et son stockage côté serveur : il suffit de
   demander la permission. Plus aucun copier-coller à faire. */
async function enableNotifications() {
  const OneSignal = window.OneSignal;
  if (!OneSignal || !OneSignal.Notifications) {
    alert("Le service de notifications n'est pas encore prêt. Réessaie dans quelques secondes.");
    return;
  }
  // Sur iPhone, il faut iOS 16.4+ ET l'app ajoutée à l'écran d'accueil.
  if (OneSignal.Notifications.isPushSupported && !OneSignal.Notifications.isPushSupported()) {
    alert("Notifications non supportées ici.\nSur iPhone : iOS 16.4+ ET l'app ajoutée à l'écran d'accueil (pas dans Safari).");
    return;
  }
  try {
    await OneSignal.Notifications.requestPermission();
    if (OneSignal.Notifications.permission) {
      await OneSignal.User.PushSubscription.optIn();
      alert("Notifications activées ! Tu recevras le récap chaque matin. 🎉");
    } else {
      alert("Permission refusée. Tu peux la réactiver dans Réglages iOS → SportVeille → Notifications.");
    }
  } catch (e) {
    alert("Impossible d'activer les notifications : " + (e?.message || e));
  }
}

function setActiveTab(view) {
  document.querySelectorAll(".tabbar__btn").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.view === view)
  );
}

/* ---------- Navigation par onglets ---------- */
document.querySelectorAll(".tabbar__btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    closeSearch(); // ferme la recherche si on change d'onglet
    state.view = btn.dataset.view;
    setActiveTab(state.view);
    // Revenir au recap du jour si on quitte un jour d'historique
    if (state.view === "today" && state.data && state.data.date !== window.__todayDate) {
      try { state.data = window.__today; indexTopics(state.data); setHeaderDate(state.data.date); } catch {}
    }
    render();
  });
});

// Actualiser : recharge les données mais reste où on est (onglet/filtre/scroll)
document.getElementById("refreshBtn").addEventListener("click", () => init(false, true));

/* ---------- Recherche façon Spotlight ---------- */
const searchBtn = document.getElementById("searchBtn");
const searchOverlay = document.getElementById("searchOverlay");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

let searchCorpus = null; // tous les articles de tous les jours [{date, item}]

/** Construit (une fois) l'index de recherche sur TOUS les jours d'historique. */
async function buildCorpus() {
  if (searchCorpus) return searchCorpus;
  const idx = await loadHistoryIndex(); // déjà trié du plus récent au plus ancien
  const days = await Promise.all(
    idx.map((d) => loadHistoryDay(d.date).then((day) => ({ date: d.date, items: day.items || [] })).catch(() => null))
  );
  const seen = new Set();
  const corpus = [];
  for (const day of days) {
    if (!day) continue;
    for (const it of day.items) {
      if (seen.has(it.url)) continue; // garde la 1re occurrence (jour le plus récent)
      seen.add(it.url);
      corpus.push({ date: day.date, item: it });
    }
  }
  searchCorpus = corpus;
  return corpus;
}

function openSearch() {
  // Cale le voile juste sous l'en-tête et au-dessus de la barre du bas
  searchOverlay.style.top = document.getElementById("appHeader").offsetHeight + "px";
  searchOverlay.style.bottom = document.querySelector(".tabbar").offsetHeight + "px";
  searchOverlay.hidden = false;
  searchInput.value = "";
  searchResults.innerHTML = "";
  document.body.classList.add("search-open"); // fige le fond
  searchInput.focus();
  buildCorpus().then(() => renderSearchResults(searchInput.value)); // précharge tous les jours
}
function closeSearch() {
  searchOverlay.hidden = true;
  document.body.classList.remove("search-open");
  searchInput.blur();
}
searchBtn.addEventListener("click", () => (searchOverlay.hidden ? openSearch() : closeSearch()));
searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !searchOverlay.hidden) closeSearch(); });
// Tap n'importe où en dehors de la boîte (voile, en-tête, onglets…) = fermer
document.addEventListener("click", (e) => {
  if (searchOverlay.hidden) return;
  if (e.target.closest("#searchBtn") || e.target.closest(".search-box") || e.target.closest(".search-result")) return;
  closeSearch();
});

function renderSearchResults(query) {
  const words = normalize(query).split(" ").filter(Boolean);
  if (!words.length) { searchResults.innerHTML = ""; return; }
  if (!searchCorpus) { searchResults.innerHTML = `<div class="search-empty">Chargement…</div>`; return; }
  const matches = searchCorpus.filter(({ item }) => {
    const hay = normalize(`${item.title || ""} ${item.summary || ""} ${topicInfo(item.topic).label}`);
    return words.every((w) => hay.includes(w));
  });
  if (!matches.length) {
    searchResults.innerHTML = `<div class="search-empty">Aucun article trouvé</div>`;
    return;
  }
  // Tri du plus récent au plus ancien (par date de publication de l'article)
  matches.sort((a, b) => new Date(b.item.publishedAt) - new Date(a.item.publishedAt));
  searchResults.innerHTML = matches.map(({ item, date }) => `
    <div class="search-result" data-key="${escapeHtml(readKey(item))}" data-date="${escapeHtml(date)}">
      <div class="search-result__sport">${escapeHtml(topicInfo(item.topic).label)} · ${formatDayMonth(item.publishedAt)}</div>
      <div class="search-result__title">${escapeHtml(item.title)}</div>
    </div>`).join("");
  searchResults.querySelectorAll(".search-result").forEach((el) =>
    el.addEventListener("click", () => {
      const entry = searchCorpus.find(
        (e) => readKey(e.item) === el.dataset.key && e.date === el.dataset.date
      );
      if (entry) openDetail(entry.item); // clic sur un résultat -> page détail in-app
    })
  );
}

// Logo -> retour à la page d'accueil (récap du jour, filtre Tout)
document.querySelector(".logo").addEventListener("click", goHome);
document.getElementById("backBtn").addEventListener("click", goBackFromArticle);

function goHome() {
  if (window.__today) { state.data = window.__today; indexTopics(state.data); setHeaderDate(state.data.date); }
  state.view = "today";
  state.filter = "all";
  setActiveTab("today");
  render();
}

// Sélecteur de date : le champ <input type="date"> transparent posé sur la
// pastille ouvre le calendrier natif (fiable sur iOS et ordinateur).
const datePicker = document.getElementById("datePicker");

async function refreshDateBounds() {
  datePicker.max = window.__todayDate || "";
  try {
    const idx = await loadHistoryIndex();
    const dates = idx.map((d) => d.date).sort();
    if (dates.length) datePicker.min = dates[0];
  } catch { /* ignore */ }
}

datePicker.addEventListener("change", async () => {
  datePicker.blur(); // ferme le calendrier natif après le choix de la date
  const v = datePicker.value;
  if (!v) return;
  if (v === window.__todayDate) { goHome(); return; }
  try {
    const day = await loadHistoryDay(v);
    state.data = day;
    indexTopics(day);
    state.view = "today";
    state.filter = "all";
    setActiveTab("today");
    setHeaderDate(day.date);
    render();
  } catch {
    alert("Aucun récap disponible pour cette date.");
  }
});

function setHeaderDate(dateKey) {
  document.getElementById("datePill").textContent = formatDateLong(dateKey);
  if (datePicker && dateKey) datePicker.value = dateKey; // ouvre le calendrier sur ce mois
}

/* ---------- Initialisation ---------- */
async function init(forceTab, keepScroll) {
  applyTheme(getSettings().theme);
  try {
    const data = await loadToday();
    state.data = data;
    window.__today = data;
    window.__todayDate = data.date;
    searchCorpus = null; // l'index de recherche sera reconstruit (données fraîches)
    indexTopics(data);
    setHeaderDate(data.date);
    refreshDateBounds();
    if (forceTab) { state.view = "today"; state.filter = "all"; setActiveTab("today"); }
    render({ keepScroll });
  } catch (err) {
    document.getElementById("content").innerHTML =
      `<div class="empty"><span class="empty__emoji">⚠️</span>Impossible de charger les actualités.<br>${escapeHtml(err.message)}</div>`;
  }
}

init();

/* ---------- Service worker (mode hors-ligne / installation) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
