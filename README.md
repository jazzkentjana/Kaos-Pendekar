# Kaos Pendekar — listing images

Public image hosting for Shopee Mass Upload. Shopee pulls each photo from its
raw link:

    https://raw.githubusercontent.com/jazzkentjana/Kaos-Pendekar/main/<path>

Layout
- `shared/` — images reused on every listing (size chart)
- `listings/<slug>/` — the six mockups per design, `<slug>_01..06_*.jpg`

Files here are referenced by live listings. Do not rename or delete them.

Website (GitHub Pages)
- `index.html`, `assets/` — showcase site; buyers are sent to Shopee to purchase
- `site/` — generated from `listings/` by `scripts/build_site.py` (web-size images + `data.json`)
- After adding a design to `listings/` and `listings/log.csv`, run `python3 scripts/build_site.py` and commit `site/`
