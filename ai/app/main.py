"""FastAPI entry point for the SINARMS AI engine."""
from __future__ import annotations

import logging
import re
import threading
import time
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from models import embeddings, faq_matcher, intent_classifier

from .backend_client import fetch_faq, fetch_maps
from .config import AI_HOST, AI_PORT
from . import router
from .state import state

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


def _refresh_from_backend() -> bool:
    maps = fetch_maps()
    if not maps:
        LOGGER.warning("Backend unreachable; AI engine has no facility maps yet.")
        return False

    state.set_maps(maps)
    intent_classifier.invalidate_cache()
    LOGGER.info("Loaded %d facility map(s) from backend.", len(maps))

    faq_entries = fetch_faq()
    state.set_faq(faq_entries)
    faq_matcher.invalidate_cache()
    LOGGER.info("Loaded %d FAQ entries from backend.", len(faq_entries))
    return True


def _startup_warmup() -> None:
    # On a fresh deploy this container can come up before the backend is
    # ready; without retries it served empty state until manually restarted.
    for _attempt in range(20):
        if state.maps or _refresh_from_backend():
            break
        time.sleep(6)

    # Loading the MiniLM encoder takes tens of seconds on a small host. Done
    # lazily it lands on the first visitor query, which then exceeds the
    # backend's AI timeout and trips its circuit breaker into offline
    # fallback — so pay the cost here instead.
    embeddings.get_encoder()
    LOGGER.info("Startup warm-up complete (encoder loaded: %s).", embeddings.is_loaded())


@app.on_event("startup")
async def startup() -> None:
    threading.Thread(target=_startup_warmup, name="startup-warmup", daemon=True).start()


@app.get("/healthz")
async def healthz() -> Dict[str, Any]:
    return {
        "status": "ok",
        "deployMarker": "pipeline-test-1",
        "locations": list(state.maps.keys()),
        "faqEntries": len(state.faq),
        "models": intent_classifier.models_loaded(),
    }


@app.post("/ai/classify-intent")
async def classify_intent(payload: ClassifyRequest) -> Dict[str, Any]:
    return intent_classifier.classify(payload.text, payload.locationId)


@app.post("/ai/calculate-route")
async def calculate_route(payload: RouteRequest) -> Dict[str, Any]:
    result = router.calculate_route(payload.fromNode, payload.toNode, payload.locationId)
    if not result["pathNodeIds"]:
        raise HTTPException(status_code=404, detail="No route available.")
    return result


@app.post("/ai/chatbot")
async def chatbot(payload: ChatbotRequest) -> Dict[str, Any]:
    query = (payload.query or "").strip()
    if not query:
        return {"answer": None, "fallback": "Please type a question.", "confidence": 0.0, "type": "faq"}

    nav_forced = payload.type == "navigation" or bool(NAV_KEYWORDS.search(query))

    nav_local = intent_classifier.classify(query, payload.locationId)
    nav_conf = float(nav_local.get("confidence") or 0.0)

    # If the current location is weak, check whether the destination exists in
    # a *different* facility map. If so, annotate the result with the location
    # so the frontend can offer to switch.
    cross_location: Optional[Dict[str, Any]] = None
    if nav_local.get("status") != "resolved" or nav_conf < 0.7:
        candidate = intent_classifier.classify_across_locations(query)
        candidate_conf = float(candidate.get("confidence") or 0.0)
        candidate_loc = candidate.get("locationId")
        if (
            candidate_loc
            and candidate_loc != (payload.locationId or candidate_loc)
            and candidate_conf > nav_conf + 0.05
        ):
            cross_location = candidate

    nav_is_strong = nav_local.get("status") in {"resolved", "confirm"} and nav_conf >= NAV_USABLE_THRESHOLD

    # Answer clear navigation queries without consulting the FAQ matcher —
    # its embedding encode is the slowest part of this handler and the
    # result would be discarded anyway.
    if nav_forced and nav_is_strong:
        return {**nav_local, "type": "navigation"}

    faq_result = faq_matcher.answer(query, payload.organizationId)
    faq_conf = float(faq_result.get("confidence") or 0.0)

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

    intent_classifier.invalidate_cache()
    return {"status": "ok", "locations": list(state.maps.keys())}


@app.post("/ai/refresh-faq")
async def refresh_faq(payload: RefreshFaqRequest) -> Dict[str, Any]:
    if payload.faq is not None:
        state.set_faq(payload.faq)
    else:
        state.set_faq(fetch_faq())
    faq_matcher.invalidate_cache()
    return {"status": "ok", "faqEntries": len(state.faq)}


def run() -> None:  # pragma: no cover - manual entry
    import uvicorn

    uvicorn.run("app.main:app", host=AI_HOST, port=AI_PORT, reload=False)


if __name__ == "__main__":  # pragma: no cover
    run()
