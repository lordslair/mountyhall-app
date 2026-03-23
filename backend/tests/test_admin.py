from tests.conftest import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    USER_EMAIL,
    USER_PASSWORD,
    auth_header_from_login,
)


def test_admin_metrics_forbidden_for_non_admin(seeded_client):
    headers = auth_header_from_login(seeded_client, USER_EMAIL, USER_PASSWORD)
    resp = seeded_client.get("/admin/metrics", headers=headers)
    assert resp.status_code == 403
    assert "Forbidden" in resp.get_json().get("error", "")


def test_admin_metrics_success(seeded_client):
    headers = auth_header_from_login(seeded_client, ADMIN_EMAIL, ADMIN_PASSWORD)
    resp = seeded_client.get("/admin/metrics", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["total_users"] == 3
    assert data["users_with_sciz"] == 2
    assert data["users_without_sciz"] == 1
    assert data["total_monsters"] == 2


def test_admin_metrics_requires_auth_401(seeded_client):
    resp = seeded_client.get("/admin/metrics")
    assert resp.status_code == 401
