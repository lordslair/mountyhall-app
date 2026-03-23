from unittest.mock import MagicMock, patch

from tests.conftest import (
    SCIZ_USER_EMAIL,
    SCIZ_USER_PASSWORD,
    USER_EMAIL,
    USER_PASSWORD,
    auth_header_from_login,
)


def _json_response(data):
    m = MagicMock()
    m.raise_for_status = MagicMock()
    m.json.return_value = data
    return m


def test_sciz_trolls_requires_auth_401(seeded_client):
    resp = seeded_client.get("/group/sciz/trolls")
    assert resp.status_code == 401


def test_sciz_trolls_missing_token_400(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.get("/group/sciz/trolls", headers=headers)
    assert resp.status_code == 400
    assert "Sciz token" in resp.get_json().get("error", "")


@patch("group.requests.post")
def test_sciz_trolls_fetches_and_returns_json(mock_post, seeded_client):
    mock_post.return_value = _json_response({"trolls": [{"id": 1}]})
    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    resp = seeded_client.get("/group/sciz/trolls", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["trolls"][0]["id"] == 1
    mock_post.assert_called_once()


@patch("group.requests.post")
def test_sciz_trolls_uses_cache_second_request(mock_post, seeded_client):
    mock_post.return_value = _json_response({"cached": True})
    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    r1 = seeded_client.get("/group/sciz/trolls", headers=headers)
    assert r1.status_code == 200
    r2 = seeded_client.get("/group/sciz/trolls", headers=headers)
    assert r2.status_code == 200
    assert mock_post.call_count == 1


@patch("group.requests.post")
def test_sciz_trolls_request_failure_500(mock_post, seeded_client):
    mock_post.side_effect = OSError("network down")
    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    resp = seeded_client.get("/group/sciz/trolls", headers=headers)
    assert resp.status_code == 500


def test_bt_requires_auth_401(seeded_client):
    resp = seeded_client.get("/group/bt")
    assert resp.status_code == 401


def test_bt_incomplete_config_400(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.get("/group/bt", headers=headers)
    assert resp.status_code == 400
    assert "Bricol" in resp.get_json().get("error", "")


@patch("group.requests.get")
def test_bt_returns_json_success(mock_get, seeded_client):
    mock_get.return_value = _json_response({"members": []})
    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    resp = seeded_client.get("/group/bt", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json() == {"members": []}
    mock_get.assert_called_once()


@patch("group.requests.get")
def test_bt_non_json_response_502(mock_get, seeded_client):
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.side_effect = ValueError("not json")
    mock_get.return_value = mock_resp

    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    resp = seeded_client.get("/group/bt", headers=headers)
    assert resp.status_code == 502


@patch("group.requests.get")
def test_bt_cache_second_request(mock_get, seeded_client):
    mock_get.return_value = _json_response({"bt": 1})
    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    seeded_client.get("/group/bt", headers=headers)
    seeded_client.get("/group/bt", headers=headers)
    assert mock_get.call_count == 1
