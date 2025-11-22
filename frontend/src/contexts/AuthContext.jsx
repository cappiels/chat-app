import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;
    let authResolved = false;
    
    const resolveAuth = async (user) => {
      if (authResolved || !isMounted) return;
      authResolved = true;
      
      // Transform Firebase user to include token for API calls
      if (user) {
        try {
          const token = await user.getIdToken();
          if (isMounted) {
            setUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              token: token
            });
            setLoading(false);
            console.log('🔐 Auth resolved: signed in with token');
          }
        } catch (error) {
          console.error('Error getting user token:', error);
          if (isMounted) {
            setUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              token: null
            });
            setLoading(false);
            console.log('🔐 Auth resolved: signed in without token');
          }
        }
      } else {
        setUser(null);
        setLoading(false);
        console.log('🔐 Auth resolved: signed out');
      }
    };

    unsubscribe = onAuthStateChanged(auth, resolveAuth, (error) => {
      console.error('❌ Auth error:', error);
      resolveAuth(null);
    });

    // Fast timeout for immediate UI response
    const timeoutId = setTimeout(() => {
      if (!authResolved && isMounted) {
        console.log('⚡ Auth timeout: proceeding with current state');
        resolveAuth(auth.currentUser);
      }
    }, 1000);

    return () => {
      isMounted = false;
      authResolved = true;
      clearTimeout(timeoutId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Immediately update user state for instant UI response
      const token = await result.user.getIdToken();
      setUser({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        token: token
      });
      setLoading(false);
      
      toast.success(`Welcome, ${result.user.displayName}! 🎉`);
      return result.user;
    } catch (error) {
      console.error("Error signing in with Google", error);
      toast.error("Failed to sign in. Please try again.");
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Error signing out", error);
      toast.error("Failed to sign out");
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    handleSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
