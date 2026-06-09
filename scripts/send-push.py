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


def send(body, send_after=None):
    payload = {
        "app_id": APP_ID,
        "included_segments": ["Total Subscriptions"],
        "headings": {"en": NOTIF_TITLE, "fr": NOTIF_TITLE},
        "contents": {"en": body, "fr": body},
        "url": "https://ultiimatte.github.io/Sport-Veille/",
    }
    if send_after:
        payload["send_after"] = send_after  # livraison programmée (rappels de la journée)
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
        nid = resp.get("id") or ""
        recipients = resp.get("recipients", 0)
        errors = resp.get("errors")
        # Un vrai échec = erreurs ET aucun destinataire (ex : segment introuvable).
        if errors and not recipients:
            print("Echec OneSignal :", errors)
            return False
        # NB : OneSignal renvoie parfois recipients=0 alors que la notif part bien.
        print(f"Notification envoyée à OneSignal (id={nid}, ~{recipients} destinataire(s)) : {body}")
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

    # --- Rappels de lecture à des heures ALÉATOIRES dans la journée (heure de Paris) ---
    # Programmés une seule fois (avec la notif du matin) via send_after. Mêmes textes/emojis.
    try:
        import datetime
        from zoneinfo import ZoneInfo
        paris = ZoneInfo("Europe/Paris")
        now_p = datetime.datetime.now(paris)
        midnight = now_p.replace(hour=0, minute=0, second=0, microsecond=0)
        # Deux fenêtres : (12h-16h) puis (16h-20h), heure aléatoire dans chacune.
        for (lo, hi) in [(12, 16), (16, 20)]:
            target = midnight + datetime.timedelta(minutes=random.randint(lo * 60, hi * 60 - 1))
            if target <= now_p:
                continue  # heure déjà passée (run tardif) -> on saute ce rappel
            if send(f"{random.choice(TEXTS)} {random.choice(EMOJIS)}", send_after=target.isoformat()):
                print(f"Rappel programmé à {target.strftime('%H:%M')} (Paris).")
    except Exception as e:
        print("Rappels non programmés :", repr(e))
