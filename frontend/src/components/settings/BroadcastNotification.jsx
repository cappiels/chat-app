/**
 * Broadcast Notification Component
 * Admin-only feature to send push notifications to all users
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Send, AlertCircle, CheckCircle2, Users, Radio } from 'lucide-react';
import { auth } from '../../firebase';

const BroadcastNotification = ({ currentUser }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // Check if current user is admin
  const isAdmin = currentUser?.email === 'cappiels@gmail.com';

  if (!isAdmin) {
    return null;
  }

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setResult({ success: false, error: 'Title and message are required' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, body })
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          recipientCount: data.recipientCount
        });
        // Clear form on success
        setTitle('');
        setBody('');
      } else {
        setResult({
          success: false,
          error: data.error || 'Failed to send broadcast'
        });
      }
    } catch (err) {
      console.error('Broadcast error:', err);
      setResult({
        success: false,
        error: err.message || 'Network error'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Broadcast Notification</h3>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Send push notifications to all users with registered devices
        </p>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter your message..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
            maxLength={500}
          />
          <p className="text-xs text-gray-500 mt-1">{body.length}/500 characters</p>
        </div>

        {/* Result message */}
        {result && (
          <div className={`flex items-start gap-2 p-3 rounded-lg ${
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            {result.success ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              {result.success ? (
                <span className="text-green-700">
                  {result.message}
                  {result.recipientCount > 0 && (
                    <span className="flex items-center gap-1 mt-1 text-green-600">
                      <Users className="w-4 h-4" />
                      {result.recipientCount} recipient(s)
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-red-700">{result.error}</span>
              )}
            </div>
          </div>
        )}

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
            sending || !title.trim() || !body.trim()
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {sending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Broadcast
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          This will send to all users who have push notifications enabled
        </p>
      </div>
    </div>
  );
};

BroadcastNotification.propTypes = {
  currentUser: PropTypes.object.isRequired
};

export default BroadcastNotification;
