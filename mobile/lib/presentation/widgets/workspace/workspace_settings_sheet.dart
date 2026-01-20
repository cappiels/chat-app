import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../data/services/http_client.dart';

/// Bottom sheet for workspace settings - invite members, view members, etc.
class WorkspaceSettingsSheet extends StatefulWidget {
  final Map<String, dynamic> workspace;

  const WorkspaceSettingsSheet({
    super.key,
    required this.workspace,
  });

  @override
  State<WorkspaceSettingsSheet> createState() => _WorkspaceSettingsSheetState();
}

class _WorkspaceSettingsSheetState extends State<WorkspaceSettingsSheet> {
  final HttpClient _httpClient = HttpClient();
  int _selectedTab = 0; // 0 = invite, 1 = members

  // Invite tab state
  final _emailController = TextEditingController();
  String _selectedRole = 'member';
  bool _sendingInvite = false;
  String? _inviteError;
  String? _inviteSuccess;

  // Members tab state
  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _pendingInvites = [];
  bool _loadingMembers = true;

  bool get _isAdmin =>
      widget.workspace['role'] == 'admin' ||
      widget.workspace['user_role'] == 'admin';

  @override
  void initState() {
    super.initState();
    _loadMembers();
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _loadMembers() async {
    setState(() => _loadingMembers = true);

    try {
      final workspaceId = widget.workspace['id'];
      final response = await _httpClient.get('/api/workspaces/$workspaceId/members');

      setState(() {
        _members = List<Map<String, dynamic>>.from(response.data['members'] ?? []);
        _pendingInvites = List<Map<String, dynamic>>.from(response.data['pending_invitations'] ?? []);
        _loadingMembers = false;
      });
    } catch (e) {
      print('Error loading members: $e');
      setState(() => _loadingMembers = false);
    }
  }

  Future<void> _sendInvite() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      setState(() => _inviteError = 'Please enter an email address');
      return;
    }

    // Basic email validation
    if (!email.contains('@') || !email.contains('.')) {
      setState(() => _inviteError = 'Please enter a valid email address');
      return;
    }

    setState(() {
      _sendingInvite = true;
      _inviteError = null;
      _inviteSuccess = null;
    });

