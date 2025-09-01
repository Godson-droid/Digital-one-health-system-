import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Components
import BlockchainStats from './components/BlockchainStats';
import BlockchainVerification from './components/BlockchainVerification';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AuthModal from './components/AuthModal';
import MFASetup from './components/MFASetup';

// Backend URL configuration with environment detection
const getBackendUrl = () => {
  // Check if we're in development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8001';
  }
  // Production URL
  return 'https://digital-one-health-system-cjum.onrender.com';
};

const BACKEND_URL = getBackendUrl();
const API = `${BACKEND_URL}/api`;

// Enhanced axios configuration with better timeout and error handling
axios.defaults.timeout = 45000; // 45 seconds
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Add request interceptor for debugging
axios.interceptors.request.use(
  (config) => {
    console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging and error handling
axios.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', error.response?.status, error.response?.data || error.message);
    
    // Handle specific error types
    if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout - please check your connection');
    } else if (error.response?.status === 0) {
      toast.error('Network error - cannot reach server');
    } else if (error.response?.status >= 500) {
      toast.error('Server error - please try again later');
    }
    
    return Promise.reject(error);
  }
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [systemStatus, setSystemStatus] = useState(null);

  // Check authentication status on app load
  useEffect(() => {
    checkAuthStatus();
    checkSystemStatus();
    
    // Set up periodic connection monitoring
    const interval = setInterval(checkSystemStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkSystemStatus = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 15000 });
      setConnectionStatus('connected');
      setSystemStatus(response.data);
    } catch (error) {
      console.error('System status check failed:', error);
      setConnectionStatus('disconnected');
      setSystemStatus(null);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        
        // Verify token is still valid
        const response = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000
        });
        
        if (response.data) {
          setUser(parsedUser);
        } else {
          // Token invalid, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Clear invalid tokens
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setShowAuthModal(false);
    toast.success(`Welcome back, ${userData.full_name || userData.username}!`);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.info('Logged out successfully');
  };

  const openAuthModal = (mode = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg font-medium">Loading Digital One Health...</p>
          <p className="text-gray-500 text-sm mt-2">Initializing secure health platform</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
        {/* Connection Status Indicator */}
        <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          connectionStatus === 'connected' ? 'bg-green-500' : 
          connectionStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
        } text-white text-center py-1 text-sm`}>
          {connectionStatus === 'connected' && '🟢 Connected to Digital One Health System'}
          {connectionStatus === 'disconnected' && '🔴 Connection Lost - Retrying...'}
          {connectionStatus === 'checking' && '🟡 Checking Connection...'}
        </div>

        <div className="pt-8">
          <Routes>
            <Route 
              path="/" 
              element={
                user ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <LandingPage 
                    onLogin={() => openAuthModal('login')}
                    onRegister={() => openAuthModal('register')}
                    systemStatus={systemStatus}
                  />
                )
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                user ? (
                  <Dashboard 
                    user={user} 
                    onLogout={handleLogout}
                    onShowMFASetup={() => setShowMFASetup(true)}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
          </Routes>
        </div>

        {/* Auth Modal */}
        {showAuthModal && (
          <AuthModal
            mode={authMode}
            onClose={() => setShowAuthModal(false)}
            onLogin={handleLogin}
            onSwitchMode={(mode) => setAuthMode(mode)}
          />
        )}

        {/* MFA Setup Modal */}
        {showMFASetup && user && (
          <MFASetup
            user={user}
            onClose={() => setShowMFASetup(false)}
            onMFAEnabled={() => {
              setShowMFASetup(false);
              toast.success('MFA enabled successfully!');
            }}
          />
        )}

        {/* Toast Notifications */}
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          toastClassName="rounded-xl"
        />
      </div>
    </Router>
  );
}

export default App;