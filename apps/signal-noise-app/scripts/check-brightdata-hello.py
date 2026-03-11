#!/usr/bin/env python3
"""
BrightData hello-world contract check.

Validates:
1) Auth token is present
2) Zone whitelist can be read
3) /request works with sdk_unlocker
4) /serp/req accepts query object payload with sdk_serp
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv


def main() -> int:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    token = os.getenv("BRIGHTDATA_API_TOKEN")
    if not token:
        print("ERROR: BRIGHTDATA_API_TOKEN missing")
        return 2

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    with httpx.Client(timeout=30) as client:
        wl = client.get("https://api.brightdata.com/zone/whitelist", headers=headers)
        print(f"zone/whitelist: {wl.status_code}")
        if wl.status_code != 200:
            print(wl.text[:300])
            return 3

        print(f"zones: {wl.text[:200]}")

        req_payload = {"zone": "sdk_unlocker", "url": "https://example.com", "format": "raw"}
        req = client.post("https://api.brightdata.com/request", headers=headers, json=req_payload)
        print(f"request(sdk_unlocker): {req.status_code}")
        if req.status_code == 200:
            print(f"request sample: {req.text[:120].replace(chr(10), ' ')}")
        else:
            print(req.text[:300])

        serp_payload = {"zone": "sdk_serp", "query": {"q": "hello world", "num": 3}}
        serp = client.post("https://api.brightdata.com/serp/req", headers=headers, json=serp_payload)
        print(f"serp/req(sdk_serp): {serp.status_code}")
        print(serp.text[:300])

    if req.status_code == 200 and serp.status_code == 200:
        print("OK: BrightData hello-world checks passed")
        return 0

    print("WARN: BrightData hello-world checks partially failed")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

