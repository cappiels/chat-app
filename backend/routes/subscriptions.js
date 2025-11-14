const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');
const { authenticateUser } = require('../middleware/auth');
const { createPool } = require('../config/database');

const pool = createPool();

// Apply authentication to all routes
router.use(authenticateUser);

// GET /api/subscriptions/plans - Get all available plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await stripeService.getSubscriptionPlans();
    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

// GET /api/subscriptions/status - Get user's current subscription status
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = await stripeService.getUserSubscription(userId);
    
    if (!subscription) {
      return res.json({ 
        hasSubscription: false,
        plan: 'free',
        status: 'none'
      });
    }

    res.json({
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        plan_name: subscription.plan_name,
        plan_display_name: subscription.plan_display_name,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        features: subscription.features,
        max_workspaces: subscription.max_workspaces,
        max_users_per_workspace: subscription.max_users_per_workspace
      }
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// POST /api/subscriptions/create-checkout-session - Create Stripe checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Build URLs based on environment
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL 
      : 'http://localhost:3000';

    const successUrl = `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/subscription/cancel`;

    const session = await stripeService.createCheckoutSession(
      userId, 
      planId, 
      successUrl, 
      cancelUrl
    );

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/subscriptions/cancel - Cancel user's subscription
router.post('/cancel', async (req, res) => {
  try {
    const userId = req.user.id;
    const { immediate = false } = req.body;

    const canceledSubscription = await stripeService.cancelUserSubscription(
      userId, 
      !immediate
    );

    res.json({
      message: immediate ? 'Subscription canceled immediately' : 'Subscription will cancel at period end',
      subscription: canceledSubscription
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
});

// POST /api/subscriptions/passes/redeem - Redeem a free pass
router.post('/passes/redeem', async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Pass code is required' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const result = await stripeService.redeemFreePass(
      userId, 
      code.toUpperCase(), 
      ipAddress, 
      userAgent
    );

    res.json({
      message: 'Pass redeemed successfully',
      subscription: result.subscription,
      pass: {
        code: result.pass.code,
        plan_name: result.pass.plan_name,
        duration_months: result.pass.duration_months
      }
    });
  } catch (error) {
    console.error('Error redeeming pass:', error);
    res.status(400).json({ error: error.message || 'Failed to redeem pass' });
  }
});

// Admin routes (workspace admins only)
// GET /api/subscriptions/admin/passes - Get passes created by admin
router.get('/admin/passes', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // TODO: Add proper admin check - for now, any authenticated user can see their created passes
    const result = await pool.query(`
      SELECT fp.*, sp.name as plan_name, sp.display_name as plan_display_name
      FROM free_passes fp
      JOIN subscription_plans sp ON fp.plan_id = sp.id
      WHERE fp.created_by_admin = $1
      ORDER BY fp.created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admin passes:', error);
    res.status(500).json({ error: 'Failed to fetch passes' });
  }
});

// POST /api/subscriptions/admin/passes/generate - Generate free pass (admin only)
router.post('/admin/passes/generate', async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const { 
      planId, 
      maxUses = 1, 
      expiresAt = null, 
      durationMonths = 1, 
      notes = null 
    } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // TODO: Add proper admin check
    // For now, any authenticated user can generate passes

    const pass = await stripeService.generateFreePass(adminUserId, planId, {
      maxUses,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      durationMonths,
      notes
    });

    res.json({
      message: 'Free pass generated successfully',
      pass: {
        id: pass.id,
        code: pass.code,
        plan_id: pass.plan_id,
        max_uses: pass.max_uses,
        expires_at: pass.expires_at,
        duration_months: pass.duration_months,
        notes: pass.notes
      }
    });
  } catch (error) {
    console.error('Error generating pass:', error);
    res.status(500).json({ error: 'Failed to generate pass' });
  }
});

// External API routes (require API key)
// POST /api/subscriptions/external/passes/generate - Generate pass via API key
router.post('/external/passes/generate', async (req, res) => {
  try {
    const apiKey = req.get('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const { 
      planId, 
      maxUses = 1, 
      expiresAt = null, 
      durationMonths = 1,
      apiSource = 'external',
      notes = null 
    } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    const pass = await stripeService.generateFreePassAPI(apiKey, planId, {
      maxUses,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      durationMonths,
      apiSource,
      notes
    });

    res.json({
      success: true,
      pass: {
        code: pass.code,
        plan_id: pass.plan_id,
        max_uses: pass.max_uses,
        expires_at: pass.expires_at,
        duration_months: pass.duration_months
      }
    });
  } catch (error) {
    console.error('Error generating API pass:', error);
    res.status(error.message.includes('Invalid') ? 401 : 500).json({ 
      error: error.message || 'Failed to generate pass' 
    });
  }
});

// Stripe webhook endpoint (no auth required)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('Stripe webhook secret not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(req.body, signature, webhookSecret);

    console.log('Stripe webhook received:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
        await stripeService.handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await stripeService.updateSubscriptionStatus(
          event.data.object.id,
          event.data.object.status,
          event.data.object.current_period_end
        );
        break;

      case 'customer.subscription.deleted':
        await stripeService.updateSubscriptionStatus(
          event.data.object.id,
          'canceled',
          event.data.object.current_period_end
        );
        break;

      case 'invoice.payment_failed':
        // Handle failed payments
        console.log('Payment failed for subscription:', event.data.object.subscription);
        break;

      case 'invoice.payment_succeeded':
        // Handle successful payments
        console.log('Payment succeeded for subscription:', event.data.object.subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

// Utility routes for development/testing
if (process.env.NODE_ENV === 'development') {
  // GET /api/subscriptions/dev/create-api-key - Create API key for testing
  router.post('/dev/create-api-key', async (req, res) => {
    try {
      const userId = req.user.id;
      const { keyName = 'Test Key', maxPassesPerDay = 10 } = req.body;

      const apiKey = 'sk_test_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const result = await pool.query(`
        INSERT INTO api_keys (key_name, api_key, created_by_user, max_passes_per_day)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [keyName, apiKey, userId, maxPassesPerDay]);

      res.json({
        message: 'API key created (development only)',
        apiKey: result.rows[0]
      });
    } catch (error) {
      console.error('Error creating dev API key:', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  });
}

module.exports = router;
