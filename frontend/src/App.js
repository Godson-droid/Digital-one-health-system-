import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import QRCode from 'react-qr-code';
import axios from 'axios';
import BlockchainVerification from './components/BlockchainVerification';
import BlockchainStats from './components/BlockchainStats';
import './App.css';

// Set backend URL with fallback - Updated for deployment
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 
  (window.location.hostname === 'localhost' ? 'http://localhost:8001' : window.location.origin);
const API = `${BACKEND_URL}/api`;

// Configure axios defaults with increased timeout and better error handling
axios.defaults.timeout = 30000; // Increased to 30 seconds
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Add request interceptor for debugging
axios.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to: ${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with better error handling
axios.interceptors.response.use(
  (response) => {
    console.log(`Response received from: ${response.config.url} - Status: ${response.status}`);
    return response;
  },
  (error) => {
    console.error('API Error Details:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code
    });

    // Handle different types of errors
    if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout - server may be slow. Please try again.');
    } else if (error.code === 'ERR_NETWORK') {
      toast.error('Network error - please check your connection and try again.');
    } else if (error.response?.status === 500) {
      toast.error('Server error - please try again later.');
    } else if (error.response?.status === 503) {
      toast.error('Service unavailable - server may be starting up.');
    } else if (error.response?.status === 408) {
      toast.error('Request timeout - please try again.');
    } else if (error.response?.status >= 400 && error.response?.status < 500) {
      // Client errors - show specific message if available
      const message = error.response?.data?.detail || error.response?.data?.message || 'Client error occurred';
      toast.error(message);
    } else if (!error.response) {
      toast.error('Unable to connect to server. Please check if the server is running.');
    }
    
    return Promise.reject(error);
  }
);

