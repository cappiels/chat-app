import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:async';
import 'package:uni_links/uni_links.dart';
import 'auth/login_screen.dart';
import 'workspace/workspace_selection_screen.dart';
import 'threads/thread_list_screen.dart';
import '../../data/services/push_notification_service.dart';
import '../../data/services/version_check_service.dart';

/// 🏆 STEP 2: REAL APP WITH FIREBASE AUTHENTICATION
class MainApp extends ConsumerStatefulWidget {
  const MainApp({super.key});

  @override
  ConsumerState<MainApp> createState() => _MainAppState();
}

class _MainAppState extends ConsumerState<MainApp> {
  Map<String, dynamic>? _selectedWorkspace;
  String? _pendingInviteToken;
  StreamSubscription? _linkSubscription;
  bool _pushNotificationsInitialized = false;
  bool _versionCheckDone = false;

  @override
  void initState() {
    super.initState();
    _initDeepLinks();
    _initPushNotifications();
    _checkForUpdates();
  }

  /// 📱 VERSION CHECK: Check for app updates on startup
  Future<void> _checkForUpdates() async {
    if (_versionCheckDone) return;

    // Wait a moment for the app to initialize
    await Future.delayed(const Duration(seconds: 2));

    if (!mounted) return;

    try {
      final versionService = ref.read(versionCheckServiceProvider);
      final result = await versionService.checkForUpdate();

      _versionCheckDone = true;

      if (result.updateAvailable && mounted) {
        // Show update dialog
        versionService.showUpdateDialog(context, result);
      }
    } catch (e) {
      debugPrint('❌ Version check error: $e');
      _versionCheckDone = true;
    }
  }

  /// 🔔 PUSH NOTIFICATIONS: Initialize when user is authenticated
  Future<void> _initPushNotifications() async {
    if (_pushNotificationsInitialized) return;

    // Wait for auth state to be ready
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      // Will be called again when user logs in
      FirebaseAuth.instance.authStateChanges().first.then((user) {
        if (user != null && mounted) {
          _initPushNotifications();
        }
      });
      return;
    }

