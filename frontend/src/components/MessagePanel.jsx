import React from 'react';
import PropTypes from 'prop-types';

/**
 * A component that displays the messages for a selected channel
 * and includes a message input form.
 */
const MessagePanel = ({ channel, messages, onSendMessage }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    const content = e.target.elements.message.value;
    if (content) {
      onSendMessage(content);
      e.target.reset();
    }
  };

  return (
    <div className="message-panel">
      <div className="message-panel-header">
        <h2 className="channel-name"># {channel?.name || 'Select a channel'}</h2>
      </div>
      <div className="message-list">
        {messages.map(msg => (
          <div key={msg.id} className="message">
            <div className="message-author">{msg.author}</div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
      </div>
      <div className="message-input-container">
        <form onSubmit={handleSubmit} className="message-form">
          <input
            type="text"
            name="message"
            className="message-input"
            placeholder={`Message #${channel?.name || ''}`}
            disabled={!channel}
          />
          <button type="submit" className="send-button" disabled={!channel}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

MessagePanel.propTypes = {
  channel: PropTypes.shape({
    name: PropTypes.string,
  }),
  messages: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    author: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
  })).isRequired,
  onSendMessage: PropTypes.func.isRequired,
};

export default MessagePanel;
