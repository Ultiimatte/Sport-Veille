// =============================================================================
//  CONFIGURATION DES THEMES ET DES SOURCES
// -----------------------------------------------------------------------------
//  Architecture modulaire : pour ajouter une nouvelle thematique (Business,
//  Tech, Finance...), il suffit d'ajouter une entree dans `categories` avec
//  ses sports/rubriques et ses flux RSS. Aucune autre partie du code n'a
//  besoin d'etre modifiee.
//
//  Champs d'une rubrique (topic) :
//    - id      : identifiant unique (sans espace)
//    - label   : nom affiche
//    - emoji   : pictogramme affiche dans l'interface
//    - keywords: mots-cles servant a classer les articles des flux generaux
//
//  Champs d'une source (feed) :
//    - name    : nom du media (affiche)
//    - url     : URL du flux RSS
//    - topic   : id de la rubrique si le flux est mono-thematique
//                (ex: un flux 100% Football). Laisser vide ('') pour un flux
//                generaliste : les articles seront classes via les keywords.
// =============================================================================

export const categories = [
  {
    id: "sport",
    label: "Sport",
    enabled: true,
    // ---- Rubriques (sports) -------------------------------------------------
    topics: [
      { id: "football",   label: "Football",          emoji: "⚽", keywords: [
        "football", "foot", "ligue 1", "ligue 2", "ligue des champions", "ligue europa", "champions league",
        "coupe du monde", "mondial", "euro", "equipe de france", "les bleus", "deschamps", "mbappe", "mbappé",
        "psg", "paris saint-germain", "marseille", "lyon", "monaco", "lille", "lens", "rennes", "nice", "brest",
        "brestois", "nantes", "strasbourg", "toulouse", "reims", "montpellier", "auxerre",
        "real madrid", "barca", "barcelone", "manchester", "liverpool", "arsenal", "chelsea", "bayern", "city",
        "premier league", "liga", "serie a", "bundesliga", "mercato", "transfert", "buteur", "gardien",
        "selectionneur", "fifa", "uefa", "ballon d'or", "attaquant", "milieu", "defenseur", "penalty"] },
      { id: "basket",     label: "Basketball",        emoji: "🏀", keywords: ["basket", "basketball", "nba", "euroleague", "betclic elite", "lebron", "wembanyama", "dunk", "playoffs nba", "asvel", "monaco basket"] },
      { id: "tennis",     label: "Tennis",            emoji: "🎾", keywords: ["tennis", "roland-garros", "roland garros", "wimbledon", "us open", "open d'australie", "atp", "wta", "djokovic", "alcaraz", "sinner", "swiatek", "sabalenka", "parry"] },
      { id: "rugby",      label: "Rugby",             emoji: "🏉", keywords: ["rugby", "xv de france", "top 14", "pro d2", "six nations", "stade toulousain", "stade francais", "racing 92", "la rochelle", "mêlée"] },
      { id: "f1",         label: "Formule 1",         emoji: "🏎️", keywords: ["formule 1", "f1", "grand prix", "verstappen", "hamilton", "leclerc", "ferrari", "mclaren", "mercedes", "red bull", "pole position", "qualifications", "grille de depart"] },
      { id: "cyclisme",   label: "Cyclisme",          emoji: "🚴", keywords: ["cyclisme", "tour de france", "vuelta", "giro", "pogacar", "vingegaard", "maillot jaune", "peloton", "contre-la-montre", "velo"] },
      { id: "athletisme", label: "Athletisme",        emoji: "🏃", keywords: ["athletisme", "marathon", "sprint", "saut", "perche", "diamond league", "championnats du monde d'athletisme", "100 metres", "relais"] },
      { id: "natation",   label: "Natation",          emoji: "🏊", keywords: ["natation", "nageur", "nageuse", "bassin", "marchand", "papillon", "brasse", "crawl"] },
      { id: "handball",   label: "Handball",          emoji: "🤾", keywords: ["handball", "starligue", "lidl starligue", "ehf", "championnat du monde de handball"] },
      { id: "volley",     label: "Volleyball",        emoji: "🏐", keywords: ["volley", "volleyball", "ligue des nations de volley", "beach-volley"] },
      { id: "combat",     label: "Sports de combat",  emoji: "🥊", keywords: ["mma", "ufc", "boxe", "boxeur", "judo", "karate", "lutte", "taekwondo", "knockout", "octogone", "ring", "combat"] },
      { id: "esport",     label: "Esports",           emoji: "🎮", keywords: ["esport", "e-sport", "league of legends", "valorant", "counter-strike", "cs2", "dota", "rocket league", "karmine corp"] },
      { id: "jo",         label: "Jeux Olympiques",   emoji: "🏅", keywords: ["jeux olympiques", "olympique", "olympiques", "cio", "paralympique", "paralympiques", "flamme olympique"] },
      { id: "autre",      label: "Autres sports",     emoji: "🏆", keywords: ["golf", "ski", "biathlon", "voile", "equitation", "escrime", "aviron", "surf", "skateboard", "patinage"] },
    ],
    // ---- Flux RSS -----------------------------------------------------------
    //  Le script tolere les flux indisponibles : il les ignore et continue.
    //  On melange des flux mono-sport (topic precise) et des flux generalistes
    //  (topic vide -> classement automatique par mots-cles).
    feeds: [
      // L'Equipe -- flux par sport (classement direct, riche en images).
      // URL testees le 2026-06-01 (API dwh.lequipe.fr).
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Football/",         topic: "football" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Tennis/",           topic: "tennis" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Rugby/",            topic: "rugby" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Basket/",           topic: "basket" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Cyclisme/",         topic: "cyclisme" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Formule-1/",        topic: "f1" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Athletisme/",       topic: "athletisme" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Natation/",         topic: "natation" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Handball/",         topic: "handball" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Volley-Ball/",      topic: "volley" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Boxe/",             topic: "combat" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Sports-de-combat/", topic: "combat" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Esport/",           topic: "esport" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Golf/",             topic: "autre" },
      { name: "L'Equipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Ski/",              topic: "autre" },

      // Flux generalistes FR (riches en resume texte) -> classement par mots-cles.
      { name: "Le Monde",      url: "https://www.lemonde.fr/sport/rss_full.xml",         topic: "" },
      { name: "France Info",   url: "https://www.franceinfo.fr/sports.rss",              topic: "" }, // URL finale (evite la redirection francetvinfo)
      { name: "20 Minutes",    url: "https://www.20minutes.fr/feeds/rss-sport.xml",      topic: "" },
      { name: "Ouest-France",  url: "https://www.ouest-france.fr/rss/sport",             topic: "" },
      { name: "RFI Sport",     url: "https://www.rfi.fr/fr/sports/rss",                  topic: "" },
    ],
  },

  // -------------------------------------------------------------------------
  //  EXEMPLE de thematique future (desactivee). Pour l'activer plus tard :
  //  passer enabled a true et completer les flux.
  // -------------------------------------------------------------------------
  // {
  //   id: "tech",
  //   label: "Technologie",
  //   enabled: false,
  //   topics: [
  //     { id: "ia",      label: "Intelligence artificielle", emoji: "🤖", keywords: ["ia", "intelligence artificielle", "llm", "openai", "anthropic"] },
  //     { id: "startup", label: "Startups",                  emoji: "🚀", keywords: ["startup", "levee de fonds", "scale-up"] },
  //   ],
  //   feeds: [
  //     // { name: "...", url: "https://.../rss", topic: "" },
  //   ],
  // },
];

// Parametres globaux de generation
export const settings = {
  // Heure de coupure des "editions" (heure locale Paris).
  // L'edition du jour J = articles publies entre J-1 <cutoff> et J <cutoff>.
  // Ainsi un article publie APRES la coupure ira dans l'edition du lendemain,
  // quelle que soit l'heure reelle de generation.
  editionCutoff: "06:30",
  // Nombre maximum d'articles conserves par jour (apres tri).
  maxItemsPerDay: 80,
  // Plafond par sport, pour preserver la diversite (eviter que le football
  // ne monopolise tout le recap). Mettre 0 pour desactiver.
  maxItemsPerTopic: 12,
  // Longueur maximale du resume (caracteres). La liste tronque a ~10 lignes
  // (CSS) ; la page detail affiche tout. On garde donc plus de texte ici.
  summaryMaxChars: 1200,
  // Nombre de jours d'historique conserves.
  historyDays: 30,
  // Fuseau utilise pour calculer la "date du jour" du recap.
  timeZone: "Europe/Paris",
};
