# Subscription Enforcement System Implementation

## Overview
Implementing freemium subscription model with hard limits enforced at API level.

**IMPORTANT**: Limits are based on the **workspace owner's subscription**, not the user performing the action. This means:
- A free user can only create 1 workspace (they own it)
- But that same free user can be invited to unlimited Pro/Business workspaces
- Each workspace's limits (channels, users, storage) are determined by the workspace owner's plan
- Future: Transfer ownership feature will allow upgrading a workspace's limits by changing owner

## Implementation Date
November 23, 2025

## Subscription Plans

### Free Plan - $0/month
- ✅ 1 workspace allowed
- ✅ 3 channels allowed
- ✅ Can access invited channels (unlimited)
- ✅ 10MB storage limit per workspace
- ✅ Graceful warnings + email notifications on limit

### Starter Plan - $9.99/month
- ✅ 1 workspace
- ✅ 5 channels
- ✅ 10 invited users per workspace
- ✅ 100MB storage limit
- ✅ Graceful warnings + email notifications on limit

### Pro Plan - $19.99/month
- ✅ 5 workspaces
- ✅ 25 channels
- ✅ 25 users per workspace
- ✅ 500MB storage limit
- ✅ Graceful warnings + email notifications on limit

### Business Plan - $99/month
- ✅ Unlimited workspaces (999)
- ✅ Unlimited channels (999)
- ✅ 100 users per workspace
- ✅ 10GB storage limit
- ✅ Graceful warnings + email notifications on limit

## Implementation Progress

### ✅ Phase 1: Database & Service Layer (COMPLETE)
- [x] Updated subscription plans in migration `028_stripe_subscription_system.sql`
- [x] Created `backend/services/subscriptionEnforcement.js` service
- [x] Implemented `getUserPlanLimits()` - Gets user's plan with fallback to free
- [x] Implemented `canCreateWorkspace()` - Checks creating user's plan (they become owner)
- [x] Implemented `canCreateChannel()` - Checks workspace owner's plan (not creator)
- [x] Implemented `canInviteUser()` - Checks workspace owner's plan (not inviter)
- [x] Implemented `canUploadFile()` - Checks workspace owner's plan (not uploader)
- [x] Implemented `getWorkspaceStorageUsage()` - Current usage calculation
- [x] Implemented `sendStorageLimitNotifications()` - In-app + email alerts

**Key Design**: All workspace-level limits (channels, users, storage) use the workspace owner's subscription plan, not the user performing the action.

### ⏳ Phase 2: API Enforcement (IN PROGRESS)
- [x] **Workspace Creation** - Added to `POST /api/workspaces`
- [ ] **Channel Creation** - Need to add to `POST /api/workspaces/:id/threads`
- [ ] **User Invitation** - Need to add to `POST /api/workspaces/:id/invite`
- [ ] **File Upload** - Need to add to `POST /api/upload`

### 📋 Phase 3: Email Templates (TODO)
- [ ] Create storage limit warning email template
- [ ] Create storage limit admin notification email template
- [ ] Add email methods to `emailService.js`

### 🧪 Phase 4: Testing (TODO)
- [ ] Test free plan workspace limit (1)
- [ ] Test free plan channel limit (3)
- [ ] Test storage limits with real file uploads
- [ ] Test email notifications for storage warnings
- [ ] Test upgrade flow when limits reached
- [ ] Verify invited users don't count against inviter's limits

### 🚀 Phase 5: Production Deployment (TODO)
- [ ] Update existing subscription plans via SQL script
- [ ] Deploy backend with enforcement
- [ ] Monitor error logs for enforcement issues
- [ ] Verify existing users maintain access to their workspaces

## API Error Response Format

When limits are reached, APIs return:

```json
{
  "error": "Subscription Limit Reached",
  "message": "You've reached your workspace limit (1/1). Upgrade your plan to create more workspaces.",
  "details": {
    "currentCount": 1,
    "limit": 1,
    "plan": "free",
    "planDisplayName": "Free Plan",
    "upgradeUrl": "https://crewchat.elbarriobk.com/#/subscription"
  }
}
```

## Storage Limit Notifications

When storage limits are exceeded during file upload:

