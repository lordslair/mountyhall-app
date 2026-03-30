from datetime import timedelta
from unittest.mock import MagicMock, patch

from database import db
from group import parse_bonus_malus
from models import BtProfile, User, utc_now
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


BONUS_MALUS_HTML = """
<html><body><fieldset>
<legend>Bonus Malus (dernière maj : 29/03/2026 19:27:54) : <a href="update_bonusmalus.php?id=94284">Mise à jour</a></legend>
<ul>
<li>First malus line : 1 tours</li>
<li>Second line</li>
</ul>
</fieldset></body></html>
"""


def test_parse_bonus_malus_extracts_title_and_items():
    out = parse_bonus_malus(BONUS_MALUS_HTML)
    assert out is not None
    assert "Bonus Malus (dernière maj : 29/03/2026 19:27:54)" in out["title"]
    assert "Mise à jour" not in out["title"]
    assert out["items"] == ["First malus line : 1 tours", "Second line"]


def test_parse_bonus_malus_returns_none_without_fieldset():
    assert parse_bonus_malus("<html><body></body></html>") is None
    assert parse_bonus_malus("") is None


def test_bonus_malus_requires_auth_401(seeded_client):
    resp = seeded_client.post("/group/bt/bonus-malus", json={"troll_ids": [1]})
    assert resp.status_code == 401


def test_bonus_malus_invalid_body_400(seeded_client):
    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    resp = seeded_client.post(
        "/group/bt/bonus-malus",
        json={"troll_ids": "not-a-list"},
        headers=headers,
    )
    assert resp.status_code == 400


def test_bonus_malus_400_without_plaintext_password(seeded_client, seeded_app):
    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    with seeded_app.app_context():
        u = User.query.filter_by(email=SCIZ_USER_EMAIL).first()
        saved = u.bt_password
        u.bt_password = ""
        db.session.commit()
    try:
        resp = seeded_client.post(
            "/group/bt/bonus-malus",
            json={"troll_ids": ["1"]},
            headers=headers,
        )
        assert resp.status_code == 400
        assert "password" in resp.get_json().get("error", "").lower()
    finally:
        with seeded_app.app_context():
            u = User.query.filter_by(email=SCIZ_USER_EMAIL).first()
            u.bt_password = saved
            db.session.commit()


@patch("group.requests.Session")
def test_bonus_malus_502_no_phpsessid(mock_session_class, seeded_client):
    mock_sess = MagicMock()
    mock_session_class.return_value = mock_sess
    mock_sess.post.return_value = MagicMock(raise_for_status=MagicMock())
    mock_sess.cookies.get.return_value = None
    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    resp = seeded_client.post(
        "/group/bt/bonus-malus",
        json={"troll_ids": ["1"]},
        headers=headers,
    )
    assert resp.status_code == 502


@patch("group.requests.Session")
def test_bonus_malus_post_stores_html_and_parses(mock_session_class, seeded_client, seeded_app):
    mock_sess = MagicMock()
    mock_session_class.return_value = mock_sess
    mock_sess.post.return_value = MagicMock(raise_for_status=MagicMock())
    mock_sess.cookies.get.return_value = "sessid"
    get_resp = MagicMock()
    get_resp.raise_for_status = MagicMock()
    get_resp.text = BONUS_MALUS_HTML
    mock_sess.get.return_value = get_resp

    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    resp = seeded_client.post(
        "/group/bt/bonus-malus",
        json={"troll_ids": ["94284"]},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "94284" in data["by_troll_id"]
    assert "Bonus Malus" in data["by_troll_id"]["94284"]["title"]
    assert data["by_troll_id"]["94284"]["items"]

    mock_sess.post.assert_called_once()
    mock_sess.get.assert_called_once()
    call_kw = mock_sess.get.call_args
    assert call_kw[0][0].endswith("/profil.php")
    assert call_kw[1]["params"] == {"id": "94284"}

    with seeded_app.app_context():
        uid = User.query.filter_by(email=SCIZ_USER_EMAIL).first().id
        row = db.session.get(BtProfile, (uid, "94284"))
        assert row is not None
        assert row.html_profile == BONUS_MALUS_HTML
        assert row.created_at is not None
        assert row.updated_at is not None


@patch("group.requests.Session")
def test_bonus_malus_fresh_db_cache_skips_raistlin(mock_session_class, seeded_client, seeded_app):
    with seeded_app.app_context():
        uid = User.query.filter_by(email=SCIZ_USER_EMAIL).first().id
        db.session.add(
            BtProfile(
                user_id=uid,
                troll_id="94284",
                html_profile=BONUS_MALUS_HTML,
                created_at=utc_now(),
                updated_at=utc_now(),
            )
        )
        db.session.commit()

    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    resp = seeded_client.post(
        "/group/bt/bonus-malus",
        json={"troll_ids": ["94284"]},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "94284" in data["by_troll_id"]
    mock_session_class.assert_not_called()


@patch("group.requests.Session")
def test_bonus_malus_stale_cache_refetches_raistlin(mock_session_class, seeded_client, seeded_app):
    with seeded_app.app_context():
        uid = User.query.filter_by(email=SCIZ_USER_EMAIL).first().id
        db.session.add(
            BtProfile(
                user_id=uid,
                troll_id="94284",
                html_profile=BONUS_MALUS_HTML,
                created_at=utc_now() - timedelta(seconds=200),
                updated_at=utc_now() - timedelta(seconds=200),
            )
        )
        db.session.commit()

    mock_sess = MagicMock()
    mock_session_class.return_value = mock_sess
    mock_sess.post.return_value = MagicMock(raise_for_status=MagicMock())
    mock_sess.cookies.get.return_value = "sessid"
    get_resp = MagicMock()
    get_resp.raise_for_status = MagicMock()
    get_resp.text = BONUS_MALUS_HTML
    mock_sess.get.return_value = get_resp

    headers = auth_header_from_login(seeded_client, SCIZ_USER_EMAIL, SCIZ_USER_PASSWORD)
    resp = seeded_client.post(
        "/group/bt/bonus-malus",
        json={"troll_ids": ["94284"]},
        headers=headers,
    )
    assert resp.status_code == 200
    mock_session_class.assert_called_once()
    mock_sess.get.assert_called_once()
