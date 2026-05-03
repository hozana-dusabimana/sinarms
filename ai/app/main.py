"""FastAPI entry point for the SINARMS AI engine."""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .backend_client import fetch_faq, fetch_maps
from .config import AI_HOST, AI_PORT
from .state import state

# Lazy-load heavy dependencies (ML models, networkx, etc.)
# to allow server startup even if they aren't installed yet
_faq_matcher = None
_intent_classifier = None
_router = None
_models_import_error = None


def _get_faq_matcher():
    global _faq_matcher, _models_import_error
    if _faq_matcher is not None:
        return _faq_matcher
    if _models_import_error is not None:
        raise _models_import_error
    try:
        from models import faq_matcher
        _faq_matcher = faq_matcher
        return faq_matcher
    except Exception as e:
        _models_import_error = e
        raise


def _get_intent_classifier():
    global _intent_classifier, _models_import_error
    if _intent_classifier is not None:
        return _intent_classifier
    if _models_import_error is not None:
        raise _models_import_error
    try:
        from models import intent_classifier
        _intent_classifier = intent_classifier
        return intent_classifier
    except Exception as e:
        _models_import_error = e
        raise


def _get_router():
    global _router
    if _router is not None:
        return _router
    try:
        from . import router
        _router = router
        return router
    except Exception as e:
        raise RuntimeError(f"Router failed to load: {e}")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
LOGGER = logging.getLogger("sinarms-ai")

app = FastAPI(title="SINARMS AI Engine", version="1.0.0")


class ClassifyRequest(BaseModel):
    text: str
    locationId: Optional[str] = Field(default=None)
    language: Optional[str] = Field(default="en")


class RouteRequest(BaseModel):
    fromNode: str = Field(default="entrance")
    toNode: str
    locationId: Optional[str] = Field(default=None)


class ChatbotRequest(BaseModel):
    query: str
    locationId: Optional[str] = Field(default=None)
    organizationId: Optional[str] = Field(default=None)
    type: Optional[str] = Field(default=None)


class RefreshGraphRequest(BaseModel):
    maps: Optional[Dict[str, Any]] = None


class RefreshFaqRequest(BaseModel):
    faq: Optional[List[Dict[str, Any]]] = None


NAV_KEYWORDS = re.compile(
    r"\b(navigate|direction|office|department|go to|get to|where is|manager|meet|ndashaka|urugendo|bureau|salle)\b",
    re.IGNORECASE,
)

# A nav result is "usable" when the classifier is confident enough that we'd
# rather surface a destination than an FAQ. Below this we still include
# alternatives but let the FAQ match win if it is above its own threshold.
NAV_USABLE_THRESHOLD = 0.45


def _refresh_from_backend() -> None:
    maps = fetch_maps()
    if maps:
        state.set_maps(maps)
        try:
            _get_intent_classifier().invalidate_cache()
        except Exception as e:
            LOGGER.warning("Could not invalidate intent classifier cache: %s", e)
        LOGGER.info("Loaded %d facility map(s) from backend.", len(maps))
    else:
        LOGGER.warning("Backend unreachable on startup; AI engine will serve empty state.")

    faq_entries = fetch_faq()
    state.set_faq(faq_entries)
    try:
        _get_faq_matcher().invalidate_cache()
    except Exception as e:
        LOGGER.warning("Could not invalidate FAQ matcher cache: %s", e)
    LOGGER.info("Loaded %d FAQ entries from backend.", len(faq_entries))


@app.on_event("startup")
async def startup() -> None:
    _refresh_from_backend()


@app.get("/healthz")
async def healthz() -> Dict[str, Any]:
    models_loaded = False
    try:
        models_loaded = _get_intent_classifier().models_loaded()
    except Exception:
        pass
    return {
        "status": "ok",
        "locations": list(state.maps.keys()),
        "faqEntries": len(state.faq),
        "models": models_loaded,
    }


@app.post("/ai/classify-intent")
async def classify_intent(payload: ClassifyRequest) -> Dict[str, Any]:
    try:
        return _get_intent_classifier().classify(payload.text, payload.locationId)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Intent classifier unavailable: {str(e)}")


