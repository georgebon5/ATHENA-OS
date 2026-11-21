"""
Static user equilibrium traffic assignment (Frank-Wolfe, BPR cost function).

Methodology:
  - Graph: OSM drive network of demo bbox
  - Demand: synthetic gravity OD matrix between bbox-boundary zones (NOT calibrated to
    counts: no traffic sensors exist in the bbox; stated in SimResult.notes)
  - Assignment: Frank-Wolfe with BPR t_a(x) = t0 * (1 + α*(x/c)^β)
  - Uncertainty: demand sensitivity (×0.85, ×1.00, ×1.15); each level is compared with
    the base of the SAME level → p10/p50/p90
  - Warm start: scenario and base references run the same procedure, so an edit-free
    scenario gives exactly 0 %

References:
  Sheffi, Y. (1985). Urban Transportation Networks.
  BPR: Bureau of Public Roads (1964) Traffic Assignment Manual.
"""
from __future__ import annotations
import logging
import time
from typing import TYPE_CHECKING

import networkx as nx
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra

from .constants import (
    BPR_ALPHA, BPR_BETA,
    FW_N_ITER_BASE, FW_N_ITER_SCENARIO, FW_CONVERGENCE_GAP,
    MC_DEMAND_SCALES,
    DEMO_BBOX,
    COPERT_EMISSIONS_KG_KM,
)
from .models import (
    Range, TrafficPart, TrafficSegment, Trip, Scenario,
)

if TYPE_CHECKING:
    pass

log = logging.getLogger(__name__)

# Cached base assignment (node_id: int → edge flows at equilibrium)
_BASE_FLOWS: dict[tuple, float] | None = None   # (u, v, k) → flow veh/h
_BASE_OD: dict[tuple[int, int], float] | None = None


# ── BPR ──────────────────────────────────────────────────────────────────────

def bpr_time(x: np.ndarray, t0: np.ndarray, cap: np.ndarray) -> np.ndarray:
    """Vectorised BPR travel time."""
    return t0 * (1.0 + BPR_ALPHA * np.power(x / np.maximum(cap, 1.0), BPR_BETA))


# ── OD matrix ────────────────────────────────────────────────────────────────

def _boundary_nodes(G: nx.MultiDiGraph, max_zones: int = 40) -> list[int]:
    """
    Nodes at the bbox boundary (entry/exit zones), capped at max_zones.
    Subsample evenly by longitude so the zones spread across the bbox.
    """
    min_lng, min_lat, max_lng, max_lat = DEMO_BBOX
    margin = 0.002  # ~175 m band
    boundary = []
    for node, data in G.nodes(data=True):
        x, y = data.get("x", 0), data.get("y", 0)
        near_edge = (
            x < min_lng + margin or x > max_lng - margin or
            y < min_lat + margin or y > max_lat - margin
        )
        if near_edge:
            boundary.append(node)

    if not boundary:
        log.warning("No boundary nodes found — using high-degree nodes as OD zones")
        boundary = sorted(G.nodes(), key=lambda n: G.degree(n), reverse=True)[:max_zones]
        return boundary

    # Subsample evenly spread by (x, y) if too many
    if len(boundary) > max_zones:
        boundary.sort(key=lambda n: (G.nodes[n].get("x", 0), G.nodes[n].get("y", 0)))
        step = len(boundary) / max_zones
        boundary = [boundary[int(i * step)] for i in range(max_zones)]

    return boundary


def _build_od_matrix(G: nx.MultiDiGraph, demand_scale: float = 1.0) -> dict[tuple[int, int], float]:
    """
    Build a synthetic OD matrix.
    - Origins/destinations: boundary nodes (capped at 40 zones)
    - Demand: proportional to road capacity at the boundary edge
    - Scaled to 8000 veh/h in total (not calibrated to counts)
    """
    boundary = _boundary_nodes(G)

    # Attraction weights based on node capacity sum
    attract: dict[int, float] = {}
    for n in boundary:
        cap_sum = sum(
            G[n][nbr][k].get("capacity", 1000.0)
            for nbr in G.neighbors(n)
            for k in G[n][nbr]
        )
        attract[n] = max(cap_sum, 100.0)

    total_attraction = sum(attract.values())

    # Total demand (synthetic, see module docstring)
    target_total_demand = 8000.0 * demand_scale  # veh/h across all OD pairs
    od: dict[tuple[int, int], float] = {}
    for orig in boundary:
        for dest in boundary:
            if orig == dest:
                continue
            w = (attract[orig] * attract[dest]) / (total_attraction ** 2)
            d = target_total_demand * w
            if d > 1.0:
                od[(orig, dest)] = d

    return od


