import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  Plus, 
  Send, 
  Smile, 
  AtSign, 
  Mic,
  Edit3,
  Hash,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link2,
  List,
  ListOrdered,
  Code,
  X,
  MicOff,
  Calendar,
  FileText,
  Table
} from 'lucide-react';
import socketManager from '../../utils/socket';
import notificationManager from '../../utils/notifications';
import QuickTaskDialog from '../tasks/QuickTaskDialog';

const MessageComposer = ({ channel, onSendMessage, placeholder, workspace, workspaceId, currentUser }) => {
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [shouldFocusAfterExpand, setShouldFocusAfterExpand] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiButtonPosition, setEmojiButtonPosition] = useState({ top: 0, left: 0 });
  
  const editorRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const buttonClickedRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const recordingIntervalRef = useRef(null);
  const selectionRef = useRef(null);

  // Auto-resize editor and handle focus after expand - optimized
  useEffect(() => {
    if (editorRef.current && isExpanded) {
      // Use requestAnimationFrame for smoother DOM updates
      requestAnimationFrame(() => {
        if (editorRef.current) {
          const maxHeight = 120;
          editorRef.current.style.height = 'auto';
          editorRef.current.style.height = Math.min(editorRef.current.scrollHeight, maxHeight) + 'px';
          
          // If we should focus after expanding, do it now
          if (shouldFocusAfterExpand) {
            editorRef.current.focus();
            setShouldFocusAfterExpand(false);
          }
        }
      });
    }
  }, [message, isExpanded, shouldFocusAfterExpand]);

  // Handle text selection for formatting toolbar - debounced for performance
  useEffect(() => {
    let selectionTimeout;
    const handleSelection = () => {
      // Debounce to prevent excessive firing
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && selection.toString().length > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (editorRef.current && editorRef.current.contains(selection.anchorNode)) {
            setToolbarPosition({
              top: rect.top - 50,
              left: rect.left + rect.width / 2
            });
            setShowFormatToolbar(true);
            selectionRef.current = { range, selection };
          }
        } else {
          setShowFormatToolbar(false);
        }
      }, 150); // Debounce by 150ms
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      clearTimeout(selectionTimeout);
    };
  }, []);

  // Typing indicator handlers
  const startTyping = useCallback(() => {
    if (!channel?.id || isTypingRef.current) return;
    
    console.log('🔤 Starting typing for channel:', channel.id, channel.name);
    isTypingRef.current = true;
    const success = socketManager.startTyping(channel.id);
    console.log('🔤 startTyping result:', success);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        console.log('🔤 Auto-stopping typing due to timeout');
        isTypingRef.current = false;
        socketManager.stopTyping(channel.id);
      }
    }, 3000);
  }, [channel?.id]);

  const stopTyping = useCallback(() => {
    if (!channel?.id || !isTypingRef.current) return;
    
    console.log('🔤 Stopping typing for channel:', channel.id, channel.name);
    isTypingRef.current = false;
    const success = socketManager.stopTyping(channel.id);
    console.log('🔤 stopTyping result:', success);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [channel?.id]);

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current && channel?.id) {
        socketManager.stopTyping(channel.id);
      }
    };
  }, [channel?.id]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (message.trim() && !sendingMessage) {
      setSendingMessage(true);
      stopTyping();
      
      try {
        // Play message sent sound
        notificationManager.playMessageSentSound();
        
        // Clean message text (remove any attachment prefix that shouldn't be there)
        const cleanMessage = message.replace(/^📎 \d+ files? attached\n\n/, '').trim();
        
        await onSendMessage(cleanMessage);
        
        // Clear pending attachments
        window.pendingAttachments = [];
        
        // Reset message content but keep composer expanded and focused
        setMessage('');
        
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.style.height = 'auto';
            // Immediate focus without setTimeout to prevent iOS keyboard delays
            editorRef.current.focus();
          }
        });
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        setSendingMessage(false);
      }
    }
  }, [message, sendingMessage, stopTyping, onSendMessage]);

  const handleSendClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (message.trim() && !sendingMessage) {
      handleSubmit(e);
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key !== 'Enter') {
      startTyping();
    }
  }, [handleSubmit, startTyping]);

  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;
    setMessage(newValue);
    
    if (newValue.trim() && !isTypingRef.current) {
      startTyping();
    } else if (!newValue.trim() && isTypingRef.current) {
      stopTyping();
    }
  }, [startTyping, stopTyping]);

  const handleInputFocus = useCallback(() => {
    // Cancel any pending blur timeout to prevent conflicts
    buttonClickedRef.current = false;
    
    if (!isExpanded) {
      // When expanding from collapsed state, expand AND focus immediately
      setIsExpanded(true);
      setIsFocused(true);
      setShouldFocusAfterExpand(true); // This will trigger focus in the useEffect
    } else {
      setIsFocused(true);
    }
    if (message.trim()) {
      startTyping();
    }
  }, [isExpanded, message, startTyping]);

  const handleInputBlur = useCallback((e) => {
    // Don't collapse if user is clicking the send button or other composer controls
    if (e.relatedTarget && e.relatedTarget.closest('.composer-container')) {
      return; // Stay expanded if clicking within composer
    }
    
    // Don't collapse if task dialog is open
    if (showTaskDialog) {
      return;
    }
    
    // Don't collapse if a button was just clicked
    if (buttonClickedRef.current) {
      buttonClickedRef.current = false; // Reset flag
      return;
    }
    
    // Immediate collapse for better responsiveness - only delay for iOS Safari edge cases
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const delay = isIOS ? 10 : 0; // Minimal delay only for iOS
    
    if (delay > 0) {
      setTimeout(() => {
        if (!sendingMessage && !showTaskDialog && !buttonClickedRef.current) {
          setIsExpanded(false);
          setIsFocused(false);
          stopTyping();
        }
        buttonClickedRef.current = false;
      }, delay);
    } else {
      // Immediate collapse on non-iOS devices
      if (!sendingMessage && !showTaskDialog && !buttonClickedRef.current) {
        setIsExpanded(false);
        setIsFocused(false);
        stopTyping();
      }
      buttonClickedRef.current = false;
    }
  }, [showTaskDialog, sendingMessage, stopTyping]);

  const handleContainerClick = useCallback(() => {
    // When clicking anywhere on the collapsed composer, expand and focus
    if (!isExpanded && !isFocused) {
      setIsExpanded(true);
      setIsFocused(true);
      setShouldFocusAfterExpand(true);
    }
  }, [isExpanded, isFocused]);

  const handleAttachment = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.heic,.heif';
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      
      console.log('Selected files:', files);
      
      try {
        // Upload files
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });
        
        // Add workspace and channel info
        formData.append('workspaceName', workspace?.name || 'Default Workspace');
        formData.append('channelName', channel?.name || 'Default Channel');
        formData.append('uploaderEmail', currentUser?.email || '');
        
        const response = await fetch('/api/upload/files', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error('Upload failed');
        }
        
        const result = await response.json();
        console.log('✅ Upload successful:', result.files);
        
        // Store attachment metadata for sending with message
        if (!window.pendingAttachments) {
          window.pendingAttachments = [];
        }
        window.pendingAttachments.push(...result.files);
        
        // Don't modify message text - attachments are handled separately
        console.log(`📎 ${window.pendingAttachments.length} file(s) ready to send with message`);
        
      } catch (error) {
        console.error('File upload error:', error);
        // Show more helpful error message
        const errorMsg = error.message || 'Upload failed';
        alert(`Failed to upload files: ${errorMsg}\n\nPlease try again or contact support if the issue persists.`);
      }
    };
    input.click();
  };

  const handleCreateGoogleDoc = async () => {
    const title = prompt('Enter document name:', 'Untitled Document');
    if (!title) return;

    try {
      console.log('📝 Creating Google Doc:', title);
      
      const response = await fetch('/api/upload/create-doc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          workspaceName: workspace?.name || 'Default Workspace',
          channelName: channel?.name || 'Default Channel',
          uploaderEmail: currentUser?.email || ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create Google Doc');
      }

      const result = await response.json();
      console.log('✅ Google Doc created:', result);

      // Add Google Doc link to message
      const docText = `📝 [${result.name}](${result.url}) - Google Doc created`;
      setMessage(prev => {
        const newMessage = prev ? `${prev}\n\n${docText}` : docText;
        return newMessage;
      });

    } catch (error) {
      console.error('Create Doc error:', error);
      alert('Failed to create Google Doc. Please try again.');
    }
  };

  const handleCreateGoogleSheet = async () => {
    const title = prompt('Enter spreadsheet name:', 'Untitled Spreadsheet');
    if (!title) return;

    try {
      console.log('📊 Creating Google Sheet:', title);
      
      const response = await fetch('/api/upload/create-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          workspaceName: workspace?.name || 'Default Workspace',
          channelName: channel?.name || 'Default Channel',
          uploaderEmail: currentUser?.email || ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create Google Sheet');
      }

      const result = await response.json();
      console.log('✅ Google Sheet created:', result);

      // Add Google Sheet link to message
      const sheetText = `📊 [${result.name}](${result.url}) - Google Sheet created`;
      setMessage(prev => {
        const newMessage = prev ? `${prev}\n\n${sheetText}` : sheetText;
        return newMessage;
      });

    } catch (error) {
      console.error('Create Sheet error:', error);
      alert('Failed to create Google Sheet. Please try again.');
    }
  };

  const handleMention = () => {
    const inputRef = isExpanded ? editorRef : editorRef;
    if (!inputRef.current) return;
    const cursorPos = inputRef.current.selectionStart;
    const newMessage = message.slice(0, cursorPos) + '@' + message.slice(cursorPos);
    setMessage(newMessage);
    setTimeout(() => {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(cursorPos + 1, cursorPos + 1);
    }, 0);
  };

  const handleEmojiSelect = (emoji) => {
    const inputRef = isExpanded ? editorRef : editorRef;
    if (!inputRef.current) return;
    
    const cursorPos = inputRef.current.selectionStart;
    const newMessage = message.slice(0, cursorPos) + emoji + message.slice(cursorPos);
    setMessage(newMessage);
    
    // Close emoji picker and refocus input
    setShowEmojiPicker(false);
    setTimeout(() => {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    }, 0);
  };

  const toggleEmojiPicker = () => {
    if (!showEmojiPicker && emojiButtonRef.current) {
      // Get button position to place picker above it
      const rect = emojiButtonRef.current.getBoundingClientRect();
      setEmojiButtonPosition({
        top: rect.top - 200, // Position above button
        left: rect.left - 150 // Center horizontally relative to button
      });
    }
    setShowEmojiPicker(!showEmojiPicker);
  };

  // Business & Project Management focused emojis
  const businessEmojis = [
    // Project Status
    { emoji: '✅', label: 'Done/Complete' },
    { emoji: '⏳', label: 'In Progress' },
    { emoji: '🔄', label: 'Review' },
    { emoji: '❌', label: 'Blocked/Failed' },
    { emoji: '⏸️', label: 'Paused' },
    { emoji: '🚀', label: 'Launch/Deploy' },
    
    // Feedback & Reactions
    { emoji: '👍', label: 'Approve/Good' },
    { emoji: '👎', label: 'Disapprove/Bad' },
    { emoji: '❗', label: 'Important/Urgent' },
    { emoji: '❓', label: 'Question/Unclear' },
    { emoji: '💡', label: 'Idea/Suggestion' },
    { emoji: '⚠️', label: 'Warning/Caution' },
    
    // Priority & Alerts
    { emoji: '🔥', label: 'High Priority/Hot' },
    { emoji: '🎯', label: 'Goal/Target' },
    { emoji: '📊', label: 'Metrics/Data' },
    { emoji: '📈', label: 'Growth/Up' },
    { emoji: '📉', label: 'Decline/Down' },
    { emoji: '⚡', label: 'Fast/Quick' },
    
    // Communication
    { emoji: '💬', label: 'Discussion' },
    { emoji: '📝', label: 'Notes/Documentation' },
    { emoji: '🔍', label: 'Investigation/Search' },
    { emoji: '🎉', label: 'Celebration/Success' },
    { emoji: '🤝', label: 'Agreement/Partnership' },
    { emoji: '👀', label: 'Reviewing/Watching' }
  ];

  const handleFormatting = () => {
    // Toggle between common formatting options
    const formats = [
      { before: '**', after: '**', placeholder: 'bold text' },
      { before: '_', after: '_', placeholder: 'italic text' },
      { before: '`', after: '`', placeholder: 'code' },
      { before: '~', after: '~', placeholder: 'strikethrough' }
    ];
    
    const format = formats[0]; // Default to bold
    
    const inputRef = isExpanded ? editorRef : editorRef;
    if (!inputRef.current) return;
    const start = inputRef.current.selectionStart;
    const end = inputRef.current.selectionEnd;
    const selectedText = message.substring(start, end);
    const textToInsert = selectedText || format.placeholder;
    const newMessage = message.substring(0, start) + format.before + textToInsert + format.after + message.substring(end);
    
    setMessage(newMessage);
    setTimeout(() => {
      inputRef.current.focus();
      const newStart = start + format.before.length;
      const newEnd = newStart + textToInsert.length;
      inputRef.current.setSelectionRange(newStart, newEnd);
    }, 0);
  };

  // Enhanced voice recording functionality
  const startRecording = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const recorder = new MediaRecorder(stream);
          const chunks = [];
          
          recorder.ondataavailable = (e) => chunks.push(e.data);
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            console.log('Voice recording completed:', blob);
            // TODO: Send voice message
            stream.getTracks().forEach(track => track.stop());
          };
          
          recorder.start();
          setMediaRecorder(recorder);
          setIsRecording(true);
          setRecordingTime(0);
          
          recordingIntervalRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
          }, 1000);
        })
        .catch(err => {
          console.error('Error accessing microphone:', err);
          alert('Microphone access denied. Please allow microphone access to send voice messages.');
        });
    } else {
      alert('Voice messaging is not supported in this browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
      setRecordingTime(0);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const handleVoiceMessage = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Rich text formatting functions
  const applyFormatting = (type, value = '') => {
    if (!selectionRef.current) return;
    
    const { range, selection } = selectionRef.current;
    const selectedText = selection.toString();
    
    let formattedText = '';
    switch (type) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `_${selectedText}_`;
        break;
      case 'strikethrough':
        formattedText = `~${selectedText}~`;
        break;
      case 'code':
        formattedText = `\`${selectedText}\``;
        break;
      case 'link':
        const url = prompt('Enter URL:') || '#';
        formattedText = `[${selectedText}](${url})`;
        break;
      default:
        formattedText = selectedText;
    }
    
    range.deleteContents();
    range.insertNode(document.createTextNode(formattedText));
    
    setShowFormatToolbar(false);
    selection.removeAllRanges();
    
    // Update message state
    if (editorRef.current) {
      setMessage(editorRef.current.textContent || '');
    }
  };

  // Debug showTaskDialog state changes
  useEffect(() => {
    console.log('📊 showTaskDialog state changed to:', showTaskDialog);
    if (showTaskDialog) {
      console.log('✅ Dialog should be open now');
    } else {
      console.log('❌ Dialog is closed');
    }
  }, [showTaskDialog]);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Collapsed state (Slack-like minimal input)
  if (!isExpanded && !isFocused) {
    return (
      <>
        <div className="message-input-container">
          <div className="composer-container">
            <div className="message-input-wrapper cursor-text">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔥 CALENDAR BUTTON CLICKED - COLLAPSED STATE - ONE CLICK');
                  setShowTaskDialog(true);
                }}
                className="btn-icon"
                title="Create task/event"
              >
                <Calendar className="w-5 h-5" />
              </button>
              
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAttachment();
                }}
                className="btn-icon"
                title="Add attachments"
              >
                <Plus className="w-5 h-5" />
              </button>
              
              <div className="flex-1 flex items-center" onClick={handleContainerClick}>
                <Hash className="w-4 h-4 text-text-tertiary mr-1" />
                <input
                  ref={editorRef}
                  value={message}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder={placeholder || `Message #${channel?.name || 'general_chat'}`}
                  className="message-input"
                />
              </div>
              
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVoiceMessage();
                }}
                className={`btn-icon ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : ''
                }`}
                title={isRecording ? 'Stop recording' : 'Send voice message'}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Task Dialog - Available in collapsed state */}
        {console.log('🔍 QuickTaskDialog render check (COLLAPSED) - isOpen:', showTaskDialog, 'channel:', channel, 'workspaceId:', workspaceId || workspace?.id)}
        <QuickTaskDialog
          isOpen={showTaskDialog}
          onClose={() => {
            console.log('QuickTaskDialog onClose called');
            setShowTaskDialog(false);
          }}
          channel={channel}
          workspaceId={workspaceId || workspace?.id}
          currentUser={currentUser}
          onTaskCreated={(task) => {
            console.log('Task created:', task);
            setShowTaskDialog(false);
          }}
        />
      </>
    );
  }

  // Expanded state (All buttons visible)
  return (
    <>
      {/* Recording State Overlay */}
      {isRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-lg font-medium">Recording</span>
            </div>
            <div className="text-2xl font-mono">
              {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
            </div>
            <button
              onClick={handleVoiceMessage}
              className="flex items-center justify-center w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
              title="Stop recording"
            >
              <MicOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Business Emoji Picker */}
      {showEmojiPicker && (
        <div 
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50 w-72"
          style={{ 
            top: `${emojiButtonPosition.top}px`, 
            left: `${emojiButtonPosition.left}px`
          }}
        >
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Close emoji picker"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {businessEmojis.map(({ emoji, label }, index) => (
              <button
                key={index}
                onClick={() => handleEmojiSelect(emoji)}
                className="p-2 hover:bg-blue-50 rounded text-lg transition-colors"
                title={label}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating Format Toolbar */}
      {showFormatToolbar && (
        <div 
          className="fixed z-40 bg-gray-800 text-white rounded-lg shadow-lg px-2 py-1 flex items-center gap-1"
          style={{ 
            top: `${toolbarPosition.top}px`, 
            left: `${toolbarPosition.left}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <button
            onClick={() => applyFormatting('bold')}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => applyFormatting('italic')}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => applyFormatting('strikethrough')}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
          <button
            onClick={() => applyFormatting('code')}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Code"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            onClick={() => applyFormatting('link')}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Link"
          >
            <Link2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowFormatToolbar(false)}
            className="p-2 hover:bg-gray-700 rounded transition-colors ml-1"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="message-input-container">
        {/* Button toolbar - separate from form to prevent event conflicts */}
        <div className="message-input-wrapper composer-container">
          {/* Blue accent bar */}
          <div className="h-1 bg-accent-500" />
          
          <div className="p-3">
            {/* Top row with buttons - mobile responsive */}
            <div className="flex items-center gap-1 sm:gap-2 mb-3 overflow-x-auto">
              {/* All buttons visible - fix container width, not button count */}
              <button
                type="button"
                onMouseDown={() => { buttonClickedRef.current = true; }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowTaskDialog(true);
                }}
                className="btn-icon flex-shrink-0"
                title="Create task/event"
              >
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              <button
                type="button"
                onMouseDown={() => { buttonClickedRef.current = true; }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAttachment();
                }}
                className="btn-icon flex-shrink-0"
                title="Upload file to Google Drive"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              <button
                type="button"
                onMouseDown={() => { buttonClickedRef.current = true; }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateGoogleDoc();
                }}
                className="btn-icon flex-shrink-0"
                title="Create Google Doc"
              >
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              <button
                type="button"
                onMouseDown={() => { buttonClickedRef.current = true; }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateGoogleSheet();
                }}
                className="btn-icon flex-shrink-0"
                title="Create Google Sheet"
              >
                <Table className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              <button
                type="button"
                ref={emojiButtonRef}
                onMouseDown={() => { buttonClickedRef.current = true; }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleEmojiPicker();
                }}
                className="btn-icon flex-shrink-0"
                title="Add emoji"
              >
                <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              {/* Secondary buttons - visible on larger mobile screens */}
              <button
                type="button"
                onMouseDown={() => { buttonClickedRef.current = true; }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleFormatting();
                }}
                className="btn-icon flex-shrink-0 hidden sm:inline-flex"
                title="Text formatting"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              
              <button
                type="button"
                onMouseDown={() => { buttonClickedRef.current = true; }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMention();
                }}
                className="btn-icon flex-shrink-0 hidden sm:inline-flex"
                title="Mention someone"
              >
                <AtSign className="w-4 h-4" />
              </button>
              
              <div className="flex-1 min-w-2" />
              
              {/* Voice and Send buttons - always visible */}
              <button
                type="button"
                onMouseDown={() => { buttonClickedRef.current = true; }}
                onClick={handleVoiceMessage}
                className={`btn-icon flex-shrink-0 ${
                  isRecording ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : ''
                }`}
                title={isRecording ? 'Stop recording' : 'Start voice recording'}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              
              <button
                type="button"
                onMouseDown={() => { buttonClickedRef.current = true; }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (message.trim() && !sendingMessage) {
                    handleSubmit(e);
                  }
                }}
                disabled={!message.trim() || sendingMessage}
                className={`btn-icon flex-shrink-0 ${
                  message.trim() && !sendingMessage
                    ? 'bg-accent-600 hover:bg-accent-700 text-white shadow-md hover:shadow-lg'
                    : 'bg-surface-tertiary text-text-tertiary cursor-not-allowed'
                }`}
                title={sendingMessage ? "Sending..." : "Send message"}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Form for message input - separate container */}
        <form onSubmit={handleSubmit}>
          <div className="message-input-wrapper composer-container" style={{ marginTop: '-1px' }}>
            <div className="p-3 pt-0">
              {/* Message input area */}
              <div className="relative">
                <textarea
                  ref={editorRef}
                  value={message}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder={placeholder || `Message #${channel?.name || 'general_chat'}`}
                  className="message-input text-sm md:text-base"
                  rows="1"
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Quick Task Dialog */}
      {console.log('🔍 QuickTaskDialog render check - isOpen:', showTaskDialog, 'channel:', channel, 'workspaceId:', workspaceId || workspace?.id)}
      <QuickTaskDialog
        isOpen={showTaskDialog}
        onClose={() => {
          console.log('QuickTaskDialog onClose called');
          setShowTaskDialog(false);
        }}
        channel={channel}
        workspaceId={workspaceId || workspace?.id}
        currentUser={currentUser}
        onTaskCreated={(task) => {
          console.log('Task created:', task);
          // TODO: Refresh calendar/timeline views
          setShowTaskDialog(false);
        }}
      />
    </>
  );
};

MessageComposer.propTypes = {
  channel: PropTypes.object,
  onSendMessage: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

export default MessageComposer;
