import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Simple, working dialog component with Safari fixes
const Dialog = ({ children, open, onClose, className = '' }) => {
  const dialogRef = useRef(null);
  const backdropRef = useRef(null);
  
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        // Safari fix: Use requestAnimationFrame for proper timing
        requestAnimationFrame(() => {
          onClose?.();
        });
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
      // Safari fix: Focus trap to prevent focus issues
      if (dialogRef.current) {
        // Wait for dialog to render before focusing
        requestAnimationFrame(() => {
          const firstFocusable = dialogRef.current?.querySelector('input, button, textarea, select, [tabindex]:not([tabindex="-1"])');
          if (firstFocusable) {
            firstFocusable.focus();
          }
        });
      }
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
      // Safari fix: Use requestAnimationFrame for proper timing
      requestAnimationFrame(() => {
        onClose?.();
      });
    }
  };
  
  const handleCloseClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Safari fix: Use requestAnimationFrame for proper timing
    requestAnimationFrame(() => {
      onClose?.();
    });
  };
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        ref={backdropRef}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={handleBackdropClick}
        // Safari fix: Prevent touch events from interfering
        onTouchStart={(e) => e.stopPropagation()}
      />
      
      {/* Dialog content */}
      <div 
        ref={dialogRef}
        className={`relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden z-[101] ${className}`}
        // Safari fix: Prevent backdrop clicks from bubbling through dialog
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleCloseClick}
          onTouchStart={(e) => e.stopPropagation()}
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
