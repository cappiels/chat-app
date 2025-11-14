import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  Users, 
  Settings,
  Search,
  Calendar,
  Crown,
  Filter,
  BarChart3
} from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../contexts/AuthContext';

const AdminWorkspaceTabs = ({ 
  user, 
  personalWorkspaces, 
  onSelectWorkspace, 
  onShowCreateForm 
}) => {
  const { isSiteAdmin } = useSubscription();
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState('my-workspaces');
  const [allWorkspaces, setAllWorkspaces] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');

  // Only show admin tabs for site admin
  if (!isSiteAdmin()) {
    return null;
  }

  // Fetch admin data
  const fetchAdminWorkspaces = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/workspaces', {
        headers: {
          'Authorization': `Bearer ${authUser.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAllWorkspaces(data.workspaces);
      }
    } catch (error) {
      console.error('Error fetching admin workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${authUser.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching admin users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${authUser.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAdminStats(data);
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'all-workspaces' && allWorkspaces.length === 0) {
      fetchAdminWorkspaces();
    } else if (activeTab === 'users' && allUsers.length === 0) {
      fetchAdminUsers();
    }
    
    if (adminStats === null) {
      fetchAdminStats();
    }
  }, [activeTab]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatSubscriptionPlan = (plan) => {
    const planColors = {
      free: 'bg-gray-100 text-gray-800',
      starter: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
      business: 'bg-green-100 text-green-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${planColors[plan] || planColors.free}`}>
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </span>
    );
  };

  const filteredWorkspaces = allWorkspaces.filter(workspace => {
    const matchesSearch = workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workspace.owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workspace.owner.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPlan = filterPlan === 'all' || workspace.owner.subscription.plan === filterPlan;
    
    return matchesSearch && matchesPlan;
  });

  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPlan = filterPlan === 'all' || user.subscription.plan === filterPlan;
    
    return matchesSearch && matchesPlan;
  });

  const getTabLabel = (tab) => {
    let count = 0;
    let label = tab.label;

    if (tab.id === 'my-workspaces') {
      count = personalWorkspaces.length;
    } else if (tab.id === 'all-workspaces') {
      count = allWorkspaces.length;
    } else if (tab.id === 'users') {
      count = allUsers.length;
    }

    return count > 0 ? `${label} (${count})` : label;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Mobile-Friendly Admin Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 sm:p-6 flex-shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center">
              <Crown className="h-5 w-5 sm:h-6 sm:w-6 mr-2 flex-shrink-0" />
              <h1 className="text-lg sm:text-2xl font-bold">Site Administration</h1>
            </div>
            <div className="text-xs sm:text-sm opacity-90 truncate">
              Welcome, {user.displayName}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-Responsive Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 flex-shrink-0">
        <div className="max-w-6xl mx-auto">
          <nav className="flex overflow-x-auto scrollbar-hide">
            {[
              { id: 'my-workspaces', label: 'My Workspaces', shortLabel: 'My', icon: MessageCircle },
              { id: 'all-workspaces', label: 'All Workspaces', shortLabel: 'All', icon: Settings },
              { id: 'users', label: 'Users', shortLabel: 'Users', icon: Users }
            ].map((tab) => {
              const Icon = tab.icon;
              const tabLabel = getTabLabel(tab);
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-3 sm:px-4 py-3 sm:py-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline">{tabLabel}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content - Scrollable Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {activeTab === 'my-workspaces' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h2 className="text-lg sm:text-xl font-semibold">Your Personal Workspaces</h2>
              <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs sm:text-sm font-medium self-start">
                {personalWorkspaces.length} workspaces
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {personalWorkspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onSelectWorkspace(workspace)}
                >
                  <h3 className="font-semibold text-lg mb-2">{workspace.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{workspace.description || 'No description'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {workspace.member_count} members
                    </span>
                    <span className="text-sm text-gray-400">
                      {formatDate(workspace.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              
              {/* Create workspace card */}
              <div
                className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-purple-400 cursor-pointer transition-colors"
                onClick={onShowCreateForm}
              >
                <div className="text-center">
                  <div className="text-gray-400 mb-2">+</div>
                  <div className="text-gray-600">Create New Workspace</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'all-workspaces' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h2 className="text-lg sm:text-xl font-semibold">System Workspaces</h2>
              <div className="flex flex-wrap gap-2 sm:gap-4">
                {adminStats && (
                  <>
                    <div className="bg-blue-100 text-blue-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                      {allWorkspaces.length} total
                    </div>
                    <div className="bg-green-100 text-green-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                      {adminStats.subscription_breakdown.filter(p => p.plan !== 'free').reduce((sum, p) => sum + parseInt(p.count), 0)} paying
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search workspaces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                </select>
              </div>
            </div>

            {/* All Workspaces Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workspace
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Members
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                        Loading workspaces...
                      </td>
                    </tr>
                  ) : filteredWorkspaces.map((workspace) => (
                    <tr key={workspace.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {workspace.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {workspace.description || 'No description'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {workspace.owner.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {workspace.owner.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatSubscriptionPlan(workspace.owner.subscription.plan)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workspace.member_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(workspace.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h2 className="text-lg sm:text-xl font-semibold">System Users</h2>
              <div className="flex flex-wrap gap-2 sm:gap-4">
                {adminStats && (
                  <>
                    <div className="bg-gray-100 text-gray-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                      {adminStats.total_users} total
                    </div>
                    <div className="bg-green-100 text-green-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                      {adminStats.active_users_7d} active (7d)
                    </div>
                    <div className="bg-purple-100 text-purple-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                      {adminStats.subscription_breakdown.filter(p => p.plan !== 'free').reduce((sum, p) => sum + parseInt(p.count), 0)} paying
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                </select>
              </div>
            </div>

            {/* All Users Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workspaces
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <img
                            className="h-8 w-8 rounded-full"
                            src={user.profile_picture_url || '/api/placeholder/32/32'}
                            alt={user.display_name}
                          />
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {user.display_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatSubscriptionPlan(user.subscription.plan)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div>Owns: {user.workspaces_owned}</div>
                          <div className="text-gray-500">Member of: {user.workspaces_member_of}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.joined_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_login ? formatDate(user.last_login) : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
        </div>
      </div>
    </div>
  );
};

export default AdminWorkspaceTabs;
