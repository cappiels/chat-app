import React from 'react';
import PropTypes from 'prop-types';
import AppLayout from './layout/AppLayout';

const ChatInterface = ({ user, workspace, onSignOut, onWorkspaceSwitch, onBackToWorkspaces }) => {
  return (
    <AppLayout 
      user={user} 
      workspace={workspace} 
      onSignOut={onSignOut}
      onWorkspaceSwitch={onWorkspaceSwitch}
      onBackToWorkspaces={onBackToWorkspaces}
    />
  );
};

ChatInterface.propTypes = {
  user: PropTypes.object.isRequired,
  workspace: PropTypes.object.isRequired,
  onSignOut: PropTypes.func.isRequired,
  onWorkspaceSwitch: PropTypes.func,
  onBackToWorkspaces: PropTypes.func,
};

export default ChatInterface;
