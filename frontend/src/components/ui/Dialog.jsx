import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// Simple, working dialog component
const Dialog = ({ children, open, onClose, className = '' }) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onClose?.();
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);
  
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Dialog content */}
      <div className={`relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden ${className}`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Close dialog"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
        
        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[90vh]">
          {children}
        </div>
      </div>
    </div>
  );
};

// Compatibility components for existing usage
const DialogContent = ({ children, className = '' }) => (
  <div className={className}>
    {children}
  </div>
);

const DialogHeader = ({ children, className = '' }) => (
  <div className={`mb-6 ${className}`}>
    {children}
  </div>
);

const DialogTitle = ({ children, className = '' }) => (
  <h2 className={`text-xl font-semibold text-gray-900 dark:text-white ${className}`}>
    {children}
  </h2>
);

const DialogDescription = ({ children, className = '' }) => (
  <p className={`text-sm text-gray-600 dark:text-gray-400 mt-2 ${className}`}>
    {children}
  </p>
);

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