# ── Frank-Wolfe ───────────────────────────────────────────────────────────────

def frank_wolfe(
    G: nx.MultiDiGraph,
    od: dict[tuple[int, int], float],
    n_iter: int = FW_N_ITER_BASE,
    warm_start: dict[tuple, float] | None = None,
) -> tuple[dict[tuple, float], dict[tuple, float]]:
    """
    Static UE assignment with Frank-Wolfe.

    Returns:
        flows  : {(u, v, k): flow veh/h}
        times  : {(u, v, k): travel time s}
    """
    edges = [(u, v, k) for u, v, k in G.edges(keys=True)]
    n_edges = len(edges)

    t0_arr = np.array([G[u][v][k].get("t0", 60.0) for u, v, k in edges])
    cap_arr = np.array([G[u][v][k].get("capacity", 1000.0) for u, v, k in edges])

    # Initialize
    if warm_start:
        x = np.array([warm_start.get(e, 0.0) for e in edges])
    else:
        x = np.zeros(n_edges)

    t = bpr_time(x, t0_arr, cap_arr)

    # Shortest paths σε C (scipy.csgraph): ένα dijkstra για όλες τις αφετηρίες ανά επανάληψη
    nodes = list(G.nodes())
    nidx = {n: i for i, n in enumerate(nodes)}
    n_nodes = len(nodes)
    src = np.array([nidx[u] for u, _, _ in edges], dtype=np.int64)
    dst = np.array([nidx[v] for _, v, _ in edges], dtype=np.int64)
    od_by_origin: dict[int, list[tuple[int, float]]] = {}
    for (orig, dest), demand in od.items():
        if demand >= 0.1 and orig in nidx and dest in nidx:
            od_by_origin.setdefault(nidx[orig], []).append((nidx[dest], demand))
    origins = np.array(list(od_by_origin), dtype=np.int64)

    for it in range(n_iter):
        # All-or-nothing: από παράλληλες ακμές κρατάμε τη γρηγορότερη
        order = np.lexsort((t, dst, src))
        first = np.ones(len(order), dtype=bool)
        first[1:] = (src[order][1:] != src[order][:-1]) | (dst[order][1:] != dst[order][:-1])
        best = order[first]
        W = csr_matrix((t[best] + 1e-9, (src[best], dst[best])), shape=(n_nodes, n_nodes))
        edge_of = dict(zip((src[best] * n_nodes + dst[best]).tolist(), best.tolist()))
        _, pred = dijkstra(W, directed=True, indices=origins, return_predecessors=True)

        y = np.zeros(n_edges)
        for row, o in enumerate(origins.tolist()):
            pr = pred[row]
            for j, demand in od_by_origin[o]:
                if pr[j] < 0:
                    continue  # μη προσβάσιμος προορισμός (π.χ. μετά από κλείσιμο)
                while j != o:
                    i = int(pr[j])
                    y[edge_of[i * n_nodes + j]] += demand
                    j = i

        # Optimal step size via bisection on Beckmann integral derivative
        d = y - x

        def phi(lam: float) -> float:
            x_new = x + lam * d
            t_new = bpr_time(x_new, t0_arr, cap_arr)
            return float(np.dot(t_new, d))

        v0, v1 = phi(0.0), phi(1.0)
        if v1 <= 0:
            lam = 1.0  # το Beckmann μειώνεται ως το τέλος του βήματος
        elif v0 >= 0:
            lam = 1.0 / (it + 2)  # αριθμητικός θόρυβος: MSA για ασφάλεια
        else:
            lo, hi = 0.0, 1.0
            for _ in range(16):
                mid = (lo + hi) / 2.0
                if phi(mid) > 0:
                    hi = mid
                else:
                    lo = mid
            lam = (lo + hi) / 2.0

        x_new = x + lam * d
        t = bpr_time(x_new, t0_arr, cap_arr)

        # Relative gap convergence check
        denom = float(np.dot(t, x_new))
        if denom > 0:
            gap = float(np.dot(t, x_new - y)) / denom
            if abs(gap) < FW_CONVERGENCE_GAP:
                log.debug("F-W converged at iter %d (gap=%.2e)", it, gap)
                x = x_new
                break

        x = x_new

    flows = {e: float(x[i]) for i, e in enumerate(edges)}
    times = {e: float(t[i]) for i, e in enumerate(edges)}
    return flows, times


