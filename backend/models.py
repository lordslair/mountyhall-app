from database import db
from datetime import datetime
import bcrypt

class User(db.Model):
    """User model for authentication and profile management."""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    troll_id = db.Column(db.String(50), nullable=True)
    troll_name = db.Column(db.String(255), nullable=True)  # UTF-8 support
    sciz_token = db.Column(db.String(255), nullable=True)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def set_password(self, password: str):
        """Hash and set the user's password."""
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
    
    def check_password(self, password: str) -> bool:
        """Check if the provided password matches the user's password."""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )
    
    def to_dict(self):
        """Convert user to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'email': self.email,
            'troll_id': self.troll_id,
            'troll_name': self.troll_name,
            'sciz_token': self.sciz_token,
            'is_admin': self.is_admin,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Monster(db.Model):
    """Monster model for storing user's monsters."""
    __tablename__ = 'monsters'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    mob_id = db.Column(db.String(50), nullable=False)
    mob_name_full = db.Column(db.String(255), nullable=True)
    mob_json = db.Column(db.Text, nullable=True)  # JSON data from MZ API stored as text
    is_dead = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationship to User
    user = db.relationship('User', backref=db.backref('monsters', lazy=True))
    
    def to_dict(self):
        """Convert monster to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'mob_id': self.mob_id,
            'mob_name_full': self.mob_name_full,
            'mob_json': self.mob_json,
            'is_dead': self.is_dead,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
