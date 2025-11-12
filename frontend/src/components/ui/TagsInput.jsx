/**
 * TagsInput Component - Adapted from react-staging TagInput.js
 * 
 * Features from your proven implementation:
 * - Automatic HSL-based color generation (deterministic hash)
 * - Compact mode for table cells
 * - Admin color override system  
 * - Elegant hover interactions
 * - Google Calendar sync integration
 */

import React, { useState, useRef, useEffect } from 'react';
import { Palette, Settings } from 'lucide-react';

const TagsInput = ({ 
  value = [], 
  onChange,
  suggestions = [],
  placeholder = "Type to add tags...",
  allowNew = true,
  maxTags = null,
  className = "",
  
  // Color system props (adapted from your react-staging)
  colorMap = {}, // Admin overrides from database
  defaultColors = {
    bg: 'bg-blue-100',
    text: 'text-blue-800'
  },
  
  // Compact mode (from your GV2.js TagsColumn)
  compactMode = false,
  columnWidth = null,
  readOnlyMode = false,
  
  // Channel admin override system (NEW)
  channelId = null,
  workspaceId = null,
  showColorManagement = false,
  onTagColorUpdate = null,
  
  // Callback for individual tag updates
  onTagUpdate = null
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(null); // which tag is being color edited
  
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  
  const showAllOptions = suggestions.length <= 6;

  // Your proven HSL color generation algorithm (from react-staging)
  const getTagColor = (tag) => {
    // First check for admin override
    if (colorMap[tag]) {
      const override = colorMap[tag];
      return {
        backgroundColor: override.hex || override.backgroundColor,
        color: override.textColor || override.color,
        isOverride: true
      };
    }
    
    // Use your proven algorithm from react-staging
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      const char = tag.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Generate a color based on the hash (your proven values)
    const hue = Math.abs(hash) % 360;
    const saturation = 45 + (Math.abs(hash) % 30); // 45-75%
    const lightness = 85 + (Math.abs(hash) % 10); // 85-95%
    
    return {
      backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      color: `hsl(${hue}, ${Math.min(saturation + 40, 100)}%, 25%)`, // Darker text color
      isOverride: false
    };
  };

  // Update filtered suggestions whenever input changes
  useEffect(() => {
    if (showAllOptions && !inputValue) {
      setFilteredSuggestions(suggestions.filter(s => !value.includes(s)));
    } else {
      const filtered = suggestions.filter(suggestion => 
        suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
        !value.includes(suggestion)
      );
      setFilteredSuggestions(filtered);
    }
    setSelectedIndex(0);
  }, [inputValue, suggestions, value, showAllOptions]);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  // Your proven tag adding logic (from react-staging)
  const addTag = (tag) => {
    const trimmedTag = tag.trim();
    if (!trimmedTag || value.includes(trimmedTag)) return;

    // Capitalize first letter (keeping your existing behavior)
    let finalTag = trimmedTag;
    if (finalTag.length > 0) {
      finalTag = finalTag[0].toUpperCase() + finalTag.slice(1);
    }

    // For single-select (maxTags === 1), replace the existing tag
    if (maxTags === 1) {
      onChange([finalTag]);
    }
    // For multi-select, check maxTags limit
    else if (!maxTags || value.length < maxTags) {
      onChange([...value, finalTag]);
    }
    
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const removeTag = (tagToRemove) => {
    console.log('Removing tag:', tagToRemove);
    const newTags = value.filter(tag => tag !== tagToRemove);
    console.log('New tags array:', newTags);
    onChange(newTags);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === 'Enter' && inputValue) {
      e.preventDefault();
      if (filteredSuggestions[selectedIndex]) {
        addTag(filteredSuggestions[selectedIndex]);
      } else if (allowNew) {
        addTag(inputValue);
      }
    } else if (e.key === 'ArrowDown' && isOpen) {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp' && isOpen) {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleEmptySpaceClick = (e) => {
    if (readOnlyMode) return;
    setIsEditingMode(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleTagClick = (e, index) => {
    if (readOnlyMode) return;
    e.stopPropagation();
    setIsEditingMode(true);
  };

  // Admin color override handler
  const handleTagColorEdit = async (tag, newColor) => {
    if (!onTagColorUpdate || !channelId) return;
    
    try {
      await onTagColorUpdate(tag, newColor, channelId, workspaceId);
      setShowColorPicker(null);
    } catch (error) {
      console.error('Failed to update tag color:', error);
    }
  };

  // Your proven compact mode implementation (from react-staging)
  if (compactMode && columnWidth) {
    // Responsive sizing logic from your GV2.js
    const shouldUseSmallestTags = value.length > 5 || columnWidth < 140;
    const shouldUseSmallerTags = value.length > 2 || columnWidth < 180;
    
    let tagFontSize, tagHeight, tagPadding;
    if (shouldUseSmallestTags) {
      tagFontSize = '8px';
      tagHeight = '14px';
      tagPadding = 'px-1 py-0';
    } else if (shouldUseSmallerTags) {
      tagFontSize = '9px';
      tagHeight = '16px';
      tagPadding = 'px-1.5 py-0.5';
    } else {
      tagFontSize = '10px';
      tagHeight = '18px';
      tagPadding = 'px-2 py-0.5';
    }

    useEffect(() => {
      if (!isEditingMode) return;
      
      const handleClickOutside = (event) => {
        if (!event.target.closest('[data-tag-input-id="compact-mode"]')) {
          setIsEditingMode(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditingMode]);

    return (
      <div 
        className={`${className} relative flex items-center`}
        data-tag-input-id="compact-mode"
        style={{
          width: columnWidth, 
          height: '30px',  // Fixed height to match your GV2 ROW_HEIGHT
          overflow: isEditingMode ? 'visible' : 'hidden',
          padding: '2px 4px'
        }}
        onClick={readOnlyMode ? undefined : handleEmptySpaceClick}
        title={readOnlyMode ? value.join(', ') : 'Click on tag to edit, click anywhere to add new tag'}
      >
        <div 
          className="flex flex-wrap gap-0.5 items-center"
          style={{
            width: '100%',
            maxHeight: '26px', 
            overflow: 'hidden',
            lineHeight: 1
          }}
        >
          {value.map((tag, index) => {
            const tagColor = getTagColor(tag);
            
            return (
              <span 
                key={index} 
                className="group inline-flex items-center rounded-full font-medium whitespace-nowrap cursor-pointer transition-all duration-200 ease-in-out relative"
                style={{
                  backgroundColor: tagColor.backgroundColor,
                  color: tagColor.color,
                  fontSize: tagFontSize,
                  height: tagHeight,
                  lineHeight: '1',
                  maxWidth: Math.max(columnWidth - 20, 30),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  paddingLeft: '6px',
                  paddingRight: '6px'
                }}
                onMouseEnter={(e) => {
                  // Expand LEFT padding to make room for X button on the left
                  e.currentTarget.style.paddingLeft = '18px';
                }}
                onMouseLeave={(e) => {
                  // Shrink back to normal
                  e.currentTarget.style.paddingLeft = '6px';
                }}
                onClick={readOnlyMode ? undefined : (e) => handleTagClick(e, index)}
                title={readOnlyMode ? tag : `Click to edit: ${tag}`}
              >
                {!readOnlyMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeTag(tag);
                    }}
                    className="absolute left-1 hover:opacity-70 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                    style={{ fontSize: '10px', width: '12px', height: '12px' }}
                  >
                    ×
                  </button>
                )}
                
                {/* Admin color override button (NEW) */}
                {showColorManagement && !readOnlyMode && tagColor.isOverride && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowColorPicker(tag);
                    }}
                    className="absolute right-1 hover:opacity-70 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                    style={{ fontSize: '8px', width: '10px', height: '10px' }}
                    title="Edit color"
                  >
                    <Palette className="w-2 h-2" />
                  </button>
                )}
                
                <span className="truncate">{tag}</span>
              </span>
            );
          })}

          {/* Show input field when in editing mode */}
          {isEditingMode && !readOnlyMode && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsOpen(true)}
              onBlur={() => {
                setTimeout(() => setIsEditingMode(false), 150);
              }}
              placeholder="Add tag..."
              className="flex-1 outline-none min-w-[60px] bg-transparent text-xs"
              style={{ fontSize: tagFontSize }}
              autoFocus
            />
          )}
        </div>

        {/* Compact mode dropdown */}
        {isEditingMode && isOpen && (inputValue || filteredSuggestions.length > 0) && (
          <div
            className="absolute z-50 left-0 top-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-40 overflow-auto"
            style={{ minWidth: Math.max(columnWidth, 120) }}
          >
            {filteredSuggestions.length > 0 ? (
              <ul className="py-1">
                {filteredSuggestions.map((suggestion, index) => (
                  <li
                    key={suggestion}
                    className={`px-3 py-1 cursor-pointer text-xs ${
                      index === selectedIndex
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addTag(suggestion);
                      setIsEditingMode(false);
                    }}
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            ) : allowNew && inputValue ? (
              <div 
                className="px-3 py-1 text-xs text-gray-700 cursor-pointer hover:bg-gray-100"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  addTag(inputValue);
                  setIsEditingMode(false);
                }}
              >
                Create "{inputValue}"
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  // Your proven full-size mode (from react-staging)
  return (
    <div className={`relative ${className}`}>
      <div className="min-h-[38px] w-full border rounded-md bg-white shadow-sm px-3 py-1 flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        {value.map((tag, index) => {
          const tagColor = getTagColor(tag);
          
          return (
            <div key={index} className="relative group">
              <span
                className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium transition-all duration-200 hover:shadow-sm"
                style={tagColor}
              >
                {tag}
                
                {/* Remove button (your proven approach) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  className="ml-1 hover:opacity-70 focus:outline-none"
                >
                  ×
                </button>
                
                {/* Admin color override button (NEW) */}
                {showColorManagement && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowColorPicker(tag);
                    }}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:opacity-70 focus:outline-none"
                    title="Edit tag color"
                  >
                    <Palette className="w-3 h-3" />
                  </button>
                )}
              </span>
              
              {/* Color picker dropdown (NEW) */}
              {showColorPicker === tag && (
                <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                  <div className="text-xs font-medium text-gray-700 mb-2">
                    Edit color for "{tag}"
                  </div>
                  
                  {/* Color preset options */}
                  <div className="grid grid-cols-6 gap-2 mb-3">
                    {[
                      { name: 'Red', hex: '#EF4444', tailwind: 'bg-red-500 text-white' },
                      { name: 'Orange', hex: '#F97316', tailwind: 'bg-orange-500 text-white' },
                      { name: 'Green', hex: '#22C55E', tailwind: 'bg-green-500 text-white' },
                      { name: 'Blue', hex: '#3B82F6', tailwind: 'bg-blue-500 text-white' },
                      { name: 'Purple', hex: '#A855F7', tailwind: 'bg-purple-500 text-white' },
                      { name: 'Pink', hex: '#EC4899', tailwind: 'bg-pink-500 text-white' }
                    ].map(color => (
                      <button
                        key={color.name}
                        className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ backgroundColor: color.hex }}
                        onClick={() => handleTagColorEdit(tag, color)}
                        title={color.name}
                      />
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Reset to algorithmic color
                        handleTagColorEdit(tag, null);
                      }}
                      className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
                    >
                      Reset to Auto
                    </button>
                    
                    <button
                      onClick={() => setShowColorPicker(null)}
                      className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 outline-none min-w-[120px] bg-transparent"
          disabled={maxTags && value.length >= maxTags}
        />
      </div>

      {/* Quick select buttons for small number of options */}
      {showAllOptions && !isOpen && filteredSuggestions.length > 0 && value.length === 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => addTag(suggestion)}
              className="px-2 py-1 text-xs rounded-full border border-gray-200 hover:border-blue-500 hover:text-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (inputValue || filteredSuggestions.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto"
        >
          {filteredSuggestions.length > 0 ? (
            <ul className="py-1">
              {filteredSuggestions.map((suggestion, index) => (
                <li
                  key={suggestion}
                  className={`px-3 py-2 cursor-pointer text-sm ${
                    index === selectedIndex
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => addTag(suggestion)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={getTagColor(suggestion)}
                    />
                    {suggestion}
                  </div>
                </li>
              ))}
            </ul>
          ) : allowNew && inputValue ? (
            <div 
              className="px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100"
              onClick={() => addTag(inputValue)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={getTagColor(inputValue)}
                />
                Create "{inputValue}"
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Global color picker overlay */}
      {showColorPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-sm">
            <div className="text-lg font-medium text-gray-900 mb-3">
              Edit Color for "{showColorPicker}"
            </div>
            
            <div className="grid grid-cols-8 gap-2 mb-4">
              {/* Extended color palette */}
              {[
                { name: 'Red', hex: '#EF4444' },
                { name: 'Orange', hex: '#F97316' },
                { name: 'Amber', hex: '#F59E0B' },
                { name: 'Yellow', hex: '#EAB308' },
                { name: 'Lime', hex: '#84CC16' },
                { name: 'Green', hex: '#22C55E' },
                { name: 'Emerald', hex: '#10B981' },
                { name: 'Teal', hex: '#14B8A6' },
                { name: 'Cyan', hex: '#06B6D4' },
                { name: 'Sky', hex: '#0EA5E9' },
                { name: 'Blue', hex: '#3B82F6' },
                { name: 'Indigo', hex: '#6366F1' },
                { name: 'Violet', hex: '#8B5CF6' },
                { name: 'Purple', hex: '#A855F7' },
                { name: 'Fuchsia', hex: '#D946EF' },
                { name: 'Pink', hex: '#EC4899' },
                { name: 'Rose', hex: '#F43F5E' },
                { name: 'Slate', hex: '#64748B' },
                { name: 'Gray', hex: '#6B7280' },
                { name: 'Neutral', hex: '#737373' }
              ].map(color => (
                <button
                  key={color.name}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 hover:scale-110"
                  style={{ backgroundColor: color.hex }}
                  onClick={() => handleTagColorEdit(showColorPicker, color)}
                  title={color.name}
                />
              ))}
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  // Reset to algorithmic color
                  handleTagColorEdit(showColorPicker, null);
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
              >
                Reset to Auto
              </button>
              
              <button
                onClick={() => setShowColorPicker(null)}
                className="px-3 py-1 text-sm text-white bg-gray-600 rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagsInput;
