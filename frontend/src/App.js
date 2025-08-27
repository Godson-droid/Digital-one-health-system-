import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import QRCode from 'react-qr-code';
import './App.css';
import BlockchainStats from './components/BlockchainStats';
import BlockchainVerification from './components/BlockchainVerification';

// Backend URL configuration - FIXED for your deployment
const BACKEND_URL = 'https://digital-one-health-system-cjum.onrender.com';
const API = `${BACKEND_URL}/api`;

// Configure axios defaults with enhanced timeout and error handling
axios.defaults.timeout = 30000; // 30 seconds
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Add request interceptor for debugging
axios.interceptors.request.use(
  (config) => {
    console.log(`🔄 Making ${config.method?.toUpperCase()} request to:`, config.url);
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
axios.interceptors.response.use(
  (response) => {
    console.log(`✅ Response received from:`, response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ Response error:', error);
    
    if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout - please check your connection');
    } else if (error.response?.status === 0 || !error.response) {
      toast.error('Cannot connect to server - please check if the backend is running');
    } else if (error.response?.status >= 500) {
      toast.error('Server error - please try again later');
    } else if (error.response?.status === 401) {
      toast.error('Authentication failed - please login again');
    } else if (error.response?.status === 403) {
      toast.error('Access denied - insufficient permissions');
    }
    
    return Promise.reject(error);
  }
);

function App() {
  // Authentication state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  
  // Connection monitoring
  const [isConnected, setIsConnected] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  
  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '', mfaToken: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '', email: '', password: '', confirmPassword: '', role: 'individual', fullName: ''
  });
  
  // Health records state
  const [healthRecords, setHealthRecords] = useState([]);
  const [showCreateRecord, setShowCreateRecord] = useState(false);
  const [recordForm, setRecordForm] = useState({
    title: '', description: '', recordType: 'human', subjectName: '', subjectId: '', isPublic: false
  });
  
  // MFA state
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaData, setMfaData] = useState(null);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  
  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState({});
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationRecordId, setVerificationRecordId] = useState(null);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);

  // Check authentication on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setIsLoggedIn(true);
      checkConnection();
    } else {
      checkConnection();
    }
  }, []);

  // Load data when user logs in
  useEffect(() => {
    if (isLoggedIn && user) {
      loadHealthRecords();
      loadDashboardStats();
    }
  }, [isLoggedIn, user]);

  // Connection monitoring
  const checkConnection = async () => {
    try {
      setConnectionStatus('checking');
      const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 10000 });
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('✅ Backend connection successful:', response.data);
    } catch (error) {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      console.error('❌ Backend connection failed:', error);
    }
  };

  // Authentication functions
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, {
        username: loginForm.username,
        password: loginForm.password,
        mfa_token: loginForm.mfaToken || undefined
      });

      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setToken(response.data.access_token);
        setUser(response.data.user);
        setIsLoggedIn(true);
        setMfaRequired(false);
        toast.success(`Welcome back, ${response.data.user.username}!`);
        setLoginForm({ username: '', password: '', mfaToken: '' });
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.response?.status === 401) {
        const errorMsg = error.response.data?.detail || 'Invalid credentials';
        if (errorMsg.includes('MFA token required')) {
          setMfaRequired(true);
          toast.info('Please enter your MFA token');
        } else if (errorMsg.includes('Invalid MFA token')) {
          toast.error('Invalid MFA token. Please check your authenticator app.');
        } else {
          toast.error(errorMsg);
        }
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Enhanced validation
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.fullName) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (registerForm.password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    // Password complexity validation
    const hasUpper = /[A-Z]/.test(registerForm.password);
    const hasLower = /[a-z]/.test(registerForm.password);
    const hasNumber = /\d/.test(registerForm.password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(registerForm.password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      toast.error('Password must contain uppercase, lowercase, number, and special character');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/register`, {
        username: registerForm.username,
        email: registerForm.email,
        password: registerForm.password,
        role: registerForm.role,
        full_name: registerForm.fullName
      });

      toast.success('Registration successful! Please login to continue.');
      setShowLogin(true);
      setRegisterForm({
        username: '', email: '', password: '', confirmPassword: '', role: 'individual', fullName: ''
      });
    } catch (error) {
      console.error('Registration error:', error);
      const errorMsg = error.response?.data?.detail || 'Registration failed';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
    setHealthRecords([]);
    setDashboardStats({});
    toast.info('Logged out successfully');
  };

  // MFA functions
  const setupMFA = async () => {
    try {
      const response = await axios.post(`${API}/auth/setup-mfa`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMfaData(response.data);
      setShowMFASetup(true);
    } catch (error) {
      console.error('MFA setup error:', error);
      toast.error('Failed to setup MFA');
    }
  };

  const enableMFA = async () => {
    if (!mfaToken || mfaToken.length !== 6) {
      toast.error('Please enter a valid 6-digit MFA token');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/auth/enable-mfa?mfa_token=${mfaToken}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('MFA enabled successfully!');
      setShowMFASetup(false);
      setMfaToken('');
      
      // Update user state to reflect MFA is enabled
      const updatedUser = { ...user, mfa_enabled: true };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Enable MFA error:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to enable MFA. Please check your token.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Health records functions
  const loadHealthRecords = async () => {
    setRecordsLoading(true);
    try {
      const response = await axios.get(`${API}/health-records`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHealthRecords(response.data || []);
    } catch (error) {
      console.error('Failed to load health records:', error);
      toast.error('Failed to load health records');
    } finally {
      setRecordsLoading(false);
    }
  };

  const createHealthRecord = async (e) => {
    e.preventDefault();
    
    if (!recordForm.title || !recordForm.description || !recordForm.subjectName) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const recordData = {
        title: recordForm.title,
        description: recordForm.description,
        record_type: recordForm.recordType,
        subject_name: recordForm.subjectName,
        subject_id: recordForm.subjectId || `${recordForm.recordType}-${Date.now()}`,
        data: {
          notes: recordForm.description,
          created_via: 'web_interface'
        },
        is_public: recordForm.isPublic
      };

      await axios.post(`${API}/health-records`, recordData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Health record created successfully!');
      setShowCreateRecord(false);
      setRecordForm({
        title: '', description: '', recordType: 'human', subjectName: '', subjectId: '', isPublic: false
      });
      loadHealthRecords();
      loadDashboardStats();
    } catch (error) {
      console.error('Failed to create health record:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to create health record';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecordPrivacy = async (recordId, currentStatus) => {
    try {
      await axios.put(`${API}/health-records/${recordId}/privacy?is_public=${!currentStatus}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Record privacy updated to ${!currentStatus ? 'public' : 'private'}`);
      loadHealthRecords();
      loadDashboardStats();
    } catch (error) {
      console.error('Failed to update privacy:', error);
      toast.error('Failed to update record privacy');
    }
  };

  // Dashboard functions
  const loadDashboardStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardStats(response.data || {});
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    }
  };

  // Utility functions
  const getRecordTypeIcon = (type) => {
    const icons = {
      human: '👤',
      animal: '🐾',
      plant: '🌱'
    };
    return icons[type] || '📄';
  };

  const getRecordTypeColor = (type) => {
    const colors = {
      human: 'from-blue-500 to-blue-600',
      animal: 'from-green-500 to-green-600',
      plant: 'from-yellow-500 to-yellow-600'
    };
    return colors[type] || 'from-gray-500 to-gray-600';
  };

  const canViewRecord = (record) => {
    if (!user) return false;
    
    // Admin can view all records
    if (user.role === 'admin') return true;
    
    // Owner can view their own records
    if (record.owner_id === user.id || record.created_by === user.id) return true;
    
    // Public records can be viewed by healthcare providers and researchers
    if (record.is_public && ['healthcare_provider', 'researcher'].includes(user.role)) return true;
    
    // Individuals can only view their own records
    return false;
  };

  const canModifyRecord = (record) => {
    if (!user) return false;
    // Only the original creator can modify records
    return record.owner_id === user.id && record.created_by === user.id;
  };

  // Get filtered records based on user role
  const getFilteredRecords = () => {
    if (!user) return [];
    
    return healthRecords.filter(record => {
      // Admin can see all records
      if (user.role === 'admin') return true;
      
      // Owner can see their own records
      if (record.owner_id === user.id || record.created_by === user.id) return true;
      
      // Healthcare providers and researchers can see public records
      if (record.is_public && ['healthcare_provider', 'researcher'].includes(user.role)) return true;
      
      // Individuals can only see their own records
      return false;
    });
  };

  // Get public records count for dashboard
  const getPublicRecordsCount = () => {
    if (!user) return 0;
    
    // Only show public records count for roles that can access them
    if (['admin', 'healthcare_provider', 'researcher'].includes(user.role)) {
      return healthRecords.filter(record => record.is_public && record.owner_id !== user.id).length;
    }
    
    return 0;
  };

  // Connection status component
  const ConnectionStatus = () => (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
      connectionStatus === 'connected' 
        ? 'bg-green-100 text-green-800 border border-green-200' 
        : connectionStatus === 'checking'
        ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
        : 'bg-red-100 text-red-800 border border-red-200'
    }`}>
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          connectionStatus === 'connected' ? 'bg-green-500' : 
          connectionStatus === 'checking' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
        }`}></div>
        <span>
          {connectionStatus === 'connected' ? 'Connected' : 
           connectionStatus === 'checking' ? 'Connecting...' : 'Disconnected'}
        </span>
        {connectionStatus === 'disconnected' && (
          <button 
            onClick={checkConnection}
            className="ml-2 text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );

  // If not logged in, show login/register
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <ConnectionStatus />
        
        {/* Professional Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Digital One Health</h1>
                  <p className="text-sm text-gray-600">Secure Health Data Management Platform</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Blockchain Secured</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>AES-256 Encrypted</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-md mx-auto pt-16 pb-12 px-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setShowLogin(true)}
                className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                  showLogin 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setShowLogin(false)}
                className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                  !showLogin 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="p-8">
              {showLogin ? (
                /* Login Form */
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
                    <p className="text-gray-600 mt-2">Sign in to your secure health account</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter your username"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter your password"
                      required
                    />
                  </div>

                  {mfaRequired && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        MFA Token
                      </label>
                      <input
                        type="text"
                        value={loginForm.mfaToken}
                        onChange={(e) => setLoginForm({...loginForm, mfaToken: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter 6-digit MFA code"
                        maxLength="6"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the 6-digit code from your authenticator app
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Signing In...
                      </div>
                    ) : (
                      'Sign In'
                    )}
                  </button>

                  <div className="text-center">
                    <p className="text-sm text-gray-600">
                      Don't have an account?{' '}
                      <button
                        type="button"
                        onClick={() => setShowLogin(false)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Create one here
                      </button>
                    </p>
                  </div>
                </form>
              ) : (
                /* Register Form */
                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
                    <p className="text-gray-600 mt-2">Join our secure health platform</p>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={registerForm.fullName}
                        onChange={(e) => setRegisterForm({...registerForm, fullName: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Username *
                      </label>
                      <input
                        type="text"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Choose a username"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter your email"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Role *
                      </label>
                      <select
                        value={registerForm.role}
                        onChange={(e) => setRegisterForm({...registerForm, role: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        required
                      >
                        <option value="individual">Individual</option>
                        <option value="healthcare_provider">Healthcare Provider</option>
                        <option value="researcher">Researcher</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password *
                      </label>
                      <input
                        type="password"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Create a strong password"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Must contain uppercase, lowercase, number, and special character
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Confirm your password"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-xl font-medium hover:from-green-700 hover:to-emerald-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Creating Account...
                      </div>
                    ) : (
                      'Create Account'
                    )}
                  </button>

                  <div className="text-center">
                    <p className="text-sm text-gray-600">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => setShowLogin(true)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Sign in here
                      </button>
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Security Features */}
          <div className="mt-8 text-center">
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Blockchain Integrity</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>End-to-End Encryption</span>
              </div>
            </div>
          </div>
        </div>

        <ToastContainer position="top-right" autoClose={5000} />
      </div>
    );
  }

  // Main dashboard for logged-in users
  return (
    <div className="min-h-screen bg-gray-50">
      <ConnectionStatus />
      
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Digital One Health</h1>
                <p className="text-xs text-gray-600">Secure Health Data Platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Welcome, <span className="font-medium text-gray-900">{user?.full_name || user?.username}</span>
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
              
              {!user?.mfa_enabled && (
                <button
                  onClick={setupMFA}
                  className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full hover:bg-yellow-200 transition-colors"
                >
                  Setup MFA
                </button>
              )}
              
              <button
                onClick={handleLogout}
                className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {user?.role === 'individual' 
                    ? (dashboardStats.my_records || 0)
                    : (dashboardStats.total_records || 0)
                  }
                </p>
                <p className="text-sm text-gray-600">
                  {user?.role === 'individual' ? 'My Records' : 'Total Records'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {user?.role === 'individual' 
                    ? (dashboardStats.my_public_records || 0)
                    : (dashboardStats.public_records || 0)
                  }
                </p>
                <p className="text-sm text-gray-600">
                  {user?.role === 'individual' ? 'My Public Records' : 'Public Records'}
                </p>
              </div>
            </div>
          </div>

          {/* Public Records Count - Only for admin, healthcare providers, and researchers */}
          {['admin', 'healthcare_provider', 'researcher'].includes(user?.role) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">
                    {getPublicRecordsCount()}
                  </p>
                  <p className="text-sm text-gray-600">Other Public Records</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {user?.role === 'individual' 
                    ? (dashboardStats.my_private_records || 0)
                    : (dashboardStats.private_records || 0)
                  }
                </p>
                <p className="text-sm text-gray-600">
                  {user?.role === 'individual' ? 'My Private Records' : 'Private Records'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Blockchain Stats */}
        <BlockchainStats />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
          <h2 className="text-2xl font-bold text-gray-900">Health Records</h2>
          
          {['healthcare_provider', 'individual', 'admin'].includes(user?.role) && (
            <button
              onClick={() => setShowCreateRecord(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Create Record</span>
            </button>
          )}
        </div>

        {/* Health Records List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          {recordsLoading ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading health records...</p>
            </div>
          ) : getFilteredRecords().length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Health Records</h3>
              <p className="text-gray-600 mb-6">
                {user?.role === 'individual' 
                  ? "You haven't created any health records yet."
                  : "No health records are available for your role."
                }
              </p>
              {['healthcare_provider', 'individual', 'admin'].includes(user?.role) && (
                <button
                  onClick={() => setShowCreateRecord(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Create Your First Record
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {getFilteredRecords().map((record) => (
                <div key={record.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className={`w-12 h-12 bg-gradient-to-br ${getRecordTypeColor(record.record_type)} rounded-xl flex items-center justify-center text-white text-xl`}>
                        {getRecordTypeIcon(record.record_type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {record.title}
                          </h3>
                          
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            record.is_public 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.is_public ? '🌐 Public' : '🔒 Private'}
                          </span>
                          
                          {record.is_verified !== undefined && (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              record.is_verified 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {record.is_verified ? '✅ Verified' : '⏳ Unverified'}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {record.description}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Subject: {record.subject_name}</span>
                          <span>Type: {record.record_type}</span>
                          <span>Created: {new Date(record.created_at).toLocaleDateString()}</span>
                          {record.owner_id !== user?.id && (
                            <span className="text-blue-600">📤 Shared Record</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => {
                          setVerificationRecordId(record.id);
                          setShowVerification(true);
                        }}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Verify blockchain integrity"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </button>
                      
                      {canModifyRecord(record) && (
                        <button
                          onClick={() => toggleRecordPrivacy(record.id, record.is_public)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title={`Make ${record.is_public ? 'private' : 'public'}`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                              record.is_public 
                                ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            } />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Record Modal */}
      {showCreateRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Create Health Record</h3>
                    <p className="text-sm text-gray-600">Add detailed health information to the secure platform</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowCreateRecord(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={createHealthRecord} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                <div className="flex items-center space-x-2 mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="text-lg font-semibold text-blue-900">Basic Information</h4>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={recordForm.title}
                      onChange={(e) => setRecordForm({...recordForm, title: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Record title"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Record Type *
                    </label>
                    <select
                      value={recordForm.recordType}
                      onChange={(e) => setRecordForm({...recordForm, recordType: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    >
                      <option value="human">👤 Human Health</option>
                      <option value="animal">🐾 Animal Health</option>
                      <option value="plant">🌱 Plant Health</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject Name *
                    </label>
                    <input
                      type="text"
                      value={recordForm.subjectName}
                      onChange={(e) => setRecordForm({...recordForm, subjectName: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Name of the subject"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject ID
                    </label>
                    <input
                      type="text"
                      value={recordForm.subjectId}
                      onChange={(e) => setRecordForm({...recordForm, subjectId: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Unique identifier (auto-generated if empty)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={recordForm.description}
                      onChange={(e) => setRecordForm({...recordForm, description: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      rows="4"
                      placeholder="Detailed description of the health record"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={recordForm.isPublic}
                      onChange={(e) => setRecordForm({...recordForm, isPublic: e.target.checked})}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">
                      Make this record public (visible to researchers and healthcare providers)
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateRecord(false)}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200"
                >
                  <span>Cancel</span>
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Create Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MFA Setup Modal */}
      {showMFASetup && mfaData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">MFA Setup Required</h3>
                    <p className="text-sm text-gray-600">Multi-factor authentication is mandatory for account security</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowMFASetup(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-gray-700 mb-4">Scan this QR code with your authenticator app:</p>
                
                <div className="bg-white p-4 rounded-2xl border-2 border-gray-200 inline-block">
                  <QRCode value={mfaData.qr_code} size={200} />
                </div>
                
                <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-600 mb-1">Manual entry key:</p>
                  <p className="font-mono text-sm text-gray-800 break-all">{mfaData.manual_entry_key}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter 6-digit code from your authenticator app:
                </label>
                <input
                  type="text"
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-center text-2xl font-mono tracking-widest"
                  placeholder="000000"
                  maxLength="6"
                />
              </div>

              <button
                onClick={enableMFA}
                disabled={loading || mfaToken.length !== 6}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-xl font-medium hover:from-green-700 hover:to-emerald-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Enabling MFA...
                  </div>
                ) : (
                  'Enable MFA'
                )}
              </button>

              {mfaData.backup_codes && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Backup Codes:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    {mfaData.backup_codes.map((code, index) => (
                      <div key={index} className="bg-white p-2 rounded border text-center">
                        {code}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    Save these codes in a secure location
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Blockchain Verification Modal */}
      {showVerification && verificationRecordId && (
        <BlockchainVerification
          recordId={verificationRecordId}
          onClose={() => {
            setShowVerification(false);
            setVerificationRecordId(null);
          }}
        />
      )}

      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
}

export default App;