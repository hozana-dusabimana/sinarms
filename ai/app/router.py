"""Shortest-path routing over the facility map graph using NetworkX."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import networkx as nx

from .state import MapGraph, state


def _build_graph(map_graph: MapGraph) -> nx.Graph:
    graph = nx.Graph()
    for node in map_graph.nodes:
        graph.add_node(node["id"], **node)
    for edge in map_graph.edges:
        if not edge.get("isAccessible", True):
            continue
        graph.add_edge(
            edge["from"],
            edge["to"],
            weight=float(edge.get("distanceM", 1) or 1),
            direction=edge.get("direction", "straight"),
            directionHint=edge.get("directionHint", ""),
        )
    return graph


def calculate_route(
    from_node: str,
    to_node: str,
    location_id: Optional[str] = None,
) -> Dict[str, Any]:
    map_graph = state.get_map(location_id) if location_id else state.default_map()
    if map_graph is None:
        return {"pathNodeIds": [], "steps": [], "totalDistanceM": 0, "estimatedTimeMin": 0}

    graph = _build_graph(map_graph)
    if from_node not in graph or to_node not in graph:
        return {"pathNodeIds": [from_node], "steps": [], "totalDistanceM": 0, "estimatedTimeMin": 0}

    try:
        path: List[str] = nx.dijkstra_path(graph, from_node, to_node, weight="weight")
    except nx.NetworkXNoPath:
        return {"pathNodeIds": [from_node], "steps": [], "totalDistanceM": 0, "estimatedTimeMin": 0}

    steps: List[Dict[str, Any]] = []
    total_distance = 0.0
    for index in range(len(path) - 1):
        current_id = path[index]
        next_id = path[index + 1]
        edge_data = graph.get_edge_data(current_id, next_id) or {}
        next_node = graph.nodes[next_id]
        distance = float(edge_data.get("weight", 0))
        total_distance += distance
        steps.append(
            {
                "step": index + 1,
                "nodeId": next_id,
                "instruction": edge_data.get("directionHint")
                or f"Continue to {next_node.get('label', next_id)}.",
                "distanceM": distance,
                "direction": edge_data.get("direction", "straight"),
            }
        )

    return {
        "pathNodeIds": path,
        "steps": steps,
        "totalDistanceM": round(total_distance, 2),
        "estimatedTimeMin": max(1, int(total_distance // 45) + (1 if total_distance % 45 else 0)),
    }


__all__ = ["calculate_route"]
