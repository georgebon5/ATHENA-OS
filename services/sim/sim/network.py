"""
OSM road network: load, cache, apply scenario edits, resolve street names.
Loaded once at startup and kept in module-level state.
"""
from __future__ import annotations
import logging
import unicodedata
from pathlib import Path
from typing import Any

import networkx as nx
import numpy as np
import pandas as pd

from .constants import (
    DEMO_BBOX, DEMO_BBOX_BUFFER_DEG,
    CAPACITY_PER_LANE, DEFAULT_LANES,
    DATA_PROCESSED_DIR, SERAFEIO_LNGLAT,
    M_PER_DEG_LAT, M_PER_DEG_LNG_AT_38,
)

log = logging.getLogger(__name__)

# Module-level state (populated by load_graph())
_G: nx.MultiDiGraph | None = None
_edges_df: pd.DataFrame | None = None   # wayId, name, name_en, geometry, lanes, maxspeed, highway
_node_positions: dict[int, tuple[float, float]] | None = None   # node_id → (lng, lat)


# ── Graph loading ─────────────────────────────────────────────────────────────

def load_graph(force_fetch: bool = False) -> nx.MultiDiGraph:
    """Load or fetch the drive network. Populates module globals."""
    global _G, _edges_df, _node_positions

    graphml_path = DATA_PROCESSED_DIR / "network.graphml"
    gpkg_path = DATA_PROCESSED_DIR / "network.gpkg"

    if not force_fetch and (graphml_path.exists() or gpkg_path.exists()):
        log.info("Loading graph from %s", graphml_path if graphml_path.exists() else gpkg_path)
        _G = _load_from_gpkg(gpkg_path)
    else:
        log.info("Fetching graph from OSM (bbox=%s)…", DEMO_BBOX)
        _G = _fetch_from_osm()
        DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        _save_to_gpkg(_G, gpkg_path)

    _enrich_graph(_G)
    _edges_df = _build_edges_df(_G)
    _node_positions = {n: (d["x"], d["y"]) for n, d in _G.nodes(data=True)}

    log.info("Graph ready: %d nodes, %d edges", _G.number_of_nodes(), _G.number_of_edges())
    return _G


def _fetch_from_osm() -> nx.MultiDiGraph:
    import osmnx as ox
    min_lng, min_lat, max_lng, max_lat = DEMO_BBOX
    buf = DEMO_BBOX_BUFFER_DEG
    # osmnx 2.x: bbox = (left, bottom, right, top) = (west, south, east, north)
    bbox = (min_lng - buf, min_lat - buf, max_lng + buf, max_lat + buf)
    G = ox.graph_from_bbox(bbox=bbox, network_type="drive", retain_all=False, simplify=True)
    G = ox.add_edge_speeds(G)
    G = ox.add_edge_travel_times(G)
    return G


def _load_from_gpkg(path: Path) -> nx.MultiDiGraph:
    """Load from GraphML (osmnx 2.x — preferred format for round-trip fidelity)."""
    import osmnx as ox
    graphml_path = path.with_suffix(".graphml")
    if graphml_path.exists():
        G = ox.io.load_graphml(filepath=graphml_path)
    else:
        # Fallback: reconstruct from GeoPackage via graph_from_gdfs
        import geopandas as gpd
        nodes = gpd.read_file(str(path), layer="nodes")
        edges = gpd.read_file(str(path), layer="edges")
        G = ox.graph_from_gdfs(nodes, edges)
    G = ox.add_edge_speeds(G)
    G = ox.add_edge_travel_times(G)
    return G


def _save_to_gpkg(G: nx.MultiDiGraph, path: Path) -> None:
    try:
        import osmnx as ox
        # Save GraphML for round-trip, GeoPackage for GIS viewing
        ox.io.save_graphml(G, filepath=path.with_suffix(".graphml"))
        ox.io.save_graph_geopackage(G, filepath=path)
        log.info("Saved graph to %s (.graphml + .gpkg)", path.stem)
    except Exception as e:
        log.warning("Could not save graph: %s", e)


def _enrich_graph(G: nx.MultiDiGraph) -> None:
    """Add `capacity`, `t0` (free-flow time s), `wayId` to every edge."""
    for u, v, k, data in G.edges(keys=True, data=True):
        highway = data.get("highway", "unclassified")
        if isinstance(highway, list):
            highway = highway[0]

        lanes_raw = data.get("lanes", DEFAULT_LANES.get(highway, 1))
        if isinstance(lanes_raw, list):
            lanes_raw = lanes_raw[0]
        try:
            lanes = int(lanes_raw)
        except (TypeError, ValueError):
            lanes = DEFAULT_LANES.get(highway, 1)

        cap_per_lane = CAPACITY_PER_LANE.get(highway, 1000.0)
        data["lanes"] = lanes
        data["capacity"] = lanes * cap_per_lane

        # Free-flow time (seconds)
        length_m = data.get("length", 50.0)
        speed_mps = data.get("speed_kph", 50.0) / 3.6
        data["t0"] = length_m / max(speed_mps, 1.0)

        # wayId: use osmid (may be int or list of ints for merged ways)
        osmid = data.get("osmid", 0)
        if isinstance(osmid, list):
            osmid = osmid[0]
        data["wayId"] = int(osmid) if osmid else 0


