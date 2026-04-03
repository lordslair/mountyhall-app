from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bs4 import BeautifulSoup
from models import User, BtProfile, utc_now
from database import db
from auth import compute_bt_password_hash
import requests
import logging
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from encoding_utils import deep_fix_mojibake_utf8, json_utf8, text_utf8

# Serve profil HTML from bt_profiles without re-fetching Raistlin if younger than this (see post_bt_bonus_malus).
BT_PROFIL_CACHE_TTL = timedelta(seconds=120)

group_bp = Blueprint('group', __name__, url_prefix='/group')
logger = logging.getLogger(__name__)

# In-memory cache: {cache_key: {'data': ..., 'timestamp': ...}}
_group_cache = {}

def _cache_key(user_id, namespace):
    return f"{user_id}:{namespace}"

def get_cached_data(user_id, namespace='sciz'):
    """Get cached data if it's still valid (less than 60 seconds old)."""
    key = _cache_key(user_id, namespace)
    if key in _group_cache:
        cache_entry = _group_cache[key]
        if datetime.now(timezone.utc) - cache_entry['timestamp'] < timedelta(seconds=60):
            return cache_entry['data']
        del _group_cache[key]
    return None

def set_cached_data(user_id, data, namespace='sciz'):
    """Store data in cache with current timestamp."""
    key = _cache_key(user_id, namespace)
    _group_cache[key] = {
        'data': data,
        'timestamp': datetime.now(timezone.utc)
    }