    try {
      final pushService = ref.read(pushNotificationServiceProvider);

      // Set up notification tap handler
      pushService.onNotificationTap = (data) {
        _handleNotificationTap(data);
      };

      // Initialize the service
      await pushService.initialize();
      _pushNotificationsInitialized = true;
      print('✅ Push notifications initialized for user ${user.uid}');

    } catch (e) {
      print('❌ Failed to initialize push notifications: $e');
    }
  }

  /// 🔔 Handle notification tap - navigate to the appropriate screen
  void _handleNotificationTap(Map<String, dynamic> data) {
    print('🔔 Notification tapped with data: $data');

    final workspaceId = data['workspaceId'];
    final threadId = data['threadId'];

    if (workspaceId != null) {
      // Navigate to workspace/thread
      // For now, we'll set the workspace and let the user see it
      // Full deep navigation to specific thread would require more work
      setState(() {
        _selectedWorkspace = {
          'id': workspaceId,
          'name': 'Loading...',
        };
      });

      // Show a snackbar to indicate what happened
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(threadId != null
                ? 'Opening conversation...'
                : 'Opening workspace...'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    super.dispose();
  }

  /// 🔗 DEEP LINK HANDLER: Captures invitation links
  Future<void> _initDeepLinks() async {
    // Handle initial link if app was opened via deep link
    try {
      final initialLink = await getInitialUri();
      if (initialLink != null) {
        _handleDeepLink(initialLink);
      }
    } catch (e) {
      print('❌ Error getting initial link: $e');
    }

    // Listen for deep links while app is running
    _linkSubscription = uriLinkStream.listen(
      (Uri? uri) {
        if (uri != null) {
          _handleDeepLink(uri);
        }
      },
      onError: (err) {
        print('❌ Deep link error: $err');
      },
    );
  }

  /// 📥 PROCESS DEEP LINK: Extract invite token or workspace/thread IDs
  void _handleDeepLink(Uri uri) {
    print('🔗 Deep link received: $uri');
    print('🔗 Path: ${uri.path}');
    print('🔗 Fragment: ${uri.fragment}');

    // Check for hash-based routing (e.g., /#/workspace/UUID or /#/workspace/UUID/thread/UUID)
    if (uri.fragment.isNotEmpty) {
      final fragmentPath = uri.fragment;
      print('🔗 Processing fragment path: $fragmentPath');

      // Parse workspace from fragment: /workspace/UUID or /workspace/UUID/thread/UUID
      final workspaceMatch = RegExp(r'/workspace/([a-f0-9-]+)').firstMatch(fragmentPath);
      if (workspaceMatch != null) {
        final workspaceId = workspaceMatch.group(1);
        print('✅ Extracted workspace ID from fragment: $workspaceId');

        // Check for thread ID
        final threadMatch = RegExp(r'/thread/([a-f0-9-]+)').firstMatch(fragmentPath);
        final threadId = threadMatch?.group(1);
        if (threadId != null) {
          print('✅ Extracted thread ID from fragment: $threadId');
        }

        // Navigate to workspace (and optionally thread)
        _navigateToWorkspace(workspaceId!, threadId);
        return;
      }

      // Check for invite in fragment: /invite/TOKEN
      if (fragmentPath.startsWith('/invite/')) {
        final token = fragmentPath.split('/').last;
        setState(() {
          _pendingInviteToken = token;
        });
        print('✅ Extracted invite token from fragment: $token');
        Future.delayed(const Duration(milliseconds: 500), () {
          if (mounted && _pendingInviteToken != null) {
            _showInviteDialog(_pendingInviteToken!);
          }
        });
        return;
      }
    }

    // Check if it's an invite link in path: /invite/TOKEN
    if (uri.path.startsWith('/invite/')) {
      final token = uri.path.split('/').last;
      setState(() {
        _pendingInviteToken = token;
      });
      print('✅ Extracted invite token: $token');

      // Show invite dialog after a short delay to ensure UI is ready
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted && _pendingInviteToken != null) {
          _showInviteDialog(_pendingInviteToken!);
        }
      });
      return;
    }

    // Check for workspace in path: /workspace/UUID
    final pathWorkspaceMatch = RegExp(r'/workspace/([a-f0-9-]+)').firstMatch(uri.path);
    if (pathWorkspaceMatch != null) {
      final workspaceId = pathWorkspaceMatch.group(1);
      final threadMatch = RegExp(r'/thread/([a-f0-9-]+)').firstMatch(uri.path);
      final threadId = threadMatch?.group(1);
      print('✅ Extracted workspace ID from path: $workspaceId');
      _navigateToWorkspace(workspaceId!, threadId);
    }
  }

  /// 🚀 Navigate to a specific workspace (and optionally thread)
  void _navigateToWorkspace(String workspaceId, String? threadId) {
    print('🚀 Navigating to workspace: $workspaceId, thread: $threadId');

    // Set the workspace - this will trigger navigation in build()
    setState(() {
      _selectedWorkspace = {
        'id': workspaceId,
        'name': 'Loading...', // Will be populated when workspace loads
        'deepLinkThreadId': threadId, // Pass thread ID for further navigation
      };
    });

    // Show feedback to user
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(threadId != null
              ? 'Opening conversation...'
              : 'Opening workspace...'),
          duration: const Duration(seconds: 2),
          backgroundColor: Colors.blue.shade600,
        ),
      );
    }
  }

  /// 💬 SHOW INVITE DIALOG: Display workspace invitation
  void _showInviteDialog(String token) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Workspace Invitation'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('You\'ve been invited to join a workspace!'),
            const SizedBox(height: 16),
            Text(
              'Token: $token',
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 12,
                color: Colors.grey,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              setState(() {
                _pendingInviteToken = null;
              });
              Navigator.pop(context);
            },
            child: const Text('Dismiss'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              // TODO: Implement workspace invitation acceptance API call
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Invitation acceptance coming soon!'),
                  backgroundColor: Colors.blue,
                ),
              );
              setState(() {
                _pendingInviteToken = null;
              });
            },
            child: const Text('Accept'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        // Show loading while checking auth state
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }
        
        // Show login screen if not authenticated
        if (!snapshot.hasData || snapshot.data == null) {
          return const LoginScreen();
        }
        
        // Show workspace selection if authenticated and no workspace selected
        if (_selectedWorkspace == null) {
          return WorkspaceSelectionScreen(
            onSignOut: () async {
              try {
                await FirebaseAuth.instance.signOut();
                setState(() {
                  _selectedWorkspace = null;
                });
              } catch (e) {
                print('❌ Sign out error: $e');
              }
            },
            onSelectWorkspace: (workspace) {
              setState(() {
                _selectedWorkspace = workspace;
              });
              print('✅ Selected workspace: ${workspace['name']}');
            },
          );
        }
        
        // Show thread list/channel view for selected workspace
        return ThreadListScreen(
          workspace: _selectedWorkspace!,
          onBack: () {
            setState(() {
              _selectedWorkspace = null;
            });
          },
          onWorkspaceChannelSelect: (workspace, thread) {
            // Switch to the new workspace and let the thread list handle the channel
            setState(() {
              _selectedWorkspace = {
                'id': workspace.id,
                'name': workspace.name,
                'description': workspace.description,
                'owner_id': workspace.ownerId,
                'role': workspace.role,
                'user_role': workspace.role,
                'member_count': workspace.memberCount,
                'channel_count': workspace.channelCount,
                'settings': workspace.settings,
                'initialChannelId': thread.id,
                'initialChannelName': thread.name,
              };
            });
          },
        );
      },
    );
  }
}

