"""Lokale Vorschau und Export für Newsfeed OS. Benötigt nur Python ab 3.9."""
import argparse
import base64
import binascii
import io
import html
import json
import mimetypes
import re
import threading
import unicodedata
import uuid
import zipfile
from collections import OrderedDict
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
CURRENT = OrderedDict()
LOCK = threading.Lock()
RESOURCES = {"site.json", "index.html", "docs/demos/Stadtlabor.html",
             "docs/demos/Orbitbrief.html", "docs/demos/Newsfeed-OS.zip"}


def encode_json(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def slug(text):
    text = unicodedata.normalize("NFKD", text.casefold()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-") or "ausgabe"


def clean_text(data, key, required=False):
    value = data.get(key, "")
    if not isinstance(value, str) or len(value) > 5000 or (required and not value.strip()):
        raise ValueError(f"Bitte prüfe das Feld {key}.")
    return value.strip()


def named_rows(text, previous):
    known = {item["label"]: item for item in previous}
    result = []
    seen = set()
    for label in [s.strip() for s in text.splitlines() if s.strip()]:
        row = known.get(label, {"id": slug(label), "label": label})
        if row["id"] in seen:
            raise ValueError("Jeder Bereich und jedes Thema braucht einen eindeutigen Namen.")
        seen.add(row["id"])
        result.append(row)
    if not result:
        raise ValueError("Trage mindestens einen Bereich und ein Thema ein.")
    return result


def make_edition(data):
    manifest = read_json("site.json")
    profile_path = manifest["profiles"].get(data.get("basis"))
    if not profile_path:
        raise ValueError("Wähle eine vorhandene Ausgabe.")
    profile = read_json(profile_path)
    original_sections, original_topics = profile["sections"], profile["topics"]
    old_feed = profile["feed"]
    for key in ("name", "kicker", "headline", "highlight", "intro", "about", "publisher"):
        profile[key] = clean_text(data, key, required=key in ("name", "headline", "publisher"))
    profile["logoMode"] = "wordmark" if data.get("wordmark") else "symbol"
    for field in ("primary", "accent", "tint", "ink"):
        color = clean_text(data, field)
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            raise ValueError("Eine Farbe fehlt oder ist ungültig.")
        profile["theme"][field] = color
    if data.get("style") not in ("journal", "atlas"):
        raise ValueError("Wähle einen gültigen Satzstil.")
    profile["theme"]["style"] = data["style"]
    artwork = data.get("artwork", "")
    if artwork not in ("", "stadtplan", "umlaufbahn"):
        raise ValueError("Unbekanntes Kopfmotiv.")
    profile["theme"]["artwork"] = artwork
    profile["links"] = {}
    for key in ("website", "newsletter", "impressum", "datenschutz"):
        url = clean_text(data, key)
        if url:
            dest = urlsplit(url)
            if dest.scheme not in ("http", "https") or not dest.netloc:
                raise ValueError("Externe Links brauchen eine vollständige Webadresse.")
            profile["links"][key] = url
    profile["sections"] = named_rows(clean_text(data, "sections", True), original_sections)
    profile["topics"] = named_rows(clean_text(data, "topics", True), original_topics)
    public = {p.relative_to(ROOT).as_posix(): p.read_bytes()
              for p in sorted((ROOT / "assets").glob("*")) if p.suffix in (".js", ".css")}
    logo = data.get("image")
    if logo:
        if not isinstance(logo, str) or "," not in logo:
            raise ValueError("Bitte verwende eine PNG- oder JPEG-Datei.")
        header, payload = logo.split(",", 1)
        signatures = {"data:image/png;base64": ("png", b"\x89PNG\r\n\x1a\n"),
                      "data:image/jpeg;base64": ("jpg", b"\xff\xd8\xff")}
        ext, magic = signatures.get(header, ("", None))
        raw = base64.b64decode(payload, validate=True)
        if not magic or not raw.startswith(magic) or len(raw) > 2_000_000:
            raise ValueError("Bitte verwende ein PNG oder JPEG mit höchstens 2 MB.")
        profile["logo"] = "assets/logo." + ext
        public[profile["logo"]] = raw
    elif data.get("keepLogo", True) and profile.get("logo"):
        asset = profile["logo"]
        if asset.startswith("assets/") and (ROOT / asset).resolve().parent == ROOT / "assets":
            public[asset] = (ROOT / asset).read_bytes()
        else:
            raise ValueError("Für dieses Profil bitte ein lokales Logo wählen.")
    else:
        profile["logo"] = ""
    keep_source = bool(data.get("includeNews"))
    remote_feed = urlsplit(old_feed).scheme in ("https", "http")
    records = read_json(old_feed) if keep_source and not remote_feed else []
    if keep_source and remote_feed and (profile["sections"] != original_sections or profile["topics"] != original_topics):
        raise ValueError("Für die bestehende Feedquelle müssen ihre Themen und Bereiche erhalten bleiben.")
    if records:
        sections = {row["id"] for row in profile["sections"]}
        topics = {row["id"] for row in profile["topics"]}
        if any(r["section"] not in sections or not set(r["topics"]) <= topics for r in records):
            raise ValueError("Die Beispielmeldungen verwenden die ursprünglichen Bereiche und Themen. Wähle für deine eigene Einteilung einen leeren Feed.")
    profile["feed"] = old_feed if keep_source and remote_feed else "feeds/meldungen.json"
    public["site.json"] = encode_json({"defaultProfile": "ausgabe", "profiles": {"ausgabe": "profiles/ausgabe.json"}})
    public["profiles/ausgabe.json"] = encode_json(profile)
    if not (keep_source and remote_feed):
        public[profile["feed"]] = encode_json(records)
    entry = (ROOT / "index.html").read_text(encoding="utf-8")
    entry = re.sub(r"<title>.*?</title>", lambda _: "<title>" + html.escape(profile["name"]) + "</title>", entry)
    for field, value in (("description", profile["intro"]), ("theme-color", profile["theme"]["primary"])):
        entry = re.sub(r'(<meta name="' + field + r'" content=")[^"]*', lambda m: m[1] + html.escape(value, quote=True), entry)
    public["index.html"] = entry.encode()
    return slug(profile["name"]), public


class Server(BaseHTTPRequestHandler):
    def reply(self, status, data, mime, **headers):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def do_GET(self):
        path = unquote(urlsplit(self.path).path).lstrip("/")
        if not path or path.endswith("/"):
            path += "index.html"
        parts = path.split("/")
        if any(p in ("", ".", "..") for p in parts):
            return self.send_error(404)
        if parts[0] == "vorschau" and len(parts) >= 3:
            with LOCK:
                value = CURRENT.get(parts[1], {}).get("/".join(parts[2:]))
            if value is None:
                return self.send_error(404)
        else:
            if path.startswith("einrichten/"):
                path = "werkstatt/" + path.removeprefix("einrichten/")
            allowed = (path in RESOURCES or parts[0] in ("assets", "profiles", "feeds")
                       or path in ("werkstatt/index.html", "werkstatt/form.js", "werkstatt/form.css", "werkstatt/newsfeed-os.svg"))
            file = (ROOT / path).resolve()
            if not allowed or ROOT not in file.parents or not file.is_file():
                return self.send_error(404)
            value = file.read_bytes()
        self.reply(200, value, mimetypes.guess_type(path)[0] or "application/octet-stream")

    do_HEAD = do_GET

    def do_POST(self):
        port = self.server.server_address[1]
        if self.headers.get("Origin") not in (f"http://127.0.0.1:{port}", f"http://localhost:{port}"):
            return self.send_error(403)
        action = urlsplit(self.path).path
        if action not in ("/einrichten/vorschau", "/einrichten/paket"):
            return self.send_error(404)
        try:
            length = int(self.headers.get("Content-Length", 0))
            if not 0 < length <= 3_000_000:
                raise ValueError("Die Eingabe ist zu groß. Das Logo darf höchstens 2 MB haben.")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("Ungültige Eingabe.")
            name, files = make_edition(data)
        except (ValueError, TypeError, binascii.Error) as exc:
            return self.reply(HTTPStatus.BAD_REQUEST, encode_json({"error": str(exc)}), "application/json")
        if action.endswith("vorschau"):
            key = uuid.uuid4().hex
            with LOCK:
                CURRENT[key] = files
                while len(CURRENT) > 8:
                    CURRENT.popitem(last=False)
            return self.reply(200, encode_json({"url": f"/vorschau/{key}/"}), "application/json")
        target = io.BytesIO()
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
            for path, value in files.items():
                archive.writestr(path, value)
        self.reply(200, target.getvalue(), "application/zip",
                   **{"Content-Disposition": f'attachment; filename="{name}.zip"'})


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--port", type=int, default=8765)
    args = cli.parse_args()
    try:
        service = ThreadingHTTPServer(("127.0.0.1", args.port), Server)
    except OSError as exc:
        cli.exit(1, f"Port {args.port} ist nicht verfügbar. Starte mit --port 8766 oder --port 0.\n{exc}\n")
    with service:
        address = f"http://127.0.0.1:{service.server_port}"
        print(f"Website: {address}/\nEigene Ausgabe einrichten: {address}/einrichten/\nBeenden mit Strg+C.", flush=True)
        try:
            service.serve_forever()
        except KeyboardInterrupt:
            pass