    try {
      final workspaceId = widget.workspace['id'];
      await _httpClient.post(
        '/api/workspaces/$workspaceId/invite',
        data: {
          'email': email,
          'role': _selectedRole,
        },
      );

      setState(() {
        _inviteSuccess = 'Invitation sent to $email';
        _emailController.clear();
        _sendingInvite = false;
      });

      // Reload members to show pending invite
      _loadMembers();
    } catch (e) {
      setState(() {
        _inviteError = e.toString().contains('already')
            ? 'This person is already a member or has a pending invite'
            : 'Failed to send invitation. Please try again.';
        _sendingInvite = false;
      });
    }
  }

  Future<void> _cancelInvite(String invitationId, String email) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Invitation'),
        content: Text('Cancel the invitation to $email?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final workspaceId = widget.workspace['id'];
      await _httpClient.delete('/api/workspaces/$workspaceId/invitations/$invitationId');
      _loadMembers();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invitation cancelled')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to cancel: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.blue.shade600,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.workspaces,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.workspace['name'] ?? 'Workspace',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        '${_members.length} member${_members.length != 1 ? 's' : ''}',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          // Tabs
          Container(
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Colors.grey.shade200),
              ),
            ),
            child: Row(
              children: [
                _buildTab(0, Icons.person_add, 'Invite'),
                _buildTab(1, Icons.people, 'Members'),
              ],
            ),
          ),

          // Tab content
          Flexible(
            child: _selectedTab == 0 ? _buildInviteTab() : _buildMembersTab(),
          ),

          // Safe area padding
          SizedBox(height: MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }

  Widget _buildTab(int index, IconData icon, String label) {
    final isSelected = _selectedTab == index;

    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedTab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isSelected ? Colors.blue.shade600 : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 18,
                color: isSelected ? Colors.blue.shade600 : Colors.grey.shade500,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  color: isSelected ? Colors.blue.shade600 : Colors.grey.shade600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInviteTab() {
    if (!_isAdmin) {
      return Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.admin_panel_settings,
              size: 48,
              color: Colors.grey.shade300,
            ),
            const SizedBox(height: 12),
            Text(
              'Admin access required',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Only workspace admins can invite new members',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade500,
              ),
            ),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Email input
          const Text(
            'Email Address',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: InputDecoration(
              hintText: 'colleague@company.com',
              prefixIcon: const Icon(Icons.email_outlined, size: 20),
              filled: true,
              fillColor: Colors.grey.shade100,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
          ),
          const SizedBox(height: 16),

          // Role selector
          const Text(
            'Role',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _buildRoleChip('member', 'Member', 'Can view and participate'),
              const SizedBox(width: 12),
              _buildRoleChip('admin', 'Admin', 'Full workspace control'),
            ],
          ),
          const SizedBox(height: 20),

          // Error/Success messages
          if (_inviteError != null)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.red.shade600, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _inviteError!,
                      style: TextStyle(color: Colors.red.shade700, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),

          if (_inviteSuccess != null)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.green.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.check_circle_outline, color: Colors.green.shade600, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _inviteSuccess!,
                      style: TextStyle(color: Colors.green.shade700, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),

          // Send button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _sendingInvite ? null : _sendInvite,
              icon: _sendingInvite
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.send),
              label: Text(_sendingInvite ? 'Sending...' : 'Send Invitation'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue.shade600,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),

          // Pending invites section
          if (_pendingInvites.isNotEmpty) ...[
            const SizedBox(height: 24),
            const Divider(),
            const SizedBox(height: 16),
            Text(
              'Pending Invitations (${_pendingInvites.length})',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            ..._pendingInvites.map((invite) => _buildPendingInviteItem(invite)),
          ],
        ],
      ),
    );
  }

  Widget _buildRoleChip(String role, String label, String description) {
    final isSelected = _selectedRole == role;

    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedRole = role),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isSelected ? Colors.blue.shade50 : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? Colors.blue.shade400 : Colors.grey.shade300,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    role == 'admin' ? Icons.shield : Icons.person,
                    size: 16,
                    color: isSelected ? Colors.blue.shade600 : Colors.grey.shade600,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    label,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: isSelected ? Colors.blue.shade700 : Colors.grey.shade700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: TextStyle(
                  fontSize: 11,
                  color: isSelected ? Colors.blue.shade600 : Colors.grey.shade500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPendingInviteItem(Map<String, dynamic> invite) {
    final email = invite['email'] ?? 'Unknown';
    final role = invite['role'] ?? 'member';
    final invitedBy = invite['invited_by_name'] ?? 'Unknown';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: Colors.orange.shade200,
            child: Icon(Icons.mail_outline, size: 18, color: Colors.orange.shade700),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  email,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
                Text(
                  'Invited as $role by $invitedBy',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.close, size: 18, color: Colors.grey.shade600),
            onPressed: () => _cancelInvite(invite['id'].toString(), email),
            tooltip: 'Cancel invitation',
          ),
        ],
      ),
    );
  }

  Widget _buildMembersTab() {
    if (_loadingMembers) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: CircularProgressIndicator(),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: _members.length,
      itemBuilder: (context, index) {
        final member = _members[index];
        final displayName = member['display_name'] ?? 'Unknown';
        final email = member['email'] ?? '';
        final role = member['role'] ?? 'member';
        final isCurrentUser = member['is_current_user'] == true;

        return ListTile(
          leading: CircleAvatar(
            backgroundColor: role == 'admin' ? Colors.blue.shade100 : Colors.grey.shade200,
            child: Text(
              displayName.isNotEmpty ? displayName[0].toUpperCase() : '?',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: role == 'admin' ? Colors.blue.shade700 : Colors.grey.shade700,
              ),
            ),
          ),
          title: Row(
            children: [
              Flexible(
                child: Text(
                  displayName,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (isCurrentUser)
                Container(
                  margin: const EdgeInsets.only(left: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'You',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500),
                  ),
                ),
            ],
          ),
          subtitle: Text(
            email,
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
          ),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: role == 'admin' ? Colors.blue.shade100 : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              role == 'admin' ? 'Admin' : 'Member',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: role == 'admin' ? Colors.blue.shade700 : Colors.grey.shade600,
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Shows the workspace settings sheet
void showWorkspaceSettingsSheet(BuildContext context, Map<String, dynamic> workspace) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => WorkspaceSettingsSheet(workspace: workspace),
  );
}
