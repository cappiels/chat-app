import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../data/services/workspace_service.dart';

const String SITE_ADMIN_EMAIL = 'cappiels@gmail.com';

class InviteDialog extends StatefulWidget {
  final Map<String, dynamic> workspace;

  const InviteDialog({
    super.key,
    required this.workspace,
  });

  @override
  State<InviteDialog> createState() => _InviteDialogState();
}

class _InviteDialogState extends State<InviteDialog> with SingleTickerProviderStateMixin {
  final WorkspaceService _workspaceService = WorkspaceService();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _searchController = TextEditingController();
  String _selectedRole = 'member';
  bool _isLoading = false;
  final List<Map<String, dynamic>> _pendingInvites = [];
  
  // Site admin search state
  List<Map<String, dynamic>> _searchResults = [];
  bool _isSearching = false;
  Timer? _debounceTimer;
  
  late TabController _tabController;
  bool _isSiteAdmin = false;

  @override
  void initState() {
    super.initState();
    _checkSiteAdmin();
    _tabController = TabController(length: 2, vsync: this);
  }

  void _checkSiteAdmin() {
    final user = FirebaseAuth.instance.currentUser;
    final userEmail = user?.email ?? '';
    final isSiteAdmin = userEmail.toLowerCase() == SITE_ADMIN_EMAIL.toLowerCase();
    
    print('🔐 Site Admin Check:');
    print('   Current user email: $userEmail');
    print('   Site admin email: $SITE_ADMIN_EMAIL');
    print('   Is site admin: $isSiteAdmin');
    
    setState(() {
      _isSiteAdmin = isSiteAdmin;
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _searchController.dispose();
    _tabController.dispose();
    _debounceTimer?.cancel();
    super.dispose();
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email);
  }

  Future<void> _sendInvite() async {
    final email = _emailController.text.trim();
    
    if (email.isEmpty) {
      _showError('Please enter an email address');
      return;
    }

    if (!_isValidEmail(email)) {
      _showError('Please enter a valid email address');
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      await _workspaceService.inviteUser(
        workspaceId: widget.workspace['id'].toString(),
        email: email,
        role: _selectedRole,
      );

      // Add to pending invites
      setState(() {
        _pendingInvites.add({
          'email': email,
          'role': _selectedRole,
          'timestamp': DateTime.now(),
        });
        _emailController.clear();
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ Invitation sent to $email'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
        
        // Close dialog after successful invite
        Navigator.of(context).pop();
      }
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    
    if (query.length < 2) {
      setState(() {
        _searchResults = [];
        _isSearching = false;
      });
      return;
    }

    setState(() {
      _isSearching = true;
    });

    _debounceTimer = Timer(const Duration(milliseconds: 300), () {
      _searchUsers(query);
    });
  }

  Future<void> _searchUsers(String query) async {
    try {
      final results = await _workspaceService.searchRegisteredUsers(query);
      
      // Filter out existing members
      final existingMemberIds = (widget.workspace['members'] as List?)
          ?.map((m) => m['id']?.toString())
          .toSet() ?? {};
      
      final filteredResults = results.where((user) {
        return !existingMemberIds.contains(user['id']?.toString());
      }).toList();
      
      if (mounted) {
        setState(() {
          _searchResults = filteredResults;
          _isSearching = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _searchResults = [];
          _isSearching = false;
        });
        _showError(e.toString().replaceAll('Exception: ', ''));
      }
    }
  }

  Future<void> _addUserToWorkspace(Map<String, dynamic> user) async {
    setState(() {
      _isLoading = true;
    });

    try {
      await _workspaceService.addRegisteredUserToWorkspace(
        workspaceId: widget.workspace['id'].toString(),
        userId: user['id'].toString(),
        role: _selectedRole,
      );

      if (mounted) {
        final userName = user['display_name'] ?? user['email'];
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ $userName added to workspace'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.of(context).pop(true); // Return true to indicate member was added
      }
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _showError(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: Colors.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Widget _buildRoleSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Role',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth < 350) {
              return Column(
                children: [
                  _RoleCard(
                    title: 'Member',
                    description: 'Read & write messages',
                    icon: Icons.group,
                    iconColor: Colors.blue,
                    isSelected: _selectedRole == 'member',
                    onTap: () => setState(() => _selectedRole = 'member'),
                  ),
                  const SizedBox(height: 8),
                  _RoleCard(
                    title: 'Admin',
                    description: 'Full workspace access',
                    icon: Icons.admin_panel_settings,
                    iconColor: Colors.amber.shade700,
                    isSelected: _selectedRole == 'admin',
                    onTap: () => setState(() => _selectedRole = 'admin'),
                  ),
                ],
              );
            }
            
            return Row(
              children: [
                Expanded(
                  child: _RoleCard(
                    title: 'Member',
                    description: 'Read & write messages',
                    icon: Icons.group,
                    iconColor: Colors.blue,
                    isSelected: _selectedRole == 'member',
                    onTap: () => setState(() => _selectedRole = 'member'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _RoleCard(
                    title: 'Admin',
                    description: 'Full access',
                    icon: Icons.admin_panel_settings,
                    iconColor: Colors.amber.shade700,
                    isSelected: _selectedRole == 'admin',
                    onTap: () => setState(() => _selectedRole = 'admin'),
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _buildEmailInviteTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildRoleSelector(),
          const SizedBox(height: 24),

          // Email Input
          const Text(
            'Email Address',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              hintText: 'colleague@company.com',
              prefixIcon: const Icon(Icons.email_outlined),
              suffixIcon: _emailController.text.isNotEmpty &&
                      _isValidEmail(_emailController.text.trim())
                  ? const Icon(Icons.check_circle, color: Colors.green)
                  : null,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              filled: true,
              fillColor: Colors.grey.shade50,
            ),
            onChanged: (value) => setState(() {}),
            onSubmitted: (value) {
              if (!_isLoading) _sendInvite();
            },
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _isLoading ? null : _sendInvite,
            icon: _isLoading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.send, size: 18),
            label: Text(_isLoading ? 'Sending...' : 'Send Invite'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue.shade600,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Icon(Icons.info_outline, size: 14, color: Colors.grey),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Invitations expire in 7 days',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSearchUserTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildRoleSelector(),
          const SizedBox(height: 24),

          // Search Input
          const Text(
            'Search Registered Users',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search by name or email...',
              prefixIcon: _isSearching
                  ? Container(
                      width: 20,
                      height: 20,
                      padding: const EdgeInsets.all(14),
                      child: const CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              filled: true,
              fillColor: Colors.grey.shade50,
            ),
            onChanged: _onSearchChanged,
          ),
          const SizedBox(height: 16),

          // Search Results
          if (_searchController.text.length < 2) ...[
            Container(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  Icon(Icons.search, size: 48, color: Colors.grey.shade400),
                  const SizedBox(height: 12),
                  Text(
                    'Type at least 2 characters to search',
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
          ] else if (_searchResults.isEmpty && !_isSearching) ...[
            Container(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  Icon(Icons.person_off, size: 48, color: Colors.grey.shade400),
                  const SizedBox(height: 12),
                  Text(
                    'No users found matching "${_searchController.text}"',
                    style: TextStyle(color: Colors.grey.shade600),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Make sure the user has registered in the app',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                  ),
                ],
              ),
            ),
          ] else ...[
            ..._searchResults.map((user) {
              final displayName = user['display_name'] ?? 'No name';
              final email = user['email'] ?? '';
              final photoUrl = user['profile_picture_url'];
              final initials = displayName.isNotEmpty
                  ? displayName[0].toUpperCase()
                  : (email.isNotEmpty ? email[0].toUpperCase() : 'U');

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade200),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 4,
                  ),
                  leading: CircleAvatar(
                    backgroundImage: photoUrl != null ? NetworkImage(photoUrl) : null,
                    backgroundColor: Colors.blue.shade100,
                    child: photoUrl == null
                        ? Text(
                            initials,
                            style: TextStyle(
                              color: Colors.blue.shade700,
                              fontWeight: FontWeight.bold,
                            ),
                          )
                        : null,
                  ),
                  title: Text(
                    displayName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    email,
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                  ),
                  trailing: ElevatedButton.icon(
                    onPressed: _isLoading ? null : () => _addUserToWorkspace(user),
                    icon: const Icon(Icons.person_add, size: 16),
                    label: const Text('Add'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green.shade600,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ],

          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.green.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.check_circle, size: 16, color: Colors.green.shade600),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Added users get instant access - no invitation link needed',
                    style: TextStyle(fontSize: 12, color: Colors.green.shade700),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final workspaceName = widget.workspace['name'] ?? 'Workspace';
    final screenWidth = MediaQuery.of(context).size.width;
    
    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        width: screenWidth > 600 ? 500 : screenWidth - 32,
        constraints: BoxConstraints(
          maxWidth: 500,
          minWidth: screenWidth > 600 ? 400 : screenWidth - 32,
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.person_add,
                      color: Colors.blue.shade700,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Add Members to $workspaceName',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _isSiteAdmin 
                              ? 'Search users or send email invites'
                              : 'Send email invitations',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),

            // Tab bar for site admin, or direct email invite for others
            if (_isSiteAdmin) ...[
              Container(
                color: Colors.grey.shade100,
                child: TabBar(
                  controller: _tabController,
                  labelColor: Colors.blue.shade700,
                  unselectedLabelColor: Colors.grey.shade600,
                  indicatorColor: Colors.blue.shade700,
                  indicatorWeight: 3,
                  tabs: const [
                    Tab(
                      icon: Icon(Icons.search, size: 20),
                      text: 'Search Users',
                    ),
                    Tab(
                      icon: Icon(Icons.email_outlined, size: 20),
                      text: 'Email Invite',
                    ),
                  ],
                ),
              ),
              Flexible(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildSearchUserTab(),
                    _buildEmailInviteTab(),
                  ],
                ),
              ),
            ] else ...[
              Flexible(
                child: _buildEmailInviteTab(),
              ),
            ],

            // Footer
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                border: Border(
                  top: BorderSide(color: Colors.grey.shade200),
                ),
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(20),
                  bottomRight: Radius.circular(20),
                ),
              ),
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Close'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;
  final Color iconColor;
  final bool isSelected;
  final VoidCallback onTap;

  const _RoleCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.iconColor,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? Colors.blue.shade50 : Colors.white,
          border: Border.all(
            color: isSelected ? Colors.blue.shade500 : Colors.grey.shade300,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: iconColor, size: 18),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              description,
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey.shade600,
                height: 1.2,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
