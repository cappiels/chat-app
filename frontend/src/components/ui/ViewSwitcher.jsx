import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { MessageCircle, Calendar, CalendarDays, CalendarRange, BookOpen, ChevronDown } from 'lucide-react';

const ViewSwitcher = ({ currentView, onViewChange, className = '', variant = 'default' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const views = [
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageCircle,
      title: 'Chat View'
    },
    {
      id: 'calendar',
      label: 'Monthly',
      icon: Calendar,
      title: 'Monthly Calendar View - Channel Tasks & Events'
    },
    {
      id: 'week',
      label: 'Weekly',
      icon: CalendarDays,
      title: 'Weekly Calendar View - Drag & Drop Tasks'
    },
    {
      id: 'timeline',
      label: 'Timeline', 
      icon: CalendarRange,
      title: 'Timeline View - Gantt Chart & Dependencies'
    },
    {
      id: 'guide',
      label: 'Guide',
      icon: BookOpen,
      title: 'Knowledge Base - Guides & Documentation'
    }
  ];

  const currentViewData = views.find(v => v.id === currentView);
  const CurrentIcon = currentViewData?.icon || MessageCircle;

  const handleViewSelect = (viewId) => {
    if (viewId === 'guide') {
      // TODO: Open knowledge base modal or navigate to guide section
      console.log('Guide/Knowledge Base clicked - to be implemented');
    } else {
      onViewChange(viewId);
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Trigger Button - 20% bigger on mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-2 md:px-3 md:py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-all duration-200 text-slate-700"
        title={currentViewData?.title || 'Switch View'}
      >
        <CurrentIcon className="w-5 h-5 md:w-4 md:h-4" />
        <span className="hidden md:inline">{currentViewData?.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
            {views.map(({ id, label, icon: Icon, title }) => {
              const isActive = currentView === id;
              return (
                <button
                  key={id}
                  onClick={() => handleViewSelect(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-150 ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-slate-700 hover:bg-gray-50'
                  }`}
                  title={title}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {isActive && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

ViewSwitcher.propTypes = {
  currentView: PropTypes.string.isRequired,
  onViewChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  variant: PropTypes.string,
};

export default ViewSwitcher;
