import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { Reply, MoreHorizontal, Smile, Bookmark, Edit, MessageSquare, Download, FileText, Image, Film, Music, File, Play, Pause } from 'lucide-react';
import { messageAPI, threadAPI } from '../../utils/api';
import ImageModal from '../ui/ImageModal';
import BookmarkDialog from './BookmarkDialog';

const Message = ({ message, showAvatar, onThreadClick, currentUser, workspaceId, threadId, onMessageUpdate, workspace, thread }) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imageError, setImageError] = useState({});
  const [imageModal, setImageModal] = useState({ isOpen: false, src: '', alt: '', fileName: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [audioStates, setAudioStates] = useState({});
  const [showBookmarkDialog, setShowBookmarkDialog] = useState(false);

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

  const renderAttachment = (attachment) => {
    const FileIcon = getFileIcon(attachment.type);
    
    // Handle images
    if (attachment.type.startsWith('image/') && !imageError[attachment.id]) {
      return (
        <div key={attachment.id} className="mt-2 max-w-sm">
          <img
            src={attachment.url}
            alt={attachment.name}
            className="rounded-lg shadow-sm max-w-full h-auto cursor-pointer hover:shadow-md transition-shadow"
            style={{ maxHeight: '300px', objectFit: 'cover' }}
            onError={() => handleImageError(attachment.id)}
            onClick={() => openImageModal(attachment.url, attachment.name, attachment.name)}
          />
          <div className="flex items-center justify-between text-xs text-gray-500 mt-1 px-1">
            <span>{attachment.name}</span>
            <span>{formatFileSize(attachment.size)}</span>
          </div>
        </div>
      );
    }

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
  };

  return (
    <div 
      className="flex py-3 px-5 gap-3 relative border-b border-transparent transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/20 hover:to-transparent hover:border-b-slate-200 hover:shadow-[inset_3px_0_0_rgb(37,99,235)] group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className="w-9 flex-shrink-0">
        {showAvatar && (
          <div className="relative inline-flex items-center justify-center w-9 h-9 rounded-md bg-slate-50 border-2 border-slate-200 shadow-sm overflow-hidden">
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

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {showAvatar && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[15px] font-bold text-slate-900">{message.user.name}</span>
            <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
            {message.edited && (
              <span className="text-xs text-slate-400">(edited)</span>
            )}
          </div>
        )}
        {/* Message Content with Markdown */}
        {isEditing ? (
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
            <div className="text-slate-900 leading-relaxed prose prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  // Custom styling for markdown elements
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
                  em: ({ children }) => <em className="italic text-slate-800">{children}</em>,
                  code: ({ children }) => <code className="px-1 py-0.5 bg-gray-100 rounded text-sm font-mono text-red-600">{children}</code>,
                  pre: ({ children }) => <pre className="p-3 bg-gray-100 rounded-lg overflow-x-auto my-2">{children}</pre>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2">{children}</blockquote>,
                  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">{children}</a>,
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
            {message.attachments.map(renderAttachment)}
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

      {/* Message Actions */}
      {showActions && (
        <div className="absolute -top-2 right-4 bg-white border border-slate-300 rounded-lg p-1 shadow-lg backdrop-blur-sm flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <button 
            className="p-1 rounded-md transition-colors hover:bg-blue-100 hover:text-blue-600 hover:scale-110" 
            title="Add reaction"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="w-4 h-4" />
          </button>
          <button 
            className="p-1 rounded-md transition-colors hover:bg-blue-100 hover:text-blue-600 hover:scale-110" 
            title="Reply in thread" 
            onClick={onThreadClick}
          >
            <Reply className="w-4 h-4" />
          </button>
          <button 
            className={`p-1 rounded-md transition-colors hover:bg-blue-100 hover:text-blue-600 hover:scale-110 ${isBookmarked ? 'text-yellow-500' : ''}`}
            title="Save to Knowledge Base"
            onClick={handleBookmarkClick}
          >
            <Bookmark className="w-4 h-4" />
          </button>
          {isCurrentUser && (
            <button 
              className="p-1 rounded-md transition-colors hover:bg-blue-100 hover:text-blue-600 hover:scale-110" 
              title="Edit message"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          <button className="p-1 rounded-md transition-colors hover:bg-blue-100 hover:text-blue-600 hover:scale-110" title="More actions">
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
