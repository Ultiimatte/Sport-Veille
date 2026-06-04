# PROJECT_CONTEXT.md — SportVeille

> Document de transmission complet pour reprendre le projet dans une nouvelle session
> Claude Code, sans accès à l'historique précédent. Rédigé le 2026-06-04.
> **Hypothèses déduites du code/conversation** sont signalées par 🟡.

---

## 1. Présentation du projet

- **Nom** : **SportVeille**
- **Objectif principal** : offrir à l'utilisateur (Adrien) un **récapitulatif quotidien de
  l'actualité sportive** des dernières 24 h, consultable chaque matin en moins de 5 minutes,
  sous forme d'application web installable sur iPhone (PWA).
- **Problème résolu** : éviter d'avoir à consulter de nombreux sites d'actu sportive ;
  centraliser, dédoublonner et résumer les informations importantes de la veille,
  multi-sports (pas seulement le football).
- **Public cible** : **usage strictement personnel** (une seule personne, Adrien).
  Pas de multi-utilisateurs, pas de comptes.
- **Fonctionnalités principales** :
  1. Récap quotidien d'articles (titre, résumé, sport, date/heure, image, lien source).
  2. Tri/filtrage par sport (pastilles).
  3. « Marquer comme lu » + compteur de non-lus ; les lus passent en bas.
  4. Historique des jours précédents + calendrier de sélection de date.
  5. Recherche d'articles (façon Spotlight) sur tout l'historique.
  6. Page **détail in-app** d'un article (image + texte complet/résumé + bouton vers la source).
  7. **Résumé IA** (Google Gemini gratuit) + lecture du texte complet des articles.
  8. **Notification push** chaque matin (Web Push iOS).
- **Vision globale** : un produit **gratuit, autonome, fiable**, qui se met à jour tout seul
  chaque matin avant 7 h, pensé **modulaire** pour ajouter d'autres thématiques plus tard
  (Tech, Finance, Business…) sans refonte.

---

## 2. Historique des décisions (et alternatives)

| Décision | Raison | Alternatives écartées |
|---|---|---|
| **PWA (site web installable)** plutôt qu'app native | 100 % gratuit, pas de compte développeur Apple (99 €/an), installable via un lien (Safari → écran d'accueil) | App Store (payant + public) ; sideload natif (expire tous les 7 j) |
| **Vanilla HTML/CSS/JS** (aucun framework) | Simplicité, zéro build, hébergement statique gratuit, débutant à l'aise | React/Vue (build, complexité inutile ici) |
| **Données = fichiers JSON statiques** (pas de base de données) | Gratuit, simple, généré par script et servi par GitHub Pages | BDD/serveur (coût, complexité) |
| **Hébergement GitHub Pages + génération GitHub Actions** | 100 % gratuit, automatisable | Vercel/Netlify (équivalent, mais GitHub déjà utilisé) |
| **Sources RSS françaises** | Résumés déjà en français, pas besoin de traduction | Sources internationales (nécessiteraient traduction IA) |
| **L'Équipe via API `dwh.lequipe.fr`** | Les anciennes URL `lequipe.fr/rss/*.xml` renvoient 404 ; cette API marche, riche en images et par sport | URLs RSS classiques (cassées) |
| **Pas d'IA payante au départ → puis Gemini GRATUIT** | L'utilisateur ne veut pas de coût. L'abonnement Claude (23 €) **ne donne pas** d'accès API ; l'API Anthropic serait facturée en plus | Claude API / OpenAI (payant) |
| **Fenêtre d'« édition figée » à 6h30** | L'utilisateur veut « les actus d'hier » : l'édition du jour J = articles publiés entre J-1 6h30 et J 6h30. Un article publié après 6h30 va dans l'édition du lendemain | Fenêtre glissante 24/36 h (incluait des actus du jour même) |
| **Fusion d'édition** (anti-perte) | Une re-génération tardive perdait les articles ayant défilé hors des flux RSS → on fusionne avec l'édition existante | Re-génération « from scratch » (perdait des articles) |
| **Déclencheur externe cron-job.org** (6h30 Paris) | Les crons GitHub sont **peu fiables** (retardés/sautés, parfois +12 h). cron-job.org appelle l'API GitHub à l'heure pile | GitHub cron seul (gardé en secours) |
| **Suivi « lu » par URL** (pas par hash) | Les hash différaient entre générateurs (Python seed vs Node), cassant l'état « lu ». L'URL est stable partout | Hash de l'URL (instable) |
| **Notifications push : titre « SportVeille » + message en description** | iOS ajoute « from SportVeille » (non supprimable). Décision finale de l'utilisateur : garder 3 lignes | Titre vide / message en titre (testés, abandonnés) |
| **Plafonds par sport (12) et par source (18)** | Éviter que football / L'Équipe ne monopolisent ; favoriser la diversité | Aucun plafond (peu varié) |
| **Généralistes traités AVANT L'Équipe** | Au dédoublonnage, la source traitée en premier « gagne » → plus de diversité de sources + souvent texte complet | L'Équipe en premier (écrasait les autres) |
| **Page détail = texte complet (verbatim) si dispo, sinon teaser ; liste = résumé IA court** | Texte complet ne nécessite pas d'IA (lecture de page) ; l'IA ne sert qu'au résumé court de la liste | Détail = résumé IA (perdait le texte) |

