import React, { useState, useEffect } from 'react';
import { CalendarIcon, XMarkIcon, PlusIcon, TrashIcon, UserIcon, UsersIcon } from '@heroicons/react/24/outline';

const TodoListDialog = ({ 
  isOpen, 
  onClose, 
  channel, 
  workspaceId,
  currentUser,
  onTodoListCreated
}) => {
  const [listTitle, setListTitle] = useState('');
  const [todoItems, setTodoItems] = useState([
    { id: 1, title: '', assignees: [], teams: [], dueDate: '', priority: 'medium' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [teams, setTeams] = useState([]);
  const [workspaceUsers, setWorkspaceUsers] = useState([]);

  // Fetch teams and users when dialog opens
  useEffect(() => {
    if (isOpen && workspaceId) {
      fetchTeamsAndUsers();
    }
  }, [isOpen, workspaceId]);

  const fetchTeamsAndUsers = async () => {
    try {
      // Fetch teams
      const teamsResponse = await fetch(`/api/workspaces/${workspaceId}/teams`, {
        credentials: 'include'
      });
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        setTeams(teamsData.teams || []);
      }

      // Fetch workspace users (assuming there's an endpoint)
      const usersResponse = await fetch(`/api/workspaces/${workspaceId}/members`, {
        credentials: 'include'
      });
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setWorkspaceUsers(usersData.members || []);
      }
    } catch (error) {
      console.error('Error fetching teams and users:', error);
    }
  };

  const addTodoItem = () => {
    const newId = Math.max(...todoItems.map(item => item.id), 0) + 1;
    setTodoItems([...todoItems, {
      id: newId,
      title: '',
      assignees: [],
      teams: [],
      dueDate: '',
      priority: 'medium'
    }]);
  };

  const removeTodoItem = (id) => {
    if (todoItems.length > 1) {
      setTodoItems(todoItems.filter(item => item.id !== id));
    }
  };

  const updateTodoItem = (id, field, value) => {
    setTodoItems(todoItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const toggleAssignee = (itemId, userId) => {
    setTodoItems(todoItems.map(item => {
      if (item.id === itemId) {
        const assignees = item.assignees.includes(userId)
          ? item.assignees.filter(id => id !== userId)
          : [...item.assignees, userId];
        return { ...item, assignees };
      }
      return item;
    }));
  };

  const toggleTeam = (itemId, teamId) => {
    setTodoItems(todoItems.map(item => {
      if (item.id === itemId) {
        const teams = item.teams.includes(teamId)
          ? item.teams.filter(id => id !== teamId)
          : [...item.teams, teamId];
        return { ...item, teams };
      }
      return item;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validItems = todoItems.filter(item => item.title.trim());
    if (!listTitle.trim() || validItems.length === 0) {
      setError('List title and at least one todo item are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create tasks for each todo item
      const createdTasks = [];
      
      for (const item of validItems) {
        const taskData = {
          title: item.title.trim(),
          due_date: item.dueDate || null,
          priority: item.priority,
          status: 'pending',
          assignees: item.assignees,
          assigned_teams: item.teams,
          assignment_mode: 'collaborative',
          requires_individual_response: false,
          is_todo_item: true,
          todo_list_title: listTitle.trim()
        };

        const response = await fetch(`/api/workspaces/${workspaceId}/threads/${channel.id}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(taskData)
        });

        if (!response.ok) {
          throw new Error(`Failed to create task: ${item.title}`);
        }

        const result = await response.json();
        createdTasks.push({ ...result.task, ...item });
      }

      // Reset form
      setListTitle('');
      setTodoItems([{ id: 1, title: '', assignees: [], teams: [], dueDate: '', priority: 'medium' }]);
      
      // Create the embedded todo list for the message
      const todoListData = {
        title: listTitle.trim(),
        items: createdTasks,
        created_at: new Date().toISOString(),
        created_by: currentUser
      };
      
      // Notify parent component
      if (onTodoListCreated) {
        onTodoListCreated(todoListData);
      }
      
      onClose();
    } catch (err) {
      console.error('Error creating todo list:', err);
      setError('Failed to create todo list. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Create Todo List in #{channel.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            {/* List Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Todo List Title *
              </label>
              <input
                type="text"
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="e.g., Project Launch Tasks, Meeting Action Items"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
                required
              />
            </div>

            {/* Todo Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Todo Items
                </label>
                <button
                  type="button"
                  onClick={addTodoItem}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <PlusIcon className="w-3 h-3" />
                  Add Item
                </button>
              </div>

              {todoItems.map((item, index) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateTodoItem(item.id, 'title', e.target.value)}
                        placeholder={`Todo item ${index + 1}...`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {todoItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTodoItem(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Due Date */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={item.dueDate}
                        onChange={(e) => updateTodoItem(item.id, 'dueDate', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Priority
                      </label>
                      <select
                        value={item.priority}
                        onChange={(e) => updateTodoItem(item.id, 'priority', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  {/* Assignees */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Assign To
                    </label>
                    <div className="space-y-2">
                      {/* Individual Users */}
                      {workspaceUsers.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Individuals:</div>
                          <div className="flex flex-wrap gap-1">
                            {workspaceUsers.map(user => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => toggleAssignee(item.id, user.id)}
                                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                                  item.assignees.includes(user.id)
                                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <UserIcon className="w-3 h-3" />
                                {user.display_name || user.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Teams */}
                      {teams.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Teams:</div>
                          <div className="flex flex-wrap gap-1">
                            {teams.map(team => (
                              <button
                                key={team.id}
                                type="button"
                                onClick={() => toggleTeam(item.id, team.id)}
                                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                                  item.teams.includes(team.id)
                                    ? `bg-${team.color}-100 border-${team.color}-300 text-${team.color}-800`
                                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <UsersIcon className="w-3 h-3" />
                                {team.display_name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !listTitle.trim() || todoItems.every(item => !item.title.trim())}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CalendarIcon className="w-4 h-4" />
                  Create Todo List
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TodoListDialog;
