import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'dart:async';
import 'package:uni_links/uni_links.dart';
import 'firebase_options.dart';
import 'presentation/screens/main_app.dart';
import 'data/services/push_notification_service.dart';

void main() async {
  // Catch ALL errors to prevent white screen
  FlutterError.onError = (details) {
    print('❌ Flutter Error: ${details.exceptionAsString()}');
  };

  WidgetsFlutterBinding.ensureInitialized();

  // 🏆 FIREBASE INITIALIZATION: Properly configured with FlutterFire CLI
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    print('✅ Firebase initialized successfully');

    // Set up background message handler (must be done before runApp)
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    print('✅ Firebase Messaging background handler registered');
  } catch (e) {
    print('⚠️ Firebase initialization failed: $e');
    // App continues even if Firebase fails - graceful degradation
  }

  print('🚀 Starting Crew Mobile App');

  // 🚀 BEST PRACTICE: ProviderScope for world-class state management
  runApp(const ProviderScope(child: CrewMobileApp()));
}

/// 🏆 BEST PRACTICE: Clean, focused app widget with single responsibility
class CrewMobileApp extends StatelessWidget {
  const CrewMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Crew - Revolutionary Team Chat',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      // Wrap in error boundary
      home: ErrorBoundary(
        child: const MainApp(),
      ),
    );
  }
}

/// Error boundary to catch and display errors
class ErrorBoundary extends StatefulWidget {
  final Widget child;
  
  const ErrorBoundary({super.key, required this.child});
  
  @override
  State<ErrorBoundary> createState() => _ErrorBoundaryState();
}

class _ErrorBoundaryState extends State<ErrorBoundary> {
  Object? _error;
  
  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 64, color: Colors.red),
                  const SizedBox(height: 24),
                  const Text(
                    'App Error',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _error.toString(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 14),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () {
                      setState(() {
                        _error = null;
                      });
                    },
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    
    return widget.child;
  }
  
  @override
  void initState() {
    super.initState();
    FlutterError.onError = (details) {
      setState(() {
        _error = details.exception;
      });
    };
  }
}
