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
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
