import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  BookOpen, 
  Tag, 
  Folder, 
  Users, 
  Globe, 
  Lock, 
  Sparkles, 
  Plus,
  Search,
  Check,
  AlertCircle,
  Brain,
  Star,
  FolderPlus,
  BookmarkPlus,
  Settings
} from 'lucide-react';
import { knowledgeAPI, messageAPI } from '../../utils/api';

const BookmarkDialog = ({ 
  isOpen, 
  onClose, 
  message, 
  thread, 
  workspace, 
  currentUser 
}) => {
  const [step, setStep] = useState(1); // 1: Choose locations, 2: Select categories/tags, 3: Confirm
  const [selectedLocations, setSelectedLocations] = useState([]); // Multiple locations
  const [saveToMyBookmarks, setSaveToMyBookmarks] = useState(true); // Default to personal bookmarks
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customSummary, setCustomSummary] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [availableScopes, setAvailableScopes] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [userPermissions, setUserPermissions] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [myBookmarksFolder, setMyBookmarksFolder] = useState(null);
  const [apiErrors, setApiErrors] = useState({});

  useEffect(() => {
    if (isOpen && message) {
      loadBookmarkData();
      generateAISuggestions();
      loadMyBookmarksFolder();
    }
  }, [isOpen, message]);

  const loadBookmarkData = async () => {
    setIsLoading(true);
    const errors = {};
    
    // Load each API call separately to handle individual failures
    try {
      const scopesResponse = await knowledgeAPI.getScopes(workspace.id);
      setAvailableScopes(scopesResponse.data?.scopes || []);
      
      // Auto-select thread scope if available
      const threadScope = scopesResponse.data?.scopes?.find(s => s.source_thread_id === thread.id);
      if (threadScope) {
        setSelectedLocations([threadScope]);
      }
    } catch (error) {
      console.error('Error loading scopes:', error);
      errors.scopes = error.message;
      setAvailableScopes([]);
    }

    try {
      const categoriesResponse = await knowledgeAPI.getCategories(workspace.id);
      setAvailableCategories(categoriesResponse.data?.data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      errors.categories = error.message;
      setAvailableCategories([]);
    }

    try {
      const tagsResponse = await knowledgeAPI.getTags(workspace.id);
      setAvailableTags(tagsResponse.data?.data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
      errors.tags = error.message;
      setAvailableTags([]);
    }

    try {
      const permissionsResponse = await knowledgeAPI.getUserPermissions(workspace.id, currentUser.uid);
      setUserPermissions(permissionsResponse.data?.permissions || {});
    } catch (error) {
      console.error('Error loading permissions:', error);
      errors.permissions = error.message;
      // Set default permissions to allow basic operations
      setUserPermissions({ 
        workspace_admin: false,
        global_admin: false
      });
    }

    setApiErrors(errors);
    setIsLoading(false);
  };

  const loadMyBookmarksFolder = async () => {
    try {
      // Look for user's personal bookmarks folder or create it
      const response = await knowledgeAPI.getOrCreatePersonalBookmarks(workspace.id, currentUser.uid);
      setMyBookmarksFolder(response.data?.scope);
    } catch (error) {
      console.error('Error loading my bookmarks folder:', error);
    }
  };

  const generateAISuggestions = async () => {
    try {
      const response = await knowledgeAPI.generateAISuggestions(workspace.id, {
        content: message.content,
        thread_context: thread.name,
        message_type: message.message_type
      });
      
      const suggestions = response.data?.suggestions;
      setAiSuggestions(suggestions);
      setCustomTitle(suggestions?.suggested_title || '');
      setCustomSummary(suggestions?.suggested_summary || '');
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
    }
  };

  const handleSaveBookmark = async () => {
    try {
      setIsLoading(true);
      
      const locations = [...selectedLocations];
      
      // Add personal bookmarks if selected
      if (saveToMyBookmarks && myBookmarksFolder) {
        locations.push(myBookmarksFolder);
      }
      
      if (locations.length === 0) {
        console.error('No locations selected for bookmark');
        return;
      }
      
      const bookmarkData = {
        source_message_id: message.id,
        source_thread_id: thread.id,
        source_type: 'message',
        title: customTitle || message.content.substring(0, 100),
        content: message.content,
        summary: customSummary,
        primary_scope_id: locations[0]?.id,
        additional_scope_ids: locations.slice(1).map(l => l.id),
        category_ids: selectedCategories.map(c => c.id),
        tag_ids: selectedTags.map(t => t.id),
        ai_suggestions: aiSuggestions,
        save_to_multiple_locations: true
      };

      await knowledgeAPI.createKnowledgeItem(workspace.id, bookmarkData);
      onClose();
      
      // Show success notification
      console.log(`Knowledge item saved to ${locations.length} location(s) successfully!`);
    } catch (error) {
      console.error('Error saving bookmark:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const canAccessScope = (scope) => {
    return userPermissions[scope.id]?.permissions?.create || 
           scope.created_by === currentUser.uid ||
           userPermissions.global_admin ||
           userPermissions.workspace_admin;
  };

  const canCreateCategory = (scope) => {
    // Only workspace admins can create top-level categories
    // Regular users can create folders in their own area
    return userPermissions.workspace_admin || 
           (scope && (scope.created_by === currentUser.uid || userPermissions[scope.id]?.permissions?.manage_categories));
  };

  const toggleLocation = (location) => {
    setSelectedLocations(prev => {
      const isSelected = prev.some(l => l.id === location.id);
      if (isSelected) {
        return prev.filter(l => l.id !== location.id);
      } else {
        return [...prev, location];
      }
    });
  };

  const LocationCard = ({ location, isSelected, onToggle }) => (
    <motion.div
      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
      } ${!canAccessScope(location) ? 'opacity-50 cursor-not-allowed' : ''}`}
      whileHover={canAccessScope(location) ? { scale: 1.02 } : {}}
      onClick={() => canAccessScope(location) && onToggle(location)}
      disabled={!canAccessScope(location)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {location.scope_type === 'channel' && <Users className="w-5 h-5 text-blue-600" />}
          {location.scope_type === 'workspace' && <Globe className="w-5 h-5 text-green-600" />}
          {location.scope_type === 'custom' && <Folder className="w-5 h-5 text-purple-600" />}
          {location.scope_type === 'personal' && <Star className="w-5 h-5 text-yellow-600" />}
          <h3 className="font-semibold text-gray-900 dark:text-white">{location.name}</h3>
        </div>
        <div className="flex items-center space-x-2">
          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
          {!canAccessScope(location) && <Lock className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {location.description}
      </p>
      <div className="flex items-center justify-between text-xs">
        <span className={`px-2 py-1 rounded-full ${
          location.scope_type === 'channel' ? 'bg-blue-100 text-blue-800' :
          location.scope_type === 'workspace' ? 'bg-green-100 text-green-800' :
          location.scope_type === 'personal' ? 'bg-yellow-100 text-yellow-800' :
          'bg-purple-100 text-purple-800'
        }`}>
          {location.scope_type === 'personal' ? 'My Bookmarks' : location.scope_type}
        </span>
        <span className="text-gray-500">{location.item_count || 0} items</span>
      </div>
    </motion.div>
  );

  const CategoryTag = ({ item, isSelected, onToggle, type = 'category' }) => (
    <motion.button
      className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onToggle(item)}
    >
      {type === 'category' && (
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: item.color }}
        />
      )}
      {type === 'tag' && <Tag className="w-3 h-3" />}
      <span className="text-sm font-medium">{item.name}</span>
      {isSelected && <Check className="w-4 h-4" />}
    </motion.button>
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-[20px] border border-blue-200 dark:border-blue-600 shadow-[0_25px_50px_-12px_rgba(37,99,235,0.2)] max-w-4xl w-full max-h-[90vh] overflow-hidden ring-1 ring-blue-100 dark:ring-blue-500/20"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Save to Knowledge Base
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Step {step} of 3: {
                    step === 1 ? 'Choose Save Locations' :
                    step === 2 ? 'Categorize & Tag' : 
                    'Review & Confirm'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-8 max-h-[70vh] overflow-y-auto">
            {/* Step 1: Choose Locations */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Where should this knowledge be saved?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Select one or more locations to save this knowledge. You can save to multiple knowledge bases at once.
                  </p>
                </div>

                {/* Personal Bookmarks Option */}
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                  <motion.label 
                    className="flex items-center space-x-3 cursor-pointer"
                    whileHover={{ scale: 1.01 }}
                  >
                    <input
                      type="checkbox"
                      checked={saveToMyBookmarks}
                      onChange={(e) => setSaveToMyBookmarks(e.target.checked)}
                      className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                    />
                    <div className="flex items-center space-x-2">
                      <Star className="w-5 h-5 text-yellow-600" />
                      <span className="font-medium text-gray-900 dark:text-white">Save to My Bookmarks</span>
                    </div>
                  </motion.label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 ml-7">
                    Personal bookmark folder - only you can access these items
                  </p>
                </div>

                {/* Available Knowledge Locations */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
                    <BookmarkPlus className="w-4 h-4" />
                    <span>Also save to other knowledge bases</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableScopes.map((scope) => (
                      <LocationCard 
                        key={scope.id} 
                        location={scope}
                        isSelected={selectedLocations.some(l => l.id === scope.id)}
                        onToggle={toggleLocation}
                      />
                    ))}
                  </div>
                </div>

                {/* Create New Category Option for Workspace Admins */}
                {userPermissions.workspace_admin && (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center space-x-2 mb-2">
                      <FolderPlus className="w-5 h-5 text-purple-600" />
                      <h4 className="font-medium text-gray-900 dark:text-white">Create New Top-Level Category</h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      As a workspace admin, you can create new top-level knowledge categories
                    </p>
                    <button
                      className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center space-x-2"
                      onClick={() => console.log('TODO: Implement create category modal')}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Category</span>
                    </button>
                  </div>
                )}

                {/* AI Suggestions */}
                {aiSuggestions && (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <Brain className="w-5 h-5 text-purple-600" />
                      <h4 className="font-medium text-gray-900 dark:text-white">AI Recommendations</h4>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <p>Based on the message content, I recommend:</p>
                      <ul className="mt-2 space-y-1">
                        <li>• <strong>Scope:</strong> {aiSuggestions.recommended_scope}</li>
                        <li>• <strong>Category:</strong> {aiSuggestions.recommended_category}</li>
                        <li>• <strong>Confidence:</strong> {Math.round(aiSuggestions.confidence * 100)}%</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Categories and Tags */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Organize your knowledge
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Add categories and tags to make this knowledge easy to find later.
                  </p>
                </div>

                {/* Categories */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Categories</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {availableCategories
                      .filter(cat => {
                        // Include global categories and categories from selected locations
                        if (!cat.scope_id) return true; // Global categories
                        if (saveToMyBookmarks && myBookmarksFolder && cat.scope_id === myBookmarksFolder.id) return true;
                        return selectedLocations.some(location => cat.scope_id === location.id);
                      })
                      .map((category) => (
                        <CategoryTag
                          key={category.id}
                          item={category}
                          type="category"
                          isSelected={selectedCategories.some(c => c.id === category.id)}
                          onToggle={(cat) => {
                            setSelectedCategories(prev => 
                              prev.some(c => c.id === cat.id)
                                ? prev.filter(c => c.id !== cat.id)
                                : [...prev, cat]
                            );
                          }}
                        />
                      ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Tags</h4>
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search or create tags..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableTags
                      .filter(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((tag) => (
                        <CategoryTag
                          key={tag.id}
                          item={tag}
                          type="tag"
                          isSelected={selectedTags.some(t => t.id === tag.id)}
                          onToggle={(t) => {
                            setSelectedTags(prev => 
                              prev.some(existing => existing.id === t.id)
                                ? prev.filter(existing => existing.id !== t.id)
                                : [...prev, t]
                            );
                          }}
                        />
                      ))}
                  </div>
                </div>

                {/* Custom Title and Summary */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Custom Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="Enter a custom title..."
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Summary (Optional)
                    </label>
                    <textarea
                      value={customSummary}
                      onChange={(e) => setCustomSummary(e.target.value)}
                      placeholder="Add a brief summary..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Review and Confirm
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Please review the details before saving to the knowledge base.
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Locations:</span>
                    <div className="space-y-2 mt-1">
                      {saveToMyBookmarks && (
                        <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <Star className="w-4 h-4 text-yellow-600" />
                          <span className="text-gray-900 dark:text-white">My Bookmarks</span>
                        </div>
                      )}
                      {selectedLocations.map(location => (
                        <div key={location.id} className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          {location.scope_type === 'channel' && <Users className="w-4 h-4 text-blue-600" />}
                          {location.scope_type === 'workspace' && <Globe className="w-4 h-4 text-green-600" />}
                          {location.scope_type === 'custom' && <Folder className="w-4 h-4 text-purple-600" />}
                          <span className="text-gray-900 dark:text-white">{location.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title:</span>
                    <p className="text-gray-900 dark:text-white">
                      {customTitle || message.content.substring(0, 100) + '...'}
                    </p>
                  </div>

                  {selectedCategories.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Categories:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedCategories.map(cat => (
                          <span key={cat.id} className="inline-flex items-center space-x-1 px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span>{cat.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTags.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedTags.map(tag => (
                          <span key={tag.id} className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs">
                            #{tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center justify-between p-6 mx-5">
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <AlertCircle className="w-4 h-4" />
                <span>Knowledge will be saved with your current permissions</span>
              </div>
              
              <div className="flex items-center space-x-4">
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="px-6 py-2.5 bg-gray-200 text-gray-900 hover:bg-gray-300 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-xl transition-all font-medium shadow-sm hover:shadow-md"
                  >
                    Back
                  </button>
                )}
                
                {step < 3 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    disabled={step === 1 && !saveToMyBookmarks && selectedLocations.length === 0}
                    className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center space-x-2"
                  >
                    <span>Next</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleSaveBookmark}
                    disabled={isLoading || (step === 1 && !saveToMyBookmarks && selectedLocations.length === 0)}
                    className="px-8 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Save to Knowledge Base</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BookmarkDialog;
