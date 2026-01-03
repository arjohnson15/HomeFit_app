#!/bin/bash
# HomeFit Update Script
# Pulls latest changes from GitHub and redeploys
# Usage: ./update.sh [version]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCTION_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$PRODUCTION_DIR")"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  HomeFit Update${NC}"
echo -e "${GREEN}======================================${NC}"

# Check for version argument or fetch latest from git
if [ -n "$1" ]; then
    VERSION="$1"
else
    echo -e "${GREEN}Fetching latest version from GitHub...${NC}"
    cd "$PROJECT_ROOT"

    # Fetch latest tags
    git fetch --tags 2>/dev/null || {
        echo -e "${YELLOW}Not a git repository, using current version${NC}"
        VERSION=$(grep APP_VERSION "$PRODUCTION_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "1.0.0")
    }

    # Get latest tag or use current version
    VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "1.0.0")
fi

echo -e "${GREEN}Target version: ${VERSION}${NC}"

# Create backup before update
echo -e "${GREEN}Step 1: Creating backup before update...${NC}"
"$SCRIPT_DIR/backup.sh" pre-update || {
    echo -e "${YELLOW}Backup skipped or failed${NC}"
}

# Pull latest changes
echo -e "${GREEN}Step 2: Pulling latest changes...${NC}"
cd "$PROJECT_ROOT"
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    git fetch origin
    git checkout "v${VERSION}" 2>/dev/null || git checkout "${VERSION}" 2>/dev/null || git pull origin main
fi

# Run deployment
echo -e "${GREEN}Step 3: Running deployment...${NC}"
"$SCRIPT_DIR/deploy.sh" "$VERSION"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Update Complete!${NC}"
echo -e "${GREEN}  Version: ${VERSION}${NC}"
echo -e "${GREEN}======================================${NC}"
