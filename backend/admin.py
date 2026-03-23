from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, Monster
from database import db

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


@admin_bp.route('/metrics', methods=['GET'])
@jwt_required()
def get_metrics():
    """Get admin metrics. Requires JWT and is_admin=True."""
    try:
        user_id = int(get_jwt_identity())
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        if not user.is_admin:
            return jsonify({'error': 'Forbidden: admin access required'}), 403

        users_with_sciz = User.query.filter(
            User.sciz_token.isnot(None),
            User.sciz_token != ''
        ).count()

        users_without_sciz = User.query.filter(
            db.or_(
                User.sciz_token.is_(None),
                User.sciz_token == ''
            )
        ).count()

        total_users = User.query.count()
        total_monsters = Monster.query.count()

        return jsonify({
            'users_with_sciz': users_with_sciz,
            'users_without_sciz': users_without_sciz,
            'total_users': total_users,
            'total_monsters': total_monsters,
        }), 200

    except Exception as e:
        return jsonify({'error': 'Failed to retrieve metrics', 'details': str(e)}), 500
