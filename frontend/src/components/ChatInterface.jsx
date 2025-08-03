import React, { useState, useEffect } from 'react';
import { workspaceAPI } from '../utils/api';
import Layout from './Layout';
import WorkspaceSidebar from './WorkspaceSidebar';
import ChannelList from './ChannelList';
import MessagePanel from './MessagePanel';

const ChatInterface = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const response = await workspaceAPI.getWorkspaces();
        setWorkspaces(response.data.workspaces);
        if (response.data.workspaces.length > 0) {
          setActiveWorkspace(response.data.workspaces[0]);
        }
      } catch (err) {
        setError('Failed to load workspaces.');
        console.error('Load workspaces error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (activeWorkspace) {
      // In a real app, you would fetch channels for the active workspace
      // For now, we'll use placeholder data.
      const placeholderChannels = [
        { id: '1', name: 'general', type: 'channel' },
        { id: '2', name: 'random', type: 'channel' },
      ];
      setChannels(placeholderChannels);
      setActiveChannel(placeholderChannels[0]);
    }
  }, [activeWorkspace]);

  const handleSendMessage = (content) => {
    const newMessage = {
      id: Date.now().toString(),
      author: 'You',
      content: content,
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
  };

  if (loading) {
    return <div className="flex-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex-center min-h-screen">{error}</div>;
  }

  return (
    <Layout>
      <WorkspaceSidebar
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={setActiveWorkspace}
      />
      <ChannelList
        workspace={activeWorkspace}
        channels={channels}
        onSelectChannel={setActiveChannel}
      />
      <MessagePanel
        channel={activeChannel}
        messages={messages}
        onSendMessage={handleSendMessage}
      />
    </Layout>
  );
};

export default ChatInterface;