---

## 3. Architecture technique

- **Type** : application web statique (PWA) + script de génération de données exécuté en CI.
- **Frontend** : HTML/CSS/JavaScript **vanilla** (aucun framework). Single-page, rendu côté
  client par `docs/app.js` qui charge des JSON et génère le DOM.
- **PWA** : `manifest.webmanifest` + `sw.js` (Service Worker, stratégie **réseau-d'abord**,
  cache hors-ligne en secours). Version de cache actuelle : **`sport-veille-v20`** (à
  incrémenter à chaque modif des fichiers du shell).
- **Génération de données** : Node 20, script `scripts/build-news.mjs`, dépendance
  **`rss-parser`**. Lit les flux RSS, filtre, dédoublonne, classe par sport, télécharge les
  pages d'articles, résume via Gemini, écrit les JSON.
- **APIs / services externes** :
  - **Flux RSS** des médias sportifs FR (L'Équipe via `dwh.lequipe.fr/api/edito/rss`, Le Monde,
    France Info, 20 Minutes, Ouest-France, RFI).
  - **Google Gemini** (`generativelanguage.googleapis.com`, modèle `gemini-2.0-flash`,
    palier gratuit) pour les résumés.
  - **Web Push** (VAPID) via **`pywebpush`** (Python) pour les notifications.
  - **cron-job.org** (gratuit) qui déclenche le workflow GitHub chaque matin (6h30 Paris).
- **Base de données** : **aucune**. Les « données » = fichiers JSON dans `docs/data/`.
- **Hébergement** : **GitHub Pages** (dépôt `Ultiimatte/Sport-Veille`, dossier `/docs`,
  branche `main`). URL : **https://ultiimatte.github.io/Sport-Veille/** (⚠️ casse exacte).
