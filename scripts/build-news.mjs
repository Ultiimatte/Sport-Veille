// =============================================================================
//  GENERATEUR DU RECAP QUOTIDIEN
// -----------------------------------------------------------------------------
//  Execute chaque nuit par GitHub Actions (gratuit). Pour chaque thematique
//  active :
//    1. recupere les flux RSS
//    2. normalise les articles (titre, resume, sport, date, image, lien)
//    3. supprime les doublons (URL + similarite de titre)
//    4. filtre les dernieres ~24h et trie
//    5. ecrit docs/data/news.json + un fichier d'historique du jour
//
//  Aucune cle API, aucune IA payante. La couche "resume IA" pourra etre
//  branchee ici plus tard (voir fonction enrichWithAI, laissee en commentaire).
// =============================================================================

import Parser from "rss-parser";
import { writeFile, mkdir, readFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { categories, settings } from "../config/sources.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "docs", "data");
const HISTORY_DIR = path.join(DATA_DIR, "history");

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "SportVeille/1.0 (+personal use)" },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

// ---------------------------------------------------------------------------
//  Utilitaires
// ---------------------------------------------------------------------------

/** Supprime les accents et la ponctuation, met en minuscules. */
function normalize(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nettoie le HTML et coupe proprement le resume. */
function buildSummary(item) {
  const raw =
    item.contentSnippet ||
    stripHtml(item.contentEncoded || item.content || item.summary || "");
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length <= settings.summaryMaxChars) return text;
  const cut = text.slice(0, settings.summaryMaxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

function stripHtml(html = "") {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ");
}

/** Tente de trouver une image representative. */
function extractImage(item) {
  const fromArray = (arr) => {
    if (!Array.isArray(arr)) arr = arr ? [arr] : [];
    for (const m of arr) {
      const url = m?.$?.url || m?.url;
      if (url && /^https?:\/\//.test(url)) return url;
    }
    return null;
  };
  return (
    fromArray(item.mediaContent) ||
    fromArray(item.mediaThumbnail) ||
    (item.enclosure?.url && /^https?:\/\//.test(item.enclosure.url) ? item.enclosure.url : null) ||
    firstImgInHtml(item.contentEncoded || item.content || item.summary || "") ||
    null
  );
}

function firstImgInHtml(html = "") {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m && /^https?:\/\//.test(m[1]) ? m[1] : null;
}

/** Retire les fragments de tracking (#at_medium=...) pour des liens propres. */
function cleanUrl(u = "") {
  return u.split("#")[0].trim();
}

/**
 * Classe un article dans un sport via les mots-cles.
 * - mots-cles simples : compares en MOTS ENTIERS (evite que "om" matche "comme")
 * - mots-cles composes (avec espace) : recherche en sous-chaine
 * Le texte inclut titre + resume + URL (l'URL contient souvent le sport).
 */
function classifyTopic(text, topics) {
  const hay = " " + normalize(text) + " ";
  const tokens = new Set(hay.trim().split(" "));
  let best = null;
  let bestScore = 0;
  for (const t of topics) {
    let score = 0;
    for (const kw of t.keywords || []) {
      const k = normalize(kw);
      if (!k) continue;
      const hit = k.includes(" ") ? hay.includes(k) : tokens.has(k);
      if (hit) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = t.id;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Similarite de Jaccard entre deux titres (pour le dedoublonnage). */
function titleSimilarity(a, b) {
  const sa = new Set(normalize(a).split(" ").filter((w) => w.length > 3));
  const sb = new Set(normalize(b).split(" ").filter((w) => w.length > 3));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/** Decalage (ms) du fuseau `tz` par rapport a UTC a l'instant `date`. */
function tzOffsetMs(date, tz) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

/**
 * Fenetre de l'edition du jour : [J-1 cutoff, J cutoff[ en heure locale `tz`.
 * J = date locale au moment de la generation. Renvoie des timestamps ms.
 */
function editionWindow(now, tz, cutoffHHMM) {
  const dateKey = localDateKey(now, tz); // "YYYY-MM-DD" local (aujourd'hui)
  const [hh, mm] = cutoffHHMM.split(":").map(Number);
  const [Y, M, D] = dateKey.split("-").map(Number);
  const approx = Date.UTC(Y, M - 1, D, hh, mm, 0); // heure murale traitee comme UTC
  const end = approx - tzOffsetMs(new Date(approx), tz); // instant UTC reel
  return { start: end - 24 * 3600 * 1000, end, dateKey };
}

/** Date "du jour" dans le fuseau configure (YYYY-MM-DD). */
function localDateKey(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// ---------------------------------------------------------------------------
//  Recuperation + traitement
// ---------------------------------------------------------------------------

async function fetchFeed(feed, category) {
  try {
    const parsed = await parser.parseURL(feed.url);
    const items = [];
    for (const it of parsed.items || []) {
      const title = (it.title || "").trim();
      const url = cleanUrl(it.link || it.guid || "");
      if (!title || !url) continue;

      const topicId =
        feed.topic ||
        classifyTopic(`${title}. ${it.contentSnippet || it.content || ""} ${url}`, category.topics) ||
        "autre";

      items.push({
        id: hash(url),
        title,
        summary: buildSummary(it),
        category: category.id,
        topic: topicId,
        source: feed.name,
        url,
        image: extractImage(it),
        publishedAt: it.isoDate || it.pubDate || null,
      });
    }
    console.log(`  ✓ ${feed.name} — ${feed.url} (${items.length} articles)`);
    return items;
  } catch (err) {
    console.warn(`  ✗ ${feed.name} — ${feed.url} : ${err.message}`);
    return [];
  }
}

/** Hash court et stable pour l'identifiant d'article. */
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/** Supprime les doublons (meme URL, ou titres tres similaires). */
function dedupe(items) {
  const out = [];
  const seenUrls = new Set();
  for (const it of items) {
    if (seenUrls.has(it.url)) continue;
    const dup = out.find(
      (o) => o.topic === it.topic && titleSimilarity(o.title, it.title) >= 0.6
    );
    if (dup) {
      // On garde celui qui a une image ou le resume le plus complet.
      if (!dup.image && it.image) dup.image = it.image;
      if ((it.summary?.length || 0) > (dup.summary?.length || 0)) dup.summary = it.summary;
      continue;
    }
    seenUrls.add(it.url);
    out.push(it);
  }
  return out;
}

// ---------------------------------------------------------------------------
//  Reecriture IA (Google Gemini, palier gratuit) -> champ `detail`
//  S'active uniquement si la cle GEMINI_API_KEY est presente (sinon ignore).
//  Le champ `detail` n'apparait QUE dans la page detail de l'app (la liste
//  garde le `summary` court). Mise en cache par URL pour ne pas regenerer.
// ---------------------------------------------------------------------------
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.0-flash";
const AI_THROTTLE_MS = 4500; // ~13 req/min, sous la limite gratuite (15/min)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function aiRewrite(title, summary) {
  const prompt =
    "Tu es journaliste sportif. À partir UNIQUEMENT des informations ci-dessous " +
    "(titre + court résumé), rédige un court article de 4 à 6 phrases en français, " +
    "clair et fluide. RÈGLES STRICTES : n'invente AUCUN fait, chiffre, score, date, " +
    "citation ou nom qui ne soit pas dans le résumé ; si l'info est mince, reste " +
    "général sans broder. Ne mets pas de titre, donne directement le texte.\n\n" +
    `Titre : ${title}\nRésumé source : ${summary}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("réponse vide");
  return text;
}

/** Charge les `detail` deja generes (news.json precedent) pour ne pas refaire. */
async function loadDetailCache() {
  const map = {};
  try {
    const prev = JSON.parse(await readFile(path.join(DATA_DIR, "news.json"), "utf8"));
    for (const it of prev.items || []) if (it.url && it.detail) map[it.url] = it.detail;
  } catch { /* pas de fichier precedent */ }
  return map;
}

async function enrichWithAI(items) {
  if (!GEMINI_KEY) {
    console.log("Pas de GEMINI_API_KEY -> reecriture IA ignoree.");
    return;
  }
  const cache = await loadDetailCache();
  let done = 0, fromCache = 0, failed = 0;
  for (const it of items) {
    if (cache[it.url]) { it.detail = cache[it.url]; fromCache++; continue; }
    if (!it.summary || it.summary.length < 30) continue; // pas assez de matiere
    try {
      it.detail = await aiRewrite(it.title, it.summary);
      done++;
      await sleep(AI_THROTTLE_MS);
    } catch (e) {
      failed++;
      console.warn(`  ⚠️ IA échouée (${it.title.slice(0, 40)}…) : ${e.message}`);
    }
  }
  console.log(`Reecriture IA : ${done} générés, ${fromCache} repris du cache, ${failed} échecs.`);
}

// ---------------------------------------------------------------------------
//  Programme principal
// ---------------------------------------------------------------------------

async function main() {
  const now = Date.now();
  let all = [];
  const usedCategories = [];

  for (const category of categories) {
    if (!category.enabled) continue;
    usedCategories.push({
      id: category.id,
      label: category.label,
      topics: category.topics.map(({ id, label, emoji }) => ({ id, label, emoji })),
    });
    console.log(`\n📡 Thematique « ${category.label} »`);
    const results = await Promise.all(category.feeds.map((f) => fetchFeed(f, category)));
    all.push(...results.flat());
  }

  console.log(`\nTotal brut : ${all.length} articles`);

  // Fenetre de l'edition : [hier cutoff, aujourd'hui cutoff[ (heure de Paris)
  const win = editionWindow(new Date(now), settings.timeZone, settings.editionCutoff);
  console.log(`Edition ${win.dateKey} : ${new Date(win.start).toISOString()} -> ${new Date(win.end).toISOString()}`);
  all = all.filter((it) => {
    const t = new Date(it.publishedAt).getTime();
    return !Number.isNaN(t) && t >= win.start && t < win.end;
  });
  console.log(`Apres fenetre d'edition : ${all.length}`);

  // Dedoublonnage
  all = dedupe(all);
  console.log(`Apres dedoublonnage : ${all.length}`);

  // Tri par date (recent -> ancien)
  all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  // Plafond par sport (preserve la diversite des disciplines)
  if (settings.maxItemsPerTopic > 0) {
    const perTopic = {};
    all = all.filter((it) => {
      perTopic[it.topic] = (perTopic[it.topic] || 0) + 1;
      return perTopic[it.topic] <= settings.maxItemsPerTopic;
    });
  }

  // Plafond global
  all = all.slice(0, settings.maxItemsPerDay);
  console.log(`Apres plafonds : ${all.length}`);

  await enrichWithAI(all); // ajoute le champ `detail` (page détail) si clé IA présente

  const dateKey = win.dateKey;
  const payload = {
    generatedAt: new Date().toISOString(),
    date: dateKey,
    categories: usedCategories,
    count: all.length,
    items: all,
  };

  await mkdir(HISTORY_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, "news.json"), JSON.stringify(payload, null, 2));
  await writeFile(path.join(HISTORY_DIR, `${dateKey}.json`), JSON.stringify(payload, null, 2));
  await updateHistoryIndex();

  console.log(`\n✅ Genere : ${all.length} articles pour le ${dateKey}`);
}

/** Met a jour l'index de l'historique ET supprime les jours de plus de 30 jours. */
async function updateHistoryIndex() {
  const files = (await readdir(HISTORY_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  files.sort().reverse(); // du plus recent au plus ancien
  const keep = files.slice(0, settings.historyDays);
  const drop = files.slice(settings.historyDays);

  // Suppression des fichiers trop vieux (> historyDays jours)
  for (const f of drop) {
    try {
      await unlink(path.join(HISTORY_DIR, f));
      console.log(`  🗑️  supprimé : ${f}`);
    } catch { /* ignore */ }
  }

  const index = [];
  for (const f of keep) {
    try {
      const data = JSON.parse(await readFile(path.join(HISTORY_DIR, f), "utf8"));
      index.push({ date: data.date, count: data.count });
    } catch {
      /* ignore */
    }
  }
  await writeFile(path.join(HISTORY_DIR, "index.json"), JSON.stringify(index, null, 2));
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
