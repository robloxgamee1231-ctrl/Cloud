#!/usr/bin/env python3
"""Generate the XCloud4 Web bundled catalog snapshot from the public
Game Pass catalog endpoints (the same public endpoints xbox.com/play uses).

Usage:  python3 scripts/gen_catalog_snapshot.py [raw_out]
        raw_out defaults to data/catalog.raw.json
"""
import json
import os
import sys
import time
import urllib.request

BASE = "https://catalog.gamepass.com"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "XCloud4Web/1.3.0 (+https://github.com/asp11edgr/XCloud4)",
}

# Cloud SIGL collections (Xbox app 2610 identifiers, community-documented)
CLOUD_SIGLS = {
    "all": "1bf84c2b-0643-4591-893f-d9edb703f692",      # XCloudAll
    "popular": "6a589fa0-d493-472b-8e20-3813699d7056",  # XCloudPopular
    "recent": "06323672-b8c8-43cc-b0de-32d5a9834749",   # RecentlyAdded
    "ea": "27a89da6-0eaf-4dca-8192-85e7f62a5b3f",       # EA Play
}


def http_get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def http_post_json(url, payload, extra_headers=None):
    data = json.dumps(payload).encode("utf-8")
    headers = dict(HEADERS)
    headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    raw_out = sys.argv[1] if len(sys.argv) > 1 else "data/catalog.raw.json"
    collections = {}
    all_ids = []
    for name, sigl_id in CLOUD_SIGLS.items():
        url = f"{BASE}/sigls/v2?id={sigl_id}&market=US&language=en-US"
        rows = http_get(url)
        ids = []
        for row in rows:
            if isinstance(row, dict) and isinstance(row.get("id"), str):
                ids.append(row["id"])
        collections[name] = ids
        all_ids.extend(ids)
        print(f"{name}: {len(ids)} titles")
        time.sleep(0.4)

    unique_ids = list(dict.fromkeys(all_ids))
    print("unique product ids:", len(unique_ids))

    products = {}
    batch = []

    def flush(batch):
        if not batch:
            return
        url = f"{BASE}/v3/products?market=US&language=en-US&hydration=RemoteLowJade0"
        hdrs = {
            "calling-app-name": "Xbox Cloud Gaming Web",
            "calling-app-version": "24.17.63",
            "ms-cv": "WGxjbG91ZDRXZWI=.0",
        }
        resp = http_post_json(url, {"Products": batch}, hdrs)
        prods = resp.get("Products", {})
        products.update(prods)
        print(f"fetched {len(prods)} (total {len(products)})")

    for pid in unique_ids:
        batch.append(pid)
        if len(batch) >= 60:
            flush(batch)
            batch = []
            time.sleep(0.5)
    flush(batch)

    out = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "market": "US",
        "language": "en-US",
        "collections": collections,
        "products": products,
    }
    os.makedirs(os.path.dirname(raw_out) or ".", exist_ok=True)
    with open(raw_out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(raw_out)
    print("saved", raw_out, f"{size/1024/1024:.2f} MB")


if __name__ == "__main__":
    main()
