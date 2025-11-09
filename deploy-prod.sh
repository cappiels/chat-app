#!/bin/bash
# 🚀 Production Deployment Script  
# Handles version bumping, commit, and push to DigitalOcean

set -e  # Exit on any error

echo "🚀 Starting Production Deployment..."

# Get current version
CURRENT_VERSION=$(grep '"version"' package.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
echo "📦 Current version: $CURRENT_VERSION"

# Ask for version bump type if not provided
if [ -z "$1" ]; then
    echo ""
    echo "🎯 Version bump options:"
    echo "  1. patch (2.1.0 → 2.1.1) - Bug fixes"
    echo "  2. minor (2.1.0 → 2.2.0) - New features"  
    echo "  3. major (2.1.0 → 3.0.0) - Breaking changes"
    echo ""
    read -p "Enter bump type (patch/minor/major) [patch]: " BUMP_TYPE
    BUMP_TYPE=${BUMP_TYPE:-patch}
else
    BUMP_TYPE=$1
fi

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "❌ Invalid bump type. Must be: patch, minor, or major"
    exit 1
fi

# Get commit message
if [ -z "$2" ]; then
    echo ""
    read -p "📝 Enter commit message: " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        echo "❌ Commit message is required"
        exit 1
    fi
else
    COMMIT_MSG=$2
fi

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --staged --quiet; then
    echo "⚠️  You have uncommitted changes. Adding them to deployment..."
    git add .
fi

# Bump version using a simpler approach to avoid npm workspace conflicts
echo "📈 Bumping version: $BUMP_TYPE"

# Calculate new version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case $BUMP_TYPE in
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

echo "📦 Updating version: $CURRENT_VERSION → $NEW_VERSION"

# Update all package.json files
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" frontend/package.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" backend/package.json

echo "✅ Version bumped: $CURRENT_VERSION → $NEW_VERSION"

# Commit with version info
FULL_COMMIT_MSG="🚀 v$NEW_VERSION: $COMMIT_MSG"
git add .
git commit -m "$FULL_COMMIT_MSG"

# Create git tag for version
git tag "v$NEW_VERSION"

echo ""
echo "🎯 Deploying to Production..."
echo "📦 Version: v$NEW_VERSION"
echo "💬 Message: $COMMIT_MSG"
echo ""

# Push to production
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo "✅ Deployment Complete!"
echo "📦 Version v$NEW_VERSION deployed to DigitalOcean"
echo "🌐 Production URL: https://crew.elbarriobk.com"
echo "⏱️  Allow 3-5 minutes for rebuild and deployment"
echo ""
echo "📋 DigitalOcean will:"
echo "  1. Pull latest code from main branch" 
echo "  2. Run migrations automatically (018, 019)"
echo "  3. Rebuild and deploy the application"
echo "  4. Update production with v$NEW_VERSION"
echo ""
