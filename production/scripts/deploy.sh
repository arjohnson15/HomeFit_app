#!/bin/bash
# HomeFit Deployment Script
# Usage: ./deploy.sh [version]
# Example: ./deploy.sh 1.0.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCTION_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$PRODUCTION_DIR")"

# Get version from argument or .env
VERSION=${1:-$(grep APP_VERSION "$PRODUCTION_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "1.0.0")}

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  HomeFit Deployment - v${VERSION}${NC}"
echo -e "${GREEN}======================================${NC}"

# Check if .env exists
if [ ! -f "$PRODUCTION_DIR/.env" ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo -e "Creating from .env.example..."
    cp "$PRODUCTION_DIR/.env.example" "$PRODUCTION_DIR/.env"
    echo -e "${RED}Please edit .env with your settings before continuing${NC}"
    exit 1
fi

# Update version in .env
sed -i.bak "s/APP_VERSION=.*/APP_VERSION=${VERSION}/" "$PRODUCTION_DIR/.env"
rm -f "$PRODUCTION_DIR/.env.bak"

echo -e "${GREEN}Step 1: Building Docker images...${NC}"
cd "$PRODUCTION_DIR"
docker-compose build --build-arg APP_VERSION="$VERSION"

echo -e "${GREEN}Step 2: Stopping existing containers...${NC}"
docker-compose down --remove-orphans || true

echo -e "${GREEN}Step 3: Starting services...${NC}"
docker-compose up -d

echo -e "${GREEN}Step 4: Waiting for database to be ready...${NC}"
sleep 10

echo -e "${GREEN}Step 5: Running database migrations...${NC}"
docker-compose exec -T app npx prisma migrate deploy || {
    echo -e "${YELLOW}Migrations may have already been applied${NC}"
}

echo -e "${GREEN}Step 6: Running database seed (if needed)...${NC}"
docker-compose exec -T app npx prisma db seed || {
    echo -e "${YELLOW}Seed may have already been applied${NC}"
}

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}  Version: ${VERSION}${NC}"
echo -e "${GREEN}======================================${NC}"

# Show running containers
echo -e "\n${GREEN}Running containers:${NC}"
docker-compose ps

echo -e "\n${GREEN}Application available at: http://localhost:${HOST_PORT:-3000}${NC}"
