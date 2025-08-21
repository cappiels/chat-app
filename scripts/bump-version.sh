#!/bin/bash

# Automated Version Bump Script
# Usage: ./scripts/bump-version.sh [patch|minor|major] "commit message"
# Example: ./scripts/bump-version.sh patch "Fix message textarea focus issue"

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ] || [ ! -f "backend/package.json" ]; then
    print_error "Must be run from project root directory"
    exit 1
fi

# Parse arguments
VERSION_TYPE=${1:-patch}
COMMIT_MESSAGE=${2:-"Version bump"}

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    print_error "Version type must be 'patch', 'minor', or 'major'"
    echo "Usage: $0 [patch|minor|major] \"commit message\""
    exit 1
fi

print_status "Starting automated version bump..."
print_status "Version type: $VERSION_TYPE"
print_status "Commit message: $COMMIT_MESSAGE"

# Get current version from frontend package.json
CURRENT_VERSION=$(node -p "require('./frontend/package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Calculate new version
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

case $VERSION_TYPE in
    "major")
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    "minor")
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    "patch")
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
print_status "New version: $NEW_VERSION"

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    print_warning "There are uncommitted changes in the repository"
    echo "Uncommitted files:"
    git status --porcelain
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Aborted by user"
        exit 1
    fi
fi

# Update frontend/package.json
print_status "Updating frontend/package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('frontend/package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('frontend/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update backend/package.json
print_status "Updating backend/package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('backend/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update app.yaml if it has version info (check if it exists first)
if [ -f "app.yaml" ]; then
    if grep -q "version:" app.yaml; then
        print_status "Updating app.yaml..."
        sed -i.bak "s/version: .*/version: $NEW_VERSION/" app.yaml
        rm app.yaml.bak 2>/dev/null || true
    fi
fi

# Check if there are any other files that might need version updates
VERSION_FILES=()

# Check for version in main layout files
if [ -f "frontend/src/components/layout/AppLayout.jsx" ]; then
    if grep -q "version" "frontend/src/components/layout/AppLayout.jsx"; then
        VERSION_FILES+=("frontend/src/components/layout/AppLayout.jsx")
    fi
fi

if [ -f "frontend/src/components/layout/Header.jsx" ]; then
    if grep -q "version" "frontend/src/components/layout/Header.jsx"; then
        VERSION_FILES+=("frontend/src/components/layout/Header.jsx")
    fi
fi

# Note: frontend/src/utils/version.js automatically imports from package.json, so no manual update needed

print_success "Version updated in all package.json files"

# Add files to git
print_status "Adding updated files to git..."
git add frontend/package.json backend/package.json

# Add app.yaml if it was updated
if [ -f "app.yaml" ] && grep -q "version:" app.yaml; then
    git add app.yaml
fi

# Add any other version files if they exist
for file in "${VERSION_FILES[@]}"; do
    if [ -f "$file" ]; then
        git add "$file"
        print_status "Added $file to git"
    fi
done

# Create commit message with version info
FULL_COMMIT_MESSAGE="v$NEW_VERSION: $COMMIT_MESSAGE"

# Commit changes
print_status "Committing changes..."
git commit -m "$FULL_COMMIT_MESSAGE"

# Push to main
print_status "Pushing to main branch..."
git push origin main

print_success "🎉 Version successfully bumped to $NEW_VERSION!"
print_success "✅ All files updated"
print_success "✅ Changes committed"
print_success "✅ Pushed to main branch"

# Show what was updated
echo ""
print_status "Files updated:"
echo "  📦 frontend/package.json: $CURRENT_VERSION → $NEW_VERSION"
echo "  📦 backend/package.json: $CURRENT_VERSION → $NEW_VERSION"
if [ -f "app.yaml" ] && grep -q "version:" app.yaml; then
    echo "  📄 app.yaml: version updated"
fi
echo "  🔗 frontend/src/utils/version.js: automatically imports from package.json"

echo ""
print_success "Commit: $FULL_COMMIT_MESSAGE"
print_success "Branch: main"
print_success "Remote: Updated"
