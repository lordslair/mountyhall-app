from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User
from database import db
import requests
import logging
from datetime import datetime, timedelta

group_bp = Blueprint('group', __name__, url_prefix='/group')
logger = logging.getLogger(__name__)

# In-memory cache: {user_id: {'data': ..., 'timestamp': ...}}
_group_cache = {}

def get_cached_data(user_id):
    """Get cached data if it's still valid (less than 60 seconds old)."""
    if user_id in _group_cache:
        cache_entry = _group_cache[user_id]
        if datetime.utcnow() - cache_entry['timestamp'] < timedelta(seconds=60):
            return cache_entry['data']
        else:
            # Cache expired, remove it
            del _group_cache[user_id]
    return None

def set_cached_data(user_id, data):
    """Store data in cache with current timestamp."""
    _group_cache[user_id] = {
        'data': data,
        'timestamp': datetime.utcnow()
    }

@group_bp.route('/trolls', methods=['GET'])
@jwt_required()
def get_group_trolls():
    """Fetch group trolls from sciz.fr API with 60-second caching."""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if not user.sciz_token:
            return jsonify({'error': 'Sciz token not configured. Please set your sciz token in your profile.'}), 400
        
        # Check cache first
        cached_data = get_cached_data(user_id)
        if cached_data is not None:
            logger.info(f"Returning cached group data for user {user_id}")
            return jsonify(cached_data), 200
        
        # Fetch from API
        url = 'https://www.sciz.fr/api/hook/trolls'
        headers = {
            'Authorization': user.sciz_token,
            'Content-Type': 'application/json'
        }
        
        logger.info(f"Fetching group data from sciz.fr for user {user_id}")
        try:
            response = requests.post(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Cache the response
            set_cached_data(user_id, data)
            
            logger.info(f"Successfully fetched and cached group data for user {user_id}")
            return jsonify(data), 200
            
        except requests.RequestException as e:
            logger.error(f"Failed to fetch group data from sciz.fr: {str(e)}")
            return jsonify({'error': f'Failed to fetch group data: {str(e)}'}), 500
    
    except Exception as e:
        logger.error(f"Error fetching group trolls: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch group trolls', 'details': str(e)}), 500
