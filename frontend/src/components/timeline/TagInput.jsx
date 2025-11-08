import React, { useState, useRef, useEffect } from 'react';

const TagInput = ({ 
  value = [], 
  onChange, 
  suggestions = [], 
  allowNew = true, 
  compactMode = false,
  columnWidth,
  readOnlyMode = false,
  className = ""
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (inputValue) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
        !value.includes(suggestion)
      );
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions([]);
    }
  }, [inputValue, suggestions, value]);

  const addTag = (tag) => {
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
      setInputValue('');
      setFilteredSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
  };

