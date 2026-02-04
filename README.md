# MountyHall App

A React PWA frontend and Flask backend API for MountyHall authentication and profile management.

## Features

- User registration and authentication with JWT tokens
- Profile management (troll_id, troll_name with UTF-8 support, sciz_token)
- Mobile-optimized Progressive Web App (PWA)
- Docker containerization for easy deployment
- SQLite database for lightweight data storage

## Tech Stack

- **Backend**: Python Flask with Flask-JWT-Extended
- **Frontend**: React with Vite, PWA capabilities
- **Database**: SQLite with SQLAlchemy ORM
- **Containerization**: Docker and Docker Compose

## Quick Start with Docker

1. **Clone the repository** (if applicable)

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set a strong `JWT_SECRET_KEY`:
   ```bash
   openssl rand -hex 32
   ```

3. **Ensure instance directory exists with proper permissions**:
   ```bash
   mkdir -p backend/instance
   # Option 1: Make it world-writable (simplest)
   chmod 777 backend/instance
   
   # Option 2: Own it by UID 1000 (matches container user)
   sudo chown -R 1000:1000 backend/instance
   chmod 755 backend/instance
   ```
   This ensures the Docker volume mount has write permissions. The container runs as user `appuser` with UID 1000.

4. **Build and start containers**:
   ```bash
   docker-compose up --build
   ```
   
   The database will be automatically initialized on first run. You'll see log messages indicating:
   - Database directory creation (if needed)
   - Table creation
   - Database structure verification

5. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Development Setup

### Backend (Local)

1. Create virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. Set environment variables (create `.env` file):
   ```
   JWT_SECRET_KEY=your-secret-key
   FLASK_ENV=development
   ```

4. Initialize the database (optional - happens automatically on app start):
   ```bash
   python init_database.py
   ```
   This will create the `instance/` directory and all required tables.

5. Run the server:
   ```bash
   python app.py
   ```
   
   The database is automatically initialized on first run if it doesn't exist.

### Frontend (Local)

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Create `.env` file:
   ```
   VITE_API_URL=http://localhost:5000
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication

- `POST /auth/register` - Register a new user
  - Body: `{ "email": "user@example.com", "password": "password123" }`

- `POST /auth/login` - Login and get JWT token
  - Body: `{ "email": "user@example.com", "password": "password123" }`
  - Returns: `{ "access_token": "jwt_token" }`

- `POST /auth/logout` - Logout (requires JWT token)

### Profile

- `GET /auth/profile` - Get user profile (requires JWT token)
  - Returns: `{ "id": 1, "email": "user@example.com", "troll_id": null, "troll_name": null, "sciz_token": null }`

- `PUT /auth/profile` - Update profile (requires JWT token)
  - Body: `{ "troll_id": "12345", "troll_name": "MonTroll 🧌", "sciz_token": "abc123" }`
  - All fields are optional

## Docker Commands

- Start services: `docker-compose up`
- Start in background: `docker-compose up -d`
- Stop services: `docker-compose down`
- View logs: `docker-compose logs -f`
- Rebuild after changes: `docker-compose up --build`

## PWA Icons

The PWA requires PNG icons. Currently, an SVG placeholder is provided. To complete the PWA setup:

1. Create `192x192` and `512x512` PNG icons
2. Place them in `frontend/public/icons/` as:
   - `icon-192x192.png`
   - `icon-512x512.png`

## Database Initialization

The SQLite database is automatically initialized on first run:

1. **Automatic initialization**: When the Flask app starts, it will:
   - Create the `instance/` directory if it doesn't exist
   - Create the database file (`app.db`) if it doesn't exist
   - Create all required tables (users table with proper schema)
   - Verify the database structure
   - Log initialization status

2. **Manual initialization** (optional):
   
   **Using bash script (recommended):**
   ```bash
   cd backend
   ./init_db.sh
   ```
   This script handles environment setup and runs the initialization.
   
   **Using Python directly:**
   ```bash
   cd backend
   python init_database.py
   ```
   
   **From Docker container:**
   ```bash
   docker-compose exec backend python init_database.py
   ```
   Or:
   ```bash
   docker-compose exec backend /app/init_db.sh
   ```

3. **Database location**:
   - Local: `backend/instance/app.db`
   - Docker: Persisted via volume mount at `./backend/instance/app.db`

## Project Structure

```
mountyhall-app/
├── backend/           # Flask backend API
│   ├── app.py        # Flask application
│   ├── models.py     # Database models
│   ├── auth.py       # Authentication routes
│   ├── database.py   # Database initialization
│   ├── init_database.py  # Standalone DB init script
│   └── Dockerfile    # Backend container
├── frontend/         # React frontend
│   ├── src/          # Source code
│   ├── public/       # Static assets
│   └── Dockerfile    # Frontend container
├── docker-compose.yaml  # Container orchestration
└── .env.example      # Environment variables template
```

## Security Notes

- Always use a strong `JWT_SECRET_KEY` in production
- Use HTTPS in production
- The database file (`backend/instance/app.db`) is persisted via Docker volumes
- Passwords are hashed using bcrypt

## License

See LICENSE file for details.
