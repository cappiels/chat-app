import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Simple, working dialog component with Safari fixes
const Dialog = ({ children, open, onClose, className = '' }) => {
  const dialogRef = useRef(null);
  const backdropRef = useRef(null);
  
  // Handle escape key and focus management
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onClose?.();
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
      // Let components handle their own focus with autoFocus attribute
      // No automatic focus management to prevent conflicts
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);
  
  if (!open) return null;
  
  const handleBackdropClick = (e) => {
    // Safari fix: Ensure we only close on backdrop click, not child clicks
    if (e.target === backdropRef.current) {
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    }
  };
  
  const handleCloseClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose?.();
  };
  
  const dialogContent = (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        ref={backdropRef}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity z-[100100]" 
        onClick={handleBackdropClick}
        // Safari fix: Prevent touch events from interfering
        onTouchStart={(e) => e.stopPropagation()}
      />
      
      {/* Dialog content */}
      <div 
        ref={dialogRef}
        className={`relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden z-[100200] ${className}`}
        // Safari fix: Prevent backdrop clicks from bubbling through dialog
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleCloseClick}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute top-4 right-4 z-[100300] p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
  
  // Use React Portal to render the dialog at document.body level
  // This escapes any parent container z-index constraints
  return createPortal(dialogContent, document.body);
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
