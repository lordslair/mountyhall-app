from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import User
from database import db
from datetime import timedelta
import hashlib
import re
import logging
import requests
from bs4 import BeautifulSoup

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')
logger = logging.getLogger(__name__)


def _request_json():
    """Parse JSON body; None when missing, empty, non-JSON, or wrong Content-Type (no exception)."""
    return request.get_json(force=True, silent=True)


def compute_bt_password_hash(password: str):
    """MD5 hex of UTF-8 password (Bricol'Trolls convention)."""
    if not password:
        return None
    clean_password = password.strip().encode('utf-8')
    return hashlib.md5(clean_password).hexdigest()


def validate_email(email: str) -> bool:
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_password(password: str) -> tuple[bool, str]:
    """Validate password strength."""
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    return True, ""

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    try:
        data = _request_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        # Validation
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        is_valid, error_msg = validate_password(password)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Check if user already exists
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'User with this email already exists'}), 409
        
        # Create new user
        user = User(email=email)
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({'message': 'User registered successfully'}), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Registration failed', 'details': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user and return JWT token."""
    try:
        logger.info("Login attempt started")
        data = _request_json()

        if not data:
            logger.warning("Login failed: No data provided in request")
            return jsonify({'error': 'No data provided'}), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        password_length = len(password) if password else 0
        
        logger.info(f"Login attempt for email: {email} (password length: {password_length})")
        
        if not email or not password:
            logger.warning(f"Login failed: Missing email or password (email provided: {bool(email)}, password provided: {bool(password)})")
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Find user
        logger.debug(f"Searching for user with email: {email}")
        user = User.query.filter_by(email=email).first()
        
        if not user:
            logger.warning(f"Login failed: User not found for email: {email}")
            return jsonify({'error': 'Invalid email or password'}), 401
        
        logger.info(f"User found: ID={user.id}, email={user.email}")
        
        # Check password
        password_valid = user.check_password(password)
        logger.debug(f"Password check result: {password_valid}")
        
        if not password_valid:
            logger.warning(f"Login failed: Invalid password for user ID={user.id}, email={email}")
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Create access token (24 hours expiration)
        logger.info(f"Creating access token for user ID={user.id}, email={email}")
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(hours=24)
        )
        
        logger.info(f"Login successful for user ID={user.id}, email={email}")
        return jsonify({'access_token': access_token}), 200
    
    except Exception as e:
        logger.error(f"Login exception occurred: {str(e)}", exc_info=True)
        return jsonify({'error': 'Login failed', 'details': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user (token validation handled by jwt_required)."""
    return jsonify({'message': 'Logged out successfully'}), 200

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get user profile."""
    try:
        user_id = int(get_jwt_identity())
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify(user.to_dict()), 200

    except Exception as e:
        return jsonify({'error': 'Failed to retrieve profile', 'details': str(e)}), 500

def fetch_troll_name_from_mountyhall(troll_id: str) -> str:
    """Helper function to fetch troll name from MountyHall website."""
    try:
        url = f'https://games.mountyhall.com/mountyhall/View/PJView.php?ai_IDPJ={troll_id}'
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        # Parse HTML to find the troll name in h1.entete
        soup = BeautifulSoup(response.text, 'html.parser')
        h1_element = soup.find('h1', class_='entete')
        
        if not h1_element:
            logger.warning(f"Troll name not found on page for troll_id={troll_id}")
            return None
        
        troll_name = h1_element.get_text(strip=True)
        
        if not troll_name:
            logger.warning(f"Troll name is empty for troll_id={troll_id}")
            return None
        
        return troll_name
    
    except requests.RequestException as e:
        logger.error(f"Failed to fetch troll page for troll_id={troll_id}: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error parsing troll name for troll_id={troll_id}: {str(e)}", exc_info=True)
        return None

@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update user profile (troll_id, sciz_token, BT credentials). troll_name is auto-fetched when troll_id changes."""
    try:
        user_id = int(get_jwt_identity())
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = _request_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Track if troll_id changed to auto-fetch troll_name
        troll_id_changed = False
        new_troll_id = None
        
        # Check if troll_id is being updated
        if 'troll_id' in data:
            new_troll_id = data['troll_id'] if data['troll_id'] else None
            if new_troll_id != user.troll_id:
                troll_id_changed = True
        
        # If troll_id is being set/changed, fetch troll_name first before saving
        if troll_id_changed and new_troll_id:
            logger.info(f"Troll ID changed for user {user_id}, fetching troll name for troll_id={new_troll_id}")
            troll_name = fetch_troll_name_from_mountyhall(new_troll_id)
            if troll_name:
                # Only save troll_id if troll_name fetch succeeded
                user.troll_id = new_troll_id
                user.troll_name = troll_name
                logger.info(f"Successfully fetched troll_name='{troll_name}' for troll_id={new_troll_id}")
            else:
                # Don't save troll_id if fetch failed
                logger.warning(f"Failed to fetch troll_name for troll_id={new_troll_id}, troll_id will not be saved")
                return jsonify({'error': f'Troll not found. Could not retrieve troll information for Troll ID {new_troll_id}. Please verify the Troll ID is correct and try again.'}), 400
        elif troll_id_changed and not new_troll_id:
            # If troll_id is cleared, also clear troll_name
            user.troll_id = None
            user.troll_name = None
        
        # Ignore direct troll_name updates from user (it's auto-managed)
        # if 'troll_name' in data:
        #     user.troll_name = data['troll_name'] if data['troll_name'] else None
        
        # Update sciz_token if provided
        if 'sciz_token' in data:
            user.sciz_token = data['sciz_token'] if data['sciz_token'] else None

        if 'bt_system' in data:
            user.bt_system = data['bt_system'] if data['bt_system'] else None
        if 'bt_login' in data:
            user.bt_login = data['bt_login'] if data['bt_login'] else None
        if 'bt_password' in data:
            pw = data['bt_password']
            if pw:
                user.bt_password = pw
                user.bt_hash = compute_bt_password_hash(pw)
            else:
                user.bt_password = None
                user.bt_hash = None

        db.session.commit()
        
        return jsonify(user.to_dict()), 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating profile: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to update profile', 'details': str(e)}), 500

@auth_bp.route('/fetch-troll-name', methods=['POST'])
@jwt_required()
def fetch_troll_name():
    """Fetch troll name from MountyHall website based on troll ID."""
    try:
        data = _request_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        troll_id = data.get('troll_id', '').strip()

        if not troll_id:
            return jsonify({'error': 'Troll ID is required'}), 400

        # Fetch the page from MountyHall
        url = f'https://games.mountyhall.com/mountyhall/View/PJView.php?ai_IDPJ={troll_id}'
        
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch troll page: {str(e)}")
            return jsonify({'error': f'Failed to fetch troll information: {str(e)}'}), 500
        
        # Parse HTML to find the troll name in h1.entete
        soup = BeautifulSoup(response.text, 'html.parser')
        h1_element = soup.find('h1', class_='entete')
        
        if not h1_element:
            return jsonify({'error': 'Troll name not found on the page'}), 404
        
        troll_name = h1_element.get_text(strip=True)
        
        if not troll_name:
            return jsonify({'error': 'Troll name is empty'}), 404
        
        return jsonify({'troll_name': troll_name}), 200
    
    except Exception as e:
        logger.error(f"Error fetching troll name: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch troll name', 'details': str(e)}), 500

@auth_bp.route('/health', methods=['GET'])
def health():
    """Health check endpoint for Docker."""
    return jsonify({'status': 'healthy'}), 200