# ── Base assignment ───────────────────────────────────────────────────────────

# Μια αλλαγή μετριέται πάντα απέναντι σε base που έτρεξε με ΑΚΡΙΒΩΣ την ίδια διαδικασία
# (ίδια ζήτηση, ίδιο warm start, ίδιες επαναλήψεις). Έτσι ένα σενάριο χωρίς κυκλοφοριακές
# αλλαγές δίνει ακριβώς 0 % και δεν μετράμε τον «θόρυβο» της μη πλήρους σύγκλισης.
_BASE_REF: dict[float, tuple[dict[tuple, float], dict[tuple, float]]] = {}

TRAFFIC_EDIT_TYPES = {"close_road", "bus_lane", "remove_lane"}
LANE_EDIT_TYPES = {"bus_lane", "remove_lane"}
MAX_SEGMENTS = 60          # τροποποιημένοι δρόμοι + όσοι αλλάζουν περισσότερο ροή
MIN_SEGMENT_DELTA = 15.0   # veh/h: κάτω από αυτό η αλλαγή ροής δεν φαίνεται
N_TRIPS = 60


def ensure_base_assignment(G: nx.MultiDiGraph) -> None:
    """Base ισορροπία + μία αναφορά ανά επίπεδο ζήτησης (κλήση στην εκκίνηση)."""
    global _BASE_FLOWS, _BASE_OD
    if _BASE_FLOWS is not None:
        return
    log.info("Computing base traffic assignment…")
    t0 = time.perf_counter()
    _BASE_OD = _build_od_matrix(G, demand_scale=1.0)
    _BASE_FLOWS, _ = frank_wolfe(G, _BASE_OD, n_iter=FW_N_ITER_BASE)
    for scale in MC_DEMAND_SCALES:
        _BASE_REF[scale] = _assign(G, scale)
    log.info("Base assignment + %d references done in %.1fs", len(_BASE_REF), time.perf_counter() - t0)


def _assign(G: nx.MultiDiGraph, scale: float) -> tuple[dict[tuple, float], dict[tuple, float]]:
    """Ζήτηση = base OD × scale (εξωγενής: δεν αλλάζει επειδή άλλαξε ο δρόμος)."""
    od = {pair: d * scale for pair, d in _BASE_OD.items()}
    warm = {e: f * scale for e, f in _BASE_FLOWS.items()}  # εφικτή ροή για την κλιμακωμένη ζήτηση
    return frank_wolfe(G, od, n_iter=FW_N_ITER_SCENARIO, warm_start=warm)


# ── Scenario simulation ───────────────────────────────────────────────────────

