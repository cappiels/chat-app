import React from 'react';
import PropTypes from 'prop-types';

/**
 * A responsive three-panel layout component inspired by modern chat applications.
 * This component creates the main structure for the application, including a sidebar
 * for workspaces, a main content area for channels and messages, and handles
 * responsive collapsing for mobile views.
 */
const Layout = ({ children }) => {
  return (
    <div className="app-layout">
      {children}
    </div>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;
