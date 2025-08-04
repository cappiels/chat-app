import React from 'react';
import PropTypes from 'prop-types';
import AppLayout from './layout/AppLayout';

const ChatInterface = ({ user, workspace, onSignOut }) => {
  return (
    <AppLayout 
      user={user} 
      workspace={workspace} 
      onSignOut={onSignOut} 
    />
  );
};

ChatInterface.propTypes = {
  user: PropTypes.object.isRequired,
  workspace: PropTypes.object.isRequired,
  onSignOut: PropTypes.func.isRequired,
};

export default ChatInterface;