@app.post("/ai/calculate-route")
async def calculate_route(payload: RouteRequest) -> Dict[str, Any]:
    try:
        result = _get_router().calculate_route(payload.fromNode, payload.toNode, payload.locationId)
        if not result["pathNodeIds"]:
            raise HTTPException(status_code=404, detail="No route available.")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Router unavailable: {str(e)}")


@app.post("/ai/chatbot")
async def chatbot(payload: ChatbotRequest) -> Dict[str, Any]:
    query = (payload.query or "").strip()
    if not query:
        return {"answer": None, "fallback": "Please type a question.", "confidence": 0.0, "type": "faq"}

    nav_forced = payload.type == "navigation" or bool(NAV_KEYWORDS.search(query))

    try:
        nav_local = _get_intent_classifier().classify(query, payload.locationId)
    except Exception as e:
        LOGGER.warning("Intent classifier failed: %s", e)
        nav_local = {"status": "error", "confidence": 0.0}
    nav_conf = float(nav_local.get("confidence") or 0.0)

    # If the current location is weak, check whether the destination exists in
    # a *different* facility map. If so, annotate the result with the location
    # so the frontend can offer to switch.
    cross_location: Optional[Dict[str, Any]] = None
    if nav_local.get("status") != "resolved" or nav_conf < 0.7:
        try:
            candidate = _get_intent_classifier().classify_across_locations(query)
            candidate_conf = float(candidate.get("confidence") or 0.0)
            candidate_loc = candidate.get("locationId")
            if (
                candidate_loc
                and candidate_loc != (payload.locationId or candidate_loc)
                and candidate_conf > nav_conf + 0.05
            ):
                cross_location = candidate
        except Exception as e:
            LOGGER.warning("Cross-location classification failed: %s", e)

    try:
        faq_result = _get_faq_matcher().answer(query, payload.organizationId)
    except Exception as e:
        LOGGER.warning("FAQ matcher failed: %s", e)
        faq_result = {"answer": None, "confidence": 0.0}
    faq_conf = float(faq_result.get("confidence") or 0.0)

    nav_is_strong = nav_local.get("status") in {"resolved", "confirm"} and nav_conf >= NAV_USABLE_THRESHOLD

    if nav_forced and nav_is_strong:
        return {**nav_local, "type": "navigation"}

    if nav_is_strong and nav_conf >= faq_conf:
        return {**nav_local, "type": "navigation"}

    if faq_result.get("answer") and faq_conf >= 0.55:
        return faq_result

    if cross_location:
        return {**cross_location, "type": "navigation", "crossLocation": True}

    if nav_local.get("alternatives"):
        return {**nav_local, "type": "navigation"}

    return faq_result


@app.post("/ai/refresh-graph")
async def refresh_graph(payload: RefreshGraphRequest) -> Dict[str, Any]:
    if payload.maps is not None:
        state.set_maps(payload.maps)
    else:
        maps = fetch_maps()
        state.set_maps(maps)

    try:
        _get_intent_classifier().invalidate_cache()
    except Exception as e:
        LOGGER.warning("Could not invalidate intent classifier cache: %s", e)
    return {"status": "ok", "locations": list(state.maps.keys())}


@app.post("/ai/refresh-faq")
async def refresh_faq(payload: RefreshFaqRequest) -> Dict[str, Any]:
    if payload.faq is not None:
        state.set_faq(payload.faq)
    else:
        state.set_faq(fetch_faq())
    try:
        _get_faq_matcher().invalidate_cache()
    except Exception as e:
        LOGGER.warning("Could not invalidate FAQ matcher cache: %s", e)
    return {"status": "ok", "faqEntries": len(state.faq)}


def run() -> None:  # pragma: no cover - manual entry
    import uvicorn

    uvicorn.run("app.main:app", host=AI_HOST, port=AI_PORT, reload=False)


if __name__ == "__main__":  # pragma: no cover
    run()
