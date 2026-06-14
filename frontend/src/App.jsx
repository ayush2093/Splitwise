import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import ExpenseDetail from './pages/ExpenseDetail';
import Landing from './pages/Landing';
import ImportWizard from './pages/ImportWizard';
import ImportReports from './pages/ImportReports';

function AppContent() {
  const { user, loading } = useAuth();
  // State trigger to force sidebar to re-fetch groups when a new group is created or members are updated
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

  const triggerSidebarRefresh = () => {
    setSidebarRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <h2>Loading Splitwise...</h2>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-container">
      <div className="app-shell">
        <Sidebar refreshTrigger={sidebarRefreshTrigger} onGroupCreated={triggerSidebarRefresh} />
        <Routes>
          <Route path="/" element={<Dashboard onSeed={triggerSidebarRefresh} />} />
          <Route path="/group/:id" element={<GroupDetail onGroupUpdated={triggerSidebarRefresh} />} />
          <Route path="/expense/:id" element={<ExpenseDetail />} />
          <Route path="/import" element={<ImportWizard onImportSuccess={triggerSidebarRefresh} />} />
          <Route path="/reports" element={<ImportReports />} />
          <Route path="/reports/:id" element={<ImportReports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