- **Authentification** : **aucune** (usage personnel ; le site est techniquement public mais
  l'URL est obscure). Une option « code d'accès » a été évoquée mais non implémentée.
- **Déploiement** : l'utilisateur publie via **GitHub Desktop** (Commit + Push) — il est
  **débutant**, ne tape **pas** de commandes Git dans un terminal.
- **CI/CD** : `.github/workflows/daily.yml` (GitHub Actions) génère + envoie la notif + commit
  les données.

### Schéma de flux
```
cron-job.org (6h30) ──► GitHub Actions (daily.yml)
                          │ 1. npm install
                          │ 2. node build-news.mjs  ── lit RSS, lit pages d'articles,
                          │                            résume via Gemini ──► docs/data/*.json
                          │ 3. send-push.py (pywebpush) ──► notification iPhone
                          │ 4. git commit docs/data + push
                          ▼
                    GitHub Pages sert /docs ──► PWA sur l'iPhone (app.js lit news.json)
```

---

## 4. Structure du projet

```
SportVeille/
├── README.md                  Guide de déploiement (GitHub Desktop, Pages, iPhone)
├── PROJECT_CONTEXT.md         (ce fichier)
├── package.json               type:module, scripts build/serve, dépendance rss-parser
├── logo-sv.jpg                Image source du logo SV fournie par l'utilisateur
├── config/
│   └── sources.mjs            ★ CONFIG CENTRALE : catégories, sports (topics), flux RSS,
│                                 et `settings` (cutoff, plafonds, fuseau…). MODULAIRE.
├── scripts/
│   ├── build-news.mjs         ★ Générateur (Node) : RSS → filtre → dédoublonne → fenêtre
│   │                             d'édition → fusion → plafonds → lecture pages → IA → JSON.
│   ├── send-push.py           Envoi des notifications push (pywebpush) + mode TEST.
│   ├── preview.py             Petit serveur local Python (aperçu) — http://localhost:8080.
│   └── serve.mjs              Serveur local Node (aperçu) — nécessite Node.
├── docs/                      ★ RACINE DU SITE (servie par GitHub Pages)
│   ├── index.html             Structure : header (logo, date, refresh, loupe, back), filtres,
│   │                             contenu, overlay recherche, barre du bas (3 onglets).
│   ├── app.js                 ★ TOUTE la logique frontend (rendu, vues, recherche, détail,
│   │                             réglages, push subscribe, localStorage…).
│   ├── styles.css             ★ Styles (thème clair par défaut, palette #F9F9F7, serif logo).
│   ├── sw.js                  Service Worker (réseau-d'abord + handlers push/notificationclick).
│   ├── manifest.webmanifest   Manifeste PWA (icônes, couleurs, standalone).
│   ├── icon.svg               Favicon (monogramme SV, fond arrondi, image PNG base64 incrustée).
│   ├── apple-touch-icon.png   Icône écran d'accueil iOS (carré, 180px).
│   ├── icon-512.png           Icône manifeste (512px).
│   └── data/
│       ├── news.json          Édition du jour (généré). Lu par app.js au démarrage.
│       ├── .last-notified     Marqueur anti-doublon de notif (date de la dernière notif).
│       └── history/
│           ├── index.json     Liste [{date, count}] des éditions disponibles (≤ 30 jours).
│           └── YYYY-MM-DD.json Une édition archivée par jour.
├── .github/workflows/
│   └── daily.yml              Workflow : génération + push + commit. Cron + déclenchement manuel.
├── .claude/
│   ├── launch.json            Config d'aperçu (Claude Preview) → scripts/preview.py.
│   └── settings.local.json    Réglages locaux Claude (gitignoré).
├── captures-evolution/        Captures d'écran de l'évolution visuelle + README.txt.
└── .gitignore / .gitattributes
```

**Relations** : `config/sources.mjs` est importé par `build-news.mjs` (Node). Le frontend
(`docs/`) ne dépend **pas** de la config ; il consomme uniquement les JSON générés.
`send-push.py` lit `docs/data/news.json` (date d'édition) et les secrets d'environnement.

---

## 5. Fonctionnalités implémentées

### 5.1 Génération quotidienne du récap — ✅ fonctionnel
- **Description** : lit les flux RSS, normalise, filtre sur la fenêtre d'édition, dédoublonne,
  classe par sport, applique les plafonds, écrit `news.json` + historique.
- **Fichiers** : `scripts/build-news.mjs`, `config/sources.mjs`, `.github/workflows/daily.yml`.
- **Dépendances** : `rss-parser`, Node 20, GitHub Actions.
- **Points d'attention** : fenêtre d'édition figée à 6h30 (voir §7). Idempotent grâce à la
  fusion d'édition + cache.

### 5.2 Lecture du texte d'article + résumé IA — ✅ fonctionnel (clé requise)
- **Description** : pour chaque article, télécharge la page (`fetchArticleText`), extrait les
  `<p>` ; si texte ≥ 1200 caractères → `detail` = texte complet + `summary` = résumé Gemini
  (~5 lignes) ; sinon `detail` = teaser, `summary` = extrait coupé.
- **Fichiers** : `build-news.mjs` (`fetchArticleText`, `callGemini`, `aiSummarize5`,
  `enrichArticles`), `docs/app.js` (`renderArticle`).
- **Dépendances** : secret **`GEMINI_API_KEY`** (sinon résumé = extrait court, détail = texte
  brut quand même).
- **Points d'attention** : sources **payantes** (L'Équipe, Le Monde) = teaser seulement ;
  **Ouest-France** flux trop court (~40 min), **RFI** lent. Throttle 4,5 s entre appels IA.
  Risque d'imprécision IA → mention « reformulé automatiquement » retirée car le détail est
  désormais le texte source verbatim.

### 5.3 Affichage liste + filtres + non-lus — ✅ fonctionnel
- **Fichiers** : `app.js` (`renderToday`, `renderFilters`, `cardHtml`), `styles.css`.
- Compteur « X actualités (Y non lus) » ; les lus passent en bas (`sortReadLast`).

### 5.4 Page détail in-app — ✅ fonctionnel
- **Description** : clic sur une carte (ou un résultat de recherche) → vue `article` :
  en-tête réduit (bouton retour + logo seuls), image, titre, **paragraphes justifiés et
  espacés**, bouton « Lire l'article sur <source> ↗ ». Masque date/refresh/loupe/filtres/barre du bas.
- **Fichiers** : `app.js` (`renderArticle`, `openDetail`, `openDetailByKey`, `goBackFromArticle`),
  `styles.css` (`.article*`, `body.is-article`), `index.html` (bouton `#backBtn`).

### 5.5 Recherche façon Spotlight — ✅ fonctionnel
- **Description** : loupe en haut → overlay (voile gris #A6A6A6) + boîte sombre ;
  recherche sur **tout l'historique** (`buildCorpus`) ; résultats triés récent→ancien,
  affichant « Sport · JJ/MM » puis titre ; clic → page détail.
- **Fichiers** : `app.js` (`openSearch`, `renderSearchResults`, `buildCorpus`), `styles.css`
  (`.search-*`), `index.html` (`#searchOverlay`).

### 5.6 Historique + calendrier — ✅ fonctionnel
- **Fichiers** : `app.js` (`renderHistory`, `loadHistoryIndex`, `loadHistoryDay`,
  date picker via `#datePicker` overlay), purge auto > 30 jours dans `build-news.mjs`.

### 5.7 Réglages — ✅ fonctionnel
- Onglet en bas. Thème (auto/clair/sombre, **clair par défaut**), heure préférée (cosmétique),
  bouton « Activer les notifications », tout marquer lu, réinitialiser les lus.

### 5.8 Notifications push — ✅ fonctionnel (réglage requis)
- **Description** : opt-in dans Réglages (`enableNotifications`) → `PushManager.subscribe`
  (clé VAPID publique) → affiche l'abonnement à copier dans le secret `PUSH_SUBSCRIPTION`.
  Envoi matinal par `send-push.py` (étape du workflow). 11 textes + 11 emojis tirés au hasard.
  Anti-doublon via `docs/data/.last-notified`. **Mode TEST** : `workflow_dispatch` avec input
  `message` (texte forcé, ignore l'anti-doublon).
- **Fichiers** : `docs/sw.js` (push/notificationclick), `docs/app.js` (`VAPID_PUBLIC`,
  `enableNotifications`), `scripts/send-push.py`, `.github/workflows/daily.yml`.
- **Dépendances** : iOS **16.4+** + app installée sur l'écran d'accueil ; secrets
  `VAPID_PRIVATE_KEY`, `PUSH_SUBSCRIPTION`, `VAPID_SUBJECT`.

### 5.9 PWA / hors-ligne / installation — ✅ fonctionnel
- `sw.js` réseau-d'abord (cache de secours). Zoom bloqué (`user-scalable=no` + `touch-action`).

### 5.10 Logo / identité — ✅ fonctionnel
- Monogramme « SV » (depuis `logo-sv.jpg`), recoloré `#F9F9F7` sur fond dégradé noir→gris.
  Généré via Pillow (script jetable). 3 fichiers : `icon.svg`, `apple-touch-icon.png`, `icon-512.png`.

---

## 6. Fonctionnalités restantes / idées

| Fonctionnalité | Priorité | Difficulté | Dépendances |
|---|---|---|---|
| **Vérifier la diversité des sources** après le dernier correctif (fusion + généralistes 1ers + plafond 18) | 🔴 Haute | Faible | Un run de génération + observation |
| Améliorer la propreté du texte verbatim (retirer « créez un compte… », signatures) | 🟠 Moyenne | Moyenne | Heuristiques d'extraction par site |
| Code d'accès (mot de passe) pour vraie confidentialité | 🟢 Basse | Faible | — |
| Nouvelles thématiques (Tech, Finance, Business) | 🟢 Basse | Moyenne | Ajouter une `category` dans `config/sources.mjs` |
| Traduction de sources internationales (via IA) | 🟢 Basse | Moyenne | Gemini |
| Meilleure couverture Ouest-France/RFI (flux problématiques) | 🟢 Basse | Élevée | Autres flux ou scraping |
| Recréer le prototype « bleu » d'origine pour la galerie (non sauvegardé en Git) | 🟢 Très basse | Faible | — |

---

## 7. État actuel du développement

### Ce qui fonctionne parfaitement
- PWA installable, génération auto, push, recherche, page détail, historique, calendrier,
  filtres, non-lus, logo, thème clair, zoom bloqué, résumé IA + texte complet (sources ouvertes).

### Partiellement terminé / à surveiller
- **Diversité des sources** : un correctif vient d'être posé (fusion d'édition + généralistes
  traités en premier + plafond 18/source). **À VÉRIFIER après un nouveau run** : avant le
  correctif, une édition régénérée l'après-midi tombait à ~27 articles dont ~24 L'Équipe.
- **Clé Gemini** : l'utilisateur a un secret `GEMINI_API_KEY` dont la clé commence par `AQ.A`
  (il affirme que c'est le nouveau format Google — 🟡 à confirmer via le log du run
  « Enrichissement : … IA X ok / Y échecs »).

### Bugs connus / limitations
- **Run tardif** : sans la fusion (désormais corrigée), une régénération l'après-midi perdait
  des articles ayant défilé hors des flux. Corrigé par `mergePreviousEdition`.
- **Ouest-France** ne garde que ~40 min d'articles → quasi jamais capté ; **RFI** flux périmé.
- **Sources payantes** (L'Équipe, Le Monde) : page détail = teaser seulement.
- **iOS** ajoute « from SportVeille » à la notif (non supprimable) → 3 lignes affichées.
- Le **texte verbatim** peut contenir des parasites (signatures, « créez un compte… »).
- **Crons GitHub peu fiables** → la fiabilité repose sur **cron-job.org** (6h30 Paris).

---

## 8. Conventions du projet

- **Langue** : tout en **français** (UI, commentaires, messages, commits). L'utilisateur est
  francophone et **débutant** : lui parler simplement, le guider pas-à-pas, privilégier le
  **gratuit** et le **simple**.
- **Style de code** : JS vanilla, fonctions courtes, `const`/`let`, template literals,
  optional chaining. Pas de framework, pas de bundler.
- **Sécurité XSS** : tout texte injecté dans le DOM passe par `escapeHtml()`.
- **Suivi « lu »** : clé = **URL de l'article** (`readKey(item)`), jamais un hash.
- **Service Worker** : à **chaque** modif d'un fichier du shell (`index.html`, `app.js`,
  `styles.css`, `sw.js`…), **incrémenter `CACHE`** dans `sw.js` (`sport-veille-vN`).
- **Données générées** : ne JAMAIS régénérer en local et committer (risque de conflit Git avec
  les commits automatiques du workflow). Laisser le workflow gérer `docs/data/`.
- **Déploiement** : l'utilisateur fait **Commit + Push via GitHub Desktop**. Lui fournir des
  étapes copier-coller, jamais de commandes terminal complexes.
- **Validation** : Node n'est **pas installé en local** ; valider la syntaxe JS via
  JavaScriptCore (`osascript -l JavaScript`) — voir les Bash de la session. Python 3.9 et
  `pip` sont dispo (Pillow, pywebpush installés). Chrome est installé (captures headless).
- **Aperçu** : l'aperçu in-harness est **bloqué par macOS TCC** car le projet est sur le
  **Bureau** ; servir une copie dans `/tmp/sv-preview` (voir `.claude/launch.json` /
  `scripts/preview.py`). L'utilisateur, lui, peut lancer `python3 scripts/preview.py`.

---

## 9. Variables et configuration

### Secrets GitHub Actions (Settings → Secrets and variables → Actions) — valeurs NON affichées
| Nom | Rôle |
|---|---|
| `GEMINI_API_KEY` | Clé API Google Gemini (palier gratuit) pour les résumés. |
| `VAPID_PRIVATE_KEY` | Clé privée VAPID (Web Push). La **clé publique** correspondante est en clair dans `docs/app.js` (`VAPID_PUBLIC`). |
| `PUSH_SUBSCRIPTION` | Abonnement push du téléphone (JSON copié depuis Réglages → Activer). |
| `VAPID_SUBJECT` | `mailto:` de contact pour VAPID. |

### Configuration applicative — `config/sources.mjs` → objet `settings`
```
editionCutoff:     "06:30"        // heure de coupure des éditions (Europe/Paris)
maxItemsPerDay:    80             // plafond global d'articles
maxItemsPerTopic:  12             // plafond par sport
maxItemsPerSource: 18             // plafond par média (anti-monopole)
summaryMaxChars:   1200           // longueur max de l'extrait RSS conservé
historyDays:       30             // jours d'historique conservés (purge auto au-delà)
timeZone:          "Europe/Paris"
```
Constantes IA (dans `build-news.mjs`) : `GEMINI_MODEL = "gemini-2.0-flash"`,
`AI_THROTTLE_MS = 4500`, `FULL_ACCESS_MIN = 1200`, `LIST_SUMMARY_MAX = 320`.

### Services à connecter pour un fonctionnement complet
1. **cron-job.org** : job quotidien 6h30 (Europe/Paris) → POST sur
   `https://api.github.com/repos/Ultiimatte/Sport-Veille/actions/workflows/daily.yml/dispatches`
   avec body `{"ref":"main"}` et en-têtes `Authorization: Bearer <PAT GitHub fine-grained
   Actions:write>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`.
2. **GitHub Pages** : Settings → Pages → Deploy from branch `main` / dossier `/docs`.
3. **Google AI Studio** : créer la clé Gemini → secret `GEMINI_API_KEY`.

---

## 10. « Base de données » (modèle de données JSON)

Pas de SGBD. Données = fichiers JSON. Schéma d'une **édition** (`news.json` ou
`history/YYYY-MM-DD.json`) :
```jsonc
{
  "generatedAt": "ISO 8601",          // instant de génération
  "date": "YYYY-MM-DD",               // date de l'édition (= jour de coupure)
  "categories": [                     // pour l'affichage des libellés/emojis
    { "id": "sport", "label": "Sport", "topics": [ {id,label,emoji}, ... ] }
  ],
  "count": 80,
  "items": [
    {
      "id": "string",                 // hash (legacy) — NON utilisé pour le "lu"
      "title": "string",
      "summary": "string",            // résumé COURT (liste) : IA si article entier, sinon extrait
      "detail": "string",             // texte LONG (page détail) : article complet ou teaser
      "category": "sport",
      "topic": "football",            // id du sport
      "source": "L'Equipe",           // nom du média
      "url": "https://…",             // ★ clé de déduplication ET de suivi "lu"
      "image": "https://… | null",
      "publishedAt": "ISO 8601 | null"
    }
  ]
}
```
- `history/index.json` : `[{ "date": "YYYY-MM-DD", "count": N }, ...]` (récent → ancien, ≤ 30).
- `.last-notified` : texte brut = date de l'édition déjà notifiée (anti-doublon push).
- **Contraintes métier** : unicité par `url` ; dates dans `[J-1 6h30, J 6h30[` (Europe/Paris) ;
  ≤ `maxItemsPerTopic` par sport, ≤ `maxItemsPerSource` par média, ≤ `maxItemsPerDay` au total.
- **Stockage côté client** : `localStorage` → `sv_read_ids` (tableau d'URLs lues),
  `sv_settings` (`{theme, notifyTime}`).

---

## 11. API et intégrations

- **Pas de backend/API propre.** Le frontend ne fait que `fetch` de fichiers statiques :
  `data/news.json`, `data/history/index.json`, `data/history/<date>.json` (tous en
  `cache: no-store`).
- **Flux RSS consommés** (par `build-news.mjs`) :
  - L'Équipe : `https://dwh.lequipe.fr/api/edito/rss?path=/<Sport>/` (15 sports).
  - `https://www.lemonde.fr/sport/rss_full.xml`
  - `https://www.franceinfo.fr/sports.rss`
  - `https://www.20minutes.fr/feeds/rss-sport.xml`
  - `https://www.ouest-france.fr/rss/sport`
  - `https://www.rfi.fr/fr/sports/rss`
- **Gemini** : `POST .../v1beta/models/gemini-2.0-flash:generateContent?key=<KEY>`,
  body `{contents:[{parts:[{text}]}], generationConfig:{temperature, maxOutputTokens}}`.
  Réponse : `candidates[0].content.parts[0].text`. Limites gratuites largement suffisantes
  (~70 articles/jour, throttle 4,5 s).
- **Web Push** : déclenché par `send-push.py` (pywebpush + VAPID). Le SW gère `push`
  (affiche la notif) et `notificationclick` (ouvre l'app). iOS impose l'en-tête « from … ».
- **GitHub API** : `cron-job.org` déclenche `workflow_dispatch` (voir §9).
- **Limitations** : sites payants/anti-bot (403, paywall) → texte partiel ; pas d'auth.

---

## 12. Journal des avancées (chronologique)

1. **Cadrage** (questions à l'utilisateur) : PWA, pas de push au début, pas d'IA payante,
   sources FR, GitHub gratuit.
2. **V1** : générateur RSS + PWA statique + workflow + données de démo, puis vraies sources FR
   testées (L'Équipe API + généralistes). Déploiement GitHub Pages guidé pas-à-pas.
3. **Refonte design** : palette crème/serif « SportVeille », pastille date, boutons ronds,
   filtres épurés, mode clair par défaut, blocage du zoom.
4. **Logo SV** : d'abord police, puis monogramme fourni par l'utilisateur (`logo-sv.jpg`)
   recoloré `#F9F9F7` sur fond dégradé.
5. **Cache réseau-d'abord** (fini les versions figées), corrections « lu » (par URL),
   suppression onglet « Par sport », calendrier, compteur non-lus, date+heure des articles.
6. **Fenêtre d'édition 6h30** + purge 30 jours.
7. **Fiabilité génération** : cron-job.org (6h30) car crons GitHub peu fiables.
8. **Notifications push** : VAPID, SW, `send-push.py`, mode test, 11 textes + 11 emojis,
   anti-doublon, ajustements du format (titre/description).
9. **Recherche Spotlight** (sur tout l'historique) + **Réglages déplacés en bas**.
10. **Page détail in-app** + **IA Gemini** : lecture des pages d'articles, résumé liste +
    texte complet en détail, paragraphes justifiés/espacés, recherche → détail.
11. **Diversité des sources** : plafond par source + fusion d'édition (anti-perte) +
    généralistes traités en premier — **dernier correctif, à vérifier après un run**.
12. **Captures d'évolution** générées (dossier `captures-evolution/`) + ce document.

---

## 13. Tâches prioritaires pour la prochaine session (checklist)

1. ☐ **Confirmer le déploiement** du dernier correctif (fusion + généralistes 1ers +
   plafond 18) : `git status` ; si non poussé, guider l'utilisateur pour **Commit + Push**.
2. ☐ **Lancer un run** (Actions → « Récap sportif quotidien » → Run workflow, champ test vide)
   puis vérifier dans `news.json` la **répartition par source** (doit être variée, pas ~24 L'Équipe).
3. ☐ Vérifier le **log du run** : ligne `Enrichissement : … IA X ok / Y échecs` (clé Gemini OK ?).
4. ☐ Vérifier sur le téléphone : page détail (texte + paragraphes espacés/justifiés),
   recherche → ouvre bien la page détail.
5. ☐ Si la diversité reste insuffisante : ajuster `maxItemsPerSource` (ex. 20-25) ou revoir
   le classement par mots-clés des généralistes.
6. ☐ (Optionnel) nettoyer le texte verbatim (signatures, « créez un compte »).
7. ☐ (Optionnel) proposer le **code d'accès** si confidentialité souhaitée.

---

## 14. Instructions pour le prochain Claude Code

- **Objectif** : PWA perso de récap sportif quotidien, **gratuite et autonome**. Lis d'abord
  ce fichier, puis `config/sources.mjs`, `scripts/build-news.mjs`, `docs/app.js`, `docs/sw.js`.
- **État actuel** : tout fonctionne ; le seul point chaud est la **diversité des sources**
  (correctif récent à vérifier après un run). Cache SW = **v20**.
- **Pièges à éviter** :
  1. **Ne régénère pas `docs/data/` en local pour le committer** → conflits Git avec le workflow.
  2. **Incrémente `CACHE` dans `sw.js`** dès que tu touches au shell, sinon l'utilisateur ne
     voit pas les changements.
  3. **Node n'est pas installé en local** : valide le JS via `osascript -l JavaScript`
     (exemple dans l'historique des Bash). Sers les aperçus depuis `/tmp` (TCC bloque le Bureau).
  4. **L'utilisateur déploie via GitHub Desktop** : donne des étapes simples, jamais de Git CLI.
  5. **iOS** : impossible de retirer « from SportVeille » des notifs ; n'essaie pas de
     « réparer » ça, c'est une limite système (décision figée).
  6. La **clé Gemini en `AQ.A`** est, selon l'utilisateur, valide → ne pas la « corriger » sans
     preuve (vérifier via le log du run).
- **Décisions à NE PAS remettre en question sans bonne raison** : PWA (pas d'app native),
  pas d'IA payante (Gemini gratuit), fenêtre d'édition figée à 6h30, suivi « lu » par URL,
  hébergement GitHub Pages, déploiement via GitHub Desktop, tout en français.
- **Méthode recommandée** : (1) comprendre la demande, poser des questions si ambigu ;
  (2) modifier le code ; (3) valider la syntaxe (JavaScriptCore) ; (4) incrémenter le cache SW
  si besoin ; (5) prévisualiser via Chrome headless ou `/tmp` si pertinent ; (6) donner à
  l'utilisateur les étapes **Commit + Push** (et Run workflow si la génération est concernée).
- **Mémoire persistante** : voir `~/.claude/projects/-Users-adrien-Desktop-SportVeille/memory/`
  (`project-sportveille.md`, `user-adrien.md`) — à tenir à jour.

---

## 15. Résumé exécutif (~600 mots)

**SportVeille** est une application web personnelle (PWA) qui fournit chaque matin, à
l'utilisateur Adrien, un récapitulatif de l'actualité sportive française des dernières 24 heures,
consultable en moins de cinq minutes sur son iPhone. Le produit doit être **gratuit, fiable et
autonome** : il se met à jour tout seul chaque matin avant 7 heures, sans serveur payant ni
maintenance manuelle. Il couvre un large éventail de sports (football, tennis, rugby, basket,
cyclisme, F1, etc.), pas seulement le football, et permet de filtrer par discipline, de marquer
les articles lus, de consulter l'historique des jours précédents, de rechercher un article, et
de lire une **page détail in-app** avec le texte de l'article et un lien vers la source.

**Architecture** : il n'y a **ni framework, ni base de données, ni backend**. Le site est du
**HTML/CSS/JavaScript vanilla** hébergé gratuitement sur **GitHub Pages** (dépôt
`Ultiimatte/Sport-Veille`, dossier `/docs`). Les données sont des **fichiers JSON statiques**
générés chaque matin par un script Node (`scripts/build-news.mjs`) exécuté dans **GitHub
Actions**. Ce script lit des **flux RSS** de médias sportifs FR (L'Équipe via l'API
`dwh.lequipe.fr`, Le Monde, France Info, 20 Minutes, Ouest-France, RFI), filtre les articles
selon une **« fenêtre d'édition » figée** (de la veille 6h30 à aujourd'hui 6h30, fuseau
Europe/Paris — ainsi un article publié après 6h30 va dans l'édition du lendemain), dédoublonne,
classe par sport, applique des plafonds (12/sport, 18/source, 80 au total), **télécharge la
page de chaque article** pour en extraire le texte, et utilise **Google Gemini (palier
gratuit)** pour produire un résumé court (affiché en liste) tout en conservant le texte complet
(affiché en page détail, sans IA). Le résultat est écrit dans `docs/data/news.json` et archivé
dans `docs/data/history/`. La fiabilité du déclenchement matinal repose sur **cron-job.org**
(les crons internes de GitHub étant peu fiables), qui appelle l'API GitHub à 6h30.

**Notifications** : l'app envoie une **notification push** chaque matin via Web Push (VAPID,
`pywebpush` dans le workflow). Cela nécessite iOS 16.4+, l'app installée sur l'écran d'accueil,
et trois secrets GitHub (`VAPID_PRIVATE_KEY`, `PUSH_SUBSCRIPTION`, `VAPID_SUBJECT`) ; la clé
VAPID publique est en clair dans `app.js`. Le texte alterne aléatoirement parmi 11 phrases et
11 emojis, avec un anti-doublon (`docs/data/.last-notified`) et un mode test via l'input
`message` du `workflow_dispatch`.

**Frontend** : `docs/app.js` contient toute la logique (rendu des vues *today/history/
settings/article*, recherche, page détail, réglages, abonnement push, `localStorage`). Le
**Service Worker** (`sw.js`) est en **réseau-d'abord** (cache de secours hors-ligne) ; son
numéro de version (`sport-veille-v20`) doit être incrémenté à chaque modification du shell.
Le thème est **clair par défaut** (palette `#F9F9F7`, logo serif « SportVeille »), le zoom est
bloqué, et le suivi « lu » est basé sur **l'URL** de l'article (stable).

**Décisions clés à respecter** : PWA (pas d'app native, trop chère/contraignante), pas d'IA
payante (l'abonnement Claude de l'utilisateur ne donne pas d'accès API → on utilise Gemini
gratuit), tout en français, déploiement par **GitHub Desktop** (l'utilisateur est débutant et
ne tape pas de commandes Git). **Contraintes d'environnement** : Node n'est pas installé en
local (valider le JS via JavaScriptCore), l'aperçu est bloqué par macOS TCC sur le Bureau
(servir depuis `/tmp`), Chrome est disponible pour des captures headless.

**Point chaud actuel** : la **diversité des sources**. Un bug faisait tomber l'édition à ~27
articles (dont ~24 L'Équipe) quand la génération tournait l'après-midi (les flux des autres
médias avaient « défilé »). Correctif posé : **fusion** de l'édition existante (on ne perd plus
les articles déjà captés), **traitement des généralistes en premier** (ils gagnent au
dédoublonnage) et **plafond de 18/source**. **À vérifier après un nouveau run.** Le reste du
produit est stable et complet.
