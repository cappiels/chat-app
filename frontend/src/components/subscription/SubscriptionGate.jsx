import React, { useState } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { X, Crown, Check, Gift } from 'lucide-react';

const SubscriptionGate = ({ 
  trigger, 
  action, 
  title, 
  description, 
  onClose,
  showRedeemPass = false 
}) => {
  const { 
    availablePlans, 
    createCheckoutSession, 
    redeemFreePass, 
    getCurrentPlan,
    isSiteAdmin 
  } = useSubscription();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassForm, setShowPassForm] = useState(false);
  const [passCode, setPassCode] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  // Don't show gate for site admin
  if (isSiteAdmin()) {
    return null;
  }

  // Get paid plans only (exclude free)
  const paidPlans = availablePlans.filter(plan => plan.name !== 'free');

  const handleUpgrade = async (planId) => {
    try {
      setIsLoading(true);
      await createCheckoutSession(planId);
    } catch (error) {
      console.error('Error upgrading:', error);
      alert('Failed to start upgrade process. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeemPass = async (e) => {
    e.preventDefault();
    if (!passCode.trim()) return;

    try {
      setIsLoading(true);
      setPassError('');
      await redeemFreePass(passCode.trim().toUpperCase());
      setPassSuccess('Pass redeemed successfully! Your subscription is now active.');
      setTimeout(() => {
        onClose?.();
      }, 2000);
    } catch (error) {
      setPassError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (cents) => {
    return (cents / 100).toFixed(2);
  };

  const currentPlan = getCurrentPlan();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <Crown className="h-6 w-6 text-yellow-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              {title || 'Upgrade Your Plan'}
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Current status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-full p-2 mr-3">
                <Crown className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Current Plan: {currentPlan.display_name}
                </p>
                <p className="text-sm text-blue-700">
                  {description || `${action} requires a paid subscription.`}
                </p>
              </div>
            </div>
          </div>

          {/* Free pass form */}
          {showRedeemPass && (
            <div className="mb-6">
              {!showPassForm ? (
                <button
                  onClick={() => setShowPassForm(true)}
                  className="flex items-center text-green-600 hover:text-green-700 font-medium"
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Have a free pass code?
                </button>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-green-900 mb-3">
                    Redeem Free Pass
                  </h3>
                  <form onSubmit={handleRedeemPass} className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={passCode}
                        onChange={(e) => setPassCode(e.target.value)}
                        placeholder="Enter pass code (e.g., ABCD1234EFGH)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        maxLength="20"
                      />
                    </div>
                    {passError && (
                      <p className="text-sm text-red-600">{passError}</p>
                    )}
                    {passSuccess && (
                      <p className="text-sm text-green-600">{passSuccess}</p>
                    )}
                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        disabled={isLoading || !passCode.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? 'Redeeming...' : 'Redeem Pass'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPassForm(false);
                          setPassCode('');
                          setPassError('');
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Plans grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {paidPlans.map((plan) => (
              <div
                key={plan.id}
                className={`border rounded-lg p-6 relative ${
                  plan.name === 'pro' 
                    ? 'border-blue-500 ring-2 ring-blue-200' 
                    : 'border-gray-200'
                }`}
              >
                {plan.name === 'pro' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      RECOMMENDED
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {plan.display_name}
                  </h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">
                      ${formatPrice(plan.price_cents)}
                    </span>
                    <span className="text-gray-500">/month</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features && plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isLoading}
                  className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                    plan.name === 'pro'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoading ? 'Processing...' : 'Choose Plan'}
                </button>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              You can access invited channels while on the free plan. 
              Upgrade to create your own workspaces and channels.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionGate;
