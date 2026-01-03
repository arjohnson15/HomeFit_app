#!/bin/bash
# HomeFit Restore Script
# Restores from a backup file
# Usage: ./restore.sh <backup_file.tar.gz>

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCTION_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PRODUCTION_DIR/backups"

if [ -z "$1" ]; then
    echo -e "${RED}Usage: ./restore.sh <backup_file.tar.gz>${NC}"
    echo -e "\nAvailable backups:"
    ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
    BACKUP_FILE="$BACKUP_DIR/$1"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Backup file not found: $1${NC}"
    exit 1
fi

echo -e "${YELLOW}WARNING: This will overwrite the current database!${NC}"
echo -e "Backup file: $BACKUP_FILE"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Load environment
if [ -f "$PRODUCTION_DIR/.env" ]; then
    export $(cat "$PRODUCTION_DIR/.env" | grep -v '^#' | xargs)
fi

POSTGRES_USER=${POSTGRES_USER:-homefit}
POSTGRES_DB=${POSTGRES_DB:-homefit}

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  HomeFit Restore${NC}"
echo -e "${GREEN}======================================${NC}"

# Create temp directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${GREEN}Extracting backup...${NC}"
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Find SQL file
SQL_FILE=$(find "$TEMP_DIR" -name "*.sql" | head -1)

if [ -n "$SQL_FILE" ]; then
    echo -e "${GREEN}Restoring database...${NC}"
    cat "$SQL_FILE" | docker-compose -f "$PRODUCTION_DIR/docker-compose.yml" exec -T db \
        psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
    echo -e "${GREEN}Database restored successfully${NC}"
else
    echo -e "${YELLOW}No SQL file found in backup${NC}"
fi

# Restore uploads if present
UPLOADS_DIR=$(find "$TEMP_DIR" -type d -name "*_uploads" | head -1)
if [ -n "$UPLOADS_DIR" ]; then
    echo -e "${GREEN}Restoring uploads...${NC}"
    docker cp "$UPLOADS_DIR/." homefit-app:/app/uploads/
    echo -e "${GREEN}Uploads restored successfully${NC}"
fi

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Restore Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
