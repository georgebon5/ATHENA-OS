from __future__ import annotations

import io
import json
import time

import pytest
from PIL import Image
from starlette.websockets import WebSocketDisconnect

from app.config import REPO_ROOT

from .conftest import jpeg_bytes, receive_until, wait_for

PUBLIC = {"cf-connecting-ip": "203.0.113.7"}


def post_report(client, headers=None, **form):
    data = {"lng": "23.7111", "lat": "37.9789", "heading": "48.5", "accuracy": "6"} | form
    files = {"photo": ("photo.jpg", jpeg_bytes(), "image/jpeg")}
    return client.post("/api/reports", data=data, files=files, headers=headers or {})


# ---------------- reports ----------------
def test_report_upload_resizes_strips_exif_and_classifies(client):
    with client.websocket_connect("/ws") as ws:
        r = post_report(client)
        assert r.status_code == 201, r.text
        report = r.json()
        assert report["location"] == [23.7111, 37.9789]
        assert report["heading"] == 48.5 and report["accuracyM"] == 6
        assert report["photoUrl"].startswith("http://localhost:8000/media/photos/")

        created = receive_until(ws, lambda m: m["type"] == "report.created")
        assert created["payload"]["id"] == report["id"]
        classified = receive_until(ws, lambda m: m["type"] == "report.classified")
        assert classified["payload"]["classification"]["category"] == "heat_exposure"

    img_path = report["photoUrl"].replace("http://localhost:8000", "")
    img = Image.open(io.BytesIO(client.get(img_path).content))
    assert max(img.size) <= 1600
    assert img.size == (1067, 1600)  # orientation 6 → περιστροφή, μετά resize
    assert not img.getexif()  # κανένα EXIF (ούτε μοντέλο κινητού)
    assert "immutable" in client.get(img_path).headers["cache-control"]

    listed = client.get("/api/reports").json()
    assert listed[-1]["classification"]["severity"] == 4


def test_report_rejects_non_image_and_rate_limits(client):
    r = client.post(
        "/api/reports", data={"lng": "23.7", "lat": "37.9"}, files={"photo": ("x.jpg", b"nope", "image/jpeg")}
    )
    assert r.status_code == 415
    headers = {"x-device-id": "device-rate-limit-1"}
    assert post_report(client, headers).status_code == 201
    assert post_report(client, headers).status_code == 429


def test_report_optional_fields_can_be_empty(client):
    r = post_report(client, {"x-device-id": "device-empty-1"}, heading="", accuracy="null")
    assert r.status_code == 201
    assert r.json()["heading"] is None and r.json()["accuracyM"] is None


# ---------------- websocket ----------------
def test_ping_pong_and_replay_after_refresh(client):
    events = [
        {"type": "director.beat", "payload": {"beat": "SIMULATE"}},
        {"type": "layer.set", "payload": {"layer": "thermal", "visible": True}},
        {"type": "time.set", "payload": {"when": "2026-07-15T14:00:00+03:00"}},
        {
            "type": "camera.flyTo",
            "payload": {"lngLat": [23.71, 37.97], "heightM": 300, "headingDeg": 10, "pitchDeg": -30, "durationS": 4},
        },
        {"type": "agent.say", "payload": {"textEl": "Γεια σας"}},
    ]
    assert client.post("/api/events", json=events).status_code == 200

    with client.websocket_connect("/ws?room=screen") as ws:
        replay = [ws.receive_json() for _ in range(4)]
        types = [m["type"] for m in replay]
        assert types == ["director.beat", "time.set", "layer.set", "camera.flyTo"]
        assert all(m["replay"] for m in replay)
        assert replay[-1]["payload"]["durationS"] == 0  # χωρίς animation στο refresh
        ws.send_json({"type": "ping"})
        assert receive_until(ws, lambda m: m["type"] == "pong")


def test_events_are_checked_against_contracts(client):
    bad = client.post("/api/events", json={"type": "layer.set", "payload": {"layer": "lava", "visible": True}})
    assert bad.status_code == 422
    unknown = client.post("/api/events", json={"type": "explode", "payload": {}})
    assert unknown.status_code == 422


def test_agent_can_publish_over_ws(client):
    with client.websocket_connect("/ws?room=screen") as screen, client.websocket_connect("/ws?room=agent") as agent:
        agent.send_json({"type": "agent.thinking", "payload": {"stepEl": "Δοκιμάζω 3 παραλλαγές"}})
        msg = receive_until(screen, lambda m: m["type"] == "agent.thinking")
        assert msg["payload"]["stepEl"] == "Δοκιμάζω 3 παραλλαγές"
        agent.send_json({"type": "agent.say", "payload": {}})
        assert receive_until(agent, lambda m: m["type"] == "error")


