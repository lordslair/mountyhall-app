from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, Monster
from database import db
import requests
import logging
import re
from datetime import datetime
import json
from typing import Optional, Tuple

monsters_bp = Blueprint('monsters', __name__, url_prefix='/monsters')
logger = logging.getLogger(__name__)

def is_monster_dead(html_content: str) -> bool:
    """Check if MonsterView page indicates the monster does not exist or has been killed."""
    # Robust check: handle encoding variants (e.g. Tué, été)
    dead_markers = ["n'existe pas", "été Tué", "ete Tue"]
    return any(marker in html_content for marker in dead_markers)


def extract_monster_name(html_content: str) -> Optional[Tuple[str, str, str]]:
    """Extract monster name from HTML using regex pattern.
    
    Returns tuple of (name, type) or None if not found.
    Pattern: /<h2>un[e]? ([-'A-Za-zÀ-ÿ\s]*) \[([A-Za-zÀ-ÿ]*)\]/
    """
    pattern = r"<h2>un[e]? ([-'A-Za-zÀ-ÿ\s]*) \[([A-Za-zÀ-ÿ]*)\]"
    match = re.search(pattern, html_content)
    
    if match:
        name = match.group(1).strip()
        monster_type = match.group(2).strip()
        mob_name_full = f"{name} [{monster_type}]"
        return mob_name_full, name, monster_type
    return None

@monsters_bp.route('/search', methods=['POST'])
@jwt_required()
def search_monster():
    """Search for a monster by ID and fetch its name from MountyHall."""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        mob_id = data.get('mob_id', '').strip()
        if not mob_id:
            return jsonify({'error': 'mob_id is required'}), 400
        
        # Fetch HTML from MountyHall
        url = f'https://games.mountyhall.com/mountyhall/View/MonsterView.php?ai_IDPJ={mob_id}'
        logger.info(f"Fetching monster data from MountyHall for mob_id={mob_id}, user_id={user_id}")
        
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch monster page for mob_id={mob_id}: {str(e)}")
            return jsonify({'error': f'Failed to fetch monster information: {str(e)}'}), 500
        
        # Extract monster name using regex
        logger.warning(f"Response text: {response.text}")
        result = extract_monster_name(response.text)
        
        if not result:
            logger.warning(f"Monster name not found in HTML for mob_id={mob_id}")
            return jsonify({'error': 'Monster name not found on the page'}), 404
        
        mob_name_full, name, monster_type = result
        
        # Check if monster already exists for this user
        existing_monster = Monster.query.filter_by(user_id=user_id, mob_id=mob_id).first()
        
        if existing_monster:
            # Update existing monster
            existing_monster.mob_name_full = mob_name_full
            existing_monster.updated_at = datetime.utcnow()
            db.session.commit()
            logger.info(f"Updated existing monster mob_id={mob_id} for user_id={user_id}")
            return jsonify({
                'mob_id': existing_monster.mob_id,
                'mob_name_full': existing_monster.mob_name_full,
                'message': 'Monster updated successfully'
            }), 200
        else:
            # Create new monster record
            new_monster = Monster(
                user_id=user_id,
                mob_id=mob_id,
                mob_name_full=mob_name_full
            )
            db.session.add(new_monster)
            db.session.commit()
            logger.info(f"Created new monster mob_id={mob_id} for user_id={user_id}")
            return jsonify({
                'mob_id': new_monster.mob_id,
                'mob_name_full': new_monster.mob_name_full,
                'message': 'Monster added successfully'
            }), 201
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error searching monster: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to search monster', 'details': str(e)}), 500