def _build_edges_df(G: nx.MultiDiGraph) -> pd.DataFrame:
    rows = []
    for u, v, k, data in G.edges(keys=True, data=True):
        name_raw = data.get("name", "")
        name = name_raw[0] if isinstance(name_raw, list) else (name_raw or "")
        name_en_raw = data.get("name:en", "")
        name_en = name_en_raw[0] if isinstance(name_en_raw, list) else (name_en_raw or "")
        highway = data.get("highway", "unclassified")
        if isinstance(highway, list):
            highway = highway[0]
        rows.append({
            "u": u, "v": v, "k": k,
            "wayId": data.get("wayId", 0),
            "name": name,
            "name_en": name_en,
            "name_norm": _normalize(name),
            "name_en_norm": _normalize(name_en),
            "lanes": data.get("lanes", 1),
            "maxspeed": data.get("maxspeed", 50),
            "highway": highway,
            "length": data.get("length", 0.0),
            "capacity": data.get("capacity", 1000.0),
            "t0": data.get("t0", 60.0),
        })
    return pd.DataFrame(rows)


# ── Name resolution ───────────────────────────────────────────────────────────

def _normalize(s: str) -> str:
    """Lowercase, remove accents/diacritics, strip."""
    s = unicodedata.normalize("NFD", s.lower().strip())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def resolve_query(q: str, top_k: int = 10) -> list[dict]:
    """
    Fuzzy match a street name query → list of {wayId, name, score, distM}.
    Works for Greek and Latin script.
    Boosts results near Σεράφειο.
    """
    if _edges_df is None:
        return []

    from rapidfuzz import process, fuzz

    q_norm = _normalize(q)
    df = _edges_df.copy()

    # Score against both Greek and Latin names
    def best_score(row: pd.Series) -> float:
        s1 = fuzz.token_set_ratio(q_norm, row["name_norm"]) / 100.0
        s2 = fuzz.token_set_ratio(q_norm, row["name_en_norm"]) / 100.0
        return max(s1, s2)

    df["score"] = df.apply(best_score, axis=1)
    df = df[df["score"] > 0.3].copy()

    # Distance boost from Σεράφειο reference
    if _node_positions:
        ref_lng, ref_lat = SERAFEIO_LNGLAT
        def dist_to_serafeio(row: pd.Series) -> float:
            u_pos = _node_positions.get(row["u"])
            if u_pos is None:
                return 9999.0
            dlng = u_pos[0] - ref_lng
            dlat = u_pos[1] - ref_lat
            return float(np.sqrt((dlng * M_PER_DEG_LNG_AT_38) ** 2 + (dlat * M_PER_DEG_LAT) ** 2))
        df["distM"] = df.apply(dist_to_serafeio, axis=1)
    else:
        df["distM"] = 9999.0

    # Sort by score desc, then distance asc
    df = df.sort_values(["score", "distM"], ascending=[False, True])

    # Deduplicate by wayId (keep highest score per wayId)
    df = df.drop_duplicates(subset="wayId")

    results = []
    for _, row in df.head(top_k).iterrows():
        results.append({
            "wayId": int(row["wayId"]),
            "name": row["name"] or row["name_en"],
            "score": round(float(row["score"]), 3),
            "distM": round(float(row["distM"]), 1),
        })
    return results


# ── Accessors ─────────────────────────────────────────────────────────────────

def get_graph() -> nx.MultiDiGraph:
    if _G is None:
        raise RuntimeError("Graph not loaded — call load_graph() at startup.")
    return _G


def get_edges_df() -> pd.DataFrame:
    if _edges_df is None:
        raise RuntimeError("Graph not loaded.")
    return _edges_df


def get_node_positions() -> dict[int, tuple[float, float]]:
    if _node_positions is None:
        raise RuntimeError("Graph not loaded.")
    return _node_positions


def graph_stats() -> dict[str, int]:
    if _G is None:
        return {}
    return {"nodes": _G.number_of_nodes(), "edges": _G.number_of_edges()}


# ── Scenario edit application ─────────────────────────────────────────────────

def apply_edits_to_graph(G: nx.MultiDiGraph, edits: list) -> nx.MultiDiGraph:
    """
    Return a COPY of G with scenario edits applied.
    Modifies `capacity` and removes edges (close_road).
    Does NOT modify the original graph.
    """
    H = G.copy()
    for edit in edits:
        match edit.type:
            case "close_road":
                _remove_ways(H, edit.wayIds)
            case "bus_lane":
                # Remove one private car lane: capacity -= cap_per_lane
                _reduce_capacity_by_lanes(H, edit.wayIds, lanes_removed=1)
            case "remove_lane":
                _reduce_capacity_by_lanes(H, edit.wayIds, lanes_removed=1)
            case "add_trees" | "cool_pavement":
                pass  # traffic graph unaffected; handled in thermal module
    return H


def _edges_for_ways(G: nx.MultiDiGraph, way_ids: list[int]) -> list[tuple]:
    """Return (u, v, k) tuples for edges whose wayId is in way_ids."""
    way_set = set(way_ids)
    return [
        (u, v, k)
        for u, v, k, data in G.edges(keys=True, data=True)
        if data.get("wayId") in way_set
    ]


def _remove_ways(G: nx.MultiDiGraph, way_ids: list[int]) -> None:
    for u, v, k in _edges_for_ways(G, way_ids):
        G.remove_edge(u, v, k)


def _reduce_capacity_by_lanes(
    G: nx.MultiDiGraph, way_ids: list[int], lanes_removed: int
) -> None:
    way_set = set(way_ids)
    for u, v, k, data in G.edges(keys=True, data=True):
        if data.get("wayId") in way_set:
            highway = data.get("highway", "secondary")
            if isinstance(highway, list):
                highway = highway[0]
            from .constants import CAPACITY_PER_LANE
            cap_per_lane = CAPACITY_PER_LANE.get(highway, 1200.0)
            current_cap = data.get("capacity", cap_per_lane * 2)
            data["capacity"] = max(current_cap - lanes_removed * cap_per_lane, cap_per_lane)
