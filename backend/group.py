from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User
from database import db
from auth import compute_bt_password_hash
import requests
import logging
from datetime import datetime, timedelta
from urllib.parse import quote

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
        if datetime.utcnow() - cache_entry['timestamp'] < timedelta(seconds=60):
            return cache_entry['data']
        del _group_cache[key]
    return None

def set_cached_data(user_id, data, namespace='sciz'):
    """Store data in cache with current timestamp."""
    key = _cache_key(user_id, namespace)
    _group_cache[key] = {
        'data': data,
        'timestamp': datetime.utcnow()
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

            data = response.json()
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
                data = response.json()
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
