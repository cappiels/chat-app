# DigitalOcean Multi-Environment Setup Guide
*Professional Dev → Staging → Production Pipeline*

## 🚀 DigitalOcean App Platform Environment Strategy

DigitalOcean App Platform supports multiple deployment approaches for testing before production:

### **Option 1: Branch-Based Environments (Recommended)**
```
main branch        → Production (chat-app-prod.ondigitalocean.app)
staging branch     → Staging (chat-app-staging.ondigitalocean.app)  
develop branch     → Development (chat-app-dev.ondigitalocean.app)
```

### **Option 2: Multiple Apps**
- `chat-app-production` - Connected to `main` branch
- `chat-app-staging` - Connected to `staging` branch
- `chat-app-dev` - Connected to `develop` branch

---

## 🏗️ SETUP INSTRUCTIONS

### **Step 1: Create Branch-Based Environments**

#### **A. Create Staging Environment**
1. **In DigitalOcean Dashboard:**
   - Go to Apps → Your App → Settings → Environments
   - Click "Add Environment"
   - Name: `staging`
   - Branch: `staging` 
   - Domain: `chat-app-staging.ondigitalocean.app`

2. **Create Staging Branch:**
```bash
git checkout main
git checkout -b staging
git push origin staging
```

#### **B. Create Development Environment**
1. **In DigitalOcean Dashboard:**
   - Add another environment
   - Name: `development`
   - Branch: `develop`
   - Domain: `chat-app-dev.ondigitalocean.app`

2. **Create Development Branch:**
```bash
git checkout main  
git checkout -b develop
git push origin develop
```

### **Step 2: Environment-Specific Configuration**

#### **Environment Variables Per Environment**
```yaml
# Production Environment
DATABASE_URL: postgres://prod-connection
ENVIRONMENT: production
DEBUG: false

# Staging Environment  
DATABASE_URL: postgres://staging-connection
ENVIRONMENT: staging
DEBUG: true

# Development Environment
DATABASE_URL: postgres://dev-connection  
ENVIRONMENT: development
DEBUG: true
```

#### **Database Strategy**
- **Production**: Main PostgreSQL cluster
- **Staging**: Separate staging database cluster
- **Development**: Shared dev database or separate small instance

---

## 🔄 WORKFLOW PROCESS

### **Development Workflow**
```mermaid
graph LR
    A[Local Dev] --> B[develop branch]
    B --> C[chat-app-dev.ondigitalocean.app]
    C --> D[Test Features]
    D --> E[staging branch]  
    E --> F[chat-app-staging.ondigitalocean.app]
    F --> G[Final Testing]
    G --> H[main branch]
    H --> I[chat-app-prod.ondigitalocean.app]
```

### **Day-to-Day Process**
1. **Develop Locally**
   ```bash
   git checkout develop
   # Make changes
   git add .
   git commit -m "New feature"
   git push origin develop
   ```
   → Auto-deploys to `chat-app-dev.ondigitalocean.app`

2. **Test in Dev Environment**
   - Visit dev URL to test changes
   - Verify new features work
   - Check database migrations

3. **Promote to Staging**
   ```bash
   git checkout staging
   git merge develop
   git push origin staging
   ```
   → Auto-deploys to `chat-app-staging.ondigitalocean.app`

4. **Final Testing in Staging**
   - Production-like environment testing
   - Performance testing
   - User acceptance testing

5. **Deploy to Production**
   ```bash
   git checkout main
   git merge staging
   git push origin main
   ```
   → Auto-deploys to production

---

## 💾 DATABASE MANAGEMENT

### **Staging Database Setup**
```bash
# Create staging database cluster in DigitalOcean
# Connection string: postgresql://staging-user:pass@staging-db/chatapp

# Run migrations on staging
NODE_ENV=staging npm run migrate
```

### **Data Management Strategy**
- **Production**: Real user data (protected)
- **Staging**: Anonymized production data OR test data
- **Development**: Test data only

### **Migration Safety**
```javascript
// backend/migrations/run-migrations.js
const environment = process.env.NODE_ENV || 'development';

if (environment === 'production') {
  console.log('🔒 Production migration - extra safety checks');
  // Additional confirmation prompts
}
```

---

## 🚦 ENVIRONMENT-SPECIFIC FEATURES

