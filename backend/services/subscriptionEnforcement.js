const { createPool } = require('../config/database');
const emailService = require('./emailService');

const pool = createPool();

/**
 * Subscription Enforcement Service
 * Validates user actions against their subscription plan limits
 */
class SubscriptionEnforcementService {
  /**
   * Get user's subscription plan with limits
   * Returns free plan defaults if no active subscription
   */
  async getUserPlanLimits(userId) {
    try {
      const result = await pool.query(`
        SELECT 
          COALESCE(sp.name, 'free') as plan_name,
          COALESCE(sp.display_name, 'Free Plan') as plan_display_name,
          COALESCE(sp.max_workspaces, 1) as max_workspaces,
          COALESCE(sp.max_users_per_workspace, 999) as max_users_per_workspace,
          COALESCE(sp.max_channels_per_workspace, 3) as max_channels_per_workspace,
          COALESCE(sp.max_upload_size_mb, 10) as max_upload_size_mb,
          us.status,
          us.current_period_end
        FROM users u
        LEFT JOIN user_subscriptions us ON u.id = us.user_id 
          AND us.status IN ('trialing', 'active')
          AND us.current_period_end > NOW()
        LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE u.id = $1
        LIMIT 1
      `, [userId]);

      if (result.rows.length === 0) {
        // Return free plan defaults if user not found
        return {
          plan_name: 'free',
          plan_display_name: 'Free Plan',
          max_workspaces: 1,
          max_users_per_workspace: 999,
          max_channels_per_workspace: 3,
          max_upload_size_mb: 10,
          status: null,
          current_period_end: null
        };
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting user plan limits:', error);
      // Return free plan defaults on error
      return {
        plan_name: 'free',
        plan_display_name: 'Free Plan',
        max_workspaces: 1,
        max_users_per_workspace: 999,
        max_channels_per_workspace: 3,
        max_upload_size_mb: 10,
        status: null,
        current_period_end: null
      };
    }
  }

  /**
   * Check if user can create a new workspace
   */
  async canCreateWorkspace(userId) {
    try {
      const limits = await this.getUserPlanLimits(userId);
      
      // Count user's owned workspaces
      const countResult = await pool.query(`
        SELECT COUNT(*) as workspace_count
        FROM workspaces
        WHERE owner_user_id = $1
      `, [userId]);

      const currentCount = parseInt(countResult.rows[0].workspace_count);

      return {
        allowed: currentCount < limits.max_workspaces,
        currentCount,
        limit: limits.max_workspaces,
        plan: limits.plan_name,
        planDisplayName: limits.plan_display_name
      };
    } catch (error) {
      console.error('Error checking workspace creation:', error);
      return { allowed: false, error: 'Unable to verify workspace limits' };
    }
  }

  /**
   * Check if user can create a new channel in workspace
   */
  async canCreateChannel(workspaceId, userId) {
    try {
      // Get workspace owner's plan limits
      const ownerResult = await pool.query(`
        SELECT owner_user_id FROM workspaces WHERE id = $1
      `, [workspaceId]);

      if (ownerResult.rows.length === 0) {
        return { allowed: false, error: 'Workspace not found' };
      }

      const ownerId = ownerResult.rows[0].owner_user_id;
      const limits = await this.getUserPlanLimits(ownerId);

      // Count channels in workspace
      const countResult = await pool.query(`
        SELECT COUNT(*) as channel_count
        FROM threads
        WHERE workspace_id = $1 AND type = 'channel'
      `, [workspaceId]);

      const currentCount = parseInt(countResult.rows[0].channel_count);

      return {
        allowed: currentCount < limits.max_channels_per_workspace,
        currentCount,
        limit: limits.max_channels_per_workspace,
        plan: limits.plan_name,
        planDisplayName: limits.plan_display_name,
        isOwner: ownerId === userId
      };
    } catch (error) {
      console.error('Error checking channel creation:', error);
      return { allowed: false, error: 'Unable to verify channel limits' };
    }
  }

  /**
   * Check if user can invite more members to workspace
   */
  async canInviteUser(workspaceId, userId) {
    try {
      // Get workspace owner's plan limits
      const ownerResult = await pool.query(`
        SELECT owner_user_id FROM workspaces WHERE id = $1
      `, [workspaceId]);

      if (ownerResult.rows.length === 0) {
        return { allowed: false, error: 'Workspace not found' };
      }

      const ownerId = ownerResult.rows[0].owner_user_id;
      const limits = await this.getUserPlanLimits(ownerId);

      // Count current members
      const countResult = await pool.query(`
        SELECT COUNT(*) as member_count
        FROM workspace_members
        WHERE workspace_id = $1
      `, [workspaceId]);

      const currentCount = parseInt(countResult.rows[0].member_count);

      return {
        allowed: currentCount < limits.max_users_per_workspace,
        currentCount,
        limit: limits.max_users_per_workspace,
        plan: limits.plan_name,
        planDisplayName: limits.plan_display_name,
        isOwner: ownerId === userId
      };
    } catch (error) {
      console.error('Error checking user invitation:', error);
      return { allowed: false, error: 'Unable to verify member limits' };
    }
  }

  /**
   * Get workspace storage usage in MB
   */
  async getWorkspaceStorageUsage(workspaceId) {
    try {
      const result = await pool.query(`
        SELECT 
          COALESCE(SUM(a.file_size), 0) as total_bytes,
          COALESCE(SUM(a.file_size), 0) / 1048576.0 as total_mb
        FROM attachments a
        JOIN messages m ON a.message_id = m.id
        JOIN threads t ON m.thread_id = t.id
        WHERE t.workspace_id = $1
      `, [workspaceId]);

      return {
        totalBytes: parseInt(result.rows[0].total_bytes),
        totalMB: parseFloat(result.rows[0].total_mb)
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { totalBytes: 0, totalMB: 0 };
    }
  }

  /**
   * Check if file upload is within workspace storage limit
   */
  async canUploadFile(workspaceId, fileSizeMB) {
    try {
      // Get workspace owner's plan limits
      const ownerResult = await pool.query(`
        SELECT owner_user_id, name FROM workspaces WHERE id = $1
      `, [workspaceId]);

      if (ownerResult.rows.length === 0) {
        return { allowed: false, error: 'Workspace not found' };
      }

      const workspace = ownerResult.rows[0];
      const limits = await this.getUserPlanLimits(workspace.owner_user_id);
      const usage = await this.getWorkspaceStorageUsage(workspaceId);

      const newTotal = usage.totalMB + fileSizeMB;
      const allowed = newTotal <= limits.max_upload_size_mb;

      return {
        allowed,
        currentUsage: usage.totalMB,
        newTotal,
        limit: limits.max_upload_size_mb,
        plan: limits.plan_name,
        planDisplayName: limits.plan_display_name,
        workspaceOwnerId: workspace.owner_user_id,
        workspaceName: workspace.name,
        exceededBy: allowed ? 0 : newTotal - limits.max_upload_size_mb
      };
    } catch (error) {
      console.error('Error checking file upload:', error);
      return { allowed: false, error: 'Unable to verify storage limits' };
    }
  }

  /**
   * Send storage limit warning notifications
   * Notifies both the user attempting upload and workspace admin
   */
  async sendStorageLimitNotifications(workspaceId, userId, uploadCheckResult, filename) {
    try {
      const workspace = await pool.query(`
        SELECT w.id, w.name, w.owner_user_id,
               u_owner.email as owner_email, u_owner.display_name as owner_name,
               u_uploader.email as uploader_email, u_uploader.display_name as uploader_name
        FROM workspaces w
        JOIN users u_owner ON w.owner_user_id = u_owner.id
        JOIN users u_uploader ON u_uploader.id = $2
        WHERE w.id = $1
      `, [workspaceId, userId]);

      if (workspace.rows.length === 0) return;

      const ws = workspace.rows[0];
      const isOwner = ws.owner_user_id === userId;

      // Create in-app notification for uploader
      await pool.query(`
        INSERT INTO notifications (
          user_id, workspace_id, type, title, message, data
        ) VALUES ($1, $2, 'storage_limit_exceeded', $3, $4, $5)
      `, [
        userId,
        workspaceId,
        '⚠️ Storage Limit Exceeded',
        `Cannot upload "${filename}". Workspace "${ws.name}" has reached its ${uploadCheckResult.limit}MB storage limit (${uploadCheckResult.planDisplayName}).`,
        JSON.stringify({
          workspace_id: workspaceId,
          workspace_name: ws.name,
          filename,
          current_usage_mb: uploadCheckResult.currentUsage,
          limit_mb: uploadCheckResult.limit,
          exceeded_by_mb: uploadCheckResult.exceededBy,
          plan: uploadCheckResult.plan
        })
      ]);

      // Notify admin if different from uploader
      if (!isOwner) {
        await pool.query(`
          INSERT INTO notifications (
            user_id, workspace_id, type, title, message, data
          ) VALUES ($1, $2, 'storage_limit_exceeded_admin', $3, $4, $5)
        `, [
          ws.owner_user_id,
          workspaceId,
          '⚠️ Storage Limit Alert',
          `${ws.uploader_name} attempted to upload a file but workspace "${ws.name}" has reached its ${uploadCheckResult.limit}MB storage limit.`,
          JSON.stringify({
            workspace_id: workspaceId,
            workspace_name: ws.name,
            uploader_name: ws.uploader_name,
            uploader_email: ws.uploader_email,
            filename,
            current_usage_mb: uploadCheckResult.currentUsage,
            limit_mb: uploadCheckResult.limit,
            exceeded_by_mb: uploadCheckResult.exceededBy,
            plan: uploadCheckResult.plan
          })
        ]);
      }

      // Send email to uploader
      try {
        await emailService.sendStorageLimitEmail({
          to: ws.uploader_email,
          userName: ws.uploader_name,
          workspaceName: ws.name,
          filename,
          currentUsageMB: uploadCheckResult.currentUsage.toFixed(2),
          limitMB: uploadCheckResult.limit,
          exceededByMB: uploadCheckResult.exceededBy.toFixed(2),
          plan: uploadCheckResult.planDisplayName,
          isOwner
        });
      } catch (emailError) {
        console.error('Failed to send storage limit email to uploader:', emailError.message);
      }

      // Send email to admin if different
      if (!isOwner) {
        try {
          await emailService.sendStorageLimitAdminEmail({
            to: ws.owner_email,
            adminName: ws.owner_name,
            uploaderName: ws.uploader_name,
            uploaderEmail: ws.uploader_email,
            workspaceName: ws.name,
            filename,
            currentUsageMB: uploadCheckResult.currentUsage.toFixed(2),
            limitMB: uploadCheckResult.limit,
            exceededByMB: uploadCheckResult.exceededBy.toFixed(2),
            plan: uploadCheckResult.planDisplayName
          });
        } catch (emailError) {
          console.error('Failed to send storage limit email to admin:', emailError.message);
        }
      }

      console.log(`📧 Storage limit notifications sent for workspace ${ws.name}`);
    } catch (error) {
      console.error('Error sending storage limit notifications:', error);
    }
  }

  /**
   * Generate upgrade URL for user
   */
  getUpgradeUrl(userId) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://crewchat.elbarriobk.com';
    return `${frontendUrl}/#/subscription`;
  }
}

module.exports = new SubscriptionEnforcementService();
