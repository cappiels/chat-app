# Automated Version Bump System 🚀

This directory contains scripts to automate the versioning process across the entire chat application.

## Quick Start

The easiest way to bump versions is using npm scripts from the root directory:

```bash
# Patch version bump (1.7.5 → 1.7.6) - for bug fixes
npm run bump "Fix send button issue"

# Minor version bump (1.7.5 → 1.8.0) - for new features  
npm run bump:minor "Add voice message support"

# Major version bump (1.7.5 → 2.0.0) - for breaking changes
npm run bump:major "Complete UI redesign"
```

## What Gets Updated Automatically

The version bump script automatically updates versions in:

- ✅ `frontend/package.json`
- ✅ `backend/package.json` 
- ✅ Root `package.json`
- ✅ `app.yaml` (if version field exists)
- ✅ Any layout files that reference version numbers

## What Gets Done Automatically

1. **Calculate New Version** - Increments patch/minor/major correctly
2. **Update All Files** - Synchronizes version across all locations
3. **Git Operations** - Adds files, commits with proper message, pushes to main
4. **Safety Checks** - Warns about uncommitted changes before proceeding

## Available Commands

### NPM Scripts (Recommended)
```bash
# Show current version
npm run version

# Get help
npm run help:version

# Version bumps with commit messages
npm run bump "your commit message"          # patch
npm run bump:minor "your commit message"    # minor  
npm run bump:major "your commit message"    # major
```

### Direct Script Usage
```bash
# Run script directly
./scripts/bump-version.sh patch "your commit message"
./scripts/bump-version.sh minor "your commit message"  
./scripts/bump-version.sh major "your commit message"
```

## Version Types

| Type | When to Use | Example | Result |
|------|-------------|---------|---------|
| **patch** | Bug fixes, small improvements | `npm run bump "Fix button styling"` | 1.7.5 → 1.7.6 |
| **minor** | New features, enhancements | `npm run bump:minor "Add dark mode"` | 1.7.5 → 1.8.0 |  
| **major** | Breaking changes, major rewrites | `npm run bump:major "New architecture"` | 1.7.5 → 2.0.0 |

## Example Workflow

```bash
# 1. Make your code changes
git add .
git commit -m "Implement new feature"

# 2. Bump version and push (all in one command!)
npm run bump:minor "Add real-time typing indicators"

# Done! ✅ 
# - Version updated everywhere
# - Changes committed  
# - Pushed to main branch
```

## Safety Features

- **Uncommitted Changes Warning** - Prompts if there are uncommitted files
- **Directory Validation** - Ensures script runs from correct location  
- **Error Handling** - Stops on any error to prevent corruption
- **Confirmation** - Shows what will be updated before proceeding

## Script Output

The script provides colorized output showing exactly what it's doing:

```
[INFO] Starting automated version bump...
[INFO] Version type: patch
[INFO] Current version: 1.7.5
[INFO] New version: 1.7.6
[INFO] Updating frontend/package.json...
[INFO] Updating backend/package.json...
[SUCCESS] Version updated in all package.json files
[INFO] Adding updated files to git...
[INFO] Committing changes...
[INFO] Pushing to main branch...
[SUCCESS] 🎉 Version successfully bumped to 1.7.6!
```

## Benefits

- ⚡ **Fast** - One command does everything
- 🎯 **Accurate** - Never forget to update a file
- 🔄 **Consistent** - Same version everywhere
- 🛡️ **Safe** - Built-in checks and validations  
- 📝 **Documented** - Clear commit messages with version info
- 🚀 **Automated** - Handles git operations automatically

## Troubleshooting

**Script not executable?**
```bash
chmod +x scripts/bump-version.sh
```

**Want to see what would change without running?**
```bash
# Check current version
npm run version

# The script will show you the new version before committing
```

**Made a mistake?**
```bash
# You can always revert the last commit if needed
git reset --hard HEAD~1
git push --force origin main
```

---

*This system saves time and prevents version sync issues across the application!*
