# 🏆 Sport Veille

Votre récapitulatif quotidien de l'actualité sportive, sous forme d'application web
installable sur iPhone (PWA). Le contenu est généré **automatiquement et gratuitement**
chaque nuit grâce à GitHub Actions, puis publié sur GitHub Pages.

- ✅ 100 % gratuit (aucune carte bancaire, aucun serveur à payer)
- ✅ Mise à jour automatique chaque nuit avant 9h (Paris)
- ✅ Couvre football, basket, tennis, rugby, F1, cyclisme, athlétisme, etc.
- ✅ Tri par sport, « marqué comme lu », historique des jours précédents
- ✅ Architecture modulaire (ajout futur de Tech, Finance, Business… facile)

---

## 📁 Structure du projet

```
config/sources.mjs        → thématiques + flux RSS (le seul fichier à éditer pour ajouter des sources)
scripts/build-news.mjs    → génère le récap (tourne sur GitHub, gratuitement)
docs/                     → le site web (servi par GitHub Pages)
  ├─ index.html, app.js, styles.css
  ├─ manifest.webmanifest, sw.js, icon.svg
  └─ data/news.json + data/history/*.json   ← généré automatiquement
.github/workflows/daily.yml → la tâche planifiée nocturne
```

---

## 🚀 Mise en ligne (à faire une seule fois)

### 1. Créer un compte GitHub
Rendez-vous sur [github.com](https://github.com) → **Sign up** (gratuit).

### 2. Créer un dépôt
En haut à droite : **+ → New repository**.
- Name : `sport-veille`
- Visibilité : **Public** (obligatoire pour GitHub Pages gratuit)
- Ne cochez rien d'autre → **Create repository**.

### 3. Envoyer le code
Dans le Terminal, depuis le dossier `SportVeille` :

```bash
git init
git add .
git commit -m "Première version de Sport Veille"
git branch -M main
git remote add origin https://github.com/VOTRE-PSEUDO/sport-veille.git
git push -u origin main
```
> Remplacez `VOTRE-PSEUDO` par votre identifiant GitHub.

### 4. Activer le site (GitHub Pages)
Dans le dépôt → **Settings → Pages** :
- **Source** : *Deploy from a branch*
- **Branch** : `main` / dossier **`/docs`** → **Save**

Au bout d'une minute, votre site est en ligne :
`https://VOTRE-PSEUDO.github.io/sport-veille/`

### 5. Activer la génération automatique
- Onglet **Actions** → si demandé, cliquez sur *I understand… enable workflows*.
- Pour générer le premier vrai récap **tout de suite** : Actions → *Récap sportif quotidien*
  → **Run workflow**.
- Ensuite, ça tourne tout seul chaque nuit.

### 6. Installer sur l'iPhone
Ouvrez l'URL dans **Safari** → bouton **Partager** → **« Sur l'écran d'accueil »**.
L'app apparaît comme une vraie application. ✅

---

## 🛠️ Personnaliser

### Ajouter / retirer une source
Éditez `config/sources.mjs`, section `feeds`. Exemple :
```js
{ name: "Mon média", url: "https://exemple.fr/rss.xml", topic: "" }
```
`topic: ""` = classement automatique par mots-clés ; sinon mettez un id de sport
(`"football"`, `"tennis"`…).

### Changer l'heure de génération
Dans `.github/workflows/daily.yml`, modifiez la ligne `cron` (en **UTC**).
Ex. `0 5 * * *` = 5h UTC.

### Ajouter une nouvelle thématique (Tech, Finance…)
Dans `config/sources.mjs`, ajoutez un objet dans `categories` avec ses `topics`
et ses `feeds`, et passez `enabled: true`. Rien d'autre à coder. 🎉

---

## 🔮 Évolutions prévues (phase 2)
- **Résumés par IA** + traduction des sources internationales : un emplacement est
  déjà prévu dans `scripts/build-news.mjs` (`enrichWithAI`).
- **Notifications push** à 9h (nécessite l'app installée sur l'écran d'accueil).

---

## 💻 Tester en local (optionnel)

**Sans rien installer** (juste pour voir le site, avec Python déjà présent sur Mac) :
```bash
python3 scripts/preview.py     # puis ouvrir http://localhost:8080
```

**Avec Node.js** (pour aussi régénérer les actualités) :
```bash
npm install
npm run build   # génère docs/data/news.json
npm run serve   # http://localhost:8080
```
> Le fichier `docs/data/news.json` livré contient déjà de vraies actualités
> récentes. GitHub le régénère automatiquement chaque nuit.
