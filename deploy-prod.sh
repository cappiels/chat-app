#!/bin/bash
# 🚀 Production Deployment Script  
# Handles version bumping, commit, and push to DigitalOcean

set -e  # Exit on any error

echo "🚀 Starting Production Deployment..."

# Get current version more reliably
CURRENT_VERSION=$(node -p "require('./package.json').version")
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

# Update package.json files using Node.js (more reliable than sed)
node -e "
const fs = require('fs');
const files = ['package.json', 'frontend/package.json', 'backend/package.json'];
files.forEach(file => {
  if (fs.existsSync(file)) {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    pkg.version = '$NEW_VERSION';
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    console.log('✅ Updated ' + file + ' to v$NEW_VERSION');
  }
});
"

# Update Flutter version to match exactly (derive build number from version)
if [ -f "mobile/pubspec.yaml" ]; then
    echo "📱 Updating Flutter version to match..."
    
    # Derive build number from version (e.g., 1.8.39 → build 1839)
    BUILD_NUMBER=$(echo $NEW_VERSION | tr -d '.')
    
    # Update version in pubspec.yaml
    sed -i.bak "s/^version: .*/version: $NEW_VERSION+$BUILD_NUMBER/" mobile/pubspec.yaml
    rm mobile/pubspec.yaml.bak 2>/dev/null || true
    
    echo "✅ Updated mobile/pubspec.yaml to v$NEW_VERSION (build $BUILD_NUMBER)"
fi

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
echo "🌐 Production URL: https://crewchat.elbarriobk.com"
echo "⏱️  Allow 3-5 minutes for rebuild and deployment"
echo ""
echo "📋 DigitalOcean will:"
echo "  1. Pull latest code from main branch"
echo "  2. Run migrations automatically (018, 019)"
echo "  3. Rebuild and deploy the application"
echo "  4. Update production with v$NEW_VERSION"
echo ""
echo "📱 Building Flutter IPA for TestFlight..."
cd mobile
flutter clean > /dev/null 2>&1
flutter build ipa --release
if [ $? -eq 0 ]; then
    echo "✅ Flutter IPA built successfully!"
    echo "📦 IPA location: mobile/build/ios/ipa/Crew Chat.ipa"
    
    # Auto-upload to TestFlight if API credentials are configured
    if [ ! -z "$ASC_KEY_ID" ] && [ ! -z "$ASC_ISSUER_ID" ]; then
        echo ""
        read -p "📤 Upload IPA to TestFlight? (y/n) [y]: " UPLOAD_CHOICE
        UPLOAD_CHOICE=${UPLOAD_CHOICE:-y}
        
        if [ "$UPLOAD_CHOICE" = "y" ]; then
            echo "🚀 Uploading to TestFlight..."
            cd ..
            xcrun altool --upload-app \
              --type ios \
              --file "mobile/build/ios/ipa/Crew Chat.ipa" \
              --apiKey $ASC_KEY_ID \
              --apiIssuer $ASC_ISSUER_ID
            
            if [ $? -eq 0 ]; then
                echo ""
                echo "✅ Upload successful!"
                echo "⏱️  Processing time: 5-10 minutes"
                echo "📱 Check App Store Connect for build availability"
            else
                echo ""
                echo "❌ Upload failed"
                echo "📤 Manual upload: Drag mobile/build/ios/ipa/Crew Chat.ipa to Transporter app"
            fi
        else
            cd ..
            echo "⏭️  Skipping upload"
            echo "📤 Manual upload: Drag mobile/build/ios/ipa/Crew Chat.ipa to Transporter app"
        fi
    else
        cd ..
        echo "⚠️  TestFlight auto-upload not configured"
        echo "💡 Set ASC_KEY_ID and ASC_ISSUER_ID environment variables"
        echo "📖 See TESTFLIGHT-AUTOMATED-UPLOAD.md for setup instructions"
        echo "📤 Manual upload: Drag mobile/build/ios/ipa/Crew Chat.ipa to Transporter app"
    fi
else
    echo "⚠️  Flutter IPA build failed (non-critical)"
    cd ..
fi
echo ""
