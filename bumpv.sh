#!/bin/bash

# Interactive Version Bump Script
# Usage: Just run ./bumpv.sh and it will ask you everything!

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Print colored output
print_header() {
    echo -e "${BOLD}${CYAN}🚀 Interactive Version Bump${NC}"
    echo -e "${CYAN}================================${NC}"
    echo
}

print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ] || [ ! -f "backend/package.json" ]; then
    print_error "Must be run from project root directory"
    exit 1
fi

print_header

# Get current version
CURRENT_VERSION=$(node -p "require('./frontend/package.json').version")
print_status "Current version: ${BOLD}$CURRENT_VERSION${NC}"
echo

# Ask for version type
echo -e "${BOLD}What type of version bump?${NC}"
echo "1) 🐛 patch   - Bug fixes, small improvements     ($CURRENT_VERSION → $(echo $CURRENT_VERSION | awk -F. '{print $1"."$2"."$3+1}'))"
echo "2) ✨ minor   - New features, enhancements       ($CURRENT_VERSION → $(echo $CURRENT_VERSION | awk -F. '{print $1"."$2+1".0"}'))"
echo "3) 💥 major   - Breaking changes, major rewrites ($CURRENT_VERSION → $(echo $CURRENT_VERSION | awk -F. '{print $1+1".0.0"}'))"
echo

while true; do
    read -p "Enter your choice (1-3): " choice
    case $choice in
        1)
            VERSION_TYPE="patch"
            EMOJI="🐛"
            break
            ;;
        2)
            VERSION_TYPE="minor"
            EMOJI="✨"
            break
            ;;
        3)
            VERSION_TYPE="major"
            EMOJI="💥"
            break
            ;;
        *)
            print_warning "Please enter 1, 2, or 3"
            ;;
    esac
done

echo
print_status "You selected: ${BOLD}$VERSION_TYPE${NC} version bump"
echo

# Calculate new version for display
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

case $VERSION_TYPE in
    "major")
        NEW_VERSION="$((MAJOR + 1)).0.0"
        ;;
    "minor")
        NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
        ;;
    "patch")
        NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
        ;;
esac

print_status "New version will be: ${BOLD}$NEW_VERSION${NC}"
echo

# Ask for commit message
echo -e "${BOLD}What's the commit message for this version?${NC}"
echo -e "${CYAN}Describe what changed, fixed, or was added:${NC}"
echo

# Provide some examples based on version type
case $VERSION_TYPE in
    "patch")
        echo -e "${CYAN}Examples:${NC}"
        echo "• Fix send button click issue"
        echo "• Correct message padding alignment"
        echo "• Resolve mobile layout bug"
        ;;
    "minor")
        echo -e "${CYAN}Examples:${NC}"
        echo "• Add voice message support"
        echo "• Implement typing indicators"
        echo "• Add message reactions"
        ;;
    "major")
        echo -e "${CYAN}Examples:${NC}"
        echo "• Complete UI redesign"
        echo "• New real-time architecture"
        echo "• Breaking API changes"
        ;;
esac

echo
read -p "💬 Commit message: " COMMIT_MESSAGE

if [ -z "$COMMIT_MESSAGE" ]; then
    print_error "Commit message cannot be empty!"
    exit 1
fi

echo
print_status "Commit message: ${BOLD}\"$COMMIT_MESSAGE\"${NC}"
echo

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    print_warning "There are uncommitted changes in the repository"
    echo
    git status --short
    echo
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Aborted by user"
        exit 1
    fi
    echo
fi

# Show summary and ask for final confirmation
echo -e "${BOLD}${CYAN}📋 SUMMARY${NC}"
echo -e "${CYAN}═══════════${NC}"
echo -e "Version bump: ${BOLD}$CURRENT_VERSION → $NEW_VERSION${NC} ($VERSION_TYPE)"
echo -e "Commit message: ${BOLD}\"$COMMIT_MESSAGE\"${NC}"
echo -e "Will update: ${BOLD}frontend/package.json, backend/package.json, root package.json${NC}"
echo -e "Git operations: ${BOLD}add → commit → push to main${NC}"
echo

read -p "🚀 Ready to bump version? (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    print_warning "Aborted by user"
    exit 0
fi

echo
print_status "🚀 Starting version bump..."

