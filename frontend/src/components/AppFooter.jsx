import React from 'react';
import { Home, MessageSquare, Bell, MoreHorizontal, Users, BookOpen } from 'lucide-react';
import PropTypes from 'prop-types';

const AppFooter = ({ activeSection = 'chat', onSectionChange }) => {
  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      active: activeSection === 'home'
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      active: activeSection === 'chat'
    },
    {
      id: 'knowledge',
      label: 'Knowledge',
      icon: BookOpen,
      active: activeSection === 'knowledge'
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: Bell,
      active: activeSection === 'activity'
    },
    {
      id: 'more',
      label: 'More',
      icon: MoreHorizontal,
      active: activeSection === 'more'
    }
  ];

  return (
    <div className="lg:hidden bg-white border-t border-gray-200 px-4 py-2 flex-shrink-0">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange?.(item.id)}
              className="flex flex-col items-center space-y-1 py-2 px-3 min-w-0 flex-1"
            >
              <Icon className={`w-6 h-6 ${item.active ? 'text-purple-600' : 'text-gray-500'}`} />
              <span className={`text-xs font-medium truncate ${item.active ? 'text-purple-600' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

AppFooter.propTypes = {
  activeSection: PropTypes.string,
  onSectionChange: PropTypes.func,
};

export default AppFooter;
