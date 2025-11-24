import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../core/config/api_config.dart';
import 'http_client.dart';

// Provider for auth service
final authServiceProvider = Provider<AuthService>((ref) {
  final httpClient = ref.read(httpClientProvider);
  return AuthService(httpClient);
});

// Provider for Firebase Auth instance
final firebaseAuthProvider = Provider<FirebaseAuth>((ref) {
  return FirebaseAuth.instance;
});

// Provider for current user stream
final authStateProvider = StreamProvider<User?>((ref) {
  final auth = ref.read(firebaseAuthProvider);
  return auth.authStateChanges();
});

// Provider for current user (sync)
final currentUserProvider = Provider<User?>((ref) {
  final authState = ref.watch(authStateProvider);
  return authState.when(
    data: (user) => user,
    loading: () => null,
    error: (_, __) => null,
  );
});

class AuthService {
  final HttpClient _httpClient;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: [
      'email',
      'profile',
    ],
  );

  AuthService(this._httpClient);

  // Current user getter
  User? get currentUser => _auth.currentUser;

  // Check if user is signed in
  bool get isSignedIn => currentUser != null;

  // Get current user ID token
  Future<String?> get idToken async {
    final user = currentUser;
    if (user != null) {
      try {
        return await user.getIdToken();
      } catch (e) {
        if (ApiConfig.enableApiLogging) {
          print('Failed to get ID token: $e');
        }
        return null;
      }
    }
    return null;
  }

  // Sign in with Google
  Future<UserCredential?> signInWithGoogle() async {
    try {
      // Sign out first to force account selection
      await _googleSignIn.signOut();
      
      // Trigger the Google Sign-In flow with account selection
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      
      if (googleUser == null) {
        // User cancelled the sign-in
        if (ApiConfig.enableApiLogging) {
          print('Google sign-in cancelled by user');
        }
        return null;
      }

      // Obtain the auth details from the request
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;

      // Create a new credential for Firebase
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Sign in to Firebase with the Google credential
      final UserCredential userCredential = await _auth.signInWithCredential(credential);
      
      if (userCredential.user != null) {
        // Sync user with backend
        await _syncUserWithBackend(userCredential.user!);
      }
      
      return userCredential;
    } catch (e) {
      if (ApiConfig.enableApiLogging) {
        print('Google sign-in error: $e');
      }
      rethrow;
    }
  }

  // Sign in with email and password (if you want to support this)
  Future<UserCredential?> signInWithEmailPassword({
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      
      if (credential.user != null) {
        await _syncUserWithBackend(credential.user!);
      }
      
      return credential;
    } catch (e) {
      if (ApiConfig.enableApiLogging) {
        print('Email sign-in error: $e');
      }
      rethrow;
    }
  }

  // Sign up with email and password (if you want to support this)
  Future<UserCredential?> signUpWithEmailPassword({
    required String email,
    required String password,
    String? displayName,
  }) async {
    try {
      final credential = await _auth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );
      
      // Update display name if provided
      if (displayName != null && credential.user != null) {
        await credential.user!.updateDisplayName(displayName);
      }
      
      if (credential.user != null) {
        await _syncUserWithBackend(credential.user!);
      }
      
      return credential;
    } catch (e) {
      if (ApiConfig.enableApiLogging) {
        print('Email sign-up error: $e');
      }
      rethrow;
    }
  }

  // Sign out
  Future<void> signOut() async {
    try {
      // Sign out from both Google and Firebase
      await Future.wait([
        _googleSignIn.signOut(),
        _auth.signOut(),
      ]);
      
      if (ApiConfig.enableApiLogging) {
        print('✅ Successfully signed out from Google and Firebase');
      }
    } catch (e) {
      if (ApiConfig.enableApiLogging) {
        print('Sign-out error: $e');
      }
      rethrow;
    }
  }

  // Sync user with backend (create or update user record)
  Future<void> _syncUserWithBackend(User user) async {
    try {
      final userData = {
        'uid': user.uid,
        'email': user.email,
        'displayName': user.displayName,
        'photoURL': user.photoURL,
        'emailVerified': user.emailVerified,
        'lastLoginAt': DateTime.now().toIso8601String(),
      };

      await _httpClient.post(
        '${ApiConfig.users}/sync',
        data: userData,
      );
    } catch (e) {
      if (ApiConfig.enableApiLogging) {
        print('Backend sync error: $e');
      }
      // Don't throw here - authentication should succeed even if backend sync fails
    }
  }

  // Check if user is admin (for admin features)
  Future<bool> isAdmin() async {
    try {
      final user = currentUser;
      if (user == null) return false;

      // Check if user email is the admin email
      const adminEmail = 'cappiels@gmail.com';
      if (user.email == adminEmail) return true;

      // Also check with backend for additional admin users
      final response = await _httpClient.get('${ApiConfig.users}/admin-status');
      return response.data['isAdmin'] ?? false;
    } catch (e) {
      return false;
    }
  }

  // Get user profile from backend
  Future<Map<String, dynamic>?> getUserProfile() async {
    try {
      final response = await _httpClient.get('${ApiConfig.users}/profile');
      return response.data;
    } catch (e) {
      if (ApiConfig.enableApiLogging) {
        print('Get user profile error: $e');
      }
      return null;
    }
  }

  // Update user profile
  Future<bool> updateUserProfile({
    String? displayName,
    String? photoURL,
  }) async {
    try {
      final user = currentUser;
      if (user == null) return false;

      // Update Firebase profile
      if (displayName != null || photoURL != null) {
        await user.updateProfile(
          displayName: displayName,
          photoURL: photoURL,
        );
      }

      // Update backend profile
      final updateData = <String, dynamic>{};
      if (displayName != null) updateData['displayName'] = displayName;
      if (photoURL != null) updateData['photoURL'] = photoURL;

      if (updateData.isNotEmpty) {
        await _httpClient.put(
          '${ApiConfig.users}/profile',
          data: updateData,
        );
      }

      return true;
    } catch (e) {
      if (ApiConfig.enableApiLogging) {
        print('Update profile error: $e');
      }
      return false;
    }
  }

  // Delete user account
  Future<bool> deleteAccount() async {
    try {
      final user = currentUser;
      if (user == null) return false;

      // Delete from backend first
      await _httpClient.delete('${ApiConfig.users}/account');

      // Delete from Firebase
      await user.delete();

      return true;
    } catch (e) {
      if (ApiConfig.enableApiLogging) {
        print('Delete account error: $e');
      }
      return false;
    }
  }

  // Send email verification
  Future<void> sendEmailVerification() async {
    try {
      final user = currentUser;
      if (user != null && !user.emailVerified) {
        await user.sendEmailVerification();
      }
    } catch (e) {
      if (ApiConfig.enableApiLogging) {
        print('Send email verification error: $e');
      }
      rethrow;
    }
  }

  // Send password reset email
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email);
    } catch (e) {
      if (ApiConfig.enableApiLogging) {
        print('Send password reset error: $e');
      }
      rethrow;
    }
  }

  // Reload current user
  Future<void> reloadUser() async {
    try {
      final user = currentUser;
      if (user != null) {
        await user.reload();
      }
    } catch (e) {
      if (ApiConfig.enableApiLogging) {
        print('Reload user error: $e');
      }
    }
  }
}

// Auth state notifier for Riverpod state management
class AuthStateNotifier extends StateNotifier<AsyncValue<User?>> {
  final AuthService _authService;
  
  AuthStateNotifier(this._authService) : super(const AsyncValue.loading()) {
    _init();
  }
  
  void _init() {
    FirebaseAuth.instance.authStateChanges().listen(
      (user) => state = AsyncValue.data(user),
      onError: (error, stackTrace) => state = AsyncValue.error(error, stackTrace),
    );
  }
  
  Future<void> signInWithGoogle() async {
    state = const AsyncValue.loading();
    try {
      final result = await _authService.signInWithGoogle();
      state = AsyncValue.data(result?.user);
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }
  
  Future<void> signOut() async {
    await _authService.signOut();
  }
}

// Provider for auth state notifier
final authStateNotifierProvider = StateNotifierProvider<AuthStateNotifier, AsyncValue<User?>>((ref) {
  final authService = ref.read(authServiceProvider);
  return AuthStateNotifier(authService);
});
