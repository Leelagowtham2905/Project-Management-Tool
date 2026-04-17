import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import Login from './pages/Login';

import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import MyIssues from './pages/MyIssues';
import Inbox from './pages/Inbox';
import GlobalSprints from './pages/GlobalSprints';
import Sidebar from './components/Sidebar';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(!!localStorage.getItem('token'));
    };
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  const ProtectedRoute = ({ children }) => {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <Sidebar onLogout={() => {
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          window.location.href = '/login';
        }} />
        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
          {children}
        </main>
      </div>
    );
  };


  return (
    <Router>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login onLogin={() => setIsAuthenticated(true)} /> : <Navigate to="/" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
        
        <Route path="/" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
        <Route path="/project/:projectId" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/my-issues" element={<ProtectedRoute><MyIssues /></ProtectedRoute>} />
        <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
        <Route path="/sprints" element={<ProtectedRoute><GlobalSprints /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
};

export default App;
