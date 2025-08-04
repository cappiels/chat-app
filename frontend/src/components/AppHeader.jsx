import React from 'react';
import { Search, Settings, Users, Bell } from 'lucide-react';
import PropTypes from 'prop-types';

const AppHeader = ({ workspace, onSignOut, searchPlaceholder = "Search" }) => {
  return (
    <div className="bg-blue-600 px-4 py-3 flex items-center justify-between w-full">
      {/* Left: Empty space for desktop, menu could go here for mobile */}
      <div className="w-8 lg:w-0"></div>

      {/* Center: Global Search Bar - WHITE BACKGROUND */}
      <div className="flex-1 max-w-2xl mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full py-2.5 pl-10 pr-4 bg-white text-gray-900 placeholder-gray-500 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-sm"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2">
        <button className="p-2 hover:bg-blue-500 rounded-full transition-colors">
          <Bell className="w-5 h-5 text-blue-100" />
        </button>
        <button className="p-2 hover:bg-blue-500 rounded-full transition-colors">
          <Users className="w-5 h-5 text-blue-100" />
        </button>
        <button 
          onClick={onSignOut}
          className="p-2 hover:bg-blue-500 rounded-full transition-colors"
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
