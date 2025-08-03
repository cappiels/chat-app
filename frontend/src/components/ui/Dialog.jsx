import React, { useState, createContext, useContext } from 'react';

const DialogContext = createContext();

const Dialog = ({ children, open, onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(open || false);
  
  const handleOpenChange = (newOpen) => {
    setIsOpen(newOpen);
    if (onOpenChange) onOpenChange(newOpen);
  };

  return (
    <DialogContext.Provider value={{ isOpen, setIsOpen: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

const DialogContent = ({ children, className = '' }) => {
  const { isOpen, setIsOpen } = useContext(DialogContext);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black bg-opacity-50" 
        onClick={() => setIsOpen(false)}
      />
      <div className={`relative bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4 ${className}`}>
        {children}
      </div>
    </div>
  );
};

const DialogHeader = ({ children, className = '' }) => (
  <div className={`mb-4 ${className}`}>
    {children}
  </div>
);

const DialogTitle = ({ children, className = '' }) => (
  <h2 className={`text-lg font-semibold ${className}`}>
    {children}
  </h2>
);

const DialogDescription = ({ children, className = '' }) => (
  <p className={`text-sm text-gray-600 mt-2 ${className}`}>
    {children}
  </p>
);

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
