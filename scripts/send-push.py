#!/usr/bin/env python3
# Envoie la notification push du matin (alternance aleatoire des 2 textes).
# Anti-doublon : une seule notif par "edition" (fichier marqueur .last-notified).
# Les identifiants viennent des secrets GitHub (env). Sans secrets -> on ignore.
import os, sys, json, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "docs", "data")
MARKER = os.path.join(DATA, ".last-notified")

TEXTS = [
    "Ce qu'il ne fallait pas manquer hier.",
    "Résultats, exploits, transferts : le résumé d'hier.",
    "Les infos sportives qui vont faire parler aujourd'hui",
    "Toute l'actualité sportive d'hier en un coup d'œil",
    "Le terrain a parlé hier. Voici ce qu'il faut retenir",
    "Soyez au courant avant tout le monde",
    "Ça a bougé dans le monde du sport hier",
    "Votre récap sport est prêt",
    "L'essentiel des dernières 24h sportives.",
    "Tout le sport, sans perte de temps",
    "Retour sur une journée chargée dans le sport",
]
# Emojis ajoutés au hasard à la fin du texte (indépendamment du texte choisi).
EMOJIS = ["📣", "🏟️", "⚽", "🏀", "🎾", "🏉", "🏎️", "📰", "⏱️", "🔥", "📲"]

sub = os.environ.get("PUSH_SUBSCRIPTION", "").strip()
priv = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
subject = os.environ.get("VAPID_SUBJECT", "mailto:sportveille@example.com").strip()

if not sub or not priv:
    print("Secrets push absents (PUSH_SUBSCRIPTION / VAPID_PRIVATE_KEY) -> envoi ignoré.")
    sys.exit(0)

# Edition du jour (date du news.json fraîchement généré)
try:
    edition = json.load(open(os.path.join(DATA, "news.json"), encoding="utf-8")).get("date", "")
except Exception:
    edition = ""

last = open(MARKER).read().strip() if os.path.exists(MARKER) else ""
if edition and edition == last:
    print(f"Déjà notifié pour l'édition {edition} -> rien à envoyer.")
    sys.exit(0)

from pywebpush import webpush, WebPushException
from py_vapid import Vapid01

payload = json.dumps({"title": f"{random.choice(TEXTS)} {random.choice(EMOJIS)}"})
try:
    webpush(
        subscription_info=json.loads(sub),
        data=payload,
        vapid_private_key=Vapid01.from_raw(private_raw=priv.encode()),
        vapid_claims={"sub": subject},
    )
    open(MARKER, "w").write(edition)
    print(f"Notification envoyée pour l'édition {edition}.")
except WebPushException as e:
    print("Echec de l'envoi push :", repr(e))
    # 404/410 = abonnement expiré (l'utilisateur devra réactiver). On ne casse pas le build.
    sys.exit(0)
