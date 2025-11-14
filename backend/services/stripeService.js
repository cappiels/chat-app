const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createPool } = require('../config/database');

const pool = createPool();

class StripeService {
  constructor() {
    this.stripe = stripe;
  }

  // Create checkout session for subscription
  async createCheckoutSession(userId, planId, successUrl, cancelUrl) {
    try {
      // Get user details
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      const user = userResult.rows[0];

      // Get plan details
      const planResult = await pool.query('SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true', [planId]);
      if (planResult.rows.length === 0) {
        throw new Error('Plan not found');
      }
      const plan = planResult.rows[0];

      // Create or get Stripe customer
      let customer;
      const existingCustomer = await this.stripe.customers.list({
        email: user.email,
        limit: 1
      });

      if (existingCustomer.data.length > 0) {
        customer = existingCustomer.data[0];
      } else {
        customer = await this.stripe.customers.create({
          email: user.email,
          name: user.display_name,
          metadata: {
            user_id: userId
          }
        });
      }

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [{
          price: plan.stripe_price_id,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          user_id: userId,
          plan_id: planId
        },
        subscription_data: {
          metadata: {
            user_id: userId,
            plan_id: planId
          }
        }
      });

      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  // Handle successful subscription creation
  async handleSubscriptionCreated(stripeSubscription) {
    try {
      const userId = stripeSubscription.metadata.user_id;
      const planId = stripeSubscription.metadata.plan_id;

      // Cancel any existing subscription for this user
      await this.cancelUserSubscription(userId, false);

      // Create new subscription record
      const result = await pool.query(`
        INSERT INTO user_subscriptions (
          user_id, plan_id, stripe_customer_id, stripe_subscription_id,
          status, current_period_start, current_period_end,
          trial_start, trial_end
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        userId,
        planId,
        stripeSubscription.customer,
        stripeSubscription.id,
        stripeSubscription.status,
        new Date(stripeSubscription.current_period_start * 1000),
        new Date(stripeSubscription.current_period_end * 1000),
        stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
        stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error handling subscription created:', error);
      throw error;
    }
  }

  // Update existing subscription status
  async updateSubscriptionStatus(stripeSubscriptionId, status, currentPeriodEnd) {
    try {
      const result = await pool.query(`
        UPDATE user_subscriptions 
        SET status = $1, current_period_end = $2, updated_at = NOW()
        WHERE stripe_subscription_id = $3
        RETURNING *
      `, [status, new Date(currentPeriodEnd * 1000), stripeSubscriptionId]);

      return result.rows[0];
    } catch (error) {
      console.error('Error updating subscription status:', error);
      throw error;
    }
  }

  // Get user's current subscription
  async getUserSubscription(userId) {
    try {
      const result = await pool.query(`
        SELECT us.*, sp.name as plan_name, sp.display_name as plan_display_name,
               sp.features, sp.max_workspaces, sp.max_users_per_workspace
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = $1
        ORDER BY us.created_at DESC
        LIMIT 1
      `, [userId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  }

  // Cancel user subscription
  async cancelUserSubscription(userId, cancelAtPeriodEnd = true) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        throw new Error('No subscription found');
      }

      // Cancel in Stripe
      if (cancelAtPeriodEnd) {
        await this.stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true
        });
      } else {
        await this.stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      }

      // Update database
      const result = await pool.query(`
        UPDATE user_subscriptions 
        SET cancel_at_period_end = $1, 
            canceled_at = $2,
            updated_at = NOW()
        WHERE user_id = $3 AND stripe_subscription_id = $4
        RETURNING *
      `, [cancelAtPeriodEnd, cancelAtPeriodEnd ? null : new Date(), userId, subscription.stripe_subscription_id]);

      return result.rows[0];
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  // Generate free pass (admin)
  async generateFreePass(adminUserId, planId, options = {}) {
    try {
      const {
        maxUses = 1,
        expiresAt = null,
        durationMonths = 1,
        notes = null
      } = options;

      // Generate unique code
      const code = this.generatePassCode();

      const result = await pool.query(`
        INSERT INTO free_passes (
          code, plan_id, created_by_admin, max_uses, expires_at, 
          duration_months, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [code, planId, adminUserId, maxUses, expiresAt, durationMonths, notes]);

      return result.rows[0];
    } catch (error) {
      console.error('Error generating free pass:', error);
      throw error;
    }
  }

  // Generate free pass via API
  async generateFreePassAPI(apiKey, planId, options = {}) {
    try {
      // Verify API key
      const apiResult = await pool.query(`
        SELECT * FROM api_keys 
        WHERE api_key = $1 AND is_active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
      `, [apiKey]);

      if (apiResult.rows.length === 0) {
        throw new Error('Invalid or expired API key');
      }

      const apiKeyRecord = apiResult.rows[0];

      // Check if this plan is allowed
      if (apiKeyRecord.allowed_plan_ids.length > 0 && !apiKeyRecord.allowed_plan_ids.includes(planId)) {
        throw new Error('Plan not allowed for this API key');
      }

      // Check rate limiting (basic implementation)
      const today = new Date().toISOString().split('T')[0];
      const todayUsage = await pool.query(`
        SELECT COUNT(*) as count FROM free_passes 
        WHERE api_key_used = $1 AND DATE(created_at) = $2
      `, [apiKey, today]);

      if (parseInt(todayUsage.rows[0].count) >= apiKeyRecord.max_passes_per_day) {
        throw new Error('API key daily limit exceeded');
      }

      const {
        maxUses = 1,
        expiresAt = null,
        durationMonths = 1,
        apiSource = 'external',
        notes = null
      } = options;

      // Generate unique code
      const code = this.generatePassCode();

      const result = await pool.query(`
        INSERT INTO free_passes (
          code, plan_id, api_key_used, api_source, max_uses, 
          expires_at, duration_months, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [code, planId, apiKey, apiSource, maxUses, expiresAt, durationMonths, notes]);

      // Update API key last used
      await pool.query(`
        UPDATE api_keys SET last_used_at = NOW() WHERE api_key = $1
      `, [apiKey]);

      return result.rows[0];
    } catch (error) {
      console.error('Error generating API free pass:', error);
      throw error;
    }
  }

  // Redeem free pass
  async redeemFreePass(userId, passCode, ipAddress = null, userAgent = null) {
    try {
      // Get pass details
      const passResult = await pool.query(`
        SELECT fp.*, sp.name as plan_name, sp.stripe_price_id
        FROM free_passes fp
        JOIN subscription_plans sp ON fp.plan_id = sp.id
        WHERE fp.code = $1 AND fp.is_active = true
        AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
        AND fp.used_count < fp.max_uses
      `, [passCode]);

      if (passResult.rows.length === 0) {
        throw new Error('Invalid, expired, or fully used pass code');
      }

      const pass = passResult.rows[0];

      // Check if user already redeemed this pass
      const existingRedemption = await pool.query(`
        SELECT * FROM pass_redemptions WHERE pass_id = $1 AND user_id = $2
      `, [pass.id, userId]);

      if (existingRedemption.rows.length > 0) {
        throw new Error('Pass already redeemed by this user');
      }

      // Check if user already has active subscription
      const existingSubscription = await this.getUserSubscription(userId);
      if (existingSubscription && ['active', 'trialing'].includes(existingSubscription.status)) {
        throw new Error('User already has an active subscription');
      }

      // Create subscription period
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + pass.duration_months);

      // Create fake subscription record (no Stripe involvement for free passes)
      const subscriptionResult = await pool.query(`
        INSERT INTO user_subscriptions (
          user_id, plan_id, stripe_customer_id, stripe_subscription_id,
          status, current_period_start, current_period_end
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        userId,
        pass.plan_id,
        'free_pass_customer',
        `free_pass_${pass.id}_${userId}`,
        'active',
        startDate,
        endDate
      ]);

      // Record redemption
      await pool.query(`
        INSERT INTO pass_redemptions (
          pass_id, user_id, subscription_created_id, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5)
      `, [pass.id, userId, subscriptionResult.rows[0].id, ipAddress, userAgent]);

      // Update pass usage
      await pool.query(`
        UPDATE free_passes SET used_count = used_count + 1, updated_at = NOW()
        WHERE id = $1
      `, [pass.id]);

      return {
        subscription: subscriptionResult.rows[0],
        pass: pass
      };
    } catch (error) {
      console.error('Error redeeming free pass:', error);
      throw error;
    }
  }

  // Generate unique pass code
  generatePassCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Get all subscription plans
  async getSubscriptionPlans() {
    try {
      const result = await pool.query(`
        SELECT * FROM subscription_plans WHERE is_active = true
        ORDER BY price_cents ASC
      `);
      return result.rows;
    } catch (error) {
      console.error('Error getting subscription plans:', error);
      throw error;
    }
  }

  // Webhook signature verification
  verifyWebhookSignature(payload, signature, secret) {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw error;
    }
  }
}

module.exports = new StripeService();