# ---------------- votes ----------------
def open_consultation(client):
    body = {
        "scenarioId": "s-1",
        "beforeUrl": "/media/photos/x.jpg",
        "afterUrl": "https://example.org/after.png",
        "questionEl": "Δέντρα στην Πειραιώς;",
    }
    r = client.post("/api/consultations", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_one_vote_per_device_and_live_tally(client):
    c = open_consultation(client)
    assert c["publicUrl"] == f"https://athena.example/c/v/{c['id']}"
    assert c["beforeUrl"] == "http://localhost:8000/media/photos/x.jpg"
    url = f"/api/consultations/{c['id']}/votes"

    with client.websocket_connect(f"/ws?room=citizen:{c['id']}") as phone:
        assert client.post(url, json={"choice": "yes"}, headers={"x-device-id": "phone-aaaa-1"}).status_code == 200
        # η ίδια συσκευή αλλάζει γνώμη (μετά το rate limit)
        assert client.post(url, json={"choice": "no"}, headers={"x-device-id": "phone-aaaa-1"}).status_code == 429
        time.sleep(0.9)
        assert client.post(url, json={"choice": "no"}, headers={"x-device-id": "phone-aaaa-1"}).status_code == 200
        r = client.post(
            url, json={"choice": "maybe", "location": [23.7125, 37.9785]}, headers={"x-device-id": "phone-bbbb-2"}
        )
        assert r.json() | {"points": None} == {
            "consultationId": c["id"],
            "yes": 0,
            "no": 1,
            "maybe": 1,
            "points": None,
        }
        tally = receive_until(phone, lambda m: m["type"] == "vote.tally" and m["payload"]["maybe"] == 1)
        assert tally["payload"]["no"] == 1
        (point,) = tally["payload"]["points"]
        assert abs(point["lngLat"][0] - 23.7125) < 0.001


def test_cookie_identifies_device(client):
    c = open_consultation(client)
    r = client.get(f"/api/consultations/{c['id']}")
    assert "athena_did" in r.cookies or "athena_did" in client.cookies
    url = f"/api/consultations/{c['id']}/votes"
    assert client.post(url, json={"choice": "yes"}).json()["yes"] == 1
    time.sleep(0.9)
    assert client.post(url, json={"choice": "yes"}).json()["yes"] == 1  # ίδιο cookie → ίδια ψήφος


def test_invalid_vote(client):
    c = open_consultation(client)
    assert client.post(f"/api/consultations/{c['id']}/votes", json={"choice": "ναι"}).status_code == 422
    assert client.post("/api/consultations/nope/votes", json={"choice": "yes"}).status_code == 404


# ---------------- δημόσιο δίκτυο (tunnel) ----------------
def test_public_requests_only_reach_citizen_endpoints(client):
    c = open_consultation(client)
    assert (
        client.post("/api/events", json={"type": "agent.say", "payload": {"textEl": "x"}}, headers=PUBLIC).status_code
        == 403
    )
    assert client.post("/api/director/reset", headers=PUBLIC).status_code == 403
    assert client.get("/api/reports", headers=PUBLIC).status_code == 403
    pub = client.get(f"/api/consultations/{c['id']}", headers=PUBLIC)
    assert pub.status_code == 200
    assert pub.json()["beforeUrl"] == "/media/photos/x.jpg"  # same-origin για τα κινητά
    vote = client.post(
        f"/api/consultations/{c['id']}/votes", json={"choice": "yes"}, headers=PUBLIC | {"x-device-id": "pub-device-1"}
    )
    assert vote.status_code == 200
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws?room=screen", headers=PUBLIC) as ws:
            ws.receive_json()
    with client.websocket_connect(f"/ws?room=citizen:{c['id']}", headers=PUBLIC) as ws:
        # replay (μπορεί να είναι έως 500 ms παλιό) και μετά το φρέσκο broadcast
        assert receive_until(ws, lambda m: m["type"] == "vote.tally" and m["payload"]["yes"] == 1)


# ---------------- scenarios ----------------
SCENARIO = {
    "id": "s-test-1",
    "title": "Δέντρα στην Πειραιώς",
    "edits": [{"type": "add_trees", "geometry": [[23.71, 37.978], [23.712, 37.979]], "count": 20, "side": "south"}],
    "when": "2026-07-15T14:00:00+03:00",
    "origin": "user",
}


def test_scenario_mock_broadcasts_progress_and_result(client):
    with client.websocket_connect("/ws") as ws:
        r = client.post("/api/scenarios", json=SCENARIO)
        assert r.status_code == 200
        assert r.headers["x-athena-source"] == "mock"
        assert r.json()["scenarioId"] == "s-test-1"
        assert receive_until(ws, lambda m: m["type"] == "scenario.created")["payload"]["id"] == "s-test-1"
        assert receive_until(ws, lambda m: m["type"] == "sim.result")["payload"]["status"] == "ok"
    assert client.get("/api/scenarios/s-test-1/result").json()["scenarioId"] == "s-test-1"


def test_scenario_falls_back_to_cache_when_sim_down(make_client, tmp_path):
    client = make_client(mock=False)
    r = client.post("/api/scenarios", json=SCENARIO)
    assert r.status_code == 200 and r.json()["status"] == "error"
    assert r.headers["x-athena-source"] == "error"

    cached = json.loads((REPO_ROOT / "packages/contracts/fixtures/sim_result.json").read_text(encoding="utf-8"))
    (tmp_path / "demo/cache/sim").mkdir(parents=True)
    (tmp_path / "demo/cache/sim/s-test-2.json").write_text(json.dumps(cached), encoding="utf-8")
    r = client.post("/api/scenarios", json=SCENARIO | {"id": "s-test-2"})
    assert r.headers["x-athena-source"] == "fallback"
    assert r.json()["status"] == "ok" and r.json()["scenarioId"] == "s-test-2"
    status = client.get("/api/director/status").json()
    assert status["services"]["sim"] == "down"
    assert any("cached" in f for f in status["fallbacks"])


def test_invalid_scenario_rejected(client):
    assert client.post("/api/scenarios", json={**SCENARIO, "edits": [{"type": "teleport"}]}).status_code == 422


# ---------------- director ----------------
def test_director_beat_fallback_and_reset(make_client, tmp_path):
    client = make_client(seed_on_start=True)
    cache = tmp_path / "web-cache"
    cache.mkdir()
    (cache / "engage.json").write_text(
        json.dumps(
            [
                {
                    "atMs": 0,
                    "event": {
                        "type": "consultation.opened",
                        "payload": {
                            "id": "c-fallback-1",
                            "scenarioId": "s-1",
                            "beforeUrl": "https://example.org/b.jpg",
                            "afterUrl": "https://example.org/a.jpg",
                            "questionEl": "Συμφωνείτε;",
                            "publicUrl": "https://dead.example/x",
                        },
                    },
                },
                {"atMs": 10, "event": {"type": "agent.say", "payload": {"textEl": "Ψηφίστε!"}}},
            ]
        ),
        encoding="utf-8",
    )
    with client.websocket_connect("/ws?room=director") as ws:
        assert client.post("/api/director/engage").json()["beat"] == "ENGAGE"
        assert receive_until(ws, lambda m: m["type"] == "director.beat")["payload"]["beat"] == "ENGAGE"
        opened = receive_until(ws, lambda m: m["type"] == "consultation.opened")
        # το QR του fallback δείχνει στο δικό μας citizen app και η διαβούλευση δέχεται ψήφους
        assert opened["payload"]["publicUrl"] == "https://athena.example/c/v/c-fallback-1"
        vote = client.post(
            "/api/consultations/c-fallback-1/votes", json={"choice": "yes"}, headers={"x-device-id": "dir-test-01"}
        )
        assert vote.status_code == 200
    assert client.post("/api/director/nope").status_code == 404

    assert len(client.get("/api/reports").json()) == 40  # seeded
    post_report(client, {"x-device-id": "dir-test-02"})
    wait_for(lambda: len(client.get("/api/reports").json()) == 41)
    out = client.post("/api/director/reset").json()
    assert out["removedReports"] == 1 and out["removedVotes"] == 1
    assert len(client.get("/api/reports").json()) == 40
    assert client.get("/api/consultations/c-fallback-1").status_code == 404


def test_city_live_and_health(make_client):
    client = make_client(seed_on_start=True)
    live = client.get("/api/city/live").json()
    assert live["reports"]["total"] == 40
    assert sum(live["reports"]["byCategory"].values()) == 40
    assert live["weather"]["source"] == "open-meteo"
    health = client.get("/api/health").json()
    assert health["ok"] and health["db"] == "sqlite"


def test_media_upload_for_agent(client):
    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, "PNG")
    r = client.post("/api/media", files={"file": ("after.png", buf.getvalue(), "image/png")})
    assert r.status_code == 201
    url = r.json()["url"]
    assert url.startswith("http://localhost:8000/media/images/") and url.endswith(".png")
    assert client.post("/api/media", files={"file": ("x.exe", b"MZ", "application/x-msdownload")}).status_code == 415


def test_citizen_spa_served_under_c(make_client, tmp_path):
    client = make_client()
    assert client.get("/c/r").status_code == 503  # δεν έχει γίνει build
    dist = tmp_path / "citizen-dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>citizen</title>", encoding="utf-8")
    (dist / "assets" / "app-123.js").write_text("console.log(1)", encoding="utf-8")
    r = client.get("/c/v/c-123", headers=PUBLIC)
    assert r.status_code == 200 and "citizen" in r.text and r.headers["cache-control"] == "no-cache"
    assert "immutable" in client.get("/c/assets/app-123.js").headers["cache-control"]
    (tmp_path / "secret.txt").write_text("TOP SECRET", encoding="utf-8")
    assert "TOP SECRET" not in client.get("/c/..%2F..%2Fsecret.txt").text  # ποτέ αρχείο έξω από το dist
