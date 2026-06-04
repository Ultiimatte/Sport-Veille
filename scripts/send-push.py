#!/usr/bin/env python3
# Envoie la notification push du matin (alternance aleatoire des textes/emojis).
# Anti-doublon : une seule notif par "edition" (fichier marqueur .last-notified).
# Mode TEST : si la variable TEST_MESSAGE est fournie, envoie ce texte tout de
#   suite (+ emoji aleatoire), sans toucher au marqueur du matin.
# Les identifiants viennent des secrets GitHub (env). Sans secrets -> on ignore.
import os, sys, json, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "docs", "data")
MARKER = os.path.join(DATA, ".last-notified")

TEXTS = [
    "Ce qu'il ne fallait pas manquer hier.",
    "Résultats, exploits, transferts",
    "Les infos sport qui vont faire parler",
    "Les actus d'hier en un coup d'œil",
    "Que s'est-il passé hier ?",
    "Soyez au courant avant tout le monde",
    "Ça a bougé dans le monde du sport !",
    "Votre récap sport est prêt",
    "L'essentiel des dernières 24h",
    "Tout le sport, sans perte de temps",
    "Une journée chargée en émotions",
]
# Emojis ajoutés au hasard à la fin du texte (indépendamment du texte choisi).
EMOJIS = ["📣", "🏟️", "⚽", "🏀", "🎾", "🏉", "🏎️", "📰", "⏱️", "🔥", "📲"]

sub = os.environ.get("PUSH_SUBSCRIPTION", "").strip()
priv = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
subject = os.environ.get("VAPID_SUBJECT", "mailto:sportveille@example.com").strip()
test_msg = os.environ.get("TEST_MESSAGE", "").strip()

if not sub or not priv:
    print("Secrets push absents (PUSH_SUBSCRIPTION / VAPID_PRIVATE_KEY) -> envoi ignoré.")
    sys.exit(0)

from pywebpush import webpush, WebPushException
from py_vapid import Vapid01


# Titre = caractère invisible (espace de largeur nulle) : iOS n'affiche pas
# "SportVeille" comme titre, et ne reste que l'entête système "from SportVeille".
INVISIBLE_TITLE = "\u200b"

def send(body):
    webpush(
        subscription_info=json.loads(sub),
        data=json.dumps({"title": INVISIBLE_TITLE, "body": body}),
        vapid_private_key=Vapid01.from_raw(private_raw=priv.encode()),
        vapid_claims={"sub": subject},
    )


# --- Mode TEST : texte forcé, envoi immédiat, sans anti-doublon ---
if test_msg:
    try:
        body = f"{test_msg} {random.choice(EMOJIS)}"
        send(body)
        print("Notification de TEST envoyée :", body)
    except WebPushException as e:
        print("Echec du test :", repr(e))
    sys.exit(0)

# --- Envoi normal du matin (anti-doublon par édition) ---
try:
    edition = json.load(open(os.path.join(DATA, "news.json"), encoding="utf-8")).get("date", "")
except Exception:
    edition = ""

last = open(MARKER).read().strip() if os.path.exists(MARKER) else ""
if edition and edition == last:
    print(f"Déjà notifié pour l'édition {edition} -> rien à envoyer.")
    sys.exit(0)

try:
    send(f"{random.choice(TEXTS)} {random.choice(EMOJIS)}")
    open(MARKER, "w").write(edition)
    print(f"Notification envoyée pour l'édition {edition}.")
except WebPushException as e:
    print("Echec de l'envoi push :", repr(e))
    sys.exit(0)
