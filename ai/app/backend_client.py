"""Fetch the map graph and FAQ list from the Node.js backend."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

from .config import BACKEND_URL


def _get(path: str, timeout: float = 5.0) -> Optional[Any]:
    try:
        response = httpx.get(f"{BACKEND_URL}{path}", timeout=timeout)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError:
        return None


def _bootstrap() -> Optional[Dict[str, Any]]:
    """Return the public bootstrap payload if the backend is reachable."""
    payload = _get("/api/bootstrap/public")
    if not payload:
        return None
    return payload.get("state") if isinstance(payload, dict) else None


def fetch_maps() -> Dict[str, Any]:
    """Return `{locationId: {nodes, edges}}`.

    The public bootstrap endpoint exposes maps but redacts FAQ, so we read maps
    from there and FAQ from the internal endpoint served on localhost.
    """
    boot = _bootstrap()
    if boot and isinstance(boot.get("maps"), dict):
        return boot["maps"]

    internal = _get("/api/internal/ai-state")
    if internal and isinstance(internal.get("maps"), dict):
        return internal["maps"]

    return {}


def fetch_faq() -> List[Dict[str, Any]]:
    internal = _get("/api/internal/ai-state")
    if internal and isinstance(internal.get("faq"), list):
        return internal["faq"]
    return []
