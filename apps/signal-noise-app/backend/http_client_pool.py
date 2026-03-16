#!/usr/bin/env python3
"""Shared async httpx client pool for backend integrations."""

from __future__ import annotations

import asyncio
from typing import Dict, Tuple, Union

import httpx


TimeoutLike = Union[float, int, httpx.Timeout]


class HttpClientPool:
    """Reuse AsyncClient instances per logical profile + timeout policy."""

    def __init__(self) -> None:
        self._clients: Dict[Tuple[str, Tuple[float, float, float, float], bool], httpx.AsyncClient] = {}
        self._lock = asyncio.Lock()
        self._closed = False

    @staticmethod
    def _normalize_timeout(timeout: TimeoutLike) -> httpx.Timeout:
        if isinstance(timeout, httpx.Timeout):
            return timeout
        return httpx.Timeout(timeout=float(timeout))

    @classmethod
    def _timeout_key(cls, timeout: TimeoutLike) -> Tuple[float, float, float, float]:
        normalized = cls._normalize_timeout(timeout)
        return (
            float(normalized.connect if normalized.connect is not None else normalized.timeout),
            float(normalized.read if normalized.read is not None else normalized.timeout),
            float(normalized.write if normalized.write is not None else normalized.timeout),
            float(normalized.pool if normalized.pool is not None else normalized.timeout),
        )

    async def get_client(
        self,
        *,
        profile: str,
        timeout: TimeoutLike,
        follow_redirects: bool = False,
    ) -> httpx.AsyncClient:
        if self._closed:
            raise RuntimeError("HTTP client pool is closed")

        key = (str(profile), self._timeout_key(timeout), bool(follow_redirects))
        async with self._lock:
            existing = self._clients.get(key)
            if existing is not None:
                return existing

            normalized_timeout = self._normalize_timeout(timeout)
            kwargs = {"timeout": normalized_timeout}
            if follow_redirects:
                kwargs["follow_redirects"] = True

            client = httpx.AsyncClient(**kwargs)
            self._clients[key] = client
            return client

    async def close(self) -> None:
        async with self._lock:
            if self._closed:
                return
            clients = list(self._clients.values())
            self._clients.clear()
            self._closed = True

        if clients:
            await asyncio.gather(*(client.aclose() for client in clients), return_exceptions=True)
