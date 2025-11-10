import React from 'react';
import PropTypes from 'prop-types';
import { MessageCircle, Calendar, CalendarRange } from 'lucide-react';

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
      container: 'flex items-center bg-white/20 rounded-lg p-1 min-w-max',
      button: (isActive) =>
        `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
          isActive 
            ? 'bg-white text-slate-900 shadow-sm' 
            : 'text-white/90 bg-white/10 hover:text-white hover:bg-white/30'
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
      label: 'Calendar',
      icon: Calendar,
      title: 'Calendar View - Channel Tasks & Events'
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
