#!/usr/bin/env python3
"""
Standalone script to initialize the database.
Can be run manually to set up the database before starting the app.
"""
import os
import sys
from dotenv import load_dotenv
from app import create_app
from database import db
import logging

# Logging is configured when importing app (uses LOG_LEVEL from the environment).
logger = logging.getLogger(__name__)

def verify_database_structure():
    """Verify that all required tables exist and have correct structure."""
    try:
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        logger.info("Verifying database structure...")
        logger.info(f"Found {len(tables)} table(s): {', '.join(tables)}")
        
        # Check if users table exists
        if 'users' not in tables:
            logger.error("ERROR: 'users' table not found!")
            return False
        
        # Check users table columns
        columns = [col['name'] for col in inspector.get_columns('users')]
        required_columns = [
            'id', 'email', 'password_hash', 'troll_id', 'troll_name', 'sciz_token',
            'is_admin', 'bt_system', 'bt_login', 'bt_password', 'bt_hash', 'created_at',
        ]
        
        missing_columns = [col for col in required_columns if col not in columns]
        if missing_columns:
            logger.error(f"ERROR: Missing columns in 'users' table: {', '.join(missing_columns)}")
            return False
        
        logger.info("✓ Database structure verified successfully")
        logger.info(f"  Users table columns: {', '.join(columns)}")
        
        return True
        
    except Exception as e:
        logger.error(f"ERROR: Failed to verify database structure: {str(e)}")
        return False

def main():
    """Main function to initialize the database."""
    logger.info("=" * 60)
    logger.info("MountyHall Database Initialization")
    logger.info("=" * 60)
    
    # Load environment variables
    load_dotenv()
    
    # Create Flask app (this will also initialize the database)
    logger.info("Creating Flask application...")
    app = create_app()
    
    with app.app_context():
        # Verify database structure
        if verify_database_structure():
            logger.info("=" * 60)
            logger.info("Database initialization completed successfully!")
            logger.info("=" * 60)
            return 0
        else:
            logger.error("=" * 60)
            logger.error("Database initialization failed!")
            logger.error("=" * 60)
            return 1

if __name__ == '__main__':
    sys.exit(main())