### **App Configuration by Environment**
```javascript
// backend/config/environment.js
const config = {
  development: {
    database: process.env.DEV_DATABASE_URL,
    debug: true,
    logLevel: 'debug',
    corsOrigin: ['http://localhost:3000', 'https://chat-app-dev.ondigitalocean.app']
  },
  staging: {
    database: process.env.STAGING_DATABASE_URL, 
    debug: true,
    logLevel: 'info',
    corsOrigin: ['https://chat-app-staging.ondigitalocean.app']
  },
  production: {
    database: process.env.DATABASE_URL,
    debug: false,
    logLevel: 'error',
    corsOrigin: ['https://chat-app.ondigitalocean.app']
  }
};

module.exports = config[process.env.NODE_ENV || 'development'];
```

### **Frontend Environment Detection**
```javascript
// frontend/src/config/environment.js
const getEnvironment = () => {
  const hostname = window.location.hostname;
  
  if (hostname.includes('-dev.')) return 'development';
  if (hostname.includes('-staging.')) return 'staging';
  return 'production';
};

export const environment = getEnvironment();
export const apiUrl = {
  development: 'https://chat-app-dev.ondigitalocean.app/api',
  staging: 'https://chat-app-staging.ondigitalocean.app/api', 
  production: 'https://chat-app.ondigitalocean.app/api'
}[environment];
```

---

## 🔧 DIGITALOCEAN SPECIFIC SETUP

### **App Platform Configuration**
```yaml
# .do/app.yaml
name: chat-app
services:
- name: backend
  source_dir: backend
  github:
    repo: your-repo/chat-app
    branch: main  # Changes per environment
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  
- name: frontend  
  source_dir: frontend
  github:
    repo: your-repo/chat-app
    branch: main  # Changes per environment
  run_command: npm run build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
```

## 💰 COST BREAKDOWN & BUDGET OPTIONS

### **DigitalOcean App Platform Pricing Reality**
**Yes, additional environments cost extra money** - each environment runs separate resources.

### **❗ CHECK CURRENT PRICING**
**I don't have real-time pricing data** - You need to check:
- Visit: https://www.digitalocean.com/pricing/app-platform
- Current App Platform instance pricing
- Current Database cluster pricing

**Each environment will cost the same as your current setup** since they run identical resources.

### **💡 COST-EFFECTIVE ALTERNATIVES**

#### **Option A: FREE Branch Testing (Recommended)**
**Cost: $0 extra**
```bash
# Use same production environment with branch switching
git checkout staging-branch
git push origin main  # Temporarily deploy staging to production
# Test, then revert back to stable main
```

#### **Option B: Minimal Staging Only**  
**Cost: +$12/month** 
- Keep production environment
- Add only 1 staging environment for final testing
- Do local development testing

#### **Option C: Shared Development Environment**
**Cost: +$5/month**
- Production: Full setup ($12/month)
- Single shared staging/dev environment ($5/month - smallest instance)
- Multiple developers push to same staging branch

#### **Option D: On-Demand Environments**
**Cost: ~$3-8/month**
- Spin up staging environment only when needed
- Delete after testing (can recreate quickly)
- Pay only for active testing periods

### **Smart Cost Strategies**
- **Use smallest instances** for non-production (`basic-xxs` = $5/month)
- **Share database** between staging/dev environments  
- **Auto-pause** development environments when not in use
- **Monthly cleanup** - delete unused test environments

---

## 🛡️ SECURITY & ACCESS

### **Environment Access Control**
- **Production**: Restricted access, admin-only
- **Staging**: Team access for testing
- **Development**: Open team access

### **API Keys & Secrets**
- Separate API keys for each environment
- Different Firebase projects per environment  
- Isolated authentication systems

---

## 📊 MONITORING & LOGGING

### **Per-Environment Monitoring**
- **Development**: Basic logging
- **Staging**: Performance monitoring
- **Production**: Full monitoring + alerting

### **Log Levels**
```javascript
const logLevels = {
  development: 'debug',
  staging: 'info', 
  production: 'warn'
};
```

---

## 🚀 QUICK START

### **Immediate Setup (15 minutes)**
1. Create `staging` branch from `main`
2. In DigitalOcean: Add staging environment → point to `staging` branch
3. Set staging environment variables
4. Test workflow: `develop` → `staging` → `main`

### **Full Setup (1-2 hours)**  
1. Create all three environments
2. Set up separate databases
3. Configure environment-specific variables
4. Set up proper domain names
5. Test complete workflow

This gives you a professional CI/CD pipeline where you can safely test changes before they hit production!
