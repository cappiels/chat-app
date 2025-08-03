import React, { useState, createContext, useContext } from 'react';

const DropdownMenuContext = createContext();

const DropdownMenu = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

const DropdownMenuTrigger = ({ children, asChild }) => {
  const { isOpen, setIsOpen } = useContext(DropdownMenuContext);
  
  if (asChild) {
    return React.cloneElement(children, {
      onClick: () => setIsOpen(!isOpen),
      'aria-haspopup': 'true',
      'aria-expanded': isOpen
    });
  }
  
  return (
    <button onClick={() => setIsOpen(!isOpen)} aria-haspopup="true" aria-expanded={isOpen}>
      {children}
    </button>
  );
};

const DropdownMenuContent = ({ children, align = 'start', className = '' }) => {
  const { isOpen, setIsOpen } = useContext(DropdownMenuContext);
  
  if (!isOpen) return null;
  
  const alignmentClass = align === 'end' ? 'right-0' : 'left-0';
  
  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={() => setIsOpen(false)}
      />
      <div className={`absolute ${alignmentClass} z-50 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none ${className}`}>
        <div className="py-1">
          {children}
        </div>
      </div>
    </>
  );
};

const DropdownMenuItem = ({ children, onClick, className = '' }) => {
  const { setIsOpen } = useContext(DropdownMenuContext);
  
  const handleClick = () => {
    if (onClick) onClick();
    setIsOpen(false);
  };
  
  return (
    <button
      className={`flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${className}`}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};

const DropdownMenuSeparator = ({ className = '' }) => (
  <div className={`my-1 h-px bg-gray-200 ${className}`} />
);

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
};