@monsters_bp.route('/<mob_id>/mz', methods=['POST'])
@jwt_required()
def fetch_mz_data(mob_id):
    """Fetch MZ API data for a monster and store it."""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get monster record for this user
        monster = Monster.query.filter_by(user_id=user_id, mob_id=mob_id).first()
        
        if not monster:
            return jsonify({'error': 'Monster not found. Please search for the monster first.'}), 404
        
        if not monster.mob_name_full:
            return jsonify({'error': 'Monster name is missing'}), 400
        
        # Check MonsterView.php before MZ API: if dead, flag and skip MZ
        monster_view_url = f'https://games.mountyhall.com/mountyhall/View/MonsterView.php?ai_IDPJ={mob_id}'
        try:
            mv_response = requests.get(monster_view_url, timeout=10)
            mv_response.raise_for_status()
            if is_monster_dead(mv_response.text):
                monster.is_dead = True
                monster.updated_at = datetime.utcnow()
                db.session.commit()
                logger.info(f"Monster mob_id={mob_id} flagged as dead (n'existe pas ou a été tué)")
                return jsonify({
                    'success': True,
                    'dead': True,
                    'message': "Monstre marqué comme mort (n'existe pas ou a été tué)"
                }), 200
        except requests.RequestException as e:
            logger.error(f"Failed to fetch MonsterView for mob_id={mob_id}: {str(e)}")
            return jsonify({
                'error': f"Impossible de vérifier le statut du monstre: {str(e)}",
                'success': False
            }), 500
        
        # Call MZ API
        mz_url = 'https://mz.mh.raistlin.fr/mz/getCaracMonstre.php'
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        list_data = [{
            "index": 1,
            "id": mob_id,
            "nom": monster.mob_name_full
        }]
        payload = {
            "l": json.dumps(list_data) 
        }
        
        logger.info(f"Fetching MZ data for mob_id={mob_id}, user_id={user_id}")
        
        try:
            response = requests.post(mz_url, data=payload, headers=headers, timeout=10)
            response.raise_for_status()
            
            # MZ API returns an array, first element contains mob_json
            mz_data = response.json()
            
            if not isinstance(mz_data, list) or len(mz_data) == 0:
                logger.warning(f"MZ API returned invalid response for mob_id={mob_id}")
                return jsonify({'error': 'Invalid response from MZ API', 'success': False}), 400
            
            mob_json = mz_data[0]
            
            # Store mob_json as JSON string in database, clear dead flag if resurrected
            monster.mob_json = json.dumps(mob_json, ensure_ascii=False)
            monster.is_dead = False
            monster.updated_at = datetime.utcnow()
            db.session.commit()
            
            logger.info(f"Successfully fetched and stored MZ data for mob_id={mob_id}, user_id={user_id}")
            return jsonify({
                'success': True,
                'mob_json': mob_json,
                'message': 'MZ data fetched and stored successfully'
            }), 200
            
        except requests.RequestException as e:
            logger.error(f"Failed to fetch MZ data for mob_id={mob_id}: {str(e)}")
            return jsonify({
                'error': f'Failed to fetch MZ data: {str(e)}',
                'success': False
            }), 500
        except (ValueError, json.JSONDecodeError) as e:
            logger.error(f"Failed to parse MZ API response for mob_id={mob_id}: {str(e)}")
            return jsonify({
                'error': 'Invalid response from MZ API',
                'success': False
            }), 500
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error fetching MZ data: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch MZ data', 'details': str(e)}), 500

@monsters_bp.route('', methods=['GET'])
@jwt_required()
def get_monsters():
    """Get all monsters for the current user."""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get all monsters for this user
        monsters = Monster.query.filter_by(user_id=user_id).order_by(Monster.created_at.desc()).all()
        
        monsters_list = [monster.to_dict() for monster in monsters]
        
        # Parse mob_json for each monster to make it easier to use in frontend
        for monster_dict in monsters_list:
            if monster_dict['mob_json']:
                try:
                    monster_dict['mob_json'] = json.loads(monster_dict['mob_json'])
                except (ValueError, json.JSONDecodeError):
                    # If parsing fails, keep as string
                    pass
        
        logger.info(f"Retrieved {len(monsters_list)} monsters for user_id={user_id}")
        return jsonify(monsters_list), 200
    
    except Exception as e:
        logger.error(f"Error retrieving monsters: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to retrieve monsters', 'details': str(e)}), 500

@monsters_bp.route('/<mob_id>', methods=['DELETE'])
@jwt_required()
def delete_monster(mob_id):
    """Delete a single monster for the current user."""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get monster record for this user
        monster = Monster.query.filter_by(user_id=user_id, mob_id=mob_id).first()
        
        if not monster:
            return jsonify({'error': 'Monster not found'}), 404
        
        # Delete the monster
        db.session.delete(monster)
        db.session.commit()
        
        logger.info(f"Deleted monster mob_id={mob_id} for user_id={user_id}")
        return jsonify({
            'message': 'Monster deleted successfully',
            'mob_id': mob_id
        }), 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting monster: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to delete monster', 'details': str(e)}), 500

@monsters_bp.route('', methods=['DELETE'])
@jwt_required()
def purge_monsters():
    """Delete all monsters for the current user."""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get all monsters for this user
        monsters = Monster.query.filter_by(user_id=user_id).all()
        count = len(monsters)
        
        # Delete all monsters
        for monster in monsters:
            db.session.delete(monster)
        
        db.session.commit()
        
        logger.info(f"Purged {count} monsters for user_id={user_id}")
        return jsonify({
            'message': f'Successfully deleted {count} monster(s)',
            'count': count
        }), 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error purging monsters: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to purge monsters', 'details': str(e)}), 500
