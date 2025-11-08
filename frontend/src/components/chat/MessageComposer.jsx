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
  MicOff
} from 'lucide-react';
import socketManager from '../../utils/socket';
import notificationManager from '../../utils/notifications';

const MessageComposer = ({ channel, onSendMessage, placeholder }) => {
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
  
  const editorRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const recordingIntervalRef = useRef(null);
  const selectionRef = useRef(null);

  // Auto-resize editor and handle focus after expand
  useEffect(() => {
    if (editorRef.current && isExpanded) {
      const maxHeight = 120;
      editorRef.current.style.height = 'auto';
      editorRef.current.style.height = Math.min(editorRef.current.scrollHeight, maxHeight) + 'px';
      
      // If we should focus after expanding, do it now
      if (shouldFocusAfterExpand) {
        editorRef.current.focus();
        setShouldFocusAfterExpand(false);
      }
    }
  }, [message, isExpanded, shouldFocusAfterExpand]);

  // Handle text selection for formatting toolbar
  useEffect(() => {
    const handleSelection = () => {
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
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (message.trim() && !sendingMessage) {
      setSendingMessage(true);
      stopTyping();
      
      try {
        // Play message sent sound
        notificationManager.playMessageSentSound();
        
        await onSendMessage(message.trim());
        
        // Reset after successful send
        setMessage('');
        setIsExpanded(false);
        setIsFocused(false);
        if (editorRef.current) {
          editorRef.current.style.height = 'auto';
          editorRef.current.blur();
        }
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        setSendingMessage(false);
      }
    }
  };

  const handleSendClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (message.trim() && !sendingMessage) {
      handleSubmit(e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key !== 'Enter') {
      startTyping();
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    
    if (e.target.value.trim() && !isTypingRef.current) {
      startTyping();
    } else if (!e.target.value.trim() && isTypingRef.current) {
      stopTyping();
    }
  };

  const handleInputFocus = () => {
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
  };

  const handleInputBlur = (e) => {
    // Don't collapse if user is clicking the send button or other composer controls
    if (e.relatedTarget && e.relatedTarget.closest('.composer-container')) {
      return; // Stay expanded if clicking within composer
    }
    
    // Add a small delay to prevent collapsing when clicking send button on mobile
    setTimeout(() => {
      // Only collapse if clicking completely outside the composer area
      // and we're not in the middle of sending a message
      if (!sendingMessage && !document.activeElement?.closest('.composer-container')) {
        setIsExpanded(false);
        setIsFocused(false);
        stopTyping();
      }
    }, 100);
  };

  const handleContainerClick = () => {
    // When clicking anywhere on the collapsed composer, expand and focus
    if (!isExpanded && !isFocused) {
      setIsExpanded(true);
      setIsFocused(true);
      setShouldFocusAfterExpand(true);
    }
  };

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
        
        const response = await fetch('/api/upload/files', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error('Upload failed');
        }
        
        const result = await response.json();
        console.log('Upload successful:', result.files);
        
        // Add uploaded files to message as attachments
        const attachmentText = result.files.map(file => 
          `📎 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`
        ).join('\n');
        
        setMessage(prev => {
          const newMessage = prev ? `${prev}\n\n${attachmentText}` : attachmentText;
          return newMessage;
        });
        
        // Store attachment metadata for sending with message
        // TODO: We'll need to modify the message sending to include attachments
        window.pendingAttachments = result.files;
        
      } catch (error) {
        console.error('File upload error:', error);
        alert('Failed to upload files. Please try again.');
      }
    };
    input.click();
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

  const handleEmoji = () => {
    // Common emojis for quick access
    const commonEmojis = ['😀', '😊', '😂', '❤️', '👍', '👎', '😢', '😮', '😡', '🎉'];
    const emoji = commonEmojis[Math.floor(Math.random() * commonEmojis.length)];
    
    const inputRef = isExpanded ? editorRef : editorRef;
    if (!inputRef.current) return;
    const cursorPos = inputRef.current.selectionStart;
    const newMessage = message.slice(0, cursorPos) + emoji + message.slice(cursorPos);
    setMessage(newMessage);
    setTimeout(() => {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    }, 0);
  };

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
      <div className="message-input-container">
        <div className="composer-container">
          <div 
            className="message-input-wrapper cursor-text"
            onClick={handleContainerClick}
          >
            <button
              type="button"
              onClick={(e) => {
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
        <form onSubmit={handleSubmit}>
          <div className="message-input-wrapper composer-container">
            {/* Blue accent bar */}
            <div className="h-1 bg-accent-500" />
            
            <div className="p-3">
              {/* Top row with buttons */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleAttachment}
                  className="btn-icon"
                  title="Add attachments"
                >
                  <Plus className="w-5 h-5" />
                </button>
                
                <button
                  type="button"
                  onClick={handleFormatting}
                  className="btn-icon"
                  title="Text formatting"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                
                <button
                  type="button"
                  onClick={handleEmoji}
                  className="btn-icon"
                  title="Add emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
                
                <button
                  type="button"
                  onClick={handleMention}
                  className="btn-icon"
                  title="Mention someone"
                >
                  <AtSign className="w-5 h-5" />
                </button>
                
                <div className="flex-1" />
                
                <button
                  type="button"
                  onClick={handleVoiceMessage}
                  className={`btn-icon mr-2 ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                      : ''
                  }`}
                  title={isRecording ? 'Stop recording' : 'Start voice recording'}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                
                <button
                  type="submit"
                  onClick={handleSendClick}
                  disabled={!message.trim() || sendingMessage}
                  className={`btn-icon ${
                    message.trim() && !sendingMessage
                      ? 'bg-accent-600 hover:bg-accent-700 text-white shadow-md hover:shadow-lg'
                      : 'bg-surface-tertiary text-text-tertiary cursor-not-allowed'
                  }`}
                  title={sendingMessage ? "Sending..." : "Send message"}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

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
                  className="message-input"
                  rows="1"
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

MessageComposer.propTypes = {
  channel: PropTypes.object,
  onSendMessage: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

export default MessageComposer;
