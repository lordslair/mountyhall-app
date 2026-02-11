from flask_sqlalchemy import SQLAlchemy
from flask import Flask
import os
import logging
import stat

db = SQLAlchemy()

logger = logging.getLogger(__name__)

def ensure_instance_directory(db_path: str):
    """Ensure the instance directory exists for SQLite database."""
    if db_path.startswith('sqlite:///'):
        # Extract the directory path from SQLite URI
        # sqlite:///instance/app.db -> instance/app.db
        db_file_path = db_path.replace('sqlite:///', '')
        db_dir = os.path.dirname(db_file_path)
        
        # Only create directory if there's a directory component
        if db_dir and db_dir != '.':
            if not os.path.exists(db_dir):
                try:
                    os.makedirs(db_dir, exist_ok=True)
                    logger.info(f"Created database directory: {db_dir}")
                except Exception as e:
                    logger.error(f"Failed to create directory {db_dir}: {e}")
                    raise
            else:
                logger.debug(f"Database directory already exists: {db_dir}")
        elif not db_dir or db_dir == '.':
            # Database file is in current directory, no subdirectory needed
            logger.debug("Database file will be created in current directory")

def _migrate_monsters_add_is_dead(db_instance):
    """Add is_dead column to monsters table if it does not exist (for existing DBs)."""
    from sqlalchemy import inspect, text
    inspector = inspect(db_instance.engine)
    tables = inspector.get_table_names()
    if 'monsters' not in tables:
        return
    columns = [col['name'] for col in inspector.get_columns('monsters')]
    if 'is_dead' in columns:
        return
    try:
        with db_instance.engine.connect() as conn:
            conn.execute(text('ALTER TABLE monsters ADD COLUMN is_dead BOOLEAN DEFAULT 0'))
            conn.commit()
        logger.info("Migration: added is_dead column to monsters table")
    except Exception as e:
        logger.warning(f"Migration is_dead skipped or failed: {e}")


def init_db(app: Flask):
    """Initialize the database with the Flask app.
    
    Creates the database file and all tables if they don't exist.
    This is safe to call multiple times - it won't recreate existing tables.
    """
    db.init_app(app)
    
    with app.app_context():
        # Get database URI from config
        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', 'sqlite:///instance/app.db')
        
        # Convert relative SQLite paths to absolute paths
        if db_uri.startswith('sqlite:///'):
            db_file_path = db_uri.replace('sqlite:///', '')
            # If path is relative, make it absolute
            if not os.path.isabs(db_file_path):
                abs_db_path = os.path.abspath(db_file_path)
                db_uri = f'sqlite:///{abs_db_path}'
                app.config['SQLALCHEMY_DATABASE_URI'] = db_uri
                logger.info(f"Converted relative database path to absolute: {abs_db_path}")
        
        # Ensure instance directory exists for SQLite
        ensure_instance_directory(db_uri)
        
        # Check if database file exists (for SQLite)
        db_exists = False
        if db_uri.startswith('sqlite:///'):
            db_file_path = db_uri.replace('sqlite:///', '')
            db_exists = os.path.exists(db_file_path)
        
        try:
            # Create all tables (this is idempotent - won't recreate existing tables)
            db.create_all()
            
            # One-time migration: add is_dead column to monsters if missing
            _migrate_monsters_add_is_dead(db)
            
            if db_exists:
                logger.info("Database already exists. Tables verified/created.")
            else:
                logger.info("Database initialized successfully. All tables created.")
                
            # Verify tables were created
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            logger.info(f"Database contains {len(tables)} table(s): {', '.join(tables)}")
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to initialize database: {error_msg}")
            
            # Provide helpful error message for permission issues
            if 'unable to open database file' in error_msg.lower() and db_uri.startswith('sqlite:///'):
                db_file_path_for_log = db_uri.replace('sqlite:///', '')
                db_dir_for_log = os.path.dirname(db_file_path_for_log)
                try:
                    current_uid = os.getuid()
                    if os.path.exists(db_dir_for_log):
                        dir_stat = os.stat(db_dir_for_log)
                        dir_uid = dir_stat.st_uid
                        dir_mode = oct(stat.S_IMODE(dir_stat.st_mode))
                        logger.error(f"PERMISSION ERROR: Directory {db_dir_for_log} exists but is not writable.")
                        logger.error(f"  Current process UID: {current_uid}")
                        logger.error(f"  Directory owner UID: {dir_uid}")
                        logger.error(f"  Directory mode: {dir_mode}")
                        logger.error(f"  Solution: On the host, run: chmod 777 {db_dir_for_log}")
                        logger.error(f"  Or: chown -R 1000:1000 {db_dir_for_log}")
                except Exception as perm_error:
                    logger.error(f"Could not check directory permissions: {perm_error}")
            
            raise
