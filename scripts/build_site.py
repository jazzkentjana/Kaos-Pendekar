#!/usr/bin/env python3
"""Build the showcase website data from listings/.

Reads listings/log.csv and the six mockups in listings/<slug>/, and writes:
  site/data.json             - one entry per live design, newest first
  site/img/<slug>/tile.webp  - flat black shot, cropped to the shirt (homepage tiles)
  site/img/<slug>/<n>.webp   - all six mockups at 1400px (product page)

It never changes anything in listings/ or shared/ (live Shopee listings use them).
Run it again after a new design is added:  python3 scripts/build_site.py
"""
import csv
import json
import os
import sys

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST = os.path.join(ROOT, "listings")
OUT = os.path.join(ROOT, "site")

SHOTS = [
    ("01_flat-black", "black", "flat"),
    ("02_flat-white", "white", "flat"),
    ("03_model-male-black", "black", "model"),
    ("04_model-female-white", "white", "model"),
    ("05_model-male-white", "white", "model"),
    ("06_model-female-black", "black", "model"),
]


def crop_to_shirt(im, pad=0.04):
    """Crop a flat shot on a white background to the shirt's bounding box."""
    rgb = im.convert("RGB")
    bg = Image.new("RGB", rgb.size, (255, 255, 255))
    diff = ImageChops.difference(rgb, bg).convert("L").point(lambda v: 255 if v > 18 else 0)
    box = diff.getbbox()
    if not box:
        return rgb
    w, h = rgb.size
    p = int(max(w, h) * pad)
    box = (max(0, box[0] - p), max(0, box[1] - p), min(w, box[2] + p), min(h, box[3] + p))
    return rgb.crop(box)


def save_webp(im, path, width, quality):
    im = im.convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(path, "WEBP", quality=quality, method=6)
    return im.size


def fresh(src, dst):
    return os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src)


def main():
    rows = list(csv.DictReader(open(os.path.join(LIST, "log.csv"), encoding="utf-8")))
    items = []
    for r in rows:
        if r.get("status", "").strip().lower() != "live":
            continue
        slug = r["slug"].strip()
        src_dir = os.path.join(LIST, slug)
        if not os.path.isdir(src_dir):
            print(f"skip {slug}: no listings folder", file=sys.stderr)
            continue
        dst_dir = os.path.join(OUT, "img", slug)
        os.makedirs(dst_dir, exist_ok=True)

        images = []
        for i, (suffix, color, kind) in enumerate(SHOTS, 1):
            src = os.path.join(src_dir, f"{slug}_{suffix}.jpg")
            if not os.path.exists(src):
                continue
            dst = os.path.join(dst_dir, f"{i}.webp")
            if not fresh(src, dst):
                save_webp(Image.open(src), dst, 1400, 80)
            images.append({"src": f"site/img/{slug}/{i}.webp", "color": color, "kind": kind})

        tile_src = os.path.join(src_dir, f"{slug}_01_flat-black.jpg")
        tile_dst = os.path.join(dst_dir, "tile.webp")
        if not fresh(tile_src, tile_dst):
            save_webp(crop_to_shirt(Image.open(tile_src)), tile_dst, 640, 82)
        tw, th = Image.open(tile_dst).size

        items.append({
            "slug": slug,
            "date": r["date"].strip(),
            "hook": r["hook"].strip(),
            "topic": r["topic"].strip(),
            "lines": [s.strip() for s in r["lines"].split(" / ") if s.strip()],
            "shopee": r["shopee_url"].strip(),
            "tile": {"src": f"site/img/{slug}/tile.webp", "w": tw, "h": th},
            "images": images,
        })

    items.sort(key=lambda x: x["date"], reverse=True)
    data = {
        "shop": "https://shopee.co.id/shop/269698445",
        "prices": [{"sizes": "S–XL", "price": 89000}, {"sizes": "XXL–XXXL", "price": 99000}],
        "sizes": ["S", "M", "L", "XL", "XXL", "XXXL"],
        "sizeChart": "shared/size-chart-1280.jpg",
        "items": items,
    }
    with open(os.path.join(OUT, "data.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"{len(items)} designs written to site/data.json")


if __name__ == "__main__":
    main()
