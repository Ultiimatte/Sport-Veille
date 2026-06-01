#!/usr/bin/env python3
# Serveur statique minimal pour l'apercu (sert le dossier docs/).
import http.server
import socketserver
import os

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")
BASE = os.path.abspath(BASE)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE, **kwargs)


with socketserver.TCPServer(("", 8080), Handler) as httpd:
    print("Serving", BASE, "on http://localhost:8080")
    httpd.serve_forever()
