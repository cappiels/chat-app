import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'auth/login_screen.dart';
import 'workspace/workspace_selection_screen.dart';
import 'threads/thread_list_screen.dart';

/// 🏆 STEP 2: REAL APP WITH FIREBASE AUTHENTICATION
class MainApp extends ConsumerStatefulWidget {
  const MainApp({super.key});

  @override
  ConsumerState<MainApp> createState() => _MainAppState();
}

class _MainAppState extends ConsumerState<MainApp> {
  Map<String, dynamic>? _selectedWorkspace;

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
