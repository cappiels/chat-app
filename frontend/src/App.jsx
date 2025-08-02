import { useState } from 'react';
import { auth, googleProvider } from './firebase'; // Import from our new file
import { signInWithPopup, signOut } from "firebase/auth";
import './App.css';

function App() {
  const [user, setUser] = useState(null); // State to hold the logged-in user
  const [workspaceName, setWorkspaceName] = useState('');
  const [message, setMessage] = useState('');

  // --- Authentication Functions ---
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      setMessage(`Welcome, ${result.user.displayName}!`);
    } catch (error) {
      console.error("Error signing in with Google", error);
      setMessage("Failed to sign in.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setMessage("You have been signed out.");
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  // --- Workspace Creation Function (Unchanged) ---
  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    setMessage('Creating...');
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workspaceName }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create workspace: ${errorText}`);
      }
      const data = await response.json();
      setMessage(`Successfully created workspace: ${data.name} (ID: ${data.id})`);
      setWorkspaceName('');
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="App">
      {/* --- Conditional UI: Show Login or Main App --- */}
      {!user ? (
        <div>
          <h1>Welcome to Chat App</h1>
          <button onClick={signInWithGoogle}>Sign in with Google</button>
        </div>
      ) : (
        <div>
          <h1>Chat App</h1>
          <p>Hello, {user.displayName} ({user.email})</p>
          <button onClick={handleSignOut}>Sign Out</button>
          <hr />
          <h2>Create a New Workspace</h2>
          <form onSubmit={handleCreateWorkspace}>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Enter workspace name"
              required
            />
            <button type="submit">Create Workspace</button>
          </form>
        </div>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}

export default App;