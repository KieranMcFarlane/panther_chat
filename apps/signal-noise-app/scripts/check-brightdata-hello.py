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
import asyncio
from pathlib import Path

import httpx
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
APP_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = APP_ROOT / "backend"
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from backend.brightdata_sdk_client import BrightDataSDKClient
except ImportError:
    from brightdata_sdk_client import BrightDataSDKClient


def main() -> int:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    token = os.getenv("BRIGHTDATA_API_TOKEN")
    if not token:
        print("ERROR: BRIGHTDATA_API_TOKEN missing")
        return 2

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    sdk_scrape_ok = False
    with httpx.Client(timeout=30) as client:
        wl = client.get("https://api.brightdata.com/zone/whitelist", headers=headers)
        print(f"zone/whitelist: {wl.status_code}")
        if wl.status_code != 200:
            print(wl.text[:300])
            return 3

        print(f"zones: {wl.text[:200]}")

        req_payload = {"zone": "sdk_unlocker", "url": "https://example.com", "format": "raw"}
        req = None
        try:
            req = client.post("https://api.brightdata.com/request", headers=headers, json=req_payload)
            print(f"request(sdk_unlocker): {req.status_code}")
            if req.status_code == 200:
                print(f"request sample: {req.text[:120].replace(chr(10), ' ')}")
            else:
                print(req.text[:300])
        except Exception as e:
            print(f"request(sdk_unlocker): exception {str(e)[:220]}")

        serp_payload = {"zone": "sdk_serp", "query": {"q": "hello world", "num": 3}}
        serp = None
        try:
            serp = client.post("https://api.brightdata.com/serp/req", headers=headers, json=serp_payload)
            print(f"serp/req(sdk_serp): {serp.status_code}")
            print(serp.text[:300])
        except Exception as e:
            print(f"serp/req(sdk_serp): exception {str(e)[:220]}")

    async def _sdk_hello() -> bool:
        bd = BrightDataSDKClient(token=token)
        try:
            result = await bd.scrape_as_markdown("https://example.com")
            ok = result.get("status") == "success" and bool(result.get("content"))
            source = (result.get("metadata") or {}).get("source")
            print(f"sdk scrape(example.com): {'ok' if ok else 'fail'} source={source}")
            return ok
        finally:
            await bd.close()

    try:
        sdk_scrape_ok = asyncio.run(_sdk_hello())
    except Exception as e:
        print(f"sdk scrape(example.com): fail error={str(e)[:220]}")

    req_ok = req is not None and req.status_code == 200
    serp_ok = serp is not None and serp.status_code == 200
    if req_ok and serp_ok and sdk_scrape_ok:
        print("OK: BrightData hello-world checks passed")
        return 0

    print("WARN: BrightData hello-world checks partially failed")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
