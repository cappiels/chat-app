import React, { useState, createContext, useContext } from 'react';
import { ChevronDown } from 'lucide-react';

const SelectContext = createContext();

const Select = ({ children, value, onValueChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || '');

  const handleValueChange = (newValue) => {
    setSelectedValue(newValue);
    setIsOpen(false);
    if (onValueChange) onValueChange(newValue);
  };

  return (
    <SelectContext.Provider value={{ 
      isOpen, 
      setIsOpen, 
      selectedValue, 
      handleValueChange 
    }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = ({ children, className = '' }) => {
  const { isOpen, setIsOpen, selectedValue } = useContext(SelectContext);
  
  return (
    <button
      type="button"
      className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      onClick={() => setIsOpen(!isOpen)}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
};

const SelectValue = ({ placeholder }) => {
  const { selectedValue } = useContext(SelectContext);
  
  return (
    <span className={selectedValue ? '' : 'text-gray-500'}>
      {selectedValue || placeholder}
    </span>
  );
};

const SelectContent = ({ children }) => {
  const { isOpen, setIsOpen } = useContext(SelectContext);
  
  if (!isOpen) return null;
  
  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={() => setIsOpen(false)}
      />
      <div className="absolute z-50 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-lg">
        <div className="p-1">
          {children}
        </div>
      </div>
    </>
  );
};

const SelectItem = ({ children, value }) => {
  const { handleValueChange, selectedValue } = useContext(SelectContext);
  
  return (
    <button
      type="button"
      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100 ${
        selectedValue === value ? 'bg-gray-100' : ''
      }`}
      onClick={() => handleValueChange(value)}
    >
      {children}
    </button>
  );
};

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
