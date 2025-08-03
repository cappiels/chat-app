import React from 'react';
import PropTypes from 'prop-types';

/**
 * A sidebar component that displays a list of workspaces as circular icons.
 * It allows users to switch between different workspaces.
 */
const WorkspaceSidebar = ({ workspaces, activeWorkspace, onSelectWorkspace }) => {
  return (
    <div className="workspace-sidebar">
      <div className="workspace-list">
        {workspaces.map((workspace) => (
          <button
            key={workspace.id}
            className={`workspace-icon ${activeWorkspace?.id === workspace.id ? 'active' : ''}`}
            onClick={() => onSelectWorkspace(workspace)}
            title={workspace.name}
          >
            {workspace.name.charAt(0)}
          </button>
        ))}
      </div>
      <div className="workspace-actions">
        <button className="workspace-icon action-icon" title="Add a workspace">+</button>
        <button className="workspace-icon action-icon" title="Explore">🚀</button>
      </div>
    </div>
  );
};

WorkspaceSidebar.propTypes = {
  workspaces: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
  activeWorkspace: PropTypes.shape({
    id: PropTypes.string,
  }),
  onSelectWorkspace: PropTypes.func.isRequired,
};

export default WorkspaceSidebar;
