#!/usr/bin/env python3
"""
Deterministic URL lane policy learned from unbounded shadow runs.

Purpose:
- Keep broad candidate generation, but reject known low-yield shell routes
  for high-value discovery hops before expensive scraping/evaluation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse
from typing import Iterable, Mapping, Optional


@dataclass(frozen=True)
class UrlPolicyDecision:
    allow: bool
    reason: str = "allow"


class DiscoveryUrlPolicy:
    """
    Policy guard for candidate URL acceptance.

    This is intentionally conservative: block only known low-yield routes
    observed repeatedly in shadow runs.
    """

    _HIGH_VALUE_HOPS = {
        "rfp_page",
        "tenders_page",
        "procurement_page",
        "press_release",
    }

    _KNOWN_LOW_YIELD_ROUTE_PATTERNS: Mapping[str, tuple[str, ...]] = {
        # Shadow runs repeatedly degraded on these shell routes.
        "ccfc.co.uk": ("/", "/about", "/procurement", "/news", "/matches", "/fixtures"),
    }
    _GENERIC_LOW_YIELD_PATH_PREFIXES: tuple[str, ...] = (
        "/news",
        "/matches",
        "/fixtures",
        "/results",
        "/videos",
        "/watch",
        "/live",
    )
    _GENERIC_ALLOWLIST_HINTS: tuple[str, ...] = (
        "procurement",
        "tender",
        "rfp",
        "supplier",
        "commercial",
        "partnership",
        "vacancy",
        "vacancies",
        "careers",
        "job",
        "jobs",
    )
    _LOW_SIGNAL_TITLE_TOKENS: tuple[str, ...] = (
        "latest news",
        "news",
        "fixtures",
        "results",
        "watch live",
    )

    def evaluate(
        self,
        *,
        url: str,
        hop_type,
        entity_name: str,
        title: str = "",
        snippet: str = "",
    ) -> UrlPolicyDecision:
        normalized_entity = str(entity_name or "").strip().lower()

        parsed = urlparse(str(url or "").strip())
        host = (parsed.netloc or "").lower().lstrip("www.")
        if not host:
            return UrlPolicyDecision(False, "missing_host")

        hop_key = str(getattr(hop_type, "value", hop_type) or "").lower().strip()
        if hop_key not in self._HIGH_VALUE_HOPS:
            return UrlPolicyDecision(True, "allow")

        path = (parsed.path or "/").strip().lower()
        if not path:
            path = "/"
        if not path.startswith("/"):
            path = f"/{path}"

        for domain, blocked_paths in self._KNOWN_LOW_YIELD_ROUTE_PATTERNS.items():
            if not self._host_matches(host, domain):
                continue
            if self._path_matches(path, blocked_paths):
                return UrlPolicyDecision(False, "known_low_yield_route")

        if self._is_generic_low_yield_route(
            path=path,
            title=title,
            snippet=snippet,
            normalized_entity=normalized_entity,
        ):
            return UrlPolicyDecision(False, "generic_low_yield_route")

        return UrlPolicyDecision(True, "allow")

    def _is_generic_low_yield_route(
        self,
        *,
        path: str,
        title: str,
        snippet: str,
        normalized_entity: str,
    ) -> bool:
        path_norm = (path or "/").strip().lower()
        title_norm = str(title or "").strip().lower()
        snippet_norm = str(snippet or "").strip().lower()
        haystack = f"{path_norm} {title_norm} {snippet_norm}"

        # Do not block explicit high-signal procurement/careers candidates.
        if any(token in haystack for token in self._GENERIC_ALLOWLIST_HINTS):
            return False
        if normalized_entity and normalized_entity in haystack:
            return False

        if path_norm == "/":
            return True

        if any(path_norm.startswith(prefix) for prefix in self._GENERIC_LOW_YIELD_PATH_PREFIXES):
            # Keep deep article pages, block shell/index pages.
            depth = len([p for p in path_norm.split("/") if p])
            slug_like = bool(re.search(r"/[a-z0-9-]{12,}", path_norm))
            if depth <= 2 and not slug_like:
                return True

        if title_norm and any(token == title_norm or token in title_norm for token in self._LOW_SIGNAL_TITLE_TOKENS):
            return True

        return False

    @staticmethod
    def _host_matches(host: str, domain: str) -> bool:
        return host == domain or host.endswith(f".{domain}")

    @staticmethod
    def _path_matches(path: str, blocked_paths: Iterable[str]) -> bool:
        normalized = path.rstrip("/") or "/"
        for blocked in blocked_paths:
            blocked_norm = (blocked or "/").strip().lower().rstrip("/") or "/"
            if normalized == blocked_norm:
                return True
        return False
