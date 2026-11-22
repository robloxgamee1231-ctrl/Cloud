#!/usr/bin/env python3
"""Build the final compact web dataset from the raw snapshot.

Usage:  python3 scripts/build_web_catalog.py [raw_in] [out_final]
        defaults: data/catalog.raw.json -> data/catalog.json

Model:
  products: { storeId: [title, publisher, imageSuffix, [cats], flags] }
  flags bit 1 = touch input, bit 2 = free-to-play / stream-your-own-game,
  imageSuffix is appended to imgBase (\"https://store-images.s-microsoft.com/image/\")
"""
import gzip
import json
import os
import sys

RAW = sys.argv[1] if len(sys.argv) > 1 else "data/catalog.raw.json"
OUT = sys.argv[2] if len(sys.argv) > 2 else "data/catalog.json"
IMG_BASE = "https://store-images.s-microsoft.com/image/"

with open(RAW, encoding="utf-8") as f:
    raw = json.load(f)

products = {}
for pid, p in raw["products"].items():
    if not p.get("Streamability", {}).get("WithGPU"):
        continue
    offerings = p.get("XCloudOfferings") or {}
    xgpu = offerings.get("XGPU") or {}
    inputs = xgpu.get("SupportedInputTypes") or []
    tile = ((p.get("Image_Tile") or {}).get("URL") or "").strip()
    if tile.startswith("//"):
        tile = "https:" + tile
    suffix = tile[len(IMG_BASE):] if tile.startswith(IMG_BASE) else ""
    if not suffix:
        continue
    cats = [c for c in (p.get("Categories") or []) if c][:3]
    flags = 0
    if any(i in ("nativetouch", "generictouch", "customtouchoverlay") for i in inputs):
        flags |= 1
    if xgpu.get("IsAdditionalProduct") is True:
        flags |= 2
    products[pid] = [
        p.get("ProductTitle", "").strip(),
        p.get("PublisherName", "").strip(),
        suffix,
        cats,
        flags,
    ]

collections = {}
for name in ("all", "recent", "ea"):
    collections[name] = [i for i in raw["collections"][name] if i in products]

out = {
    "v": 2,
    "generatedAt": raw["generatedAt"],
    "market": "US",
    "language": "en-US",
    "imgBase": IMG_BASE,
    "collections": collections,
    "products": products,
}

os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

size = os.path.getsize(OUT)
gz = len(gzip.compress(json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode()))
counts = {k: len(v) for k, v in collections.items()}
touch = sum(1 for x in products.values() if x[4] & 1)
own = sum(1 for x in products.values() if x[4] & 2)
print("titles:", len(products), "| collections:", counts, f"| raw {size/1024:.0f} KB | gzip ~{gz/1024:.0f} KB | touch {touch} | f2p/own {own}")
