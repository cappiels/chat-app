import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:math' as math;
import '../../../data/services/subscription_service.dart';
import '../../../data/services/workspace_service.dart';
import '../../../data/services/http_client.dart';
import '../../../data/models/workspace.dart';

class WorkspaceSelectionScreen extends ConsumerStatefulWidget {
  final VoidCallback? onSignOut;
  final Function(Map<String, dynamic>)? onSelectWorkspace;
  
  const WorkspaceSelectionScreen({
    super.key,
    this.onSignOut,
    this.onSelectWorkspace,
  });

  @override
  ConsumerState<WorkspaceSelectionScreen> createState() => _WorkspaceSelectionScreenState();
}

class _WorkspaceSelectionScreenState extends ConsumerState<WorkspaceSelectionScreen>
    with TickerProviderStateMixin {
  
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  
  final HttpClient _httpClient = HttpClient();
  late final SubscriptionService _subscriptionService;
  late final WorkspaceService _workspaceService;
  
  List<Workspace> _workspaces = [];
  bool _useRealBackend = true;
  bool _loading = true;
  bool _showCreateForm = false;
  String _searchQuery = '';
  String _newWorkspaceName = '';
  String _newWorkspaceDescription = '';
  bool _creating = false;
  int _selectedBottomNavIndex = 0;
  
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _subscriptionService = SubscriptionService(_httpClient);
    _workspaceService = WorkspaceService(_httpClient);
    
    // Initialize animations
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.easeOut),
    );
    _slideAnimation = Tween<Offset>(begin: const Offset(0, 0.2), end: Offset.zero).animate(
      CurvedAnimation(parent: _slideController, curve: Curves.easeOutCubic),
    );
    
    _loadWorkspaces();
    
    // Start animations
    _fadeController.forward();
    _slideController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    _searchController.dispose();
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadWorkspaces() async {
    try {
      setState(() => _loading = true);
      
      if (_useRealBackend) {
        // Try to load from real backend API
        print('🔄 Attempting to load workspaces from backend API...');
        final workspaces = await _workspaceService.getWorkspaces();
        
        setState(() {
          _workspaces = workspaces;
          _loading = false;
        });
        
        print('✅ Loaded ${workspaces.length} workspaces from backend');
      } else {
        // Fallback to demo data for development
        print('🔄 Using demo workspaces for development');
        await Future.delayed(const Duration(milliseconds: 1500));
        
        final demoWorkspaces = [
          Workspace(
            id: 'ws_demo_1',
            name: 'Marketing Team',
            description: 'Brand campaigns, content creation, and social media management',
            ownerId: 'demo_user',
            role: 'admin',
            memberCount: 8,
            channelCount: 5,
            createdAt: DateTime.now().subtract(const Duration(hours: 2)),
            settings: {'color': 'purple'},
          ),
          Workspace(
            id: 'ws_demo_2',
            name: 'Product Development',
            description: 'Feature planning, design reviews, and sprint coordination',
            ownerId: 'demo_user',
            role: 'member',
            memberCount: 12,
            channelCount: 8,
            createdAt: DateTime.now().subtract(const Duration(minutes: 30)),
            settings: {'color': 'blue'},
          ),
          Workspace(
            id: 'ws_demo_3',
            name: 'Customer Success',
            description: 'Support tickets, onboarding, and customer feedback',
            ownerId: 'other_user',
            role: 'member',
            memberCount: 5,
            channelCount: 3,
            createdAt: DateTime.now().subtract(const Duration(days: 1)),
            settings: {'color': 'green'},
          ),
        ];
        
        setState(() {
          _workspaces = demoWorkspaces;
          // Sort workspaces by creation date
          _workspaces.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          _loading = false;
        });
      }
    } catch (e) {
      print('❌ Error loading workspaces: $e');
      setState(() => _loading = false);
      
      // Try demo data as fallback
      if (_useRealBackend) {
        print('🔄 Falling back to demo data...');
        setState(() => _useRealBackend = false);
        _loadWorkspaces(); // Retry with demo data
      } else {
        _showErrorSnackBar('Failed to load workspaces: $e');
      }
    }
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red.shade600,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _showSuccessSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green.shade600,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  List<Workspace> get _filteredWorkspaces {
    if (_searchQuery.isEmpty) return _workspaces;
    return _workspaces.where((workspace) {
      final name = workspace.name.toLowerCase();
      final description = workspace.description?.toLowerCase() ?? '';
      final query = _searchQuery.toLowerCase();
      return name.contains(query) || description.contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.grey.shade50,
              Colors.white,
              Colors.grey.shade50,
            ],
            stops: const [0.0, 0.5, 1.0],
          ),
        ),
        child: SafeArea(
          child: _loading ? _buildLoadingScreen() : _buildBodyContent(),
        ),
      ),
      bottomNavigationBar: _buildBottomNavigation(),
    );
  }

  Widget _buildBodyContent() {
    if (_selectedBottomNavIndex == 0) {
      return _buildMainContent();
    } else if (_selectedBottomNavIndex == 1) {
      return _buildCalendarPlaceholder();
    } else if (_selectedBottomNavIndex == 2) {
      return _buildTimelinePlaceholder();
    } else if (_selectedBottomNavIndex == 3) {
      return _buildKnowledgePlaceholder();
    } else {
      return _buildWeeklyCalendarPlaceholder();
    }
  }

  Widget _buildLoadingScreen() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.1),
                  spreadRadius: 2,
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(
              Icons.message_rounded,
              size: 48,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: 40,
            height: 40,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              valueColor: AlwaysStoppedAnimation<Color>(Colors.blue.shade600),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Loading your workspaces...',
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey.shade600,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainContent() {
    return CustomScrollView(
      slivers: [
        _buildHeader(),
        _buildSearchBar(),
        _buildWorkspaceGrid(),
      ],
    );
  }

  Widget _buildHeader() {
    return SliverToBoxAdapter(
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: SlideTransition(
          position: _slideAnimation,
          child: Container(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // App Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.shade200),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.grey.withOpacity(0.1),
                                spreadRadius: 1,
                                blurRadius: 4,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: Icon(
                            Icons.message_rounded,
                            size: 24,
                            color: Colors.grey.shade700,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'crew',
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                            Text(
                              'Welcome back, Demo User!',
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    GestureDetector(
                      onTap: widget.onSignOut,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Text(
                          'Sign Out',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey.shade600,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return SliverToBoxAdapter(
      child: AnimatedBuilder(
        animation: _fadeAnimation,
        builder: (context, child) {
          return Transform.translate(
            offset: Offset(0, 20 * (1 - _fadeAnimation.value)),
            child: Opacity(
              opacity: _fadeAnimation.value,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade200),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.grey.withOpacity(0.05),
                        spreadRadius: 1,
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search workspaces...',
                      prefixIcon: Icon(
                        Icons.search_rounded,
                        color: Colors.grey.shade400,
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.all(20),
                      hintStyle: TextStyle(
                        color: Colors.grey.shade500,
                        fontSize: 16,
                      ),
                    ),
                    onChanged: (value) {
                      setState(() {
                        _searchQuery = value;
                      });
                    },
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildWorkspaceGrid() {
    return SliverPadding(
      padding: const EdgeInsets.all(24),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 1,
          childAspectRatio: 3.2,  // Increased to give more height
          mainAxisSpacing: 16,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            if (index < _filteredWorkspaces.length) {
              return _buildWorkspaceCard(_filteredWorkspaces[index], index);
            } else {
              return _buildCreateWorkspaceCard();
            }
          },
          childCount: _filteredWorkspaces.length + 1,
        ),
      ),
    );
  }

  Widget _buildWorkspaceCard(Workspace workspace, int index) {
    return AnimatedBuilder(
      animation: _fadeAnimation,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, 30 * (1 - _fadeAnimation.value)),
          child: Opacity(
            opacity: _fadeAnimation.value,
            child: TweenAnimationBuilder<double>(
              duration: Duration(milliseconds: 800 + (index * 100)),
              tween: Tween(begin: 0.0, end: 1.0),
              curve: Curves.easeOutBack,
              builder: (context, value, child) {
                return Transform.scale(
                  scale: 0.8 + (0.2 * value),
                  child: _buildWorkspaceCardContent(workspace),
                );
              },
            ),
          ),
        );
      },
    );
  }

  Widget _buildWorkspaceCardContent(Workspace workspace) {
    // Get color from workspace settings
    Color workspaceColor = Colors.blue;
    final colorName = workspace.color;
    switch (colorName) {
      case 'purple': workspaceColor = Colors.purple.shade500; break;
      case 'blue': workspaceColor = Colors.blue.shade500; break;
      case 'green': workspaceColor = Colors.green.shade500; break;
      case 'red': workspaceColor = Colors.red.shade500; break;
      case 'orange': workspaceColor = Colors.orange.shade500; break;
      case 'teal': workspaceColor = Colors.teal.shade500; break;
      case 'indigo': workspaceColor = Colors.indigo.shade500; break;
      default: workspaceColor = Colors.blue.shade500;
    }
    
    return GestureDetector(
      onTap: () => widget.onSelectWorkspace?.call(workspace.toJson()),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.white,
              Colors.white.withOpacity(0.8),
            ],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.3)),
          boxShadow: [
            BoxShadow(
              color: Colors.grey.withOpacity(0.1),
              spreadRadius: 2,
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.all(24),
              child: Row(
                children: [
                  Stack(
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          color: workspaceColor,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: workspaceColor.withOpacity(0.3),
                              spreadRadius: 1,
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.workspaces_rounded,
                          color: Colors.white,
                          size: 28,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 20),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                workspace.name,
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black87,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (workspace.unreadCount > 0) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.blue.shade600,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  workspace.unreadCount > 99 ? '99+' : '${workspace.unreadCount}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          workspace.description ?? 'No description',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey.shade600,
                            height: 1.2,
                          ),
                          maxLines: 1,  // Reduced to 1 line to save space
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Icon(
                              Icons.people_rounded,
                              size: 16,
                              color: Colors.grey.shade500,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${workspace.memberCount}',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade500,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '•',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade400,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                workspace.lastActivity,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade500,
                                  fontWeight: FontWeight.w500,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (workspace.isAdmin) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.blue.shade50,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'Admin',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.blue.shade700,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: Colors.grey.shade400,
                    size: 28,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCreateWorkspaceCard() {
    return AnimatedBuilder(
      animation: _fadeAnimation,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, 30 * (1 - _fadeAnimation.value)),
          child: Opacity(
            opacity: _fadeAnimation.value * 0.8,
            child: GestureDetector(
              onTap: () {
                setState(() {
                  _showCreateForm = !_showCreateForm;
                  if (!_showCreateForm) {
                    _nameController.clear();
                    _descriptionController.clear();
                    _newWorkspaceName = '';
                    _newWorkspaceDescription = '';
                  }
                });
              },
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Colors.grey.shade50,
                      Colors.white.withOpacity(0.5),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: Colors.grey.shade300,
                    style: BorderStyle.solid,
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.grey.withOpacity(0.05),
                      spreadRadius: 1,
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: _showCreateForm ? _buildCreateForm() : _buildCreatePrompt(),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCreatePrompt() {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              Icons.add_rounded,
              size: 28,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Create New Workspace',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  'Start a new workspace',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey.shade500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCreateForm() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Create New Workspace',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nameController,
            decoration: InputDecoration(
              hintText: 'Workspace name',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.blue.shade500),
              ),
              contentPadding: const EdgeInsets.all(16),
            ),
            onChanged: (value) {
              setState(() {
                _newWorkspaceName = value;
              });
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descriptionController,
            decoration: InputDecoration(
              hintText: 'Description (optional)',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.blue.shade500),
              ),
              contentPadding: const EdgeInsets.all(16),
            ),
            onChanged: (value) {
              setState(() {
                _newWorkspaceDescription = value;
              });
            },
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: _creating ? null : () {
                    setState(() {
                      _showCreateForm = false;
                      _nameController.clear();
                      _descriptionController.clear();
                      _newWorkspaceName = '';
                      _newWorkspaceDescription = '';
                    });
                  },
                  child: Text(
                    'Cancel',
                    style: TextStyle(
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _creating || _newWorkspaceName.trim().isEmpty ? null : _createWorkspace,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue.shade600,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 2,
                  ),
                  child: _creating 
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'Create',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _createWorkspace() async {
    setState(() => _creating = true);
    
    try {
      if (_useRealBackend) {
        // Use real backend API
        print('🏗️ Creating workspace via backend API: $_newWorkspaceName');
        final newWorkspace = await _workspaceService.createWorkspace(
          name: _newWorkspaceName,
          description: _newWorkspaceDescription.isEmpty ? null : _newWorkspaceDescription,
        );
        
        setState(() {
          _workspaces.insert(0, newWorkspace);
          _showCreateForm = false;
          _nameController.clear();
          _descriptionController.clear();
          _newWorkspaceName = '';
          _newWorkspaceDescription = '';
          _creating = false;
        });
        
        print('✅ Workspace created successfully: ${newWorkspace.name}');
      } else {
        // Simulate workspace creation for demo mode
        await Future.delayed(const Duration(milliseconds: 1500));
        
        final newWorkspace = Workspace(
          id: 'ws_demo_${DateTime.now().millisecondsSinceEpoch}',
          name: _newWorkspaceName,
          description: _newWorkspaceDescription.isEmpty ? null : _newWorkspaceDescription,
          ownerId: 'demo_user',
          role: 'admin',
          memberCount: 1,
          channelCount: 1,
          createdAt: DateTime.now(),
          settings: {'color': _getRandomColorName()},
        );
        
        setState(() {
          _workspaces.insert(0, newWorkspace);
          _showCreateForm = false;
          _nameController.clear();
          _descriptionController.clear();
          _newWorkspaceName = '';
          _newWorkspaceDescription = '';
          _creating = false;
        });
      }
      
      _showSuccessSnackBar('Workspace created successfully!');
    } catch (e) {
      print('❌ Error creating workspace: $e');
      setState(() => _creating = false);
      _showErrorSnackBar('Failed to create workspace: $e');
    }
  }

  String _getRandomColorName() {
    final colors = ['purple', 'blue', 'green', 'red', 'orange', 'teal', 'indigo'];
    return colors[math.Random().nextInt(colors.length)];
  }

  Color _getRandomColor() {
    final colors = [
      Colors.purple.shade500,
      Colors.blue.shade500,
      Colors.green.shade500,
      Colors.red.shade500,
      Colors.orange.shade500,
      Colors.teal.shade500,
      Colors.indigo.shade500,
    ];
    return colors[math.Random().nextInt(colors.length)];
  }

  Widget _buildCalendarPlaceholder() {
    return _buildFeaturePlaceholder(
      icon: Icons.calendar_month,
      title: 'Monthly Calendar',
      description: 'View tasks and events across all workspaces',
      color: Colors.purple,
    );
  }

  Widget _buildWeeklyCalendarPlaceholder() {
    return _buildFeaturePlaceholder(
      icon: Icons.view_week,
      title: 'Weekly Calendar',
      description: 'Week view with time blocking and schedules',
      color: Colors.teal,
    );
  }

  Widget _buildTimelinePlaceholder() {
    return _buildFeaturePlaceholder(
      icon: Icons.timeline,
      title: 'Timeline',
      description: 'Gantt chart with task dependencies and progress',
      color: Colors.orange,
    );
  }

  Widget _buildKnowledgePlaceholder() {
    return _buildFeaturePlaceholder(
      icon: Icons.library_books,
      title: 'Knowledge Base',
      description: 'Organized knowledge with categories and tagging',
      color: Colors.green,
    );
  }

  Widget _buildFeaturePlaceholder({
    required IconData icon,
    required String title,
    required String description,
    required Color color,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(icon, size: 64, color: color),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              description,
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey.shade600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '🚀 Navigate directly from home',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.blue.shade700,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNavigation() {
    return BottomNavigationBar(
      currentIndex: _selectedBottomNavIndex,
      onTap: (index) {
        setState(() {
          _selectedBottomNavIndex = index;
        });
      },
      type: BottomNavigationBarType.fixed,
      selectedItemColor: Colors.blue.shade600,
      unselectedItemColor: Colors.grey.shade500,
      selectedFontSize: 12,
      unselectedFontSize: 11,
      items: const [
        BottomNavigationBarItem(
          icon: Icon(Icons.workspaces_outlined),
          activeIcon: Icon(Icons.workspaces),
          label: 'Workspaces',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.calendar_month_outlined),
          activeIcon: Icon(Icons.calendar_month),
          label: 'Calendar',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.timeline_outlined),
          activeIcon: Icon(Icons.timeline),
          label: 'Timeline',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.library_books_outlined),
          activeIcon: Icon(Icons.library_books),
          label: 'Knowledge',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.view_week_outlined),
          activeIcon: Icon(Icons.view_week),
          label: 'Weekly',
        ),
      ],
    );
  }
}
