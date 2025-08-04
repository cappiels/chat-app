import React from 'react';
import PropTypes from 'prop-types';
import { Home, MessageSquare, Hash, Bell, Users } from 'lucide-react';

const MobileNav = ({ activeSection, onSectionChange }) => {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'dms', icon: MessageSquare, label: 'DMs' },
    { id: 'mentions', icon: Bell, label: 'Activity' },
    { id: 'you', icon: Users, label: 'You' },
  ];

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={`mobile-nav-item ${activeSection === item.id ? 'active' : ''}`}
          >
            <Icon className="w-6 h-6" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

MobileNav.propTypes = {
  activeSection: PropTypes.string,
  onSectionChange: PropTypes.func.isRequired,
};

export default MobileNav;
