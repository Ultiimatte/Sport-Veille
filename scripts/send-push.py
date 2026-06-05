#!/usr/bin/env python3
# Envoie la notification push du matin via OneSignal (alternance aleatoire des
# textes/emojis). OneSignal stocke lui-meme tous les abonnes : on envoie donc a
# tous les utilisateurs abonnes, sans gerer d'abonnement a la main.
# Anti-doublon : une seule notif par "edition" (fichier marqueur .last-notified).
# Mode TEST : si TEST_MESSAGE est fourni, envoie ce texte tout de suite (+ emoji
#   aleatoire), sans toucher au marqueur du matin.
# Identifiants via env (secrets GitHub). Sans eux -> on ignore proprement.
import os, sys, json, random, urllib.request, urllib.error

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

APP_ID = os.environ.get("ONESIGNAL_APP_ID", "").strip()
API_KEY = os.environ.get("ONESIGNAL_REST_API_KEY", "").strip()
test_msg = os.environ.get("TEST_MESSAGE", "").strip()

if not APP_ID or not API_KEY:
    print("Secrets OneSignal absents (ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY) -> envoi ignoré.")
    sys.exit(0)

NOTIF_TITLE = "SportVeille"
API_URL = "https://onesignal.com/api/v1/notifications"


def send(body):
    payload = {
        "app_id": APP_ID,
        "included_segments": ["Total Subscriptions"],
        "headings": {"en": NOTIF_TITLE, "fr": NOTIF_TITLE},
        "contents": {"en": body, "fr": body},
        "url": "https://ultiimatte.github.io/Sport-Veille/",
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": "Basic " + API_KEY,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            resp = json.loads(r.read().decode("utf-8"))
        recipients = resp.get("recipients", 0)
        if resp.get("errors"):
            print("Réponse OneSignal avec erreurs :", resp.get("errors"))
        print(f"Notification envoyée à {recipients} abonné(s) : {body}")
        return True
    except urllib.error.HTTPError as e:
        print(f"Echec OneSignal HTTP {e.code} :", e.read().decode("utf-8")[:300])
    except Exception as e:
        print("Echec de l'envoi OneSignal :", repr(e))
    return False


# --- Mode TEST : texte forcé, envoi immédiat, sans anti-doublon ---
if test_msg:
    send(f"{test_msg} {random.choice(EMOJIS)}")
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

if send(f"{random.choice(TEXTS)} {random.choice(EMOJIS)}"):
    open(MARKER, "w").write(edition)
    print(f"Marqueur mis à jour pour l'édition {edition}.")