@group_bp.route('/sciz/trolls', methods=['GET'])
@jwt_required()
def get_sciz_group_trolls():
    """Fetch group trolls from sciz.fr API with 60-second caching."""
    try:
        user_id = int(get_jwt_identity())
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        if not user.sciz_token:
            return jsonify({'error': 'Sciz token not configured. Please set your sciz token in your profile.'}), 400

        cached_data = get_cached_data(user_id, 'sciz')
        if cached_data is not None:
            logger.info(f"Returning cached SCIZ group data for user {user_id}")
            return jsonify(cached_data), 200

        url = 'https://www.sciz.fr/api/hook/trolls'
        headers = {
            'Authorization': user.sciz_token,
            'Content-Type': 'application/json'
        }

        logger.info(f"Fetching SCIZ group data from sciz.fr for user {user_id}")
        try:
            response = requests.post(url, headers=headers, timeout=10)
            response.raise_for_status()

            data = json_utf8(response)
            set_cached_data(user_id, data, 'sciz')

            logger.info(f"Successfully fetched and cached SCIZ group data for user {user_id}")
            return jsonify(data), 200

        except requests.RequestException as e:
            logger.error(f"Failed to fetch group data from sciz.fr: {str(e)}")
            return jsonify({'error': f'Failed to fetch group data: {str(e)}'}), 500

    except Exception as e:
        logger.error(f"Error fetching SCIZ group trolls: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch group trolls', 'details': str(e)}), 500

@group_bp.route('/bt', methods=['GET'])
@jwt_required()
def get_bt_group():
    """Fetch BT group JSON from Raistlin mz_json with 60-second caching (independent from SCIZ)."""
    try:
        user_id = int(get_jwt_identity())
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        bt_system = (user.bt_system or '').strip()
        bt_login = (user.bt_login or '').strip()
        bt_hash = user.bt_hash
        if not bt_hash and user.bt_password:
            bt_hash = compute_bt_password_hash(user.bt_password)

        if not bt_system or not bt_login or not bt_hash:
            return jsonify({
                'error': (
                    'Bricol\'Trolls (BT) is not fully configured. '
                    'Set Nom du système, Compte, and Password in your profile.'
                ),
            }), 400

        cached_data = get_cached_data(user_id, 'bt')
        if cached_data is not None:
            logger.info(f"Returning cached BT group data for user {user_id}")
            return jsonify(cached_data), 200

        path_system = quote(bt_system, safe='')
        url = f'https://it.mh.raistlin.fr/{path_system}/mz_json.php'
        params = {
            'login': bt_login.upper(),
            'password': bt_hash,
        }

        logger.info(f"Fetching BT group data for user {user_id} (system={bt_system!r})")
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            try:
                # Raistlin sometimes embeds UTF-8 misread as Latin-1 inside JSON strings.
                data = deep_fix_mojibake_utf8(json_utf8(response))
            except ValueError:
                logger.error('BT mz_json response is not valid JSON')
                return jsonify({'error': 'Invalid response from BT service (not JSON).'}), 502

            set_cached_data(user_id, data, 'bt')
            logger.info(f"Successfully fetched and cached BT group data for user {user_id}")
            logger.debug(f"BT group data: {data}")
            return jsonify(data), 200

        except requests.RequestException as e:
            logger.error(f"Failed to fetch BT group data: {str(e)}")
            return jsonify({'error': f'Failed to fetch BT group data: {str(e)}'}), 500

    except Exception as e:
        logger.error(f"Error fetching BT group: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch BT group', 'details': str(e)}), 500


def shorten_bonus_malus_title(title: str) -> str:
    """Abbreviate legend for UI: 'dernière maj' → 'MàJ', drop seconds from time (… HH:MM:SS → … HH:MM)."""
    if not title:
        return title
    t = re.sub(r'dernière\s+maj\s*', 'MàJ ', title, count=1, flags=re.IGNORECASE)
    t = re.sub(r'(\d{1,2}:\d{2}):\d{2}\b', r'\1', t)
    return t


def parse_bonus_malus(html: str):
    """Extract Bonus Malus fieldset title and list items from profil HTML. Returns dict or None."""
    if not html or not html.strip():
        return None
    soup = BeautifulSoup(html, 'html.parser')
    for fs in soup.find_all('fieldset'):
        leg = fs.find('legend')
        if not leg:
            continue
        if 'Bonus Malus' not in leg.get_text():
            continue
        leg_copy = BeautifulSoup(str(leg), 'html.parser').find('legend')
        if leg_copy:
            for a in leg_copy.find_all('a'):
                a.decompose()
            title = leg_copy.get_text(' ', strip=True)
        else:
            title = leg.get_text(' ', strip=True)
        items = []
        ul = fs.find('ul')
        if ul:
            for li in ul.find_all('li'):
                t = li.get_text(' ', strip=True)
                if t:
                    items.append(t)
        else:
            for li in fs.find_all('li'):
                t = li.get_text(' ', strip=True)
                if t:
                    items.append(t)
        return {'title': shorten_bonus_malus_title(title), 'items': items}
    return None


def _bt_ensure_raistlin_session(user, user_id):
    """
    Log in to Raistlin and return (session, base_url).
    On configuration or login failure return (None, None, (response, status_code)).
    """
    bt_system = (user.bt_system or '').strip()
    bt_login = (user.bt_login or '').strip()
    bt_password = (user.bt_password or '').strip()

    if not bt_system or not bt_login:
        return None, None, (
            jsonify({
                'error': (
                    'Bricol\'Trolls (BT) is not fully configured. '
                    'Set Nom du système and Compte in your profile.'
                ),
            }),
            400,
        )

    if not bt_password:
        return None, None, (
            jsonify({
                'error': (
                    'BT plaintext password is required for Bonus Malus. '
                    'Save your Bricol\'Trolls password in your profile.'
                ),
            }),
            400,
        )

    path_system = quote(bt_system, safe='')
    base = f'https://it.mh.raistlin.fr/{path_system}'
    login_url = f'{base}/login.php'

    sess = requests.Session()
    try:
        login_resp = sess.post(
            login_url,
            data={
                'login': bt_login.upper(),
                'password': bt_password,
                'submit': 'Login',
            },
            timeout=15,
            allow_redirects=True,
        )
        login_resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f'BT login.php request failed for user {user_id}: {e}')
        return None, None, (jsonify({'error': f'BT login failed: {e}'}), 502)

    if not sess.cookies.get('PHPSESSID'):
        logger.error(f'BT login did not return PHPSESSID for user {user_id}')
        return None, None, (jsonify({'error': 'BT login did not return a session cookie.'}), 502)

    return sess, base, None


def _upsert_bt_profile(troll_id_str: str, html: str):
    now = utc_now()
    row = db.session.get(BtProfile, troll_id_str)
    if row:
        row.html_profile = html
        row.updated_at = now
    else:
        db.session.add(
            BtProfile(
                troll_id=troll_id_str,
                html_profile=html,
                created_at=now,
                updated_at=now,
            )
        )


def _bt_profil_cache_fresh(row):
    """True if stored HTML was written within BT_PROFIL_CACHE_TTL (same clock as other group caches)."""
    if not row or not row.html_profile:
        return False
    ua = row.updated_at
    if ua is None:
        return False
    if ua.tzinfo is None:
        ua = ua.replace(tzinfo=timezone.utc)
    cutoff = utc_now() - BT_PROFIL_CACHE_TTL
    return ua >= cutoff


@group_bp.route('/bt/bonus-malus', methods=['POST'])
@jwt_required()
def post_bt_bonus_malus():
    """Return Bonus Malus from bt_profiles if updated within 120s; else login once and GET profil per stale id."""
    try:
        user_id = int(get_jwt_identity())
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        body = request.get_json(silent=True) or {}
        raw_ids = body.get('troll_ids')
        if not isinstance(raw_ids, list):
            return jsonify({'error': 'Request body must include troll_ids array.'}), 400

        troll_ids = []
        for x in raw_ids:
            if x is None:
                continue
            s = str(x).strip()
            if s:
                troll_ids.append(s)

        if not troll_ids:
            return jsonify({'by_troll_id': {}, 'errors': {}}), 200

        by_troll_id = {}
        errors = {}
        ids_to_fetch = []

        for tid in troll_ids:
            row = db.session.get(BtProfile, tid)
            if _bt_profil_cache_fresh(row):
                parsed = parse_bonus_malus(row.html_profile)
                if parsed:
                    by_troll_id[tid] = parsed
            else:
                ids_to_fetch.append(tid)

        if not ids_to_fetch:
            logger.info(
                f'BT bonus-malus: all {len(troll_ids)} troll(s) served from DB cache (≤{int(BT_PROFIL_CACHE_TTL.total_seconds())}s) for user {user_id}'
            )
            return jsonify({'by_troll_id': by_troll_id, 'errors': errors}), 200

        sess, base, login_err = _bt_ensure_raistlin_session(user, user_id)
        if login_err is not None:
            err_resp, err_code = login_err
            return err_resp, err_code

        profil_url = f'{base}/profil.php'

        for tid in ids_to_fetch:
            try:
                r = sess.get(profil_url, params={'id': tid}, timeout=15)
                r.raise_for_status()
            except requests.RequestException as e:
                errors[tid] = str(e)
                logger.warning(f'BT profil fetch failed for user {user_id} troll {tid}: {e}')
                continue

            html = text_utf8(r)
            try:
                _upsert_bt_profile(tid, html)
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                errors[tid] = f'Database error: {e}'
                logger.error(f'bt_profiles upsert failed for user {user_id} troll {tid}: {e}')
                continue

            parsed = parse_bonus_malus(html)
            if parsed:
                by_troll_id[tid] = parsed

        return jsonify({'by_troll_id': by_troll_id, 'errors': errors}), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f'Error in BT bonus-malus: {str(e)}', exc_info=True)
        return jsonify({'error': 'Failed to fetch BT bonus malus', 'details': str(e)}), 500


