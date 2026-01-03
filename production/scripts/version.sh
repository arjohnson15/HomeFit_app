#!/bin/bash
# HomeFit Version Management Script
# Usage: ./version.sh <major|minor|patch> [--tag] [--push]
#
# Examples:
#   ./version.sh patch           # Bump 1.0.0 -> 1.0.1
#   ./version.sh minor --tag     # Bump 1.0.0 -> 1.1.0, create git tag
#   ./version.sh major --push    # Bump 1.0.0 -> 2.0.0, push to remote

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCTION_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$PRODUCTION_DIR")"

# Parse arguments
BUMP_TYPE="$1"
CREATE_TAG=false
PUSH_REMOTE=false

for arg in "$@"; do
    case $arg in
        --tag) CREATE_TAG=true ;;
        --push) PUSH_REMOTE=true; CREATE_TAG=true ;;
    esac
done

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
    echo -e "${RED}Usage: ./version.sh <major|minor|patch> [--tag] [--push]${NC}"
    echo ""
    echo "Options:"
    echo "  major   Bump major version (X.0.0)"
    echo "  minor   Bump minor version (0.X.0)"
    echo "  patch   Bump patch version (0.0.X)"
    echo "  --tag   Create git tag"
    echo "  --push  Push to remote (implies --tag)"
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(grep '"version"' "$PROJECT_ROOT/package.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')

if [ -z "$CURRENT_VERSION" ]; then
    CURRENT_VERSION="0.1.0"
fi

echo -e "${GREEN}Current version: ${CURRENT_VERSION}${NC}"

# Parse version components
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Bump version
case $BUMP_TYPE in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

echo -e "${GREEN}New version: ${NEW_VERSION}${NC}"

# Update package.json files
echo -e "${BLUE}Updating package.json files...${NC}"

# Root package.json
sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$PROJECT_ROOT/package.json"
rm -f "$PROJECT_ROOT/package.json.bak"

# Server package.json
if [ -f "$PROJECT_ROOT/src/server/package.json" ]; then
    sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$PROJECT_ROOT/src/server/package.json"
    rm -f "$PROJECT_ROOT/src/server/package.json.bak"
fi

# Client package.json
if [ -f "$PROJECT_ROOT/src/client/package.json" ]; then
    sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$PROJECT_ROOT/src/client/package.json"
    rm -f "$PROJECT_ROOT/src/client/package.json.bak"
fi

# Update .env.example
sed -i.bak "s/APP_VERSION=.*/APP_VERSION=$NEW_VERSION/" "$PRODUCTION_DIR/.env.example"
rm -f "$PRODUCTION_DIR/.env.example.bak"

# Update .env if exists
if [ -f "$PRODUCTION_DIR/.env" ]; then
    sed -i.bak "s/APP_VERSION=.*/APP_VERSION=$NEW_VERSION/" "$PRODUCTION_DIR/.env"
    rm -f "$PRODUCTION_DIR/.env.bak"
fi

echo -e "${GREEN}Version updated to ${NEW_VERSION}${NC}"

# Git operations
if $CREATE_TAG; then
    cd "$PROJECT_ROOT"

    if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        echo -e "${RED}Not a git repository. Cannot create tag.${NC}"
        exit 1
    fi

    echo -e "${BLUE}Creating git commit and tag...${NC}"

    git add package.json
    git add src/server/package.json 2>/dev/null || true
    git add src/client/package.json 2>/dev/null || true
    git add production/.env.example

    git commit -m "Release v${NEW_VERSION}" || {
        echo -e "${YELLOW}Nothing to commit${NC}"
    }

    git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
    echo -e "${GREEN}Created tag: v${NEW_VERSION}${NC}"

    if $PUSH_REMOTE; then
        echo -e "${BLUE}Pushing to remote...${NC}"
        git push origin main
        git push origin "v${NEW_VERSION}"
        echo -e "${GREEN}Pushed to remote${NC}"
    fi
fi

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Version bump complete!${NC}"
echo -e "${GREEN}  ${CURRENT_VERSION} -> ${NEW_VERSION}${NC}"
echo -e "${GREEN}======================================${NC}"

if ! $CREATE_TAG; then
    echo -e "${YELLOW}To create a git tag, run: ./version.sh $BUMP_TYPE --tag${NC}"
fi
if ! $PUSH_REMOTE; then
    echo -e "${YELLOW}To push to remote, run: ./version.sh $BUMP_TYPE --push${NC}"
fi
