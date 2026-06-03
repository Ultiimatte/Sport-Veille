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
function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
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
      <a class="card__link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
        ${img}
        <div class="card__body">
          <div class="card__meta">
            <span class="badge">${t.emoji} ${escapeHtml(t.label)}</span>
            <span>${timeAgo(item.publishedAt)}</span>
          </div>
          <h3 class="card__title">${escapeHtml(item.title)}</h3>
          <p class="card__summary">${escapeHtml(item.summary || "")}</p>
        </div>
      </a>
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
  const meta = `<p class="list-meta">${items.length} actualité${items.length > 1 ? "s" : ""}${updated}</p>`;
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
        <div class="setting__label">Heure du récap</div>
        <div class="setting__hint">Heure à laquelle vous aimez consulter (préférence)</div>
      </div>
      <input type="time" id="set-time" value="${s.notifyTime}" />
    </div>
    <button class="btn-block" id="mark-all">✓ Tout marquer comme lu</button>
    <button class="btn-block" id="clear-read" style="margin-top:10px;">↺ Réinitialiser les "lus"</button>
    <div class="info-box">
      <strong>Notifications à 9h</strong> : non activées dans cette version. Le récap est
      simplement prêt chaque matin quand vous ouvrez l'app. Pour ne pas l'oublier, ajoutez
      l'app à votre écran d'accueil (Safari → Partager → « Sur l'écran d'accueil »).
    </div>`;
}

/* ---------- Orchestration ---------- */
async function render(opts = {}) {
  const content = document.getElementById("content");
  renderFilters();
  if (state.view === "today") content.innerHTML = renderToday();
  else if (state.view === "history") { content.innerHTML = `<div class="loader">…</div>`; content.innerHTML = await renderHistory(); }
  else if (state.view === "settings") { content.innerHTML = renderSettings(); bindSettings(); }
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

/** Clic sur un article -> ouvre la source, le marque lu et le renvoie en bas. */
function bindCardLinks() {
  document.querySelectorAll(".card__link").forEach((a) => {
    a.addEventListener("click", () => {
      const id = a.closest(".card")?.dataset.key;
      if (!id) return;
      toggleRead(id, true);
      // léger délai pour laisser le navigateur ouvrir l'article d'abord
      setTimeout(() => render({ keepScroll: true }), 60);
    });
  });
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
  document.getElementById("set-time")?.addEventListener("change", (e) => {
    saveSettings({ ...s, notifyTime: e.target.value });
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
}

function setActiveTab(view) {
  document.querySelectorAll(".tabbar__btn").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.view === view)
  );
}

/* ---------- Navigation par onglets ---------- */
document.querySelectorAll(".tabbar__btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
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

function openSearch() {
  // Cale le voile juste sous l'en-tête et au-dessus de la barre du bas
  searchOverlay.style.top = document.getElementById("appHeader").offsetHeight + "px";
  searchOverlay.style.bottom = document.querySelector(".tabbar").offsetHeight + "px";
  searchOverlay.hidden = false;
  searchInput.value = "";
  searchResults.innerHTML = "";
  searchInput.focus();
}
function closeSearch() {
  searchOverlay.hidden = true;
  searchInput.blur();
}
searchBtn.addEventListener("click", () => (searchOverlay.hidden ? openSearch() : closeSearch()));
searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
// Clic sur le voile gris (hors boîte/résultats) = fermer
searchOverlay.addEventListener("click", (e) => { if (e.target === searchOverlay) closeSearch(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !searchOverlay.hidden) closeSearch(); });

function renderSearchResults(query) {
  const items = state.data?.items || [];
  const words = normalize(query).split(" ").filter(Boolean);
  if (!words.length) { searchResults.innerHTML = ""; return; }
  const matches = items.filter((it) => {
    const hay = normalize(`${it.title || ""} ${it.summary || ""} ${topicInfo(it.topic).label}`);
    return words.every((w) => hay.includes(w));
  });
  if (!matches.length) {
    searchResults.innerHTML = `<div class="search-empty">Aucun article trouvé</div>`;
    return;
  }
  searchResults.innerHTML = matches.map((it) => `
    <div class="search-result" data-key="${escapeHtml(readKey(it))}">
      <div class="search-result__sport">${escapeHtml(topicInfo(it.topic).label)}</div>
      <div class="search-result__title">${escapeHtml(it.title)}</div>
    </div>`).join("");
  searchResults.querySelectorAll(".search-result").forEach((el) =>
    el.addEventListener("click", () => openArticle(el.dataset.key))
  );
}

/** Ferme la recherche et fait défiler jusqu'à l'article (comme un Cmd+F). */
async function openArticle(key) {
  closeSearch();
  state.view = "today";
  state.filter = "all";
  setActiveTab("today");
  await render({ keepScroll: true });
  requestAnimationFrame(() => {
    for (const c of document.querySelectorAll(".card")) {
      if (c.dataset.key === key) {
        c.scrollIntoView({ behavior: "smooth", block: "center" });
        c.classList.add("is-highlight");
        setTimeout(() => c.classList.remove("is-highlight"), 1800);
        break;
      }
    }
  });
}

// Logo -> retour à la page d'accueil (récap du jour, filtre Tout)
document.querySelector(".logo").addEventListener("click", goHome);

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