// Authentication Context
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');

  // Test backend connection on startup
  useEffect(() => {
    testBackendConnection();
  }, []);

  const testBackendConnection = async () => {
    try {
      console.log('Testing backend connection to:', BACKEND_URL);
      const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 10000 });
      console.log('Backend connection successful:', response.data);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Backend connection failed:', error);
      setConnectionStatus('disconnected');
      toast.error('Unable to connect to backend server. Please check if the server is running.');
    }
  };

  useEffect(() => {
    if (token && connectionStatus === 'connected') {
      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Decode token to get user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData && userData.id && payload.exp > Date.now() / 1000) {
          setUser(userData);
        } else {
          logout();
        }
      } catch (error) {
        console.error('Token validation error:', error);
        logout();
      }
    }
    setLoading(false);
  }, [token, connectionStatus]);

  const login = (tokenData) => {
    try {
      setToken(tokenData.access_token);
      setUser(tokenData.user);
      localStorage.setItem('token', tokenData.access_token);
      localStorage.setItem('user', JSON.stringify(tokenData.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${tokenData.access_token}`;
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  };

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token && !!user,
    connectionStatus,
    testBackendConnection
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application...</p>
          {connectionStatus === 'checking' && (
            <p className="text-sm text-gray-500 mt-2">Testing backend connection...</p>
          )}
          {connectionStatus === 'disconnected' && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 font-medium">Backend Connection Failed</p>
              <p className="text-red-500 text-sm mt-1">
                Unable to connect to: {BACKEND_URL}
              </p>
              <button 
                onClick={testBackendConnection}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Professional Navigation Component
const Navigation = () => {
  const { user, logout, connectionStatus } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  if (!user) return null;

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      healthcare_provider: 'bg-blue-100 text-blue-800',
      researcher: 'bg-green-100 text-green-800',
      individual: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || colors.individual;
  };

  return (
    <nav className="professional-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="nav-brand">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">🏥</span>
              </div>
              <div>
                <div className="text-white font-bold text-lg">Digital One Health</div>
                <div className="nav-subtitle">Secure Health Data Platform</div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Connection Status Indicator */}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs ${
              connectionStatus === 'connected' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span>{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-3">
              <span className="text-white text-sm">Welcome, {user?.full_name || 'User'}</span>
              <span className={`status-badge ${getRoleColor(user?.role)}`}>
                {user?.role?.replace('_', ' ') || 'unknown'}
              </span>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="btn-professional btn-secondary text-white border-white border-opacity-20 hover:bg-white hover:bg-opacity-10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Menu
              </button>
              
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200">
                  <div className="md:hidden px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                    <p className="text-xs text-gray-500">{user?.role?.replace('_', ' ')}</p>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setShowDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Professional Login Component
const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    mfa_token: ''
  });
  const [needsMFA, setNeedsMFA] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, connectionStatus, testBackendConnection } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (connectionStatus !== 'connected') {
      toast.error('Backend server is not connected. Please wait or refresh the page.');
      return;
    }
    
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, formData);
      login(response.data);
      toast.success('Welcome to Digital One Health!');
    } catch (error) {
      console.error('Login error:', error);
      if (error.response?.data?.detail === 'MFA token required') {
        setNeedsMFA(true);
        toast.info('Please enter your MFA token');
      } else {
        toast.error(error.response?.data?.detail || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-2xl text-white">🏥</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Digital One Health
          </h2>
          <p className="text-gray-600">
            Secure health data management with blockchain integrity
          </p>
          
          {/* Connection Status */}
          <div className={`mt-4 p-3 rounded-lg ${
            connectionStatus === 'connected' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center justify-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className={`text-sm font-medium ${
                connectionStatus === 'connected' ? 'text-green-800' : 'text-red-800'
              }`}>
                {connectionStatus === 'connected' ? 'Server Connected' : 'Server Disconnected'}
              </span>
            </div>
            {connectionStatus === 'disconnected' && (
              <button 
                onClick={testBackendConnection}
                className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
              >
                Retry Connection
              </button>
            )}
          </div>
        </div>
        
        <div className="professional-card p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="form-label-professional">Username</label>
              <input
                type="text"
                required
                className="form-input-professional"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                placeholder="Enter your username"
                disabled={connectionStatus !== 'connected'}
              />
            </div>
            
            <div>
              <label className="form-label-professional">Password</label>
              <input
                type="password"
                required
                className="form-input-professional"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Enter your password"
                disabled={connectionStatus !== 'connected'}
              />
            </div>
            
            {needsMFA && (
              <div className="fade-in">
                <label className="form-label-professional">
                  Multi-Factor Authentication Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter 6-digit code"
                  className="form-input-professional"
                  value={formData.mfa_token}
                  onChange={(e) => setFormData({...formData, mfa_token: e.target.value})}
                  disabled={connectionStatus !== 'connected'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  ⏱️ Note: This system uses 90-second intervals
                </p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading || connectionStatus !== 'connected'}
              className="btn-professional btn-primary w-full"
            >
              {loading ? (
                <>
                  <div className="loading-spinner w-4 h-4"></div>
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m0 0v3a2 2 0 002 2h6a2 2 0 002-2v-6a2 2 0 00-2-2h-3" />
                  </svg>
                  Sign In
                </>
              )}
            </button>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => window.location.href = '/register'}
                className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                disabled={connectionStatus !== 'connected'}
              >
                Don't have an account? Create one here
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Professional Register Component
const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'individual'
  });
  const [loading, setLoading] = useState(false);
  const { connectionStatus } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (connectionStatus !== 'connected') {
      toast.error('Backend server is not connected. Please wait or refresh the page.');
      return;
    }
    
    setLoading(true);

    try {
      await axios.post(`${API}/auth/register`, formData);
      toast.success('Account created successfully! Please sign in.');
      window.location.href = '/login';
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'individual', label: 'Individual', icon: '👤' },
    { value: 'healthcare_provider', label: 'Healthcare Provider', icon: '👨‍⚕️' },
    { value: 'researcher', label: 'Researcher', icon: '🔬' },
    { value: 'admin', label: 'Administrator', icon: '⚙️' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-2xl text-white">🏥</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Create Account
          </h2>
          <p className="text-gray-600">
            Join the secure health data platform
          </p>
        </div>
        
        <div className="professional-card p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="form-label-professional">Full Name</label>
              <input
                type="text"
                required
                className="form-input-professional"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                placeholder="Enter your full name"
                disabled={connectionStatus !== 'connected'}
              />
            </div>
            
            <div>
              <label className="form-label-professional">Username</label>
              <input
                type="text"
                required
                className="form-input-professional"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                placeholder="Choose a username"
                disabled={connectionStatus !== 'connected'}
              />
            </div>
            
            <div>
              <label className="form-label-professional">Email Address</label>
              <input
                type="email"
                required
                className="form-input-professional"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="Enter your email"
                disabled={connectionStatus !== 'connected'}
              />
            </div>
            
            <div>
              <label className="form-label-professional">Password</label>
              <input
                type="password"
                required
                className="form-input-professional"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Create a secure password"
                disabled={connectionStatus !== 'connected'}
              />
            </div>
            
            <div>
              <label className="form-label-professional">Role</label>
              <select
                required
                className="form-input-professional"
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                disabled={connectionStatus !== 'connected'}
              >
                {roleOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              type="submit"
              disabled={loading || connectionStatus !== 'connected'}
              className="btn-professional btn-primary w-full"
            >
              {loading ? (
                <>
                  <div className="loading-spinner w-4 h-4"></div>
                  Creating Account...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Create Account
                </>
              )}
            </button>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => window.location.href = '/login'}
                className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                disabled={connectionStatus !== 'connected'}
              >
                Already have an account? Sign in here
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Professional Dashboard Component
const Dashboard = () => {
  const { user, connectionStatus } = useAuth();
  const [records, setRecords] = useState([]);
  const [showCreateRecord, setShowCreateRecord] = useState(false);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [showBlockchainVerification, setShowBlockchainVerification] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      fetchHealthRecords();
    }
  }, [connectionStatus]);

  const fetchHealthRecords = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/health-records`);
      setRecords(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch health records:', error);
      toast.error('Failed to fetch health records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecord = (recordId) => {
    if (recordId) {
      setSelectedRecordId(recordId);
      setShowBlockchainVerification(true);
    }
  };

  const getRecordTypeIcon = (type) => {
    const icons = {
      human: '👤',
      animal: '🐕',
      plant: '🌱'
    };
    return icons[type] || '📄';
  };

  const getRecordTypeClass = (type) => {
    const classes = {
      human: 'record-type-human',
      animal: 'record-type-animal',
      plant: 'record-type-plant'
    };
    return classes[type] || 'record-type-human';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (connectionStatus !== 'connected') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Backend Connection Lost</h3>
          <p className="text-gray-600 mb-4">Unable to connect to the backend server.</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-professional btn-primary"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Blockchain Stats */}
        <div className="mb-8 fade-in">
          <BlockchainStats />
        </div>

        {/* Action Buttons */}
        <div className="mb-8 flex flex-wrap gap-4">
          {(user.role === 'healthcare_provider' || user.role === 'individual') && (
            <button
              onClick={() => setShowCreateRecord(true)}
              className="btn-professional btn-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Health Record
            </button>
          )}
          
          <button
            onClick={() => setShowMFASetup(true)}
            className="btn-professional btn-success"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Setup MFA Security
          </button>
        </div>

        {/* Health Records */}
        <div className="professional-card fade-in">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Health Records</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {user.role === 'admin' ? 'All system records' : 'Your accessible records'} - Secured with blockchain technology
                </p>
              </div>
              <div className="security-indicator">
                <svg className="security-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Blockchain Secured</span>
              </div>
            </div>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="loading-spinner mx-auto mb-4"></div>
              <p className="text-gray-600">Loading health records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Health Records</h4>
              <p className="text-gray-600 mb-4">Create your first health record to get started with secure data management.</p>
              {(user.role === 'healthcare_provider' || user.role === 'individual') && (
                <button
                  onClick={() => setShowCreateRecord(true)}
                  className="btn-professional btn-primary"
                >
                  Create First Record
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {records.map((record) => (
                <div key={record.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`record-type-icon ${getRecordTypeClass(record.record_type)}`}>
                        {getRecordTypeIcon(record.record_type)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-medium text-gray-900">
                            {record.title || 'Untitled Record'}
                          </h4>
                          <span className={`status-badge ${record.is_public ? 'status-public' : 'status-private'}`}>
                            {record.is_public ? (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Public
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Private
                              </>
                            )}
                          </span>
                          <span className={`status-badge ${record.is_verified ? 'status-verified' : 'status-unverified'}`}>
                            {record.is_verified ? (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Verified
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Unverified
                              </>
                            )}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-2">{record.description || 'No description available'}</p>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Subject: {record.subject_name || 'Unknown'}</span>
                          <span>•</span>
                          <span>Type: {record.record_type || 'Unknown'}</span>
                          <span>•</span>
                          <span>Created: {record.created_at ? new Date(record.created_at).toLocaleDateString() : 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleVerifyRecord(record.id)}
                        className="btn-professional btn-secondary text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Verify
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateRecord && <CreateRecordModal onClose={() => setShowCreateRecord(false)} onSuccess={fetchHealthRecords} />}
      {showMFASetup && <MFASetupModal onClose={() => setShowMFASetup(false)} />}
      {showBlockchainVerification && (
        <BlockchainVerification 
          recordId={selectedRecordId} 
          onClose={() => setShowBlockchainVerification(false)} 
        />
      )}
    </div>
  );
};

// Professional Create Record Modal
const CreateRecordModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    record_type: 'human',
    subject_id: '',
    subject_name: '',
    data: { notes: '', vital_signs: '' },
    is_public: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/health-records`, formData);
      toast.success('Health record created and secured with blockchain!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to create record:', error);
      toast.error(error.response?.data?.detail || 'Failed to create record');
    } finally {
      setLoading(false);
    }
  };

  const recordTypes = [
    { value: 'human', label: 'Human Health', icon: '👤' },
    { value: 'animal', label: 'Animal Health', icon: '🐕' },
    { value: 'plant', label: 'Plant Health', icon: '🌱' }
  ];

  return (
    <div className="modal-overlay-professional">
      <div className="modal-content-professional max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Create Health Record</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label-professional">Record Title</label>
              <input
                type="text"
                required
                className="form-input-professional"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Enter record title"
              />
            </div>
            
            <div>
              <label className="form-label-professional">Record Type</label>
              <select
                className="form-input-professional"
                value={formData.record_type}
                onChange={(e) => setFormData({...formData, record_type: e.target.value})}
              >
                {recordTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label-professional">Subject Name</label>
              <input
                type="text"
                required
                className="form-input-professional"
                value={formData.subject_name}
                onChange={(e) => setFormData({...formData, subject_name: e.target.value})}
                placeholder="Enter subject name"
              />
            </div>
            
            <div>
              <label className="form-label-professional">Subject ID</label>
              <input
                type="text"
                required
                className="form-input-professional"
                value={formData.subject_id}
                onChange={(e) => setFormData({...formData, subject_id: e.target.value})}
                placeholder="Enter unique identifier"
              />
            </div>
          </div>
          
          <div>
            <label className="form-label-professional">Description</label>
            <textarea
              className="form-input-professional"
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Describe the health record..."
            />
          </div>
          
          <div>
            <label className="form-label-professional">Clinical Notes</label>
            <textarea
              className="form-input-professional"
              rows="4"
              value={formData.data.notes}
              onChange={(e) => setFormData({
                ...formData, 
                data: { ...formData.data, notes: e.target.value }
              })}
              placeholder="Enter clinical observations, treatments, or other relevant notes..."
            />
          </div>
          
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="is_public"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              checked={formData.is_public}
              onChange={(e) => setFormData({...formData, is_public: e.target.checked})}
            />
            <label htmlFor="is_public" className="text-sm font-medium text-gray-700">
              Make this record publicly accessible for research
            </label>
          </div>
          
          <div className="blockchain-indicator blockchain-valid">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="font-medium">Blockchain Security Enabled</p>
              <p className="text-xs opacity-75">This record will be secured with immutable blockchain technology</p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-professional btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-professional btn-primary"
            >
              {loading ? (
                <>
                  <div className="loading-spinner w-4 h-4"></div>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Create & Secure Record
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Professional MFA Setup Modal
const MFASetupModal = ({ onClose }) => {
  const [mfaData, setMfaData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setupMFA();
  }, []);

  const setupMFA = async () => {
    try {
      const response = await axios.post(`${API}/auth/setup-mfa`);
      setMfaData(response.data);
    } catch (error) {
      console.error('Failed to setup MFA:', error);
      toast.error('Failed to setup MFA');
    }
  };

  const enableMFA = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/auth/enable-mfa?mfa_token=${verificationCode}`);
      toast.success('Multi-factor authentication enabled successfully!');
      onClose();
    } catch (error) {
      console.error('Failed to enable MFA:', error);
      toast.error('Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const getTOTPUri = () => {
    if (!mfaData?.manual_entry_key) return '';
    
    const issuer = 'Digital One Health';
    const accountName = user?.email || 'user@digitalonehealth.com';
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${mfaData.manual_entry_key}&issuer=${encodeURIComponent(issuer)}&period=90`;
  };

  if (!mfaData) {
    return (
      <div className="modal-overlay-professional">
        <div className="modal-content-professional">
          <div className="text-center py-8">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-gray-600">Setting up multi-factor authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay-professional">
      <div className="modal-content-professional max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Setup Multi-Factor Authentication</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gray-600 mb-6">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="flex justify-center bg-white p-6 rounded-lg border border-gray-200">
              <QRCode 
                value={getTOTPUri()} 
                size={200}
                level="M"
              />
            </div>
          </div>
          
          <div>
            <label className="form-label-professional">Manual Entry Key</label>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <code className="text-sm font-mono break-all">{mfaData.manual_entry_key}</code>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ⏱️ Time interval: 90 seconds (custom configuration)
            </p>
          </div>
          
          <div>
            <label className="form-label-professional">Backup Codes</label>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Save these codes safely - you can use them if you lose access to your authenticator:</p>
              <div className="grid grid-cols-2 gap-2">
                {mfaData.backup_codes?.map((code, index) => (
                  <code key={index} className="text-xs font-mono bg-white p-2 rounded border">{code}</code>
                )) || <p className="text-sm text-gray-500">No backup codes available</p>}
              </div>
            </div>
          </div>
          
          <div>
            <label className="form-label-professional">Verification Code</label>
            <input
              type="text"
              className="form-input-professional"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter 6-digit code from your app"
              maxLength="6"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the current code from your authenticator app to verify setup
            </p>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="btn-professional btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={enableMFA}
              disabled={loading || !verificationCode || verificationCode.length !== 6}
              className="btn-professional btn-success"
            >
              {loading ? (
                <>
                  <div className="loading-spinner w-4 h-4"></div>
                  Enabling...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Enable MFA
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

// Route Guards
const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? children : <Navigate to="/" replace />;
};

export default App;