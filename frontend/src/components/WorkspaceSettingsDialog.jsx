import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  Settings, 
  Trash2, 
  Archive, 
  Users, 
  UserMinus, 
  Crown,
  AlertTriangle,
  X 
} from 'lucide-react';
import { workspaceAPI } from '../utils/api';
import toast from 'react-hot-toast';

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

  if (!isOpen || !workspace) return null;

  const isOwner = workspace.owner_user_id === user?.id;
  const isAdmin = workspace.user_role === 'admin' || isOwner;
  const members = workspace.members || [];

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

  const ConfirmationDialog = ({ action, onConfirm, onCancel }) => {
    const isDelete = action?.type === 'delete';
    const isArchive = action?.type === 'archive';
    const isRemoveMember = action?.type === 'removeMember';

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
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
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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
              className={`px-4 py-2 rounded-md text-white transition-colors ${
                isRemoveMember 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : isArchive 
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:opacity-50`}
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
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
            <div className="flex-1 p-6 overflow-y-auto">
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
                  <h3 className="text-lg font-semibold">Workspace Members</h3>
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {member.profile_picture_url ? (
                            <img
                              src={member.profile_picture_url}
                              alt={member.display_name}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold">
                                {member.display_name?.charAt(0) || 'U'}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{member.display_name}</p>
                              {member.id === workspace.owner_user_id && (
                                <Crown className="w-4 h-4 text-yellow-500" title="Workspace Owner" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{member.email}</p>
                            <p className="text-xs text-gray-500 capitalize">{member.role}</p>
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
                  </div>
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
                            className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
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
                            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
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
            }
          }}
          onCancel={() => {
            setConfirmAction(null);
            setConfirmInput('');
          }}
        />
      )}
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
