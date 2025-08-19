import React from 'react';
import PropTypes from 'prop-types';

const NewMessageDivider = ({ messageCount }) => {
  return (
    <div className="flex items-center my-4 px-5 group">
      <div className="flex-1 h-0.5 bg-red-500 shadow-sm"></div>
      <div className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-md animate-pulse">
        {messageCount === 1 ? 'NEW MESSAGE' : `${messageCount} NEW MESSAGES`}
      </div>
      <div className="flex-1 h-0.5 bg-red-500 shadow-sm"></div>
    </div>
  );
};

NewMessageDivider.propTypes = {
  messageCount: PropTypes.number.isRequired,
};

export default NewMessageDivider;
