import React from 'react';
import { Search, Settings, Users, Bell } from 'lucide-react';
import PropTypes from 'prop-types';

const AppHeader = ({ workspace, onSignOut, searchPlaceholder = "Search" }) => {
  return (
    <div className="bg-blue-600 px-6 py-3 flex items-center w-full shadow-sm">
      {/* Left: ChatFlow Logo/Workspace */}
      <div className="flex items-center space-x-3 min-w-0 w-80">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
          <span className="text-white font-bold text-sm">
            {workspace?.name?.charAt(0)?.toUpperCase() || 'C'}
          </span>
        </div>
        <div className="hidden sm:block min-w-0">
          <h1 className="text-white font-semibold text-lg truncate">crew</h1>
        </div>
      </div>

      {/* Center: Global Search Bar - WHITE BACKGROUND */}
      <div className="flex-1 max-w-xl mx-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full py-2 pl-9 pr-4 bg-white text-gray-900 placeholder-gray-500 rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-1">
        <button className="p-2 hover:bg-blue-500 rounded-lg transition-colors">
          <Bell className="w-5 h-5 text-blue-100" />
        </button>
        <button className="p-2 hover:bg-blue-500 rounded-lg transition-colors">
          <Users className="w-5 h-5 text-blue-100" />
        </button>
        <button 
          onClick={onSignOut}
          className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5 text-blue-100" />
        </button>
      </div>
    </div>
  );
};

AppHeader.propTypes = {
  workspace: PropTypes.object,
  onSignOut: PropTypes.func.isRequired,
  searchPlaceholder: PropTypes.string,
};

export default AppHeader;