def simulate_traffic(
    G_scenario: nx.MultiDiGraph,
    G_base: nx.MultiDiGraph,
    scenario: Scenario,
) -> tuple[TrafficPart, int, Range, list[str]]:
    """
    Returns (TrafficPart, compute_ms, co2_range, notes_el).
    p10/p50/p90: ανάλυση ευαισθησίας ζήτησης. Σε κάθε επίπεδο (×0.85/×1/×1.15) το σενάριο
    συγκρίνεται με τη base του ΙΔΙΟΥ επιπέδου.
    """
    ensure_base_assignment(G_base)
    t_start = time.perf_counter()
    base_flows, base_times = _BASE_REF[1.0]

    if not any(e.type in TRAFFIC_EDIT_TYPES for e in scenario.edits):
        zero = Range(p10=0.0, p50=0.0, p90=0.0)
        part = TrafficPart(
            segments=[],
            corridorTravelTimeDeltaPct=zero,
            vehicleKmDeltaPct=zero,
            trips=_sample_trips(G_base, base_times),
        )
        notes = ["Κυκλοφορία: το σενάριο δεν αλλάζει το οδικό δίκτυο, άρα ούτε τη ροή (0 %)."]
        return part, int((time.perf_counter() - t_start) * 1000), zero, notes

    corridor = _corridor_edges(G_base, G_scenario, scenario)
    tt, vkm, co2 = [], [], []
    p50_flows: dict[tuple, float] = {}
    p50_times: dict[tuple, float] = {}
    for scale in MC_DEMAND_SCALES:
        flows, times = _assign(G_scenario, scale)
        b_flows, b_times = _BASE_REF[scale]
        tt.append(_pct(_corridor_time(G_base, corridor, b_flows, b_times),
                       _corridor_time(G_base, corridor, flows, times)))
        vkm.append(_pct(_vkm(G_base, b_flows), _vkm(G_base, flows)))
        co2.append(_pct(_co2_kg(G_base, b_flows, b_times), _co2_kg(G_base, flows, times)))
        if scale == 1.0:
            p50_flows, p50_times = flows, times

    def rng(vals: list[float]) -> Range:
        p50 = vals[MC_DEMAND_SCALES.index(1.0)]
        return Range(p10=round(min(vals), 2), p50=round(p50, 2), p90=round(max(vals), 2))

    part = TrafficPart(
        segments=_segments(G_base, scenario, base_flows, base_times, p50_flows, p50_times),
        corridorTravelTimeDeltaPct=rng(tt),
        vehicleKmDeltaPct=rng(vkm),
        trips=_sample_trips(G_scenario, p50_times),
    )
    notes = [
        "Χρόνος άξονα: άθροισμα χρόνων διέλευσης στους δρόμους που αλλάζουν λωρίδες."
        if corridor else
        "Χρόνος: συνολικές ώρες οχημάτων στο δίκτυο (ο δρόμος του σεναρίου κλείνει, άρα δεν έχει χρόνο διέλευσης).",
        "CO₂: οχηματοχιλιόμετρα × συντελεστής COPERT ανά ταχύτητα (μικτός στόλος ΙΧ).",
    ]
    return part, int((time.perf_counter() - t_start) * 1000), rng(co2), notes


def _pct(base: float, new: float) -> float:
    return (new - base) / base * 100.0 if base > 1e-9 else 0.0


def _corridor_edges(G_base: nx.MultiDiGraph, G_scenario: nx.MultiDiGraph, scenario: Scenario) -> list[tuple]:
    """Ακμές των δρόμων με αλλαγή λωρίδων που υπάρχουν ακόμα στο σενάριο. Κενό → μόνο κλεισίματα."""
    ways = {w for e in scenario.edits if e.type in LANE_EDIT_TYPES for w in e.wayIds}
    return [
        (u, v, k) for u, v, k, d in G_base.edges(keys=True, data=True)
        if d.get("wayId") in ways and G_scenario.has_edge(u, v, k)
    ]


def _corridor_time(G: nx.MultiDiGraph, corridor: list[tuple], flows: dict, times: dict) -> float:
    if corridor:
        return sum(times[e] for e in corridor)
    # Μόνο κλεισίματα: συνολικές ώρες οχημάτων (veh·s) στο δίκτυο
    return sum(flows.get(e, 0.0) * times.get(e, 0.0) for e in G.edges(keys=True))


def _vkm(G: nx.MultiDiGraph, flows: dict) -> float:
    return sum(f * G.edges[e].get("length", 0.0) / 1000.0 for e, f in flows.items() if G.has_edge(*e))


def _co2_kg(G: nx.MultiDiGraph, flows: dict, times: dict) -> float:
    """Σ ροή × μήκος × EF(ταχύτητα). Η συμφόρηση ρίχνει την ταχύτητα και ανεβάζει τον συντελεστή."""
    speeds = np.array(sorted(COPERT_EMISSIONS_KG_KM), dtype=float)
    factors = np.array([COPERT_EMISSIONS_KG_KM[s] for s in sorted(COPERT_EMISSIONS_KG_KM)])
    total = 0.0
    for e, f in flows.items():
        if f <= 0 or not G.has_edge(*e):
            continue
        length_m = G.edges[e].get("length", 0.0)
        kph = length_m / max(times.get(e, 1.0), 0.1) * 3.6
        total += f * length_m / 1000.0 * float(np.interp(kph, speeds, factors))
    return total


