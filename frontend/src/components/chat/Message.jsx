import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { Reply, MoreHorizontal, Smile, Bookmark, Edit, MessageSquare, Download, FileText, Image, Film, Music, File, Play, Pause, Trash2, CheckCircle, Circle, Calendar, Users, Flag, ExternalLink } from 'lucide-react';
import { messageAPI, threadAPI } from '../../utils/api';
import ImageModal from '../ui/ImageModal';
import BookmarkDialog from './BookmarkDialog';

const Message = ({ message, showAvatar, onThreadClick, currentUser, workspaceId, threadId, onMessageUpdate, workspace, thread, userRole }) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imageError, setImageError] = useState({});
  const [imageModal, setImageModal] = useState({ isOpen: false, src: '', alt: '', fileName: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [audioStates, setAudioStates] = useState({});
  const [showBookmarkDialog, setShowBookmarkDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return Image;
    if (fileType.startsWith('video/')) return Film;
    if (fileType.startsWith('audio/')) return Music;
    if (fileType.includes('pdf') || fileType.includes('document')) return FileText;
    return File;
  };

  const isCurrentUser = message.user.name === currentUser?.displayName;
  const isAdmin = userRole === 'admin';
  const canDelete = isCurrentUser || isAdmin;

  // Common emojis for quick reactions
  const quickEmojis = ['👍', '❤️', '😂', '🎉', '👀', '🔥'];

  const handleAddReaction = async (emoji) => {
    try {
      await messageAPI.addReaction(workspaceId, threadId, message.id, emoji);
      setShowEmojiPicker(false);
      if (onMessageUpdate) {
        onMessageUpdate(message.id, 'reaction_added', emoji);
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleRemoveReaction = async (emoji) => {
    try {
      await messageAPI.removeReaction(workspaceId, threadId, message.id, emoji);
      if (onMessageUpdate) {
        onMessageUpdate(message.id, 'reaction_removed', emoji);
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  const handleEditMessage = async () => {
    if (editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }

    try {
      await messageAPI.updateMessage(workspaceId, threadId, message.id, {
        content: editContent.trim(),
        edit_reason: 'User edit'
      });
      setIsEditing(false);
      if (onMessageUpdate) {
        onMessageUpdate(message.id, 'edited', editContent.trim());
      }
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const handleDeleteMessage = async () => {
    if (!canDelete) return;
    
    setIsDeleting(true);
    try {
      await messageAPI.deleteMessage(workspaceId, threadId, message.id);
      setShowDeleteConfirm(false);
      if (onMessageUpdate) {
        onMessageUpdate(message.id, 'deleted');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBookmarkClick = () => {
    setShowBookmarkDialog(true);
  };

  const openImageModal = (src, alt, fileName) => {
    setImageModal({ isOpen: true, src, alt, fileName });
  };

  const closeImageModal = () => {
    setImageModal({ isOpen: false, src: '', alt: '', fileName: '' });
  };

  // YouTube URL detection and embed
  const getYouTubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const renderYouTubeEmbed = (url) => {
    const videoId = getYouTubeId(url);
    if (!videoId) return null;

    return (
      <div className="mt-2 max-w-md">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute top-0 left-0 w-full h-full rounded-lg"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  };

  const handleImageError = (attachmentId) => {
    setImageError(prev => ({ ...prev, [attachmentId]: true }));
  };

  // Check if this is a task message
  const isTaskMessage = message.message_type === 'task' && message.metadata?.task_id;
  const taskData = message.task_data || message.metadata || {};

  // Render task message card
  const renderTaskCard = () => {
    const taskTitle = taskData.title || message.content?.replace('Task: ', '') || 'Untitled Task';
    const status = taskData.status || 'pending';
    const priority = taskData.priority || 'medium';
    const dueDate = taskData.due_date || taskData.end_date;
    const assigneeNames = taskData.assignee_names || taskData.assigned_to_name;
    const isCompleted = status === 'completed';

    const getPriorityColor = (p) => {
      switch (p) {
        case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
        case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
        case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        case 'low': return 'text-green-600 bg-green-50 border-green-200';
        default: return 'text-gray-600 bg-gray-50 border-gray-200';
      }
    };

    const getStatusColor = (s) => {
      switch (s) {
        case 'completed': return 'text-green-600 bg-green-50 border-green-200';
        case 'in_progress': return 'text-blue-600 bg-blue-50 border-blue-200';
        case 'blocked': return 'text-red-600 bg-red-50 border-red-200';
        default: return 'text-gray-600 bg-gray-50 border-gray-200';
      }
    };

    const formatTaskDate = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-4 max-w-md shadow-sm hover:shadow-md transition-shadow">
        {/* Task Type Indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
            <CheckCircle className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Task</span>
        </div>

        {/* Task Header */}
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            isCompleted ? 'bg-green-500 border-green-500' : 'border-blue-400'
          }`}>
            {isCompleted && <CheckCircle className="w-4 h-4 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold text-gray-900 ${isCompleted ? 'line-through text-gray-400' : ''}`}>
              {taskTitle}
            </h4>
          </div>
        </div>

        {/* Task Metadata */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Status Badge */}
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${getStatusColor(status)}`}>
            {status.replace('_', ' ')}
          </span>

          {/* Priority Badge */}
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${getPriorityColor(priority)}`}>
            <Flag className="w-3 h-3 inline mr-1" />
            {priority}
          </span>

          {/* Due Date */}
          {dueDate && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-600 bg-gray-100 rounded-full">
              <Calendar className="w-3 h-3" />
              {formatTaskDate(dueDate)}
            </span>
          )}
        </div>

        {/* Assignees */}
        {assigneeNames && (
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-600">
            <Users className="w-3 h-3" />
            <span>{assigneeNames}</span>
          </div>
        )}

        {/* View Task Link */}
        <div className="mt-3 pt-3 border-t border-blue-200">
          <button
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to task detail - dispatch custom event
              const event = new CustomEvent('openTaskDetail', {
                detail: { taskId: taskData.task_id || message.metadata?.task_id }
              });
              window.dispatchEvent(event);
            }}
          >
            <ExternalLink className="w-4 h-4" />
            View full task
          </button>
        </div>
      </div>
    );
  };

  const renderAttachment = (attachment) => {
    const FileIcon = getFileIcon(attachment.type);
    
    // Handle images - now returns metadata for grid rendering
    if (attachment.type.startsWith('image/') && !imageError[attachment.id]) {
      // Generate direct URL for Google Drive images if not already present
      let imageUrl = attachment.url;
      
      // If URL is a Google Drive view link, convert to direct link
      if (imageUrl && imageUrl.includes('drive.google.com') && imageUrl.includes('/file/d/')) {
        const fileIdMatch = imageUrl.match(/\/file\/d\/([^/]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          imageUrl = `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`;
        }
      }
      
      return {
        type: 'image',
        id: attachment.id,
        url: imageUrl,
        name: attachment.name,
        size: attachment.size
      };
    }

    // Return null for non-image attachments (they'll be handled separately in the render)
    return null;
  };

  return (
    <div 
      className={`message ${isCurrentUser ? 'message-current-user' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar - Show on left for others, right for current user */}
      {!isCurrentUser && (
        <div className="flex-shrink-0">
          {showAvatar && (
            <div className="message-avatar">
              {message.user.avatar ? (
                <img
                  src={message.user.avatar}
                  alt={message.user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-slate-700">
                  {message.user.initials}
                </span>
              )}
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                message.user.status === 'online' ? 'bg-green-500' : 
                message.user.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
              }`} />
            </div>
          )}
        </div>
      )}

      {/* Message Content */}
      <div className="message-content">
        {showAvatar && (
          <div className="message-header">
            <span className="message-author">{message.user.name}</span>
            {/* Task/Event indicator badge next to author name */}
            {isTaskMessage && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded ml-2">
                <CheckCircle className="w-3 h-3" />
                Task
              </span>
            )}
            <span className="message-time">{formatTime(message.timestamp)}</span>
            {message.edited && (
              <span className="text-xs text-text-tertiary">(edited)</span>
            )}
          </div>
        )}
        {/* Message Content - Task Card or Regular Message */}
        {isTaskMessage ? (
          // Render task card for task messages
          renderTaskCard()
        ) : isEditing ? (
          <div className="mt-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleEditMessage}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="message-text">
              <ReactMarkdown
                components={{
                  // Custom styling for markdown elements
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-bold text-text-primary">{children}</strong>,
                  em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
                  code: ({ children }) => <code className="px-1 py-0.5 bg-surface-tertiary rounded text-sm font-mono text-red-600">{children}</code>,
                  pre: ({ children }) => <pre className="p-3 bg-surface-tertiary rounded-lg overflow-x-auto my-2">{children}</pre>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-border-primary pl-4 italic text-text-secondary my-2">{children}</blockquote>,
                  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:text-accent-700 underline">{children}</a>,
                  ul: ({ children }) => <ul className="list-disc ml-4 my-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal ml-4 my-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                }}
              >
                {message.content || ''}
              </ReactMarkdown>
            </div>

            {/* YouTube Link Detection and Embed */}
            {message.content && getYouTubeId(message.content) && renderYouTubeEmbed(message.content)}
          </>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2">
            {(() => {
              // Separate images from other attachments
              const imageAttachments = message.attachments.filter(a => a.type.startsWith('image/') && !imageError[a.id]);
              const otherAttachments = message.attachments.filter(a => !a.type.startsWith('image/') || imageError[a.id]);

              return (
                <>
                  {/* Image Grid */}
                  {imageAttachments.length > 0 && (
                    <div className={`grid gap-2 ${imageAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} max-w-md`}>
                      {imageAttachments.map((attachment) => {
                        // Generate direct URL for Google Drive images
                        let imageUrl = attachment.url;
                        if (imageUrl && imageUrl.includes('drive.google.com') && imageUrl.includes('/file/d/')) {
                          const fileIdMatch = imageUrl.match(/\/file\/d\/([^/]+)/);
                          if (fileIdMatch && fileIdMatch[1]) {
                            imageUrl = `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`;
                          }
                        }

                        return (
                          <div key={attachment.id} className="relative group">
                            <img
                              src={imageUrl}
                              alt={attachment.name}
                              className="rounded-lg shadow-sm w-full h-auto cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
                              style={{ maxHeight: imageAttachments.length === 1 ? '300px' : '200px', objectFit: 'cover' }}
                              onError={() => handleImageError(attachment.id)}
                              onClick={() => openImageModal(imageUrl, attachment.name, attachment.name)}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="text-xs text-white truncate">{attachment.name}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Other Attachments */}
                  {otherAttachments.map(attachment => {
                    const FileIcon = getFileIcon(attachment.type);
                    
                    // Handle videos
                    if (attachment.type.startsWith('video/')) {
                      return (
                        <div key={attachment.id} className="mt-2 max-w-md">
                          <video
                            controls
                            className="rounded-lg shadow-sm max-w-full h-auto"
                            preload="metadata"
                          >
                            <source src={attachment.url} type={attachment.type} />
                            Your browser does not support the video tag.
                          </video>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-1 px-1">
                            <span>{attachment.name}</span>
                            <span>{formatFileSize(attachment.size)}</span>
                          </div>
                        </div>
                      );
                    }

                    // Handle audio
                    if (attachment.type.startsWith('audio/')) {
                      return (
                        <div key={attachment.id} className="mt-2 max-w-md bg-gray-50 rounded-lg p-3">
                          <audio controls className="w-full">
                            <source src={attachment.url} type={attachment.type} />
                            Your browser does not support the audio element.
                          </audio>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                            <span className="flex items-center gap-1">
                              <Music className="w-3 h-3" />
                              {attachment.name}
                            </span>
                            <span>{formatFileSize(attachment.size)}</span>
                          </div>
                        </div>
                      );
                    }

                    // Handle other files
                    return (
                      <div key={attachment.id} className="mt-2">
                        <a
                          href={attachment.url}
                          download={attachment.name}
                          className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group max-w-md"
                        >
                          <div className="p-2 bg-white rounded-lg border">
                            <FileIcon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{attachment.name}</div>
                            <div className="text-sm text-gray-500">{formatFileSize(attachment.size)}</div>
                          </div>
                          <Download className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                        </a>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.reactions.map((reaction, index) => (
              <button
                key={index}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full border transition-all duration-200 cursor-pointer hover:scale-110 hover:shadow-md ${
                  reaction.users.includes(currentUser?.displayName) 
                    ? 'bg-purple-100 border-purple-500 text-purple-700' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                }`}
                title={reaction.users.join(', ')}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
            <button 
              className="inline-flex items-center justify-center w-8 h-6 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 hover:scale-110 transition-all duration-200"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Thread indicator */}
        {message.thread_count > 0 && (
          <button
            onClick={onThreadClick}
            className="flex items-center gap-2 mt-3 p-3 text-sm rounded-lg bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-blue-600 hover:text-blue-700"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="font-medium">{message.thread_count} replies</span>
            {message.thread_participants && (
              <span className="text-slate-500">
                {message.thread_participants.slice(0, 2).join(', ')}
                {message.thread_participants.length > 2 && ' and others'}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Avatar for current user - on the right */}
      {isCurrentUser && (
        <div className="flex-shrink-0">
          {showAvatar && (
            <div className="message-avatar">
              {message.user.avatar ? (
                <img
                  src={message.user.avatar}
                  alt={message.user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-slate-700">
                  {message.user.initials}
                </span>
              )}
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                message.user.status === 'online' ? 'bg-green-500' : 
                message.user.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
              }`} />
            </div>
          )}
        </div>
      )}

      {/* Message Actions */}
      {showActions && (
        <div className="message-actions">
          <button 
            className="btn-icon" 
            title="Add reaction"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="w-4 h-4" />
          </button>
          <button 
            className="btn-icon" 
            title="Reply in thread" 
            onClick={onThreadClick}
          >
            <Reply className="w-4 h-4" />
          </button>
          <button 
            className={`btn-icon ${isBookmarked ? 'text-yellow-500' : ''}`}
            title="Save to Knowledge Base"
            onClick={handleBookmarkClick}
          >
            <Bookmark className="w-4 h-4" />
          </button>
          {isCurrentUser && (
            <button 
              className="btn-icon" 
              title="Edit message"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {canDelete && (
            <button 
              className="btn-icon text-red-600 hover:bg-red-50" 
              title={isAdmin && !isCurrentUser ? "Delete message (admin)" : "Delete message"}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button className="btn-icon" title="More actions">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute left-12 top-full mt-1 bg-white rounded-lg border border-slate-300 shadow-lg p-3 z-20 animate-in fade-in zoom-in-95 duration-200">
          <div className="grid grid-cols-6 gap-1">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleAddReaction(emoji)}
                className="p-2 hover:bg-slate-100 rounded-lg text-lg transition-colors hover:scale-110 duration-200"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image Modal */}
      <ImageModal
        isOpen={imageModal.isOpen}
        onClose={closeImageModal}
        src={imageModal.src}
        alt={imageModal.alt}
        fileName={imageModal.fileName}
      />
      
      {/* Bookmark Dialog */}
      <BookmarkDialog
        isOpen={showBookmarkDialog}
        onClose={() => setShowBookmarkDialog(false)}
        message={message}
        thread={thread}
        workspace={workspace}
        currentUser={currentUser}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Message</h3>
            <p className="text-gray-600 mb-4">
              {isAdmin && !isCurrentUser 
                ? "You are about to delete another user's message as an admin. This action cannot be undone."
                : "Are you sure you want to delete this message? This action cannot be undone."
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMessage}
                disabled={isDeleting}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

Message.propTypes = {
  message: PropTypes.object.isRequired,
  showAvatar: PropTypes.bool,
  onThreadClick: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
};

export default Message;
