def test_health_returns_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "healthy"


def test_auth_health_returns_ok(client):
    resp = client.get("/auth/health")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "healthy"
