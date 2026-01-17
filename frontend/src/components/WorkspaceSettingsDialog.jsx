import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Settings,
  Trash2,
  Archive,
  Users,
  UserMinus,
  Crown,
  AlertTriangle,
  X,
  UsersRound,
  Plus,
  UserPlus,
  Search,
  Radio
} from 'lucide-react';
import { workspaceAPI } from '../utils/api';
import toast from 'react-hot-toast';
import AddMemberDialog from './admin/AddMemberDialog';
import BroadcastNotification from './settings/BroadcastNotification';

const SITE_ADMIN_EMAIL = 'cappiels@gmail.com';

const WorkspaceSettingsDialog = ({ 
  workspace, 
  user, 
  isOpen, 
  onClose, 
  onWorkspaceDeleted,
  onMemberRemoved 
}) => {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmInput, setConfirmInput] = useState('');
  
  // Teams state
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(null);
  const [showAddRegisteredUserDialog, setShowAddRegisteredUserDialog] = useState(false);
  const [newTeam, setNewTeam] = useState({
    name: '',
    display_name: '',
    description: '',
    color: 'blue'
  });

  // Derive values - must be before hooks to maintain consistent hook order
  const isOwner = workspace?.owner_user_id === user?.id;
  const isAdmin = workspace?.user_role === 'admin' || isOwner;
  const members = workspace?.members || [];
  const pendingInvitations = workspace?.pending_invitations || [];

  // Load teams when switching to teams tab - must be before early return
  useEffect(() => {
    if (isOpen && workspace && activeTab === 'teams' && isAdmin) {
      loadTeams();
    }
  }, [activeTab, isAdmin, isOpen, workspace?.id]);

  // Early return after all hooks
  if (!isOpen || !workspace) return null;

  const loadTeams = async () => {
    try {
      setLoadingTeams(true);
      const response = await workspaceAPI.getTeams(workspace.id);
      setTeams(response.data.teams || []);
    } catch (error) {
      console.error('Error loading teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeam.name || !newTeam.display_name) {
      toast.error('Team name and display name are required');
      return;
    }

    try {
      setLoading(true);
      await workspaceAPI.createTeam(workspace.id, newTeam);
      toast.success('Team created successfully');
      setShowCreateTeamDialog(false);
      setNewTeam({
        name: '',
        display_name: '',
        description: '',
        color: 'blue'
      });
      loadTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      toast.error(error.response?.data?.error || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeamMember = async (teamId, userId) => {
    try {
      setLoading(true);
      await workspaceAPI.addTeamMember(workspace.id, teamId, { user_id: userId, role: 'member' });
      toast.success('Member added to team');
      setShowAddMemberDialog(null);
      loadTeams();
    } catch (error) {
      console.error('Error adding team member:', error);
      toast.error(error.response?.data?.error || 'Failed to add team member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTeamMember = async (teamId, memberId) => {
    try {
      setLoading(true);
      await workspaceAPI.removeTeamMember(workspace.id, teamId, memberId);
      toast.success('Member removed from team');
      loadTeams();
    } catch (error) {
      console.error('Error removing team member:', error);
      toast.error('Failed to remove team member');
    } finally {
      setLoading(false);
    }
  };

  const teamColors = [
    { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
    { value: 'green', label: 'Green', class: 'bg-green-500' },
    { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
    { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
    { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
    { value: 'teal', label: 'Teal', class: 'bg-teal-500' },
    { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
    { value: 'red', label: 'Red', class: 'bg-red-500' },
    { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
    { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
    { value: 'rose', label: 'Rose', class: 'bg-rose-500' },
    { value: 'violet', label: 'Violet', class: 'bg-violet-500' }
  ];

  const handleDeleteWorkspace = async (archive = false) => {
    try {
      setLoading(true);
      if (archive) {
        await workspaceAPI.archiveWorkspace(workspace.id);
        toast.success('Workspace archived successfully');
      } else {
        await workspaceAPI.deleteWorkspace(workspace.id);
        toast.success('Workspace deleted permanently');
      }
      onWorkspaceDeleted?.(workspace.id, archive);
      onClose();
    } catch (error) {
      console.error('Delete workspace error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete workspace');
    } finally {
      setLoading(false);
      setConfirmAction(null);
      setConfirmInput('');
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      setLoading(true);
      await workspaceAPI.removeMember(workspace.id, memberId);
      toast.success('Member removed successfully');
      onMemberRemoved?.(memberId);
      setConfirmAction(null);
    } catch (error) {
      console.error('Remove member error:', error);
      toast.error(error.response?.data?.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    try {
      setLoading(true);
      await workspaceAPI.cancelInvitation(workspace.id, invitationId);
      toast.success('Invitation cancelled successfully');
      setConfirmAction(null);
      // Force a refresh by closing and reopening the dialog
      onClose();
      setTimeout(() => {
        // This will cause the parent to refetch workspace data
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error('Cancel invitation error:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel invitation');
    } finally {
      setLoading(false);
    }
  };

  const ConfirmationDialog = ({ action, onConfirm, onCancel }) => {
    const isDelete = action?.type === 'delete';
    const isArchive = action?.type === 'archive';
    const isRemoveMember = action?.type === 'removeMember';

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-60">
        <div className="bg-white rounded-[20px] border border-blue-200 shadow-[0_25px_50px_-12px_rgba(37,99,235,0.2)] p-8 w-full max-w-md mx-4 ring-1 ring-blue-100">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h3 className="text-lg font-semibold">
              {isDelete && 'Delete Workspace'}
              {isArchive && 'Archive Workspace'}
              {isRemoveMember && 'Remove Member'}
            </h3>
          </div>
          
          <p className="text-gray-600 mb-4">
            {isDelete && `This will permanently delete "${workspace.name}" and all its data. This action cannot be undone.`}
            {isArchive && `This will archive "${workspace.name}". You can restore it later, but members won't be able to access it.`}
            {isRemoveMember && `This will remove ${action.memberName} from the workspace. They will lose access to all channels and messages.`}
          </p>

          {(isDelete || isArchive) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type "{workspace.name}" to confirm:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                placeholder={workspace.name}
              />
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-gray-200 text-gray-900 hover:bg-gray-300 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-lg transition-all font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={
                loading || 
                ((isDelete || isArchive) && confirmInput !== workspace.name)
              }
              className={`px-6 py-3 rounded-lg text-white transition-all font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                isRemoveMember 
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700' 
                  : isArchive 
                  ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700'
                  : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700'
              }`}
            >
              {loading ? 'Processing...' : 
                isDelete ? 'Delete Forever' : 
                isArchive ? 'Archive' : 
                'Remove Member'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-[20px] border border-blue-200 shadow-[0_25px_50px_-12px_rgba(37,99,235,0.2)] w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col ring-1 ring-blue-100">
          {/* Header */}
          <div className="flex items-center justify-between p-8 border-b">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-gray-700" />
              <div>
                <h2 className="text-xl font-semibold">{workspace.name} Settings</h2>
                <p className="text-sm text-gray-600">Manage workspace settings and members</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Sidebar */}
            <div className="w-64 border-r bg-gray-50 p-4">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    activeTab === 'general' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  General
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setActiveTab('members')}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                        activeTab === 'members' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      Members ({members.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('teams')}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                        activeTab === 'teams' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      Teams ({teams.length})
                    </button>
                  </>
                )}
                {user?.email === SITE_ADMIN_EMAIL && (
                  <button
                    onClick={() => setActiveTab('broadcast')}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
                      activeTab === 'broadcast'
                        ? 'bg-purple-100 text-purple-700'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    Broadcast
                  </button>
                )}
                {isOwner && (
                  <button
                    onClick={() => setActiveTab('danger')}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      activeTab === 'danger'
                        ? 'bg-red-100 text-red-700'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    Danger Zone
                  </button>
                )}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto">
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Workspace Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Name</label>
                        <p className="text-gray-900">{workspace.name}</p>
                      </div>
                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Owner</label>
                        <p className="text-gray-900">{workspace.owner_name}</p>
                      </div>
                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Members</label>
                        <p className="text-gray-900">{members.length}</p>
                      </div>
                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Channels</label>
                        <p className="text-gray-900">{workspace.channel_count}</p>
                      </div>
                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Created</label>
                        <p className="text-gray-900">
                          {new Date(workspace.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Your Role</label>
                        <p className="text-gray-900 capitalize">{workspace.user_role}</p>
                      </div>
                    </div>
                  </div>
                  
                  {workspace.description && (
                    <div>
                      <label className="block font-medium text-gray-700 mb-2">Description</label>
                      <p className="text-gray-900">{workspace.description}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'members' && isAdmin && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Workspace Members</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {members.length} members {pendingInvitations.length > 0 && `• ${pendingInvitations.length} pending`}
                      </span>
                      {/* Site Admin: Add from registered users button */}
                      {user?.email === SITE_ADMIN_EMAIL && (
                        <button
                          onClick={() => setShowAddRegisteredUserDialog(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition-all shadow-sm"
                        >
                          <Search className="w-4 h-4" />
                          Add Member
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Accepted Members */}
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                          {member.profile_picture_url ? (
                            <img
                              src={member.profile_picture_url}
                              alt={member.display_name}
                              className="w-10 h-10 rounded-full border-2 border-gray-200"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center border-2 border-gray-200">
                              <span className="text-white font-semibold">
                                {member.display_name?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{member.display_name}</p>
                              {member.id === workspace.owner_user_id && (
                                <Crown className="w-4 h-4 text-yellow-500" title="Workspace Owner" />
                              )}
                              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full font-medium">
                                {member.role}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{member.email}</p>
                            <p className="text-xs text-gray-400">
                              Joined {new Date(member.joined_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        {member.id !== workspace.owner_user_id && member.id !== user?.id && (
                          <button
                            onClick={() => setConfirmAction({
                              type: 'removeMember',
                              memberId: member.id,
                              memberName: member.display_name
                            })}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Remove member"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Pending Invitations */}
                    {pendingInvitations.length > 0 && (
                      <>
                        <div className="border-t border-gray-200 pt-4 mt-6">
                          <h4 className="text-md font-medium text-gray-700 mb-3">Pending Invitations</h4>
                        </div>
                        {pendingInvitations.map((invitation) => (
                          <div key={invitation.id} className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center border-2 border-yellow-300">
                                <span className="text-gray-600 font-semibold">
                                  {invitation.email.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{invitation.email}</p>
                                  <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full font-medium animate-pulse">
                                    invited
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">Role: {invitation.role}</p>
                                <p className="text-xs text-gray-400">
                                  Invited by {invitation.invited_by_name} • Expires {new Date(invitation.expires_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => setConfirmAction({
                                type: 'cancelInvitation',
                                invitationId: invitation.id,
                                memberName: invitation.email
                              })}
                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                              title="Cancel invitation"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'teams' && isAdmin && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Workspace Teams</h3>
                    <button
                      onClick={() => setShowCreateTeamDialog(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Team
                    </button>
                  </div>

                  {loadingTeams ? (
                    <div className="text-center py-8">
                      <div className="loading-spinner mx-auto mb-2"></div>
                      <p className="text-gray-600">Loading teams...</p>
                    </div>
                  ) : teams.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <UsersRound className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-2">No teams yet</p>
                      <p className="text-sm text-gray-500">Create teams to group members and assign tasks</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {teams.map((team) => {
                        const colorClass = teamColors.find(c => c.value === team.color)?.class || 'bg-blue-500';
                        const teamMembers = team.members || [];
                        
                        return (
                          <div key={team.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center text-white font-bold`}>
                                  {team.display_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900">{team.display_name}</h4>
                                  <p className="text-sm text-gray-600">@{team.name}</p>
                                  {team.description && (
                                    <p className="text-sm text-gray-500 mt-1">{team.description}</p>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => setShowAddMemberDialog(team.id)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                Add Member
                              </button>
                            </div>

                            <div className="space-y-2">
                              <p className="text-sm font-medium text-gray-700">
                                Members ({teamMembers.length})
                              </p>
                              {teamMembers.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No members yet</p>
                              ) : (
                                <div className="space-y-2">
                                  {teamMembers.map((member) => (
                                    <div key={member.user_id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                          {member.display_name?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium">{member.display_name}</p>
                                          <p className="text-xs text-gray-500">{member.email}</p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleRemoveTeamMember(team.id, member.user_id)}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Remove from team"
                                        disabled={loading}
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'broadcast' && user?.email === SITE_ADMIN_EMAIL && (
                <div className="space-y-6">
                  <BroadcastNotification currentUser={user} />
                </div>
              )}

              {activeTab === 'danger' && isOwner && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-red-700 mb-4">Danger Zone</h3>
                    <p className="text-gray-600 mb-6">
                      These actions are irreversible. Please proceed with caution.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Archive className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-yellow-800">Archive Workspace</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            Archive this workspace. It will be hidden from members but can be restored later.
                          </p>
                          <button
                            onClick={() => setConfirmAction({ type: 'archive' })}
                            className="mt-3 px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-lg hover:from-yellow-700 hover:to-orange-700 transition-all font-medium shadow-md"
                          >
                            Archive Workspace
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="border border-red-300 bg-red-50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Trash2 className="w-5 h-5 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-red-800">Delete Workspace</h4>
                          <p className="text-sm text-red-700 mt-1">
                            Permanently delete this workspace and all its data. This action cannot be undone.
                          </p>
                          <button
                            onClick={() => setConfirmAction({ type: 'delete' })}
                            className="mt-3 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg hover:from-red-700 hover:to-pink-700 transition-all font-medium shadow-md"
                          >
                            Delete Workspace
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmAction && (
        <ConfirmationDialog
          action={confirmAction}
          onConfirm={() => {
            if (confirmAction.type === 'delete') {
              handleDeleteWorkspace(false);
            } else if (confirmAction.type === 'archive') {
              handleDeleteWorkspace(true);
            } else if (confirmAction.type === 'removeMember') {
              handleRemoveMember(confirmAction.memberId);
            } else if (confirmAction.type === 'cancelInvitation') {
              handleCancelInvitation(confirmAction.invitationId);
            }
          }}
          onCancel={() => {
            setConfirmAction(null);
            setConfirmInput('');
          }}
        />
      )}

      {/* Create Team Dialog */}
      {showCreateTeamDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Create New Team</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTeam.display_name}
                  onChange={(e) => {
                    const displayName = e.target.value;
                    const generatedName = displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                    setNewTeam({ ...newTeam, display_name: displayName, name: generatedName });
                  }}
                  placeholder="e.g., Marketing Team"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Handle <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">@</span>
                  <input
                    type="text"
                    value={newTeam.name}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      setNewTeam({ ...newTeam, name: value });
                    }}
                    placeholder="marketing-team"
                    className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  placeholder="Optional team description"
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Team Color</label>
                <div className="grid grid-cols-6 gap-2">
                  {teamColors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setNewTeam({ ...newTeam, color: color.value })}
                      className={`w-10 h-10 rounded-lg ${color.class} flex items-center justify-center transition-all ${
                        newTeam.color === color.value ? 'ring-2 ring-offset-2 ring-gray-400' : 'opacity-60 hover:opacity-100'
                      }`}
                      title={color.label}
                    >
                      {newTeam.color === color.value && (
                        <svg className="w-5 h-5 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateTeamDialog(false);
                  setNewTeam({ name: '', display_name: '', description: '', color: 'blue' });
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={loading || !newTeam.name || !newTeam.display_name}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Dialog */}
      {showAddMemberDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Add Team Member</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select workspace member to add:
              </label>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {members
                  .filter(member => {
                    const team = teams.find(t => t.id === showAddMemberDialog);
                    return !team?.members?.some(tm => tm.user_id === member.id);
                  })
                  .map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleAddTeamMember(showAddMemberDialog, member.id)}
                      disabled={loading}
                      className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left disabled:opacity-50"
                    >
                      {member.profile_picture_url ? (
                        <img
                          src={member.profile_picture_url}
                          alt={member.display_name}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {member.display_name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{member.display_name}</p>
                        <p className="text-sm text-gray-600">{member.email}</p>
                      </div>
                    </button>
                  ))}
                {members.filter(member => {
                  const team = teams.find(t => t.id === showAddMemberDialog);
                  return !team?.members?.some(tm => tm.user_id === member.id);
                }).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    All workspace members are already in this team
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowAddMemberDialog(null)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Site Admin: Add Registered User Dialog */}
      <AddMemberDialog
        workspace={workspace}
        user={user}
        isOpen={showAddRegisteredUserDialog}
        onClose={() => setShowAddRegisteredUserDialog(false)}
        onMemberAdded={(newMember) => {
          // The member was added, refresh the page to show updated members
          onClose();
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }}
      />
    </>
  );
};

WorkspaceSettingsDialog.propTypes = {
  workspace: PropTypes.object,
  user: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onWorkspaceDeleted: PropTypes.func,
  onMemberRemoved: PropTypes.func,
};

export default WorkspaceSettingsDialog;
