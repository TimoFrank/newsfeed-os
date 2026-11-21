"""Build the two self-contained HTML demos with python3 build_demos.py."""
import base64
import html
import json
import mimetypes
import re
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEMO_NAMES = {"stadtlabor": "Stadtlabor.html", "orbit": "Orbitbrief.html"}


def read_text(path):
    return (ROOT / path).read_text(encoding="utf-8")


def inline_reader():
    """Inline our two reader modules, preserving the names of aliased imports."""
    ui = read_text("assets/ui.js")
    app = read_text("assets/app.js")
    imports = re.match(r"import\s*\{([^}]+)\}\s*from ['\"]\./ui\.js['\"];\s*", app)
    if not imports:
        raise ValueError("The reader should import its UI functions from ./ui.js")
    aliases = []
    for declaration in imports[1].split(","):
        names = declaration.strip().split(" as ")
        if not re.search(r"^export (?:const|function) " + re.escape(names[0]) + r"\b", ui, re.M):
            raise ValueError(f"Unknown UI export: {names[0]}")
        if len(names) == 2:
            aliases.append(f"const {names[1]} = {names[0]};")
    return "\n".join([ui, *aliases, app[imports.end():]])


def replace_once(source, pattern, replacement):
    result, count = re.subn(pattern, lambda _: replacement, source)
    if count != 1:
        raise ValueError(f"Expected one matching entry in index.html: {pattern}")
    return result


def build(profile_path, css, reader):
    profile = json.loads(read_text(profile_path))
    records = json.loads(read_text(profile["feed"]))
    if profile.get("logo"):
        path = ROOT / profile["logo"]
        mime = mimetypes.guess_type(path)[0]
        if mime not in ("image/svg+xml", "image/png", "image/jpeg", "image/webp"):
            raise ValueError(f"Unsupported demo logo: {path.name}")
        data = base64.b64encode(path.read_bytes()).decode("ascii")
        profile["logo"] = f"data:{mime};base64,{data}"
    edition = json.dumps({"profile": profile, "items": records}, ensure_ascii=True, separators=(",", ":"))
    # Script text is parsed by HTML before its contents are decoded as JSON.
    edition = edition.replace("<", r"\u003c").replace(">", r"\u003e").replace("&", r"\u0026")
    if re.search(r"</script", reader, re.I) or re.search(r"</style", css, re.I):
        raise ValueError("A reader asset contains an unescaped HTML closing tag")
    page = read_text("index.html")
    page = replace_once(page, r"<title>[^<]*</title>", f"<title>{html.escape(profile['name'])}</title>")
    for key, value in (("description", profile["intro"]), ("theme-color", profile["theme"]["primary"])):
        page = replace_once(page, rf'<meta name="{key}" content="[^"]*">',
                            f'<meta name="{key}" content="{html.escape(value, quote=True)}">')
    page = replace_once(page, r'<link rel="stylesheet" href="assets/site\.css">', f"<style>\n{css}</style>")
    return replace_once(page, r'<script src="assets/app\.js" type="module"></script>',
                        f'<script type="application/json" id="embedded-edition">{edition}</script>\n'
                        f'  <script type="module">\n{reader}</script>')


def public_path(value, folder):
    path = Path(value)
    if path.is_absolute() or path.parent != Path(folder) or not path.name:
        raise ValueError(f"Expected a local file in {folder}: {value}")
    return path.as_posix()


def build_download(target, catalog):
    # Keep the editable reader and its public data independent of the build tools.
    paths = {"index.html", "site.json", "assets/site.css", "assets/app.js", "assets/ui.js"}
    for value in catalog.values():
        path = public_path(value, "profiles")
        paths.add(path)
        profile = json.loads(read_text(path))
        paths.add(public_path(profile["feed"], "feeds"))
        if profile.get("logo"):
            paths.add(public_path(profile["logo"], "assets"))

    entries = {name: target / name for name in DEMO_NAMES.values()}
    entries.update({"vorlage/" + name: ROOT / name for name in paths})
    archive = target / "Newsfeed-OS.zip"
    with zipfile.ZipFile(archive, "w") as bundle:
        for name, source in sorted(entries.items()):
            # Fixed metadata makes identical releases identical byte for byte.
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            bundle.writestr(info, source.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    print(archive.relative_to(ROOT))


def main():
    catalog = json.loads(read_text("site.json"))["profiles"]
    target = ROOT / "docs" / "demos"
    target.mkdir(parents=True, exist_ok=True)
    css = read_text("assets/site.css")
    reader = inline_reader()
    for key, filename in DEMO_NAMES.items():
        page = build(catalog[key], css, reader)
        (target / filename).write_text(page, encoding="utf-8")
        print((target / filename).relative_to(ROOT))
    build_download(target, catalog)


if __name__ == "__main__":
    main()
