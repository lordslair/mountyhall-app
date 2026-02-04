#!/bin/bash
# MountyHall Database Initialization Script
# This script initializes the SQLite database and creates all required tables.

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MountyHall Database Initialization${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running in Docker or locally
if [ -f /.dockerenv ] || [ -n "$DOCKER_CONTAINER" ]; then
    echo -e "${YELLOW}Running inside Docker container${NC}"
    MODE="docker"
else
    echo -e "${YELLOW}Running locally${NC}"
    MODE="local"
fi

# Check if bash is available (needed for this script)
if [ -z "$BASH_VERSION" ]; then
    echo -e "${RED}ERROR: This script requires bash${NC}"
    exit 1
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}ERROR: python3 is not installed or not in PATH${NC}"
    exit 1
fi

# Check if virtual environment exists (for local mode)
if [ "$MODE" = "local" ]; then
    if [ -d "venv" ]; then
        echo "Activating virtual environment..."
        source venv/bin/activate
    elif [ -d "../venv" ]; then
        echo "Activating virtual environment..."
        source ../venv/bin/activate
    else
        echo -e "${YELLOW}Warning: No virtual environment found. Using system Python.${NC}"
    fi
fi

# Check if .env file exists
if [ -f ".env" ]; then
    echo "Found .env file, loading environment variables..."
    export $(cat .env | grep -v '^#' | xargs)
elif [ -f "../.env" ]; then
    echo "Found .env file in parent directory, loading environment variables..."
    export $(cat ../.env | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}Warning: No .env file found. Using default values.${NC}"
fi

# Ensure instance directory exists
INSTANCE_DIR="instance"
if [ ! -d "$INSTANCE_DIR" ]; then
    echo "Creating instance directory..."
    mkdir -p "$INSTANCE_DIR"
    echo -e "${GREEN}✓ Instance directory created${NC}"
else
    echo -e "${GREEN}✓ Instance directory already exists${NC}"
fi

# Check if instance directory is writable
if [ ! -w "$INSTANCE_DIR" ]; then
    echo -e "${RED}ERROR: Instance directory is not writable!${NC}"
    echo "Please fix permissions: chmod 777 $INSTANCE_DIR"
    exit 1
fi

# Run the Python initialization script
echo ""
echo "Running database initialization..."
echo ""

if [ -f "init_database.py" ]; then
    python3 init_database.py
    EXIT_CODE=$?
else
    echo -e "${RED}ERROR: init_database.py not found!${NC}"
    exit 1
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Database initialization completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    # Show database file info if it exists
    DB_FILE="$INSTANCE_DIR/app.db"
    if [ -f "$DB_FILE" ]; then
        echo ""
        echo "Database file: $DB_FILE"
        echo "Size: $(du -h "$DB_FILE" | cut -f1)"
        echo ""
    fi
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}Database initialization failed!${NC}"
    echo -e "${RED}========================================${NC}"
    exit $EXIT_CODE
fi
