# Unified Version Management System

## Overview
All versions (React Frontend, Backend API, Flutter Mobile) are synchronized automatically when deploying.

## Version Format

### All Platforms (React, Backend, Flutter)
- **Version**: `MAJOR.MINOR.PATCH` (e.g., `1.8.39`)
- **Flutter Build Number**: Automatically derived from version (e.g., `1.8.39` → build `1839`)
- **Flutter Format**: `1.8.39+1839` (version+build)
- **Files Updated**: `package.json`, `frontend/package.json`, `backend/package.json`, `mobile/pubspec.yaml`

**All platforms share the same version number!**

## Deployment Scripts

### 1. `./deploy-prod.sh` - Production Deployment
Automated version bumping and deployment to production.

**Usage:**
```bash
./deploy-prod.sh [patch|minor|major] "commit message"
```

**Interactive Mode** (no arguments):
```bash
./deploy-prod.sh
# Will prompt for bump type and commit message
```

**What It Does:**
1. ✅ Bumps React/Backend version based on type
2. ✅ Syncs Flutter version (same version, incremented build)
3. ✅ Commits all changes to git
4. ✅ Creates version tag (e.g., `v1.8.40`)
5. ✅ Pushes to production (DigitalOcean auto-deploys)

**Example:**
```bash
./deploy-prod.sh patch "Fix message send button"
# All platforms: 1.8.39 → 1.8.40
# Flutter build: 1839 → 1840 (derived from version)
```

### 2. `./bumpv.sh` - Interactive Version Bump
Beautiful interactive version bumping with colors and confirmations.

**Usage:**
```bash
./bumpv.sh
```

**What It Does:**
1. 🎯 Shows current version
2. 🎯 Asks for bump type with examples
3. 🎯 Asks for commit message
4. 🎯 Shows summary and asks for confirmation
5. ✅ Updates all package.json files
6. ✅ Syncs Flutter version automatically
7. ✅ Updates cache busting files
8. ✅ Commits and pushes to main

**Example Output:**
```
🚀 Interactive Version Bump
================================

ℹ️  Current version: 1.8.39

What type of version bump?
1) 🐛 patch   - Bug fixes, small improvements     (1.8.39 → 1.8.40)
2) ✨ minor   - New features, enhancements       (1.8.39 → 1.9.0)
3) 💥 major   - Breaking changes, major rewrites (1.8.39 → 2.0.0)

Enter your choice (1-3): 1

📋 SUMMARY
═══════════
Version bump: 1.8.39 → 1.8.40 (patch)
Files updated:
  📦 frontend/package.json: 1.8.39 → 1.8.40
  📦 backend/package.json: 1.8.39 → 1.8.40
  📦 package.json: 1.8.39 → 1.8.40
  📱 mobile/pubspec.yaml: 1.8.40+3
```

## Version Bump Types

### Patch (1.8.39 → 1.8.40)
**Use for:**
- Bug fixes
- Small improvements
- CSS/styling fixes
- Text changes
- Minor UI tweaks

**Examples:**
- "Fix send button click issue"
- "Correct message padding alignment"
- "Resolve mobile layout bug"

### Minor (1.8.39 → 1.9.0)
**Use for:**
- New features
- Enhancements
- New components
- API additions

**Examples:**
- "Add voice message support"
- "Implement typing indicators"
- "Add message reactions"

### Major (1.8.39 → 2.0.0)
**Use for:**
- Breaking changes
- Complete redesigns
- Architecture changes
- Major API changes

**Examples:**
- "Complete UI redesign"
- "New real-time architecture"
- "Breaking API changes"

## Flutter Build Numbers

The Flutter build number is **automatically derived** from the version:

- Version `1.8.39` → Build `1839` (remove dots)
- Version `1.8.40` → Build `1840`
- Version `1.9.0` → Build `190`
- Version `2.0.0` → Build `200`

**Why this approach?**
- ✅ Always unique for iOS App Store
- ✅ Automatically increments with version
- ✅ Simple and predictable
- ✅ No manual tracking needed

## Files Updated Automatically

### Always Updated:
✅ `package.json` (root)
✅ `frontend/package.json`
✅ `backend/package.json`
✅ `mobile/pubspec.yaml`

### Also Updated (if they exist):
✅ `app.yaml` (version field)
✅ `frontend/index.html` (cache busting)
✅ `frontend/public/version.json` (version info)
✅ `frontend/src/utils/cacheBreaker.js` (cache version)

## Git Operations

Both scripts perform these git operations:
1. `git add .` - Stage all changes
2. `git commit -m "🚀 vX.X.X: message"` - Commit with version
3. `git tag "vX.X.X"` - Create version tag (deploy-prod.sh only)
4. `git push origin main` - Push to main branch
5. `git push origin "vX.X.X"` - Push version tag (deploy-prod.sh only)

## Current Versions

**Production (Nov 22, 2025):**
- React Frontend: `1.8.39`
- Backend API: `1.8.39`
- Flutter Mobile: `1.1.0+2` (TestFlight)

## Best Practices

### ✅ DO:
- Use `patch` for most changes (bug fixes, small improvements)
- Use `minor` for new features
- Use `major` for breaking changes
- Let scripts handle Flutter versioning automatically
- Use descriptive commit messages

### ❌ DON'T:
- Don't manually edit version numbers
- Don't skip version bumps for production changes
- Don't use generic commit messages like "updates" or "fixes"
- Don't worry about Flutter build numbers (auto-handled)

## Troubleshooting

### Script Won't Run
```bash
chmod +x deploy-prod.sh bumpv.sh
```

### Version Out of Sync
If versions get out of sync somehow:
1. Check `package.json` files for current version
2. Manually sync if needed
3. Run either script to re-sync everything

### Flutter Build Number Issues
Build numbers are automatically derived from the version, so they will always match. If you see a mismatch, run either deployment script to re-sync.

## Examples

### Bug Fix Deployment
```bash
./deploy-prod.sh patch "Fix message timestamp display"
# All platforms: 1.8.39 → 1.8.40
# Flutter: 1.8.39+1839 → 1.8.40+1840
```

### New Feature Deployment
```bash
./bumpv.sh
# Choose: 2 (minor)
# Message: "Add voice message recording"
# All platforms: 1.8.40 → 1.9.0
# Flutter: 1.8.40+1840 → 1.9.0+190
```

### Major Version (Breaking Changes)
```bash
./deploy-prod.sh major "Complete API redesign with new authentication"
# All platforms: 1.9.0 → 2.0.0
# Flutter: 1.9.0+190 → 2.0.0+200
```

## Summary

✅ **One command** keeps everything in sync
✅ **Automatic** Flutter version updates
✅ **Auto-incrementing** build numbers for iOS
✅ **Git tags** for version history
✅ **Cache busting** for instant updates
✅ **Professional** version management workflow

No more manual version updates! 🎉
