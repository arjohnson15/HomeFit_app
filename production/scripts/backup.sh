#!/bin/bash
# HomeFit Backup Script
# Creates a backup of the database and uploaded files
# Usage: ./backup.sh [tag]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCTION_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PRODUCTION_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TAG=${1:-manual}

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  HomeFit Backup - ${TIMESTAMP}${NC}"
echo -e "${GREEN}======================================${NC}"

# Load environment variables
if [ -f "$PRODUCTION_DIR/.env" ]; then
    export $(cat "$PRODUCTION_DIR/.env" | grep -v '^#' | xargs)
fi

POSTGRES_USER=${POSTGRES_USER:-homefit}
POSTGRES_DB=${POSTGRES_DB:-homefit}

BACKUP_NAME="homefit_${TAG}_${TIMESTAMP}"

echo -e "${GREEN}Creating database backup...${NC}"
docker-compose -f "$PRODUCTION_DIR/docker-compose.yml" exec -T db \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
    > "$BACKUP_DIR/${BACKUP_NAME}.sql" 2>/dev/null || {
        echo -e "${YELLOW}Database backup skipped (database may not be running)${NC}"
    }

echo -e "${GREEN}Creating uploads backup...${NC}"
docker cp homefit-app:/app/uploads "$BACKUP_DIR/${BACKUP_NAME}_uploads" 2>/dev/null || {
    echo -e "${YELLOW}Uploads backup skipped (container may not be running)${NC}"
}

# Compress backups
if [ -f "$BACKUP_DIR/${BACKUP_NAME}.sql" ]; then
    echo -e "${GREEN}Compressing backups...${NC}"
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}.sql" "${BACKUP_NAME}_uploads" 2>/dev/null || \
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}.sql" 2>/dev/null
    rm -f "${BACKUP_NAME}.sql"
    rm -rf "${BACKUP_NAME}_uploads"
fi

# Cleanup old backups (keep last 30 days)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
echo -e "${GREEN}Cleaning up backups older than ${RETENTION_DAYS} days...${NC}"
find "$BACKUP_DIR" -name "homefit_*.tar.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Backup Complete!${NC}"
echo -e "${GREEN}  Location: ${BACKUP_DIR}${NC}"
echo -e "${GREEN}======================================${NC}"

ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -5 || echo "No backups found"
