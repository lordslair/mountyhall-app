"""Pytest fixtures: isolated SQLite, seeded users/monsters, auth helpers."""
import group as group_module
import pytest

from database import db
from models import Monster, User


USER_EMAIL = "user@test.com"
USER_PASSWORD = "password123"

ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "adminpass"

SCIZ_USER_EMAIL = "sciz@test.com"
SCIZ_USER_PASSWORD = "scizpass"
SCIZ_TOKEN = "fake-sciz-token-for-tests"

# HS256 (default JWT alg) expects HMAC key >= 32 bytes (RFC 7518); shorter keys trigger PyJWT warnings.
TEST_JWT_SECRET_KEY = "test-jwt-secret-key-must-be-at-least-32-bytes-long"


@pytest.fixture(autouse=True)
def clear_group_cache():
    """Avoid SCIZ/BT cache leaking between tests."""
    group_module._group_cache.clear()
    yield
    group_module._group_cache.clear()


@pytest.fixture
def app(tmp_path, monkeypatch):
    """Flask app with temp SQLite file and fixed JWT secret."""
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET_KEY", TEST_JWT_SECRET_KEY)

    # Import after env is patched so create_app picks up test config
    from app import create_app

    application = create_app()
    application.config["TESTING"] = True
    yield application


@pytest.fixture
def client(app):
    return app.test_client()


def seed_database(app):
    """Insert deterministic users and monsters. Call inside app_context."""
    u_regular = User(email=USER_EMAIL, is_admin=False)
    u_regular.set_password(USER_PASSWORD)

    u_admin = User(
        email=ADMIN_EMAIL,
        is_admin=True,
        sciz_token="admin-sciz-token",
    )
    u_admin.set_password(ADMIN_PASSWORD)

    u_sciz = User(email=SCIZ_USER_EMAIL, is_admin=False, sciz_token=SCIZ_TOKEN)
    u_sciz.set_password(SCIZ_USER_PASSWORD)
    u_sciz.bt_system = "TestSystem"
    u_sciz.bt_login = "btuser"
    u_sciz.bt_password = "btsecret"
    from auth import compute_bt_password_hash

    u_sciz.bt_hash = compute_bt_password_hash("btsecret")

    db.session.add_all([u_regular, u_admin, u_sciz])
    db.session.commit()

    m1 = Monster(
        user_id=u_regular.id,
        mob_id="1001",
        mob_name_full="Goblin [Gob]",
        mob_json='{"k": "v"}',
        is_dead=False,
    )
    m2 = Monster(
        user_id=u_regular.id,
        mob_id="1002",
        mob_name_full="Orc [Ork]",
        is_dead=True,
    )
    db.session.add_all([m1, m2])
    db.session.commit()

    return {
        "user": u_regular,
        "admin": u_admin,
        "sciz_user": u_sciz,
        "monsters": [m1, m2],
    }


@pytest.fixture
def seeded_app(app):
    with app.app_context():
        seed_database(app)
    yield app


@pytest.fixture
def seeded_client(seeded_app):
    return seeded_app.test_client()


def login_json(client, email: str, password: str):
    """POST /auth/login and return parsed JSON."""
    resp = client.post(
        "/auth/login",
        json={"email": email, "password": password},
        content_type="application/json",
    )
    return resp


def auth_header_from_login(client, email: str, password: str) -> dict:
    """Return Authorization header dict for JWT-protected routes."""
    resp = login_json(client, email, password)
    assert resp.status_code == 200, resp.get_json()
    token = resp.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
