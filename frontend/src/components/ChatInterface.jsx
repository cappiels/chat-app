import React from 'react';
import PropTypes from 'prop-types';
import AppLayout from './layout/AppLayout';

const ChatInterface = ({ user, workspace, onSignOut, onWorkspaceSwitch }) => {
  return (
    <AppLayout 
      user={user} 
      workspace={workspace} 
      onSignOut={onSignOut}
      onWorkspaceSwitch={onWorkspaceSwitch}
    />
  );
};

ChatInterface.propTypes = {
  user: PropTypes.object.isRequired,
  workspace: PropTypes.object.isRequired,
  onSignOut: PropTypes.func.isRequired,
  onWorkspaceSwitch: PropTypes.func,
};

export default ChatInterface;
