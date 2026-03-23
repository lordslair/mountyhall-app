from unittest.mock import MagicMock, patch

from tests.conftest import (
    USER_EMAIL,
    USER_PASSWORD,
    auth_header_from_login,
    login_json,
)
from database import db
from models import User


def test_register_success(client):
    resp = client.post(
        "/auth/register",
        json={"email": "new@test.com", "password": "secret12"},
        content_type="application/json",
    )
    assert resp.status_code == 201
    assert "registered successfully" in resp.get_json().get("message", "")


def test_register_duplicate_email_409(client):
    client.post(
        "/auth/register",
        json={"email": "dup@test.com", "password": "secret12"},
        content_type="application/json",
    )
    resp = client.post(
        "/auth/register",
        json={"email": "dup@test.com", "password": "otherpass1"},
        content_type="application/json",
    )
    assert resp.status_code == 409


def test_register_no_data_400(client):
    resp = client.post("/auth/register", content_type="application/json")
    assert resp.status_code == 400


def test_register_missing_email_400(client):
    resp = client.post(
        "/auth/register",
        json={"password": "secret12"},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_register_missing_password_400(client):
    resp = client.post(
        "/auth/register",
        json={"email": "a@b.com"},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_register_invalid_email_400(client):
    resp = client.post(
        "/auth/register",
        json={"email": "not-an-email", "password": "secret12"},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_register_short_password_400(client):
    resp = client.post(
        "/auth/register",
        json={"email": "ok@test.com", "password": "short"},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_login_success_returns_token(client):
    client.post(
        "/auth/register",
        json={"email": "login@test.com", "password": "secret12"},
        content_type="application/json",
    )
    resp = login_json(client, "login@test.com", "secret12")
    assert resp.status_code == 200
    assert "access_token" in resp.get_json()


def test_login_missing_fields_400(client):
    resp = client.post("/auth/login", json={}, content_type="application/json")
    assert resp.status_code == 400


def test_login_invalid_password_401(client):
    client.post(
        "/auth/register",
        json={"email": "pw@test.com", "password": "secret12"},
        content_type="application/json",
    )
    resp = login_json(client, "pw@test.com", "wrongpassword")
    assert resp.status_code == 401


def test_login_unknown_user_401(client):
    resp = login_json(client, "nobody@test.com", "secret12")
    assert resp.status_code == 401


def test_logout_success_with_token(client):
    client.post(
        "/auth/register",
        json={"email": "out@test.com", "password": "secret12"},
        content_type="application/json",
    )
    headers = auth_header_from_login(client, "out@test.com", "secret12")
    resp = client.post("/auth/logout", headers=headers)
    assert resp.status_code == 200


def test_logout_without_token_401(client):
    resp = client.post("/auth/logout")
    assert resp.status_code == 401


def test_get_profile_success(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.get("/auth/profile", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["email"] == USER_EMAIL
    assert "id" in data


def test_get_profile_user_not_found_404(app, seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    with app.app_context():
        User.query.filter_by(email=USER_EMAIL).delete()
        db.session.commit()

    resp = seeded_client.get("/auth/profile", headers=headers)
    assert resp.status_code == 404


@patch("auth.fetch_troll_name_from_mountyhall", return_value="FetchedTroll")
def test_put_profile_updates_troll_when_id_changes(mock_fetch, seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.put(
        "/auth/profile",
        headers=headers,
        json={"troll_id": "12345"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["troll_id"] == "12345"
    assert data["troll_name"] == "FetchedTroll"
    mock_fetch.assert_called_once_with("12345")


def test_put_profile_no_data_400(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.put("/auth/profile", headers=headers)
    assert resp.status_code == 400


@patch("auth.fetch_troll_name_from_mountyhall", return_value=None)
def test_put_profile_troll_fetch_fails_400(mock_fetch, seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.put(
        "/auth/profile",
        headers=headers,
        json={"troll_id": "99999"},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_put_profile_updates_sciz_and_bt(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.put(
        "/auth/profile",
        headers=headers,
        json={
            "sciz_token": "new-token",
            "bt_system": "SysA",
            "bt_login": "log",
            "bt_password": "mypass",
        },
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["sciz_token"] == "new-token"
    assert data["bt_system"] == "SysA"
    assert data["bt_login"] == "log"
    assert data["bt_password"] == "mypass"
    from auth import compute_bt_password_hash

    assert data["bt_hash"] == compute_bt_password_hash("mypass")


def test_put_profile_clear_troll_ids(seeded_client, app):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    with app.app_context():
        u = User.query.filter_by(email=USER_EMAIL).first()
        u.troll_id = "1"
        u.troll_name = "Old"
        db.session.commit()

    resp = seeded_client.put(
        "/auth/profile",
        headers=headers,
        json={"troll_id": None},
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["troll_id"] is None
    assert data["troll_name"] is None


@patch("auth.requests.get")
def test_fetch_troll_name_success(mock_get, seeded_client):
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.text = '<html><body><h1 class="entete">MonTroll</h1></body></html>'
    mock_get.return_value = mock_resp

    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.post(
        "/auth/fetch-troll-name",
        headers=headers,
        json={"troll_id": "42"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.get_json()["troll_name"] == "MonTroll"


@patch("auth.requests.get")
def test_fetch_troll_name_missing_h1_404(mock_get, seeded_client):
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.text = "<html><body></body></html>"
    mock_get.return_value = mock_resp

    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.post(
        "/auth/fetch-troll-name",
        headers=headers,
        json={"troll_id": "42"},
        content_type="application/json",
    )
    assert resp.status_code == 404
