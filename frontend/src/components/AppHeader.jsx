import React from 'react';
import { Search, Settings, Users, Bell } from 'lucide-react';
import PropTypes from 'prop-types';

const AppHeader = ({ workspace, onSignOut, searchPlaceholder = "Search" }) => {
  return (
    <div className="bg-purple-700 px-4 py-2 flex items-center justify-between">
      {/* Left: Workspace info (mobile hidden) */}
      <div className="hidden lg:flex items-center space-x-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
          <span className="text-white font-bold text-sm">
            {workspace?.name?.charAt(0)?.toUpperCase() || 'W'}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="text-white font-semibold text-sm truncate">
            {workspace?.name || 'Workspace'}
          </h2>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-2xl mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300 w-5 h-5" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full py-2 pl-10 pr-4 bg-purple-600 text-white placeholder-purple-300 rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2">
        <button className="p-2 hover:bg-purple-600 rounded-full">
          <Bell className="w-5 h-5 text-purple-200" />
        </button>
        <button className="p-2 hover:bg-purple-600 rounded-full">
          <Users className="w-5 h-5 text-purple-200" />
        </button>
        <button 
          onClick={onSignOut}
          className="p-2 hover:bg-purple-600 rounded-full"
        >
          <Settings className="w-5 h-5 text-purple-200" />
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
