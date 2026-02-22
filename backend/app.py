from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
import logging

from database import init_db
from auth import auth_bp
from group import group_bp
from monsters import monsters_bp
from admin import admin_bp

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL',
        'sqlite:///instance/app.db'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False  # Handled in route
    
    logger.info("Initializing Flask application...")
    logger.info(f"Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
    
    # Initialize extensions
    # Configure CORS - allow all origins for development
    # Using simple configuration that applies to all routes
    CORS(app,
         origins="*",
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
         allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
         supports_credentials=False,
         automatic_options=True)
    logger.info("CORS configured: allowing all origins")
    
    JWTManager(app)
    
    # Initialize database (creates tables on first run)
    logger.info("Initializing database...")
    init_db(app)
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(group_bp)
    app.register_blueprint(monsters_bp)
    app.register_blueprint(admin_bp)
    
    # Health check endpoint for Docker
    @app.route('/health', methods=['GET'])
    def health():
        """Health check endpoint for Docker."""
        return jsonify({'status': 'healthy'}), 200

    # Add after_request handler to ALWAYS set CORS headers
    # This ensures headers are present even if Flask-CORS misses them
    @app.after_request
    def after_request(response):
        # Always set CORS headers to ensure they're present
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS,PATCH'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response
    
    logger.info("Flask application initialized successfully")
    
    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
