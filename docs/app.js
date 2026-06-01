/* =========================================================================
   Sport Veille — logique de l'application (PWA, sans dependance)
   ========================================================================= */

const STORE = {
  read: "sv_read_ids",
  settings: "sv_settings",
};

const state = {
  data: null, // recap du jour
  view: "today", // today | bySport | history | settings
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
  try { return { theme: "auto", notifyTime: "09:00", ...JSON.parse(localStorage.getItem(STORE.settings) || "{}") }; }
  catch { return { theme: "auto", notifyTime: "09:00" }; }
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
function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
  const isRead = readIds.has(item.id);
  const img = item.image
    ? `<img class="card__img" src="${escapeHtml(item.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'card__img card__img--placeholder',textContent:'${t.emoji}'}))" />`
    : `<div class="card__img card__img--placeholder">${t.emoji}</div>`;
  return `
    <article class="card ${isRead ? "is-read" : ""}" data-id="${item.id}">
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
        <button class="read-btn ${isRead ? "is-read" : ""}" data-read="${item.id}">
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
  return banner + meta + items.map((i) => cardHtml(i, readIds)).join("");
}

function renderBySport() {
  const readIds = getReadIds();
  const items = state.data?.items || [];
  if (!items.length) return `<div class="empty"><span class="empty__emoji">📭</span>Aucune actualité aujourd'hui.</div>`;
  const groups = {};
  for (const i of items) (groups[i.topic] ||= []).push(i);
  // Ordre : selon la config des topics
  const order = Object.keys(state.topicsMap);
  return order
    .filter((id) => groups[id]?.length)
    .map((id) => {
      const t = topicInfo(id);
      return `<h2 class="section-title">${t.emoji} ${escapeHtml(t.label)} <span class="count">${groups[id].length}</span></h2>` +
        groups[id].map((i) => cardHtml(i, readIds)).join("");
    })
    .join("");
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
async function render() {
  const content = document.getElementById("content");
  renderFilters();
  if (state.view === "today") content.innerHTML = renderToday();
  else if (state.view === "bySport") content.innerHTML = renderBySport();
  else if (state.view === "history") { content.innerHTML = `<div class="loader">…</div>`; content.innerHTML = await renderHistory(); bindHistory(); }
  else if (state.view === "settings") { content.innerHTML = renderSettings(); bindSettings(); }
  bindReadButtons();
  bindHistory();
  window.scrollTo({ top: 0 });
}

function bindReadButtons() {
  document.querySelectorAll("[data-read]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.dataset.read;
      const set = getReadIds();
      set.has(id) ? set.delete(id) : set.add(id);
      setReadIds(set);
      const card = btn.closest(".card");
      const read = set.has(id);
      card?.classList.toggle("is-read", read);
      btn.classList.toggle("is-read", read);
      btn.textContent = read ? "✓ Lu" : "Marquer comme lu";
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
    (state.data?.items || []).forEach((i) => set.add(i.id));
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

document.getElementById("refreshBtn").addEventListener("click", () => init(true));
document.getElementById("settingsBtn").addEventListener("click", () => {
  state.view = "settings";
  setActiveTab(null);
  render();
});

// Ombre de l'en-tête au défilement
window.addEventListener("scroll", () => {
  document.getElementById("appHeader").classList.toggle("is-stuck", window.scrollY > 6);
}, { passive: true });

function setHeaderDate(dateKey) {
  document.getElementById("datePill").textContent = formatDateLong(dateKey);
}

/* ---------- Initialisation ---------- */
async function init(forceTab) {
  applyTheme(getSettings().theme);
  try {
    const data = await loadToday();
    state.data = data;
    window.__today = data;
    window.__todayDate = data.date;
    indexTopics(data);
    setHeaderDate(data.date);
    if (forceTab) { state.view = "today"; state.filter = "all"; setActiveTab("today"); }
    render();
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