# Update frontend/package.json
print_status "📦 Updating frontend/package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('frontend/package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('frontend/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update backend/package.json
print_status "📦 Updating backend/package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('backend/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update root package.json
print_status "📦 Updating root package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update app.yaml if it has version info
if [ -f "app.yaml" ] && grep -q "version:" app.yaml; then
    print_status "📄 Updating app.yaml..."
    sed -i.bak "s/version: .*/version: $NEW_VERSION/" app.yaml
    rm app.yaml.bak 2>/dev/null || true
fi

# Generate timestamp-based cache buster
TIMESTAMP=$(date +%s)
BUILD_ID="$NEW_VERSION-$TIMESTAMP"

# Update frontend/index.html with cache busting meta tag
if [ -f "frontend/index.html" ]; then
    print_status "🔄 Adding cache busting to index.html..."
    # Remove existing cache buster if present
    sed -i.bak '/<meta name="cache-version"/d' frontend/index.html
    # Add new cache buster right after <head>
    sed -i.bak "/<head>/a\\
    <meta name=\"cache-version\" content=\"$BUILD_ID\">\\
    <meta http-equiv=\"Cache-Control\" content=\"no-cache, no-store, must-revalidate\">\\
    <meta http-equiv=\"Pragma\" content=\"no-cache\">\\
    <meta http-equiv=\"Expires\" content=\"0\">" frontend/index.html
    rm frontend/index.html.bak 2>/dev/null || true
fi

# Create a version info file for immediate cache invalidation
print_status "💾 Creating version info file..."
cat > frontend/public/version.json << EOF
{
  "version": "$NEW_VERSION",
  "buildId": "$BUILD_ID",
  "timestamp": $TIMESTAMP,
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# Update cache breaker with new version
if [ -f "frontend/src/utils/cacheBreaker.js" ]; then
    print_status "🔄 Updating cache breaker version..."
    sed -i.bak "s/const CURRENT_VERSION = '[^']*'/const CURRENT_VERSION = '$NEW_VERSION'/" frontend/src/utils/cacheBreaker.js
    rm frontend/src/utils/cacheBreaker.js.bak 2>/dev/null || true
fi

print_success "All files updated with version $NEW_VERSION"

# Git operations
print_status "📝 Adding files to git..."
git add frontend/package.json backend/package.json package.json frontend/src/main.jsx
if [ -f "app.yaml" ] && grep -q "version:" app.yaml; then
    git add app.yaml
fi
if [ -f "frontend/index.html" ]; then
    git add frontend/index.html
fi
if [ -f "frontend/public/version.json" ]; then
    git add frontend/public/version.json
fi
if [ -f "frontend/src/utils/cacheBreaker.js" ]; then
    git add frontend/src/utils/cacheBreaker.js
fi

FULL_COMMIT_MESSAGE="v$NEW_VERSION: $COMMIT_MESSAGE"
print_status "💾 Committing changes..."
git commit -m "$FULL_COMMIT_MESSAGE"

print_status "🌐 Pushing to main branch..."
git push origin main

echo
echo -e "${BOLD}${GREEN}🎉 SUCCESS! Version bumped to $NEW_VERSION${NC}"
echo -e "${GREEN}✅ All files updated${NC}"
echo -e "${GREEN}✅ Changes committed: \"$FULL_COMMIT_MESSAGE\"${NC}"
echo -e "${GREEN}✅ Pushed to main branch${NC}"

echo
print_status "Files updated:"
echo -e "  📦 frontend/package.json: ${BOLD}$CURRENT_VERSION → $NEW_VERSION${NC}"
echo -e "  📦 backend/package.json: ${BOLD}$CURRENT_VERSION → $NEW_VERSION${NC}"
echo -e "  📦 package.json: ${BOLD}$CURRENT_VERSION → $NEW_VERSION${NC}"
if [ -f "app.yaml" ] && grep -q "version:" app.yaml; then
    echo -e "  📄 app.yaml: ${BOLD}version updated${NC}"
fi
echo -e "  🔗 frontend/src/utils/version.js: ${BOLD}automatically imports from package.json${NC}"

echo
echo -e "${BOLD}${CYAN}🎊 All done! Your app is now at version $NEW_VERSION${NC}"
