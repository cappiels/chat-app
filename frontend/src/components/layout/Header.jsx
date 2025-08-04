import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Menu, Search, X, Bell, HelpCircle, User } from 'lucide-react';

const Header = ({ workspace, user, onMenuClick, onSignOut }) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="app-header">
      <div className="flex items-center gap-3 flex-1">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="btn-icon btn-ghost text-white md:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Workspace name on mobile */}
        <div className="md:hidden">
          <h1 className="text-white font-semibold text-lg truncate">
            {workspace?.name || 'ChatFlow'}
          </h1>
        </div>

        {/* Search bar */}
        <div className="search-container hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={`Search ${workspace?.name || 'ChatFlow'}`}
              className="search-input"
            />
            {searchQuery && searchFocused && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-tertiary" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Mobile search button */}
        <button className="btn-icon btn-ghost text-white md:hidden">
          <Search className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <button className="btn-icon btn-ghost text-white relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-maroon rounded-full" />
        </button>

        {/* Help */}
        <button className="btn-icon btn-ghost text-white hidden md:flex">
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* User menu */}
        <div className="relative group">
          <button className="flex items-center gap-2 p-1 rounded hover:bg-white/10 transition">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-8 h-8 rounded"
              />
            ) : (
              <div className="w-8 h-8 bg-maroon rounded flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {user?.displayName?.charAt(0) || 'U'}
                </span>
              </div>
            )}
          </button>
          
          {/* Dropdown menu */}
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            <div className="p-3 border-b border-border">
              <p className="font-semibold text-primary truncate">{user?.displayName}</p>
              <p className="text-xs text-tertiary truncate">{user?.email}</p>
            </div>
            <div className="py-1">
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-surface transition">
                Profile
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-surface transition">
                Preferences
              </button>
              <hr className="my-1 border-border" />
              <button
                onClick={onSignOut}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface transition text-maroon"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

Header.propTypes = {
  workspace: PropTypes.object,
  user: PropTypes.object,
  onMenuClick: PropTypes.func.isRequired,
  onSignOut: PropTypes.func.isRequired,
};

export default Header;
