import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { User } from './types';
import * as api from './services/api';
import './index.css';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for a logged-in user in session storage
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = async (username: string, password: string): Promise<{ success: boolean, message?: string }> => {
    const result = await api.login(username, password);
    if (result.success && result.user) {
      setCurrentUser(result.user);
      sessionStorage.setItem('currentUser', JSON.stringify(result.user));
      return { success: true };
    }
    return { success: false, message: result.message };
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('currentUser');
  };

  return (
    <div className="App bg-slate-900 text-slate-200 min-h-screen">
      {currentUser ? (
        <Dashboard user={currentUser} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