@group_bp.route('/bt/bonus-malus/refresh', methods=['POST'])
@jwt_required()
def post_bt_bonus_malus_refresh():
    """Force Raistlin update_bonusmalus then profil, upsert DB, return parsed Bonus Malus for one troll."""
    try:
        user_id = int(get_jwt_identity())
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        body = request.get_json(silent=True) or {}
        raw_id = body.get('troll_id')
        if raw_id is None or str(raw_id).strip() == '':
            return jsonify({'error': 'Request body must include troll_id.'}), 400

        tid = str(raw_id).strip()

        sess, base, login_err = _bt_ensure_raistlin_session(user, user_id)
        if login_err is not None:
            err_resp, err_code = login_err
            return err_resp, err_code

        update_url = f'{base}/update_bonusmalus.php'
        profil_url = f'{base}/profil.php'

        try:
            u_resp = sess.get(update_url, params={'id': tid}, timeout=15)
            u_resp.raise_for_status()
        except requests.RequestException as e:
            logger.warning(f'BT update_bonusmalus failed for user {user_id} troll {tid}: {e}')
            return jsonify({'error': f'update_bonusmalus failed: {e}'}), 502

        try:
            r = sess.get(profil_url, params={'id': tid}, timeout=15)
            r.raise_for_status()
        except requests.RequestException as e:
            logger.warning(f'BT profil fetch after refresh failed for user {user_id} troll {tid}: {e}')
            return jsonify({'error': f'profil fetch failed: {e}'}), 502

        html = text_utf8(r)
        try:
            _upsert_bt_profile(tid, html)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f'bt_profiles upsert failed after refresh for user {user_id} troll {tid}: {e}')
            return jsonify({'error': f'Database error: {e}'}), 500

        parsed = parse_bonus_malus(html)
        by_troll_id = {}
        if parsed:
            by_troll_id[tid] = parsed

        return jsonify({'by_troll_id': by_troll_id, 'errors': {}}), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f'Error in BT bonus-malus refresh: {str(e)}', exc_info=True)
        return jsonify({'error': 'Failed to refresh BT bonus malus', 'details': str(e)}), 500
