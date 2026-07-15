#!/usr/bin/env python3
"""Build OpenAcademyLanding/index.html from index.template.html.

Inlines every {{screenshots/<name>.png}} token as a base64 data URI so the
published Artifact stays self-contained. Source PNGs live in screenshots/.
Missing files fall back to a neutral placeholder so the page still builds.

Usage:  python3 build.py
"""
import base64
import mimetypes
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
TEMPLATE = ROOT / "index.template.html"
OUTPUT = ROOT / "index.html"

# 1x1 light-slate PNG placeholder, used when a screenshot is not yet dropped in.
PLACEHOLDER = (
    "data:image/svg+xml;base64,"
    + base64.b64encode(
        b'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">'
        b'<rect width="100%" height="100%" fill="#f1f5f9"/>'
        b'<text x="50%" y="50%" fill="#94a3b8" font-family="sans-serif" '
        b'font-size="28" font-weight="700" text-anchor="middle">Captura pendiente</text>'
        b"</svg>"
    ).decode()
)


def data_uri(path: pathlib.Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> None:
    html = TEMPLATE.read_text(encoding="utf-8")
    used, missing = [], []

    def replace(match: "re.Match[str]") -> str:
        rel = match.group(1)
        path = ROOT / rel
        if path.exists():
            used.append(rel)
            return data_uri(path)
        missing.append(rel)
        return PLACEHOLDER

    html = re.sub(r"\{\{(screenshots/[^}]+)\}\}", replace, html)

    # Wrap the body-only template into a valid standalone HTML5 document so the
    # page works served as a plain static file (e.g. Vercel), not just inside the
    # Artifact wrapper. Pull <title> and the first <style> into a proper <head>
    # and add charset + viewport (without viewport the layout won't scale on mobile).
    head_parts = []
    for pattern in (r"<title>.*?</title>", r"<style>.*?</style>"):
        found = re.search(pattern, html, re.S)
        if found:
            head_parts.append(found.group(0))
            html = html.replace(found.group(0), "", 1)

    document = (
        "<!doctype html>\n"
        '<html lang="es">\n'
        "<head>\n"
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<link rel="icon" href="data:image/svg+xml,'
        "<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22>"
        "<text y=%22.9em%22 font-size=%2290%22>%F0%9F%8E%93</text></svg>\">\n"
        + "\n".join(head_parts)
        + "\n</head>\n<body>\n"
        + html.strip()
        + "\n</body>\n</html>\n"
    )
    OUTPUT.write_text(document, encoding="utf-8")

    print(f"Built {OUTPUT.name} ({len(document):,} bytes)")
    for rel in used:
        print(f"  embedded  {rel}")
    for rel in missing:
        print(f"  MISSING   {rel}  -> placeholder")


if __name__ == "__main__":
    main()
