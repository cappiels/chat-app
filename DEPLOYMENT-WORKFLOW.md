# 🚀 Simple Deployment Workflow

## **TL;DR - What Script Do I Run?**

### **Local Development & Testing:**
```bash
./deploy-dev.sh
```
- Starts local PostgreSQL
- Runs migrations
- Starts backend on port 8080
- Starts frontend on port 5173
- Opens browser automatically
- **NO version bump, NO git push**

### **Deploy to Production:**
```bash
./deploy-prod.sh patch "what you changed"
```
- Bumps version automatically (React + Backend + Flutter)
- Commits all changes
- Pushes to production
- DigitalOcean rebuilds automatically
- **USE THIS when you're done and tested locally**

---

## **Complete Workflow (Step-by-Step)**

### **1. Make Your Changes**
Edit code in `frontend/`, `backend/`, or `mobile/`

### **2. Test Locally**
```bash
./deploy-dev.sh
```
- Verify everything works at http://localhost:5173
- Press Ctrl+C when done testing

### **3. Deploy to Production**
```bash
./deploy-prod.sh patch "Fixed message send button"
```

**That's it!** 🎉

---

## **Script Reference**

### **`./deploy-dev.sh`** - Local Testing
**Use when:** You want to test changes locally
**What it does:**
- ✅ Starts local PostgreSQL database
- ✅ Runs migrations to mirror production
- ✅ Starts backend server (port 8080)
- ✅ Starts frontend dev server (port 5173)
- ❌ Does NOT bump versions
- ❌ Does NOT push to git

**Example:**
```bash
./deploy-dev.sh
# Test your changes...
# Press Ctrl+C to stop
```

### **`./deploy-prod.sh`** - Production Deployment
**Use when:** Changes are tested and ready for production
**What it does:**
- ✅ Bumps version (all platforms)
- ✅ Commits changes to git
- ✅ Pushes to production
- ✅ DigitalOcean auto-rebuilds

**Version Bump Types:**
- `patch` - Bug fixes, small changes (1.8.39 → 1.8.40)
- `minor` - New features (1.8.39 → 1.9.0)
- `major` - Breaking changes (1.8.39 → 2.0.0)

**Examples:**
```bash
# Bug fix (most common)
./deploy-prod.sh patch "Fixed typing indicator"

# New feature
./deploy-prod.sh minor "Added voice messages"

# Interactive mode (asks questions)
./deploy-prod.sh
```

### **`./bumpv.sh`** - Interactive Version Bump
**Use when:** You want a prettier interactive experience
**Same as deploy-prod.sh but with:**
- 🎨 Colored output
- 🤔 Interactive prompts
- 📋 Visual confirmation

**Example:**
```bash
./bumpv.sh
# Follow the prompts...
```

---

## **Common Scenarios**

### **Scenario 1: Quick Bug Fix**
```bash
# 1. Fix the bug in your code
# 2. Test locally
./deploy-dev.sh

# 3. Deploy to production
./deploy-prod.sh patch "Fixed message timestamp display"
```

### **Scenario 2: New Feature**
```bash
# 1. Build the feature
# 2. Test locally
./deploy-dev.sh

# 3. Deploy to production
./deploy-prod.sh minor "Added message reactions"
```

### **Scenario 3: Flutter Mobile Changes**
```bash
# 1. Make changes in mobile/ directory
# 2. Test locally (or in iOS Simulator)
# 3. Deploy - versions sync automatically!
./deploy-prod.sh patch "Updated mobile UI"

# Flutter version automatically matches React/Backend
```

---

## **Version Management (Automatic)**

When you run `./deploy-prod.sh patch`:
- React: `1.8.39` → `1.8.40`
- Backend: `1.8.39` → `1.8.40`
- Flutter: `1.8.39+1839` → `1.8.40+1840`

**All platforms stay in sync automatically!**

---

## **Quick Reference Card**

| Task | Command | Version Bump? | Git Push? |
|------|---------|---------------|-----------|
| Test locally | `./deploy-dev.sh` | ❌ No | ❌ No |
| Deploy bug fix | `./deploy-prod.sh patch "msg"` | ✅ Yes | ✅ Yes |
| Deploy feature | `./deploy-prod.sh minor "msg"` | ✅ Yes | ✅ Yes |
| Interactive deploy | `./bumpv.sh` | ✅ Yes | ✅ Yes |

---

## **Remember:**

1. **Always test with `./deploy-dev.sh` first**
2. **Use `./deploy-prod.sh` when ready for production**
3. **Versions sync automatically across all platforms**
4. **DigitalOcean rebuilds automatically after push**

---

**That's all you need to know!** 🎉
