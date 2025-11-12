import React from 'react';
import PropTypes from 'prop-types';
import { MessageCircle, Calendar, CalendarDays, CalendarRange } from 'lucide-react';

const ViewSwitcher = ({ currentView, onViewChange, className = '', variant = 'default' }) => {
  // Different styling variants
  const variants = {
    default: {
      container: 'flex items-center bg-slate-100 rounded-lg p-1',
      button: (isActive) => 
        `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
          isActive 
            ? 'bg-white text-slate-900 shadow-sm' 
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
        }`,
    },
    header: {
      container: 'flex items-center bg-gray-100 rounded-lg p-1 overflow-hidden',
      button: (isActive) =>
        `flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex-shrink-0 ${
          isActive 
            ? 'bg-white text-slate-900 shadow-sm' 
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
        }`,
    }
  };

  const style = variants[variant] || variants.default;

  const views = [
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageCircle,
      title: 'Chat View'
    },
    {
      id: 'calendar',
      label: 'Month',
      icon: Calendar,
      title: 'Monthly Calendar View - Channel Tasks & Events'
    },
    {
      id: 'week',
      label: 'Week',
      icon: CalendarDays,
      title: 'Weekly Calendar View - Drag & Drop Tasks'
    },
    {
      id: 'timeline',
      label: 'Timeline', 
      icon: CalendarRange,
      title: 'Timeline View - Gantt Chart & Dependencies'
    }
  ];

  return (
    <div className={`${style.container} ${className}`}>
      {views.map(({ id, label, icon: Icon, title }) => (
        <button
          key={id}
          className={style.button(currentView === id)}
          onClick={() => onViewChange(id)}
          title={title}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
};

ViewSwitcher.propTypes = {
  currentView: PropTypes.string.isRequired,
  onViewChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'header']),
};

export default ViewSwitcher;
