"""Tests for the AI engine that don't require downloading HuggingFace models.

The classifier and FAQ matcher both fall back to keyword/overlap scoring when
the embedding model cannot be loaded (e.g. in CI without outbound network), so
these tests exercise the complete request pipeline end-to-end.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.state import state
from models import faq_matcher, intent_classifier


SAMPLE_MAP = {
    "floorplanImage": None,
    "nodes": [
        {"id": "entrance", "label": "Main Entrance", "aliases": ["entrance"], "type": "checkpoint", "zone": "public", "x": 0, "y": 0, "floor": 1},
        {"id": "reception", "label": "Reception", "aliases": ["front desk"], "type": "office", "zone": "public", "x": 10, "y": 0, "floor": 1},
        {"id": "hr-office", "label": "HR Office", "aliases": ["human resources", "ressources humaines", "ubuyobozi bwa HR"], "type": "office", "zone": "public", "x": 40, "y": 10, "floor": 1},
        {"id": "finance-office", "label": "Finance Office", "aliases": ["accounting department", "bureau finance"], "type": "office", "zone": "public", "x": 40, "y": -10, "floor": 1},
        {"id": "exit", "label": "Exit Gate", "aliases": ["exit"], "type": "exit", "zone": "emergency", "x": 60, "y": 0, "floor": 1},
    ],
    "edges": [
        {"id": "e1", "from": "entrance", "to": "reception", "distanceM": 10, "direction": "straight", "directionHint": "Walk to reception.", "isAccessible": True},
        {"id": "e2", "from": "reception", "to": "hr-office", "distanceM": 15, "direction": "left", "directionHint": "Turn left to HR.", "isAccessible": True},
        {"id": "e3", "from": "reception", "to": "finance-office", "distanceM": 15, "direction": "right", "directionHint": "Turn right to Finance.", "isAccessible": True},
        {"id": "e4", "from": "finance-office", "to": "exit", "distanceM": 20, "direction": "straight", "directionHint": "Go to exit.", "isAccessible": True},
    ],
}


def setup_module(_module) -> None:
    state.set_maps({"loc-test": SAMPLE_MAP})
    state.set_faq(
        [
            {
                "id": "faq-bathroom",
                "organizationId": None,
                "language": "en",
                "question": "Where is the bathroom?",
                "answer": "End of the main corridor beside the fire exit.",
                "keywords": ["bathroom", "toilet", "restroom"],
            },
            {
                "id": "faq-parking",
                "organizationId": None,
                "language": "en",
                "question": "Is there visitor parking?",
                "answer": "Yes, next to the main gate before security.",
                "keywords": ["parking", "car", "vehicle"],
            },
        ]
    )
    intent_classifier.invalidate_cache()
    faq_matcher.invalidate_cache()


client = TestClient(app)


def test_healthz_reports_loaded_state() -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    body = response.json()
    assert "loc-test" in body["locations"]
    assert body["faqEntries"] == 2


def test_classify_intent_resolves_known_destination() -> None:
    response = client.post(
        "/ai/classify-intent",
        json={"text": "I want to visit the HR office", "locationId": "loc-test"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"resolved", "confirm"}
    top_node = body["destinationNodeId"] or body["alternatives"][0]["nodeId"]
    assert top_node == "hr-office"


def test_classify_intent_multilingual_french() -> None:
    response = client.post(
        "/ai/classify-intent",
        json={"text": "Je cherche le bureau finance", "locationId": "loc-test", "language": "fr"},
    )
    body = response.json()
    assert body["status"] in {"resolved", "confirm"}
    top_node = body["destinationNodeId"] or body["alternatives"][0]["nodeId"]
    assert top_node == "finance-office"


def test_calculate_route_returns_dijkstra_path() -> None:
    response = client.post(
        "/ai/calculate-route",
        json={"fromNode": "entrance", "toNode": "finance-office", "locationId": "loc-test"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["pathNodeIds"][0] == "entrance"
    assert body["pathNodeIds"][-1] == "finance-office"
    assert body["totalDistanceM"] == 25
    assert len(body["steps"]) == 2


def test_chatbot_routes_navigation_queries_to_intent_classifier() -> None:
    response = client.post(
        "/ai/chatbot",
        json={"query": "Where is the HR office?", "locationId": "loc-test"},
    )
    body = response.json()
    assert body["type"] == "navigation"
    top_node = body.get("destinationNodeId") or (body.get("alternatives") or [{}])[0].get("nodeId")
    assert top_node == "hr-office"


def test_chatbot_answers_faq_when_not_navigation() -> None:
    response = client.post(
        "/ai/chatbot",
        json={"query": "Is there parking available?", "locationId": "loc-test"},
    )
    body = response.json()
    assert body["type"] == "faq"
    # The embedding path or keyword fallback must surface the parking answer.
    assert body["answer"] is not None
    assert "parking" in body["answer"].lower() or "gate" in body["answer"].lower()


def test_refresh_graph_replaces_maps() -> None:
    response = client.post(
        "/ai/refresh-graph",
        json={"maps": {"loc-other": SAMPLE_MAP}},
    )
    assert response.status_code == 200
    assert "loc-other" in response.json()["locations"]
    # Restore for later tests
    state.set_maps({"loc-test": SAMPLE_MAP})
    intent_classifier.invalidate_cache()
