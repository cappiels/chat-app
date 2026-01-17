import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../data/services/http_client.dart';

const String siteAdminEmail = 'cappiels@gmail.com';

class BroadcastScreen extends ConsumerStatefulWidget {
  const BroadcastScreen({super.key});

  @override
  ConsumerState<BroadcastScreen> createState() => _BroadcastScreenState();
}

class _BroadcastScreenState extends ConsumerState<BroadcastScreen> {
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  bool _sending = false;
  String? _resultMessage;
  bool _isSuccess = false;

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  bool get _isAdmin {
    final user = FirebaseAuth.instance.currentUser;
    return user?.email == siteAdminEmail;
  }

  Future<void> _sendBroadcast() async {
    final title = _titleController.text.trim();
    final body = _bodyController.text.trim();

    if (title.isEmpty || body.isEmpty) {
      setState(() {
        _resultMessage = 'Title and message are required';
        _isSuccess = false;
      });
      return;
    }

    setState(() {
      _sending = true;
      _resultMessage = null;
    });

    try {
      final httpClient = ref.read(httpClientProvider);
      final response = await httpClient.post(
        '/push/broadcast',
        data: {
          'title': title,
          'body': body,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        setState(() {
          _resultMessage = data['message'] ?? 'Broadcast sent successfully';
          _isSuccess = true;
        });
        // Clear form on success
        _titleController.clear();
        _bodyController.clear();
      } else {
        setState(() {
          _resultMessage = response.data?['error'] ?? 'Failed to send broadcast';
          _isSuccess = false;
        });
      }
    } catch (e) {
      setState(() {
        _resultMessage = e.toString();
        _isSuccess = false;
      });
    } finally {
      setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isAdmin) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Broadcast'),
        ),
        body: const Center(
          child: Text(
            'Admin access required',
            style: TextStyle(color: Colors.grey),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Broadcast Notification'),
        backgroundColor: Colors.purple.shade600,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header info
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.purple.shade50, Colors.indigo.shade50],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.purple.shade100),
                ),
                child: Row(
                  children: [
                    Icon(Icons.broadcast_on_home, color: Colors.purple.shade600, size: 32),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Send Broadcast',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                              color: Colors.purple.shade800,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Push notification to all users with registered devices',
                            style: TextStyle(
                              color: Colors.purple.shade600,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Title field
              Text(
                'Title',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade800,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _titleController,
                decoration: InputDecoration(
                  hintText: 'Notification title...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.purple.shade400, width: 2),
                  ),
                ),
                maxLength: 100,
              ),

              const SizedBox(height: 16),

              // Body field
              Text(
                'Message',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade800,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _bodyController,
                decoration: InputDecoration(
                  hintText: 'Enter your message...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.purple.shade400, width: 2),
                  ),
                ),
                maxLines: 4,
                maxLength: 500,
              ),

              const SizedBox(height: 16),

              // Result message
              if (_resultMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _isSuccess ? Colors.green.shade50 : Colors.red.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _isSuccess ? Colors.green.shade200 : Colors.red.shade200,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _isSuccess ? Icons.check_circle : Icons.error,
                        color: _isSuccess ? Colors.green.shade600 : Colors.red.shade600,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _resultMessage!,
                          style: TextStyle(
                            color: _isSuccess ? Colors.green.shade700 : Colors.red.shade700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              const SizedBox(height: 24),

              // Send button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _sending ? null : _sendBroadcast,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.purple.shade600,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    disabledBackgroundColor: Colors.grey.shade300,
                  ),
                  child: _sending
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.send),
                            SizedBox(width: 8),
                            Text(
                              'Send Broadcast',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 16,
                              ),
                            ),
                          ],
                        ),
                ),
              ),

              const SizedBox(height: 12),

              // Info text
              Center(
                child: Text(
                  'This will send to all users with push notifications enabled',
                  style: TextStyle(
                    color: Colors.grey.shade600,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