def _segments(
    G_base: nx.MultiDiGraph,
    scenario: Scenario,
    base_flows: dict, base_times: dict,
    new_flows: dict, new_times: dict,
) -> list[TrafficSegment]:
    """Οι δρόμοι του σεναρίου + όσοι αλλάζουν περισσότερο ροή (εκεί πηγαίνει η κίνηση που εκτρέπεται)."""
    edited = {w for e in scenario.edits if e.type in TRAFFIC_EDIT_TYPES for w in e.wayIds}
    rows = []
    for u, v, k, data in G_base.edges(keys=True, data=True):
        e = (u, v, k)
        b, n = base_flows.get(e, 0.0), new_flows.get(e, 0.0)
        mine = data.get("wayId") in edited
        if (mine and b > 0.1) or abs(n - b) >= MIN_SEGMENT_DELTA:
            rows.append((not mine, -abs(n - b), e, data, b, n))
    rows.sort(key=lambda r: (r[0], r[1]))
    out = []
    for _, _, e, data, b, n in rows[:MAX_SEGMENTS]:
        b_time = base_times.get(e, data.get("t0", 0.0))
        out.append(TrafficSegment(
            wayId=data.get("wayId", 0),
            baseFlow=round(b, 1),
            newFlow=round(n, 1),
            baseTimeS=round(b_time, 1),
            newTimeS=round(new_times.get(e, b_time), 1),  # κλειστός δρόμος: κρατάμε τον χρόνο της base
            path=_edge_path(G_base, *e),
        ))
    return out


def _edge_path(G: nx.MultiDiGraph, u: int, v: int, k: int) -> list[tuple[float, float]] | None:
    geom = G.edges[u, v, k].get("geometry")
    if geom is not None and hasattr(geom, "coords"):
        return [(round(x, 6), round(y, 6)) for x, y in geom.coords]
    u_data, v_data = G.nodes.get(u, {}), G.nodes.get(v, {})
    if "x" in u_data and "x" in v_data:
        return [(u_data["x"], u_data["y"]), (v_data["x"], v_data["y"])]
    return None


def _sample_trips(G: nx.MultiDiGraph, times: dict[tuple, float], n_trips: int = N_TRIPS) -> list[Trip]:
    """
    Διαδρομές για το animation: ζεύγη OD με πιθανότητα ανάλογη της ζήτησης και συντομότερη
    διαδρομή με τους χρόνους της ισορροπίας ΑΥΤΟΥ του σεναρίου (π.χ. παρακάμπτουν κλειστό δρόμο).
    """
    if not _BASE_OD:
        return []
    rng = np.random.default_rng(42)
    pairs = list(_BASE_OD)
    weights = np.array([_BASE_OD[p] for p in pairs])
    picks = rng.choice(len(pairs), size=n_trips * 2, p=weights / weights.sum())  # 2×: κάποια δεν ενώνονται
    by_origin: dict[int, list[int]] = {}
    for i in picks:
        o, d = pairs[i]
        by_origin.setdefault(o, []).append(d)

    def weight(u: int, v: int, edges: dict) -> float:
        return min(times.get((u, v, k), attrs.get("t0", 60.0)) for k, attrs in edges.items())

    trips: list[Trip] = []
    for o, dests in by_origin.items():
        try:
            dist, paths = nx.single_source_dijkstra(G, o, weight=weight)
        except nx.NodeNotFound:
            continue
        for d in dests:
            if d not in paths or len(trips) >= n_trips:
                continue
            coords = [(G.nodes[n]["x"], G.nodes[n]["y"]) for n in paths[d] if "x" in G.nodes[n]]
            if len(coords) >= 2:
                trips.append(Trip(path=coords, departS=round(float(rng.uniform(0, 300)), 1),
                                  durationS=round(float(dist[d]), 1)))
    return trips
