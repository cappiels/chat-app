# Flutter Mobile App Development Plan
## Chat App with Multi-Assignee Tasks & Calendar Integration

---

## 📱 PHASE 1: FEATURE IDENTIFICATION

### **🎯 MUST PORT (Critical)**
- Authentication (Firebase)
- Real-time messaging (Socket.IO)
- Multi-assignee tasks with "2/7 done" progress
- Team assignments with color system
- Basic calendar view (mobile-optimized)
- Push notifications (Firebase Cloud Messaging)
- **Stripe subscription system**
- **Admin-generated free passes**
- **API-generated passes from external apps**

### **📱 MOBILE-ADAPTED**
- Timeline view → Simplified, NO drag/drop (tap-to-edit modals)
- Task creation → Mobile forms instead of `/task` commands
- Navigation → Bottom tabs instead of header buttons
- Channel management → Drawer/bottom sheets

### **❌ SKIP (V1)**
- Complex Gantt interactions
- Drag & drop timeline editing
- Parent-child task dragging
- Google Calendar sync (V2 feature)

---

## 🚀 PHASE 2: TECHNICAL ARCHITECTURE

### **Stack**
- **Frontend**: Flutter with Riverpod state management
- **Backend**: Existing PostgreSQL + Express (zero changes to APIs)
- **Auth**: Firebase SDK
- **Real-time**: Socket.IO client
- **Notifications**: Firebase Cloud Messaging
- **Deployment**: Codemagic (handles iOS certificates automatically)

### **Project Structure**
```
lib/
├── main.dart
├── core/ (constants, theme, utils)
├── data/ (models, services, repositories)
├── presentation/ (screens, widgets, providers)
└── routes/
```

### **Key Dependencies**
```yaml
firebase_core: ^2.24.2
firebase_auth: ^4.15.3  
firebase_messaging: ^14.7.10
socket_io_client: ^2.0.3+1
riverpod: ^2.4.9
table_calendar: ^3.0.9
```

---

## 📅 PHASE 3: DEVELOPMENT TIMELINE (12 Weeks)

### **Weeks 1-2: Foundation**
- Flutter project setup + Firebase
- Authentication flow
- API service integration
- Socket.IO connection

### **Weeks 3-4: Core Chat**
- Workspace/channel navigation
- Message list with real-time updates
- Mobile message composer
- Push notification setup

### **Weeks 5-6: Multi-Assignee Tasks**
- Task creation with multiple assignees
- Individual progress tracking
- Team assignment system
- Task completion workflows

### **Weeks 7-8: Calendar**
- Monthly calendar view
- Task display in calendar
- Channel filtering
- Mobile date pickers

### **Weeks 9-10: Timeline**
- Simplified timeline view (read-only)
- Task dependency visualization
- Tap-to-edit functionality

### **Weeks 11-12: Polish & Deploy**
- Performance optimization
- App Store preparation
- CI/CD setup via Codemagic

---

## 💳 PHASE 4: STRIPE SUBSCRIPTION SYSTEM

### **Architecture Decision: Firebase Auth + Custom Stripe (NO Clerk)**
- **Keep existing Firebase auth** (already integrated)
- **Direct Stripe integration** using your existing credentials
- **Custom membership logic** in your PostgreSQL backend
- **Clerk would add unnecessary complexity** and duplicate auth systems

### **Required Backend Additions**
```javascript
// New dependencies
stripe: ^14.0.0
```

### **New Database Tables**
```sql
-- Subscription plans
subscription_plans (id, name, price, features, stripe_price_id)

-- User subscriptions  
user_subscriptions (user_id, plan_id, stripe_subscription_id, status, current_period_end)

-- Free passes
free_passes (id, code, created_by_admin, max_uses, used_count, expires_at, api_source)

-- Pass redemptions
pass_redemptions (pass_id, user_id, redeemed_at)
```

### **API Endpoints**
```javascript
// Subscription management
POST /api/subscriptions/create-checkout-session
GET /api/subscriptions/status
POST /api/subscriptions/cancel

// Free pass system
POST /api/admin/passes/generate (admin only)
POST /api/passes/redeem/:code
POST /api/external/passes/generate (API key required)
```

### **Flutter Integration**
```yaml
# Additional dependency
stripe_checkout: ^2.0.0
```

### **Free Pass System**
- **Admin-generated**: Workspace admins can create passes via dashboard
- **API-generated**: External apps can create passes via API key
- **Pass types**: Single-use, multi-use, time-limited
- **Redemption flow**: User enters code → validates → grants subscription access

### **Effort Estimate**
- Backend Stripe integration: 2-3 weeks
- Flutter payment screens: 1 week  
- Free pass system: 1-2 weeks
- **Total additional: 4-6 weeks**

---

## 🔧 PHASE 5: BACKEND NOTIFICATION CHANGES

### **Required Additions**
- Firebase Admin SDK integration
- Device token storage table
- Push notification service class
- Device token registration API
- Integration with existing message/task endpoints

### **New Database Tables**
```sql
user_device_tokens (user_id, device_token, device_type)
user_notification_preferences (user_id, settings)
```

### **Effort Estimate**
- Backend changes: 1-2 weeks
- Mobile integration: 1 week
- Total additional: 3-4 weeks

---

## 🚀 PHASE 5: DEPLOYMENT STRATEGY

### **Codemagic Setup**
- Handles iOS certificates automatically
- Direct TestFlight + Play Store uploads
- Free tier: 500 build minutes/month
- Zero Xcode/Mac required

### **Process**
```bash
git tag v1.0.0 && git push origin main --tags
# Codemagic automatically builds, signs, and deploys
```

### **Costs**
- Codemagic: $0-95/month
- Apple Developer: $99/year
- Google Play: $25 one-time

---

## ✅ SUCCESS METRICS

### **Performance Targets**
- App launch: <3 seconds
- Message sending: <1 second  
- Calendar load: <2 seconds

### **Feature Completeness**
- 100% core messaging
- 90% multi-assignee tasks
- 80% calendar integration
- 60% timeline features

---

## 🎯 IMMEDIATE NEXT STEPS

1. ✅ Feature identification complete
2. Validate priorities
3. Set up Flutter development environment
4. Begin Sprint 1: Foundation

---

**Total Timeline**: 12 weeks development + 4-6 weeks Stripe system + 3-4 weeks notifications = ~19-22 weeks to production-ready mobile app
