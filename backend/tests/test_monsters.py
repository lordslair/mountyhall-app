from unittest.mock import MagicMock, patch

from tests.conftest import (
    SCIZ_USER_EMAIL,
    SCIZ_USER_PASSWORD,
    USER_EMAIL,
    USER_PASSWORD,
    auth_header_from_login,
)
from database import db
from models import Monster, User


VALID_MONSTER_HTML = (
    "<html><body><h2>un Goblin [Gobelin]</h2></body></html>"
)


def _mock_get_response(text: str, status_ok=True):
    m = MagicMock()
    m.raise_for_status = MagicMock()
    m.text = text
    return m


def test_search_requires_auth_401(seeded_client):
    resp = seeded_client.post("/monsters/search", json={"mob_id": "1"})
    assert resp.status_code == 401


def test_search_no_data_400(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.post("/monsters/search", headers=headers)
    assert resp.status_code == 400


def test_search_missing_mob_id_400(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.post(
        "/monsters/search",
        headers=headers,
        json={},
        content_type="application/json",
    )
    assert resp.status_code == 400


@patch("monsters.requests.get")
def test_search_creates_monster_201(mock_get, seeded_client):
    mock_get.return_value = _mock_get_response(VALID_MONSTER_HTML)
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.post(
        "/monsters/search",
        headers=headers,
        json={"mob_id": "7777"},
        content_type="application/json",
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["mob_id"] == "7777"
    assert "Goblin" in data["mob_name_full"]
    assert "added" in data["message"].lower()


@patch("monsters.requests.get")
def test_search_updates_existing_200(mock_get, seeded_client):
    mock_get.return_value = _mock_get_response(VALID_MONSTER_HTML)
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    seeded_client.post(
        "/monsters/search",
        headers=headers,
        json={"mob_id": "1001"},
        content_type="application/json",
    )
    mock_get.reset_mock()
    mock_get.return_value = _mock_get_response(VALID_MONSTER_HTML)
    resp = seeded_client.post(
        "/monsters/search",
        headers=headers,
        json={"mob_id": "1001"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert "updated" in resp.get_json().get("message", "").lower()


@patch("monsters.requests.get")
def test_search_name_not_found_404(mock_get, seeded_client):
    mock_get.return_value = _mock_get_response("<html><body></body></html>")
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.post(
        "/monsters/search",
        headers=headers,
        json={"mob_id": "55"},
        content_type="application/json",
    )
    assert resp.status_code == 404


@patch("monsters.requests.get")
def test_search_mountyhall_request_fails_500(mock_get, seeded_client):
    mock_get.side_effect = OSError("timeout")
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.post(
        "/monsters/search",
        headers=headers,
        json={"mob_id": "55"},
        content_type="application/json",
    )
    assert resp.status_code == 500


def test_mz_no_monster_404(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.post(
        "/monsters/missing/mz",
        headers=headers,
    )
    assert resp.status_code == 404


def test_mz_missing_mob_name_400(seeded_client, app):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    with app.app_context():
        m = Monster(
            user_id=User.query.filter_by(email=USER_EMAIL).first().id,
            mob_id="nomissing",
            mob_name_full=None,
        )
        db.session.add(m)
        db.session.commit()

    resp = seeded_client.post(
        "/monsters/nomissing/mz",
        headers=headers,
    )
    assert resp.status_code == 400


@patch("monsters.requests.post")
@patch("monsters.requests.get")
def test_mz_monster_dead_flags_and_returns(mock_get, mock_post, seeded_client):
    dead_html = "<html>n'existe pas</html>"
    mock_get.return_value = _mock_get_response(dead_html)
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.post(
        "/monsters/1001/mz",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data.get("dead") is True
    mock_post.assert_not_called()


@patch("monsters.requests.post")
@patch("monsters.requests.get")
def test_mz_fetches_and_stores_json(mock_get, mock_post, seeded_client):
    live_html = "<html><body>ok</body></html>"
    mock_get.return_value = _mock_get_response(live_html)

    mz_resp = MagicMock()
    mz_resp.raise_for_status = MagicMock()
    mz_resp.json.return_value = [{"foo": "bar", "id": "1001"}]
    mock_post.return_value = mz_resp

    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.post(
        "/monsters/1001/mz",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert data["mob_json"]["foo"] == "bar"


def test_events_requires_auth_401(seeded_client):
    resp = seeded_client.get("/monsters/1/events")
    assert resp.status_code == 401


def test_events_no_sciz_400(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.get("/monsters/1/events", headers=headers)
    assert resp.status_code == 400


@patch("monsters.requests.get")
def test_events_returns_list(mock_get, seeded_client):
    mock_get.return_value = _json_events_response({"events": [{"e": 1}]})
    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    resp = seeded_client.get("/monsters/99/events", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json() == [{"e": 1}]


def _json_events_response(payload):
    m = MagicMock()
    m.raise_for_status = MagicMock()
    m.json.return_value = payload
    return m


@patch("monsters.requests.get")
def test_events_sciz_failure_500(mock_get, seeded_client):
    mock_get.side_effect = OSError("down")
    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    resp = seeded_client.get("/monsters/99/events", headers=headers)
    assert resp.status_code == 500


def test_get_monsters_list(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.get("/monsters", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) >= 2
    by_id = {m["mob_id"]: m for m in data}
    assert by_id["1001"]["mob_json"] == {"k": "v"}


def test_delete_monster_404(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.delete("/monsters/unknown-id", headers=headers)
    assert resp.status_code == 404


def test_delete_monster_success(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.delete("/monsters/1002", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["mob_id"] == "1002"


def test_purge_monsters(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.delete("/monsters", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["count"] >= 1
    left = seeded_client.get("/monsters", headers=headers)
    assert left.get_json() == []