1. **Upload is rejected** with 403 error
2. **In-app notification** created for uploader
3. **In-app notification** created for workspace admin (if different)
4. **Email sent** to uploader with upgrade link
5. **Email sent** to admin (if different) with warning

## Database Queries

### Get User's Plan Limits (for workspace creation only)
```sql
SELECT 
  COALESCE(sp.name, 'free') as plan_name,
  COALESCE(sp.max_workspaces, 1) as max_workspaces
FROM users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id 
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE u.id = $1
```

### Get Workspace Owner's Plan Limits (for channel/user/storage limits)
```sql
SELECT 
  COALESCE(sp.name, 'free') as plan_name,
  COALESCE(sp.max_channels_per_workspace, 3) as max_channels_per_workspace,
  COALESCE(sp.max_users_per_workspace, 999) as max_users_per_workspace,
  COALESCE(sp.max_upload_size_mb, 10) as max_upload_size_mb
FROM workspaces w
JOIN users u ON w.owner_user_id = u.id
LEFT JOIN user_subscriptions us ON u.id = us.user_id 
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE w.id = $1
```

### Get Workspace Storage Usage
```sql
SELECT 
  COALESCE(SUM(a.file_size), 0) / 1048576.0 as total_mb
FROM attachments a
JOIN messages m ON a.message_id = m.id
JOIN threads t ON m.thread_id = t.id
WHERE t.workspace_id = $1
```

## Files Modified

1. `backend/migrations/028_stripe_subscription_system.sql` - Updated plans
2. `backend/services/subscriptionEnforcement.js` - NEW: Core enforcement logic
3. `backend/routes/workspaces.js` - Added workspace creation enforcement
4. `backend/routes/threads.js` - TODO: Add channel creation enforcement
5. `backend/routes/upload.js` - TODO: Add storage enforcement
6. `backend/services/emailService.js` - TODO: Add email templates

## Testing Scenarios

### Workspace Limit Testing
```bash
# As free user - should allow 1 workspace
curl -X POST https://crewchat.elbarriobk.com/api/workspaces \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"First Workspace"}'
  
# Second workspace should fail
curl -X POST https://crewchat.elbarriobk.com/api/workspaces \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Second Workspace"}'
```

### Storage Limit Testing
```bash
# Upload 11MB file to free workspace (should fail)
curl -X POST https://crewchat.elbarriobk.com/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@large_file.pdf"
```

## Migration Plan

### For Existing Users
1. All existing users default to Free Plan
2. Existing workspaces grandfathered (no deletion)
3. Workspace owners' plans determine workspace limits
4. Invited users can access any workspace regardless of their own plan
5. Limits only apply to NEW creations (channels, invites)
6. Storage limits checked but allow existing content

### Example Scenarios
**Scenario 1**: Free user creates workspace
- Can create 1 workspace
- That workspace has 3 channels max
- Can invite unlimited users to their workspace (free plan allows 999 members)
- 10MB storage limit for that workspace

**Scenario 2**: Free user invited to Pro workspace
- Can access and use all 25 channels in Pro workspace
- Can upload files (limited by Pro owner's 500MB total)
- Cannot create new workspace (already hit their 1 workspace limit)

**Scenario 3**: Transfer ownership (future feature)
- Free owner wants more channels
- Invited Pro user can take ownership
- Workspace immediately gets 25 channel limit
- Original owner maintains access as member

### Upgrade Flow
1. User hits limit
2. Error message with upgrade link
3. Redirect to `/subscription` page
4. Select plan → Stripe checkout
5. Subscription activated → limits increased

## Rollback Plan

If issues arise:
1. Remove enforcement checks from API routes
2. Keep service layer intact
3. Revert migration `028` if needed
4. Existing data unaffected

## Success Metrics

- [ ] Zero existing users blocked from their workspaces
- [ ] All new free users limited to 1 workspace
- [ ] Storage limit emails sent successfully
- [ ] Upgrade flow completes without errors
- [ ] No false positives (paying users blocked)

## Next Steps

1. Complete channel creation enforcement
2. Complete user invitation enforcement  
3. Complete storage enforcement
4. Add email templates
5. Test all scenarios in dev
6. Deploy to production
7. Monitor for 48 hours