/// 🏗️ PLACEHOLDER: Thread/Channel List Screen
class _ThreadListScreen extends StatelessWidget {
  final Map<String, dynamic> workspace;
  final VoidCallback onBack;
  
  const _ThreadListScreen({
    required this.workspace,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: onBack,
        ),
        title: Text(workspace['name'] ?? 'Workspace'),
        backgroundColor: Colors.blue.shade600,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.construction_rounded,
                size: 80,
                color: Colors.grey.shade400,
              ),
              const SizedBox(height: 24),
              Text(
                'Channel List Coming Soon!',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey.shade700,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                'You successfully selected:\n${workspace['name']}',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey.shade600,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                'Workspace ID: ${workspace['id']}',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey.shade500,
                  fontFamily: 'monospace',
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              ElevatedButton.icon(
                onPressed: onBack,
                icon: const Icon(Icons.arrow_back),
                label: const Text('Back to Workspaces'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue.shade600,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '✅ Phase 3 (95% Complete)\n🏗️ Phase 4: Revolutionary Features (Next)',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade500,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 🎯 SIMPLE HARDCODED SCREEN TO PROVE APP LAUNCHES
class _DiagnosticScreen extends StatelessWidget {
  const _DiagnosticScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                // 🎨 CREW BRANDING
                const Icon(
                  Icons.group,
                  size: 120,
                  color: Colors.blue,
                ),
                const SizedBox(height: 32),
                
                // 🏆 APP TITLE
                const Text(
                  'Crew',
                  style: TextStyle(
                    fontSize: 48,
                    fontWeight: FontWeight.bold,
                    color: Colors.blue,
                  ),
                ),
                const SizedBox(height: 16),
                
                // 🎯 DIAGNOSTIC MESSAGE
                const Text(
                  'Revolutionary Team Chat',
                  style: TextStyle(
                    fontSize: 20,
                    color: Colors.grey,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 48),
                
                // ✅ SUCCESS INDICATOR
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.green, width: 2),
                  ),
                  child: const Column(
                    children: [
                      Icon(
                        Icons.check_circle,
                        color: Colors.green,
                        size: 48,
                      ),
                      SizedBox(height: 16),
                      Text(
                        '✅ APP LAUNCHED SUCCESSFULLY',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.green,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: 8),
                      Text(
                        'No white screen! Flutter UI is working.',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 48),
                
                // 🔍 DIAGNOSTIC INFO
                const Text(
                  'STEP 1: Hardcoded Screen Test',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'This screen proves:\n'
                  '• iOS deployment works\n'
                  '• iPhone can run the app\n'
                  '• Flutter UI renders correctly\n'
                  '• No Firebase dependencies',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 48),
                
                // 🎯 NEXT STEP INDICATOR
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.arrow_forward, color: Colors.blue),
                      SizedBox(width: 12),
                      Text(
                        'Ready for Step 2',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.blue,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
