#!/usr/bin/env python3
"""
Compatibility shim for the Yellow Panther question catalog.

The canonical source now lives in `yellow_panther_catalog.py`.
This file remains so existing imports keep working while the repository
converges on a single service/question source of truth.
"""

try:
    from backend.yellow_panther_catalog import *  # noqa: F401,F403
except ImportError:
    from yellow_panther_catalog import *  # noqa: F401,F403
