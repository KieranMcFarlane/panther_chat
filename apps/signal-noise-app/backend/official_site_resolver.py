#!/usr/bin/env python3
"""Shared official-site candidate scoring and selection utilities."""

from __future__ import annotations

import re
import urllib.parse
from typing import Any, Dict, List, Sequence


_STOPWORDS = {
    "the",
    "club",
    "football",
    "sport",
    "sports",
    "association",
    "team",
    "official",
    "website",
}
_SUFFIX_TOKENS = {"fc", "afc", "cf", "ac", "sc"}
_BLOCKED_DOMAINS = {
    "wikipedia.org",
    "espn.com",
    "facebook.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "youtu.be",
    "instagram.com",
    "tiktok.com",
}
_ECOMMERCE_TERMS = {"store", "shop", "ticket", "tickets", "merch", "retail"}
_CDN_HOST_TOKENS = {"cdn", "images", "image", "media", "static", "assets", "files"}
_BINARY_DOCUMENT_SUFFIXES = (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip")
_SUBBRAND_TERMS = {"women", "womens", "ladies", "academy", "youth", "reserves", "u21", "u18", "girls", "boys", "wgfc", "wfc"}
_LOW_SIGNAL_PATH_TERMS = {
    "match",
    "matches",
    "fixture",
    "fixtures",
    "result",
    "results",
    "calendar",
    "schedule",
    "ticket",
    "tickets",
}
_HIGH_SIGNAL_PATH_TERMS = {
    "news",
    "press",
    "latest-news",
    "about",
    "club",
    "commercial",
    "careers",
    "contact",
    "partners",
}


def _to_alnum(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


def _tokenize(value: str) -> List[str]:
    return [token for token in re.split(r"[^a-z0-9]+", value.lower()) if token]


def _entity_aliases(entity_name: str) -> tuple[set[str], set[str], bool]:
    tokens = _tokenize(entity_name)
    informative = [token for token in tokens if token not in _STOPWORDS and token not in _SUFFIX_TOKENS and len(token) >= 3]
    aliases: set[str] = set()

    compact_full = _to_alnum(entity_name)
    if compact_full:
        aliases.add(compact_full)

    compact_informative = "".join(informative)
    if compact_informative:
        aliases.add(compact_informative)

    informative_initials = "".join(token[0] for token in informative if token)
    if len(informative_initials) >= 2:
        aliases.add(informative_initials)
        if any(token in _SUFFIX_TOKENS for token in tokens):
            aliases.add(f"{informative_initials}fc")

    all_initials = "".join(token[0] for token in tokens if token)
    if len(all_initials) >= 2:
        aliases.add(all_initials)

    entity_has_subbrand_terms = any(token in _SUBBRAND_TERMS for token in tokens)
    return aliases, set(informative), entity_has_subbrand_terms


def _score_candidate(entity_name: str, candidate: Dict[str, Any], index: int) -> tuple[float, List[str]]:
    url = str(candidate.get("url") or "").strip()
    if not url:
        return float("-inf"), ["missing_url"]

    parsed = urllib.parse.urlparse(url)
    host = (parsed.netloc or "").lower().strip()
    if host.startswith("www."):
        host = host[4:]
    path = (parsed.path or "").strip("/")
    domain_labels = [label for label in host.split(".") if label]
    domain_core = domain_labels[-2] if len(domain_labels) >= 2 else host

    title = str(candidate.get("title") or "").lower()
    snippet = str(candidate.get("snippet") or "").lower()
    text = f"{url.lower()} {title} {snippet}"
    host_tokens = set(_tokenize(host))

    aliases, informative_tokens, entity_has_subbrand_terms = _entity_aliases(entity_name)
    host_compact = _to_alnum(host)
    domain_core_compact = _to_alnum(domain_core)
    url_compact = _to_alnum(url)
    candidate_has_subbrand_terms = any(token in text for token in _SUBBRAND_TERMS)

    score = 0.0
    reasons: List[str] = []

    for alias in sorted(aliases, key=len, reverse=True):
        if len(alias) < 3:
            continue
        if alias in domain_core_compact:
            score += 5.5
            reasons.append(f"alias_domain_core:{alias}")
            break
        if alias in host_compact:
            score += 3.5
            reasons.append(f"alias_host:{alias}")
            break
        if alias in url_compact:
            score += 2.0
            reasons.append(f"alias_url:{alias}")
            break

    # Exact alias-to-domain-core matches should outrank derived subbrands.
    if any(alias == domain_core_compact for alias in aliases if len(alias) >= 3):
        score += 3.0
        reasons.append("alias_exact_domain_core")

    token_hits = sum(1 for token in informative_tokens if token in text)
    if token_hits:
        score += min(token_hits, 3)
        reasons.append(f"entity_token_hits:{min(token_hits, 3)}")

    if "official" in title or "official" in snippet:
        score += 2.5
        reasons.append("official_wording")

    if host.endswith((".co.uk", ".com", ".org", ".club", ".football", ".net")):
        score += 1.0
        reasons.append("preferred_tld")

    if any(domain in host for domain in _BLOCKED_DOMAINS):
        score -= 10.0
        reasons.append("blocked_domain")

    if path.lower().endswith(_BINARY_DOCUMENT_SUFFIXES):
        score -= 12.0
        reasons.append("binary_document")

    if any(term in text for term in _ECOMMERCE_TERMS):
        score -= 5.0
        reasons.append("commerce_text")
    if any(term in host_tokens for term in _ECOMMERCE_TERMS):
        score -= 9.0
        reasons.append("commerce_host")

    if any(token in host_tokens for token in _CDN_HOST_TOKENS):
        score -= 8.0
        reasons.append("cdn_host")

    if host.endswith(("youtube.com", "youtu.be")) and path.startswith(("c/", "channel/", "@")):
        score -= 6.0
        reasons.append("social_profile")

    if not path:
        score += 1.5
        reasons.append("root_path")
    else:
        segments = [segment for segment in path.split("/") if segment]
        score -= min(len(segments), 4) * 0.6
        first_segment = segments[0] if segments else ""
        path_tokens = set(_tokenize(path))
        if first_segment in {"news", "blog", "press", "updates", "fixtures", "results"}:
            score -= 1.5
            reasons.append("content_subpath")
        if path_tokens & _HIGH_SIGNAL_PATH_TERMS:
            score += 1.5
            reasons.append("high_signal_path")
        low_signal_hits = path_tokens & _LOW_SIGNAL_PATH_TERMS
        if low_signal_hits:
            score -= 5.0 + (0.5 * max(0, len(segments) - 1))
            reasons.append(f"low_signal_path:{','.join(sorted(low_signal_hits))}")
        if any(term in path_tokens for term in {"article", "story", "report", "game"}) and low_signal_hits:
            score -= 1.0
            reasons.append("low_signal_detail_page")
        if len(segments) >= 3 and low_signal_hits:
            score -= 1.0
            reasons.append("deep_low_signal_path")
        if not low_signal_hits and any(term in path_tokens for term in {"news", "press", "about", "club"}):
            score += 0.5
            reasons.append("entity_content_path")

    if candidate_has_subbrand_terms and not entity_has_subbrand_terms:
        score -= 10.0
        reasons.append("subbrand_mismatch")

    if any(alias in domain_core_compact for alias in aliases if len(alias) >= 3) and any(ch.isdigit() for ch in domain_core):
        score -= 4.0
        reasons.append("numeric_subbrand")

    score -= index * 0.1
    return score, reasons


def rank_official_site_candidates(
    entity_name: str,
    candidates: Sequence[Dict[str, Any]],
    *,
    max_candidates: int = 10,
) -> List[Dict[str, Any]]:
    """Return candidates ranked by canonical-domain likelihood."""
    ranked: List[Dict[str, Any]] = []
    limit = max(1, int(max_candidates or 1))
    for idx, candidate in enumerate(list(candidates)[:limit]):
        score, reasons = _score_candidate(entity_name, candidate, idx)
        url = str(candidate.get("url") or "").strip()
        if not url:
            continue
        ranked.append(
            {
                "url": url,
                "title": str(candidate.get("title") or ""),
                "snippet": str(candidate.get("snippet") or ""),
                "score": round(score, 4),
                "reasons": reasons,
            }
        )

    ranked.sort(key=lambda item: item.get("score", float("-inf")), reverse=True)
    return ranked


def choose_canonical_official_site(
    entity_name: str,
    candidates: Sequence[Dict[str, Any]],
    *,
    max_candidates: int = 10,
) -> str:
    """Select the best official-site URL from candidate search results."""
    ranked = rank_official_site_candidates(
        entity_name=entity_name,
        candidates=candidates,
        max_candidates=max_candidates,
    )
    if ranked:
        return str(ranked[0]["url"]).strip()
    if candidates:
        return str(candidates[0].get("url") or "").strip()
    return ""
