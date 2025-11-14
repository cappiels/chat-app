-- Migration 028: Stripe Subscription System
-- Add subscription plans, user subscriptions, free passes, and redemption tracking

-- Subscription plans (e.g., Basic, Pro, Enterprise)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL, -- Store price in cents to avoid float issues
    currency VARCHAR(3) DEFAULT 'usd',
    billing_interval VARCHAR(20) NOT NULL CHECK (billing_interval IN ('month', 'year')),
    stripe_price_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_product_id VARCHAR(255) NOT NULL,
    features JSONB DEFAULT '[]', -- Array of feature strings
    max_workspaces INTEGER DEFAULT 1,
    max_users_per_workspace INTEGER DEFAULT 10,
    max_channels_per_workspace INTEGER DEFAULT 5,
    max_upload_size_mb INTEGER DEFAULT 10, -- Upload limit in MB
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    stripe_customer_id VARCHAR(255) NOT NULL,
    stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete')),
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id) -- One subscription per user
);

-- Free passes for admin/API generation
CREATE TABLE IF NOT EXISTS free_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    created_by_admin VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
    api_source VARCHAR(100), -- Track which external app generated this
    api_key_used VARCHAR(100), -- Reference to API key if generated externally
    
    -- Pass configuration
    max_uses INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    duration_months INTEGER DEFAULT 1, -- How long the subscription lasts
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CHECK (used_count <= max_uses),
    CHECK (duration_months > 0)
);

-- Pass redemption tracking
CREATE TABLE IF NOT EXISTS pass_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_id UUID NOT NULL REFERENCES free_passes(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMP DEFAULT NOW(),
    subscription_created_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    
    UNIQUE(pass_id, user_id) -- Prevent same user redeeming same pass multiple times
);

-- API keys for external pass generation
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) NOT NULL UNIQUE,
    created_by_user VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- Optional workspace scope
    
    -- Permissions
    can_generate_passes BOOLEAN DEFAULT true,
    allowed_plan_ids UUID[] DEFAULT '{}', -- Restrict to specific plans
    max_passes_per_day INTEGER DEFAULT 100,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_free_passes_code ON free_passes(code);
CREATE INDEX IF NOT EXISTS idx_free_passes_active ON free_passes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pass_redemptions_pass_id ON pass_redemptions(pass_id);
CREATE INDEX IF NOT EXISTS idx_pass_redemptions_user_id ON pass_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- Insert default subscription plans with updated pricing
INSERT INTO subscription_plans (name, display_name, description, price_cents, billing_interval, stripe_price_id, stripe_product_id, features, max_workspaces, max_users_per_workspace, max_channels_per_workspace, max_upload_size_mb) 
VALUES 
    ('free', 'Free Plan', 'Access invited channels only', 0, 'month', 'price_free_placeholder', 'prod_free_placeholder', 
     '["Chat in invited channels", "View tasks and calendar", "No workspace/channel creation"]', 0, 0, 0, 5),
    ('starter', 'Starter Plan', 'Perfect for small teams', 300, 'month', 'price_starter_placeholder', 'prod_starter_placeholder', 
     '["1 workspace", "3 channels", "Multi-assignee tasks", "Calendar integration", "10MB upload limit"]', 1, 10, 3, 10),
    ('pro', 'Pro Plan', 'Advanced features for growing teams', 800, 'month', 'price_pro_placeholder', 'prod_pro_placeholder', 
     '["5 workspaces", "25 channels", "Timeline view", "50MB upload limit", "Advanced analytics"]', 5, 50, 25, 50),
    ('business', 'Business Plan', 'Full features for organizations', 1500, 'month', 'price_business_placeholder', 'prod_business_placeholder', 
     '["Unlimited workspaces", "Unlimited channels", "API access", "100MB upload limit", "Priority support"]', 999, 999, 999, 100)
ON CONFLICT (stripe_price_id) DO NOTHING;

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION user_has_active_subscription(user_uuid VARCHAR(128))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_subscriptions 
        WHERE user_id = user_uuid 
        AND status IN ('trialing', 'active')
        AND current_period_end > NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's current plan
CREATE OR REPLACE FUNCTION get_user_subscription_plan(user_uuid VARCHAR(128))
RETURNS TABLE(
    plan_name VARCHAR(100),
    plan_display_name VARCHAR(150),
    status VARCHAR(50),
    current_period_end TIMESTAMP,
    features JSONB,
    max_workspaces INTEGER,
    max_users_per_workspace INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.name,
        sp.display_name,
        us.status,
        us.current_period_end,
        sp.features,
        sp.max_workspaces,
        sp.max_users_per_workspace
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = user_uuid
    AND us.status IN ('trialing', 'active')
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
