import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const { user } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Site admin email - has full access regardless of subscription
  const SITE_ADMIN_EMAIL = 'cappiels@gmail.com';

  // Fetch subscription status
  const fetchSubscriptionStatus = async () => {
    console.log('🔍 SubscriptionContext: fetchSubscriptionStatus called', { user: user?.email, hasToken: !!user?.token });
    
    if (!user?.token) {
      console.log('🔍 No user token, setting default free plan');
      setSubscriptionData({
        hasSubscription: false,
        plan: 'free',
        status: 'none'
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Making subscription API call for user:', user.email);
      
      const response = await fetch('/api/subscriptions/status', {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.log('🔍 Subscription API response not OK:', response.status, response.statusText);
        throw new Error(`Failed to fetch subscription status: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔍 Subscription API response:', data);
      setSubscriptionData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err.message);
      // Default to free plan on error - this allows new users to continue
      console.log('🔍 Setting default free plan due to error');
      setSubscriptionData({
        hasSubscription: false,
        plan: 'free',
        status: 'none'
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if user is site admin
  const isSiteAdmin = () => {
    console.log('🔍 Checking site admin:', user?.email, 'vs', SITE_ADMIN_EMAIL);
    return user?.email === SITE_ADMIN_EMAIL;
  };

  // Get current plan details with defaults
  const getCurrentPlan = () => {
    if (isSiteAdmin()) {
      return {
        name: 'admin',
        display_name: 'Site Admin',
        max_workspaces: 999,
        max_users_per_workspace: 999,
        max_channels_per_workspace: 999,
        max_upload_size_mb: 999,
        features: ['All features enabled'],
      };
    }

    if (!subscriptionData?.hasSubscription) {
      return {
        name: 'free',
        display_name: 'Free Plan',
        max_workspaces: 0,
        max_users_per_workspace: 0,
        max_channels_per_workspace: 0,
        max_upload_size_mb: 5,
        features: ['Chat in invited channels', 'View tasks and calendar'],
      };
    }

    return subscriptionData.subscription;
  };

  // Feature access checks
  const canCreateWorkspace = () => {
    if (isSiteAdmin()) return true;
    const plan = getCurrentPlan();
    return plan.max_workspaces > 0;
  };

  const canCreateChannel = (currentChannelCount = 0) => {
    if (isSiteAdmin()) return true;
    const plan = getCurrentPlan();
    return plan.max_channels_per_workspace === 999 || currentChannelCount < plan.max_channels_per_workspace;
  };

  const canInviteUsers = (currentUserCount = 0) => {
    if (isSiteAdmin()) return true;
    const plan = getCurrentPlan();
    return plan.max_users_per_workspace === 999 || currentUserCount < plan.max_users_per_workspace;
  };

  const getMaxUploadSize = () => {
    const plan = getCurrentPlan();
    return plan.max_upload_size_mb * 1024 * 1024; // Convert MB to bytes
  };

  // Check if user needs upgrade prompt
  const needsUpgradePrompt = () => {
    if (isSiteAdmin()) return false;
    return !subscriptionData?.hasSubscription || subscriptionData.plan === 'free';
  };

  // Get subscription plans
  const [availablePlans, setAvailablePlans] = useState([]);
  
  const fetchAvailablePlans = async () => {
    if (!user?.token) return;

    try {
      const response = await fetch('/api/subscriptions/plans', {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const plans = await response.json();
        setAvailablePlans(plans);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  };

  // Create checkout session
  const createCheckoutSession = async (planId) => {
    if (!user?.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch('/api/subscriptions/create-checkout-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error('Error creating checkout session:', err);
      throw err;
    }
  };

  // Cancel subscription
  const cancelSubscription = async (immediate = false) => {
    if (!user?.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ immediate }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel subscription');
      }

      // Refresh subscription data
      await fetchSubscriptionStatus();
      
      return await response.json();
    } catch (err) {
      console.error('Error canceling subscription:', err);
      throw err;
    }
  };

  // Redeem free pass
  const redeemFreePass = async (code) => {
    if (!user?.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch('/api/subscriptions/passes/redeem', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to redeem pass');
      }

      // Refresh subscription data
      await fetchSubscriptionStatus();
      
      return await response.json();
    } catch (err) {
      console.error('Error redeeming pass:', err);
      throw err;
    }
  };

  // Load data on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus();
      fetchAvailablePlans();
    } else {
      setSubscriptionData(null);
      setLoading(false);
    }
  }, [user]);

  const value = {
    // Data
    subscriptionData,
    loading,
    error,
    availablePlans,
    
    // Plan info
    getCurrentPlan,
    isSiteAdmin,
    
    // Feature checks
    canCreateWorkspace,
    canCreateChannel,
    canInviteUsers,
    getMaxUploadSize,
    needsUpgradePrompt,
    
    // Actions
    fetchSubscriptionStatus,
    createCheckoutSession,
    cancelSubscription,
    redeemFreePass,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
