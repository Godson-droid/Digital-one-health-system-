import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import BlockchainStats from './components/BlockchainStats';
import BlockchainVerification from './components/BlockchainVerification';

// Backend URL configuration - FIXED for your deployment
const BACKEND_URL = 'https://digital-one-health-system.onrender.com';
const API = `${BACKEND_URL}/api`;

// Enhanced axios configuration for deployment - CRITICAL FIXES
axios.defaults.timeout = 60000; // 60 seconds for Render.com cold starts
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['Accept'] = 'application/json';

// Add request interceptor for debugging
axios.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
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
    console.error('❌ API Error Details:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
      data: error.response?.data
    });
    
    // Don't show toast for blockchain verification failures - handle them silently
    if (error.config?.url?.includes('/verify') || error.config?.url?.includes('/blockchain/')) {
      return Promise.reject(error);
    }
    
    if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout - server may be starting up. Please try again.');
    } else if (error.response?.status === 0 || !error.response) {
      toast.error('Cannot connect to server. Please check your connection.');
    } else if (error.response?.status >= 500) {
      toast.error(`Server error: ${error.response?.data?.detail || 'Please try again later.'}`);
    } else if (error.response?.status === 401) {
      toast.error('Authentication required. Please log in.');
    } else if (error.response?.status === 403) {
      toast.error('Access denied. Insufficient permissions.');
    } else if (error.response?.status === 404) {
      toast.error('Resource not found.');
    } else if (error.response?.status === 422) {
      toast.error(`Validation error: ${error.response?.data?.detail || 'Invalid data provided.'}`);
    } else if (error.response?.data?.detail) {
      toast.error(error.response.data.detail);
    }
    
    return Promise.reject(error);
  }
);

function App() {
  // Authentication state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');

  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [showBlockchainVerification, setShowBlockchainVerification] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState(null);

  // Data state
  const [healthRecords, setHealthRecords] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [mfaSetup, setMfaSetup] = useState(null);

  // Form state
  const [loginForm, setLoginForm] = useState({ username: '', password: '', mfa_token: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '', email: '', password: '', role: 'individual', full_name: ''
  });
  const [recordForm, setRecordForm] = useState({
    title: '', description: '', record_type: 'human', subject_id: '', 
    subject_name: '', data: { notes: '', vital_signs: '' }, is_public: false
  });

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
    if (token) {
      getCurrentUser();
    }
  }, [token]);

  const checkConnectionStatus = async () => {
    try {
      console.log(`🔍 Checking connection to: ${BACKEND_URL}`);
      setConnectionStatus('checking');
      
      // Try health endpoint first
      const response = await axios.get(`${BACKEND_URL}/health`, { 
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      setConnectionStatus('connected');
      console.log('✅ Backend connection successful:', response.data);
      
    } catch (error) {
      console.error('❌ Backend connection failed:', error);
      setConnectionStatus('disconnected');
      
      // Try alternative endpoints
      try {
        console.log('🔄 Trying root endpoint...');
        const rootResponse = await axios.get(`${BACKEND_URL}/`, { 
          timeout: 15000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        setConnectionStatus('connected');
        console.log('✅ Root endpoint successful:', rootResponse.data);
      } catch (rootError) {
        console.error('❌ Root endpoint also failed:', rootError);
        
        if (error.code === 'ECONNABORTED') {
          toast.warn('Server is starting up. This may take a moment on first load.');
        } else if (error.response?.status === 0) {
          toast.error('CORS or network error - cannot reach backend server.');
        } else {
          toast.error(`Cannot connect to backend server. Status: ${error.response?.status || 'Unknown'}`);
        }
      }
    }
  };

  const getCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      setUser(response.data);
      loadDashboardData();
    } catch (error) {
      console.error('Failed to get current user:', error);
      if (error.response?.status === 401) {
        logout();
      }
    }
  };

  const loadDashboardData = async () => {
    try {
      const [recordsResponse, statsResponse] = await Promise.all([
        axios.get(`${API}/health-records`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }),
        axios.get(`${API}/dashboard/stats`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }).catch(() => ({ data: {} })) // Fallback for stats
      ]);
      
      setHealthRecords(recordsResponse.data || []);
      setDashboardStats(statsResponse.data || {});
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      if (error.response?.status !== 401) {
        toast.error('Failed to load dashboard data');
      }
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/login`, loginForm, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      
      setLoginForm({ username: '', password: '', mfa_token: '' });
      toast.success(`Welcome back, ${userData.full_name}!`);
      
      loadDashboardData();
    } catch (error) {
      console.error('Login failed:', error);
      const message = error.response?.data?.detail || 'Login failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await axios.post(`${API}/auth/register`, registerForm, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      toast.success('Registration successful! Please log in.');
      setRegisterForm({
        username: '', email: '', password: '', role: 'individual', full_name: ''
      });
      setActiveTab('login');
    } catch (error) {
      console.error('Registration failed:', error);
      const message = error.response?.data?.detail || 'Registration failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    setActiveTab('login');
    toast.info('Logged out successfully');
  };

  const setupMFA = async () => {
    try {
      const response = await axios.post(`${API}/auth/setup-mfa`, {}, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      setMfaSetup(response.data);
      setShowMFASetup(true);
    } catch (error) {
      console.error('MFA setup failed:', error);
      toast.error('Failed to setup MFA');
    }
  };

  const enableMFA = async (mfaToken) => {
    try {
      await axios.post(`${API}/auth/enable-mfa?mfa_token=${mfaToken}`, {}, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      toast.success('MFA enabled successfully!');
      setShowMFASetup(false);
      getCurrentUser();
    } catch (error) {
      console.error('MFA enable failed:', error);
      toast.error('Failed to enable MFA');
    }
  };

  const createHealthRecord = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      console.log('Creating health record with data:', recordForm);
      
      // Validate required fields
      if (!recordForm.title || !recordForm.description || !recordForm.subject_id || !recordForm.subject_name) {
        toast.error('Please fill in all required fields');
        setIsLoading(false);
        return;
      }

      // Ensure data is properly formatted
      const recordData = {
        title: recordForm.title.trim(),
        description: recordForm.description.trim(),
        record_type: recordForm.record_type,
        subject_id: recordForm.subject_id.trim(),
        subject_name: recordForm.subject_name.trim(),
        data: recordForm.data || { notes: '', vital_signs: '' },
        is_public: recordForm.is_public
      };

      console.log('Sending record data:', recordData);
      
      const response = await axios.post(`${API}/health-records`, recordData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Health record creation response:', response.data);
      toast.success('Health record created successfully!');
      
      // Reset form
      setRecordForm({
        title: '', description: '', record_type: 'human', subject_id: '', 
        subject_name: '', data: { notes: '', vital_signs: '' }, is_public: false
      });
      
      // Reload dashboard data
      loadDashboardData();
      
      // Switch to records tab to see the new record
      setActiveTab('records');
      
    } catch (error) {
      console.error('Failed to create health record:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to create health record';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecordPrivacy = async (recordId, currentStatus) => {
    try {
      await axios.put(`${API}/health-records/${recordId}/privacy?is_public=${!currentStatus}`, {}, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('Privacy settings updated!');
      loadDashboardData();
    } catch (error) {
      console.error('Failed to update privacy:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to update privacy settings';
      toast.error(errorMessage);
    }
  };

  const verifyRecord = (recordId) => {
    setSelectedRecordId(recordId);
    setShowBlockchainVerification(true);
  };

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
      human: 'record-type-human',
      animal: 'record-type-animal',
      plant: 'record-type-plant'
    };
    return colors[type] || 'record-type-human';
  };

  // Enhanced Connection Status Component - FIXED POSITIONING
  const ConnectionStatus = () => (
    <div className={`fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-all duration-300 ${
      connectionStatus === 'connected' 
        ? 'bg-green-100 text-green-800 border border-green-200' 
        : connectionStatus === 'disconnected'
        ? 'bg-red-100 text-red-800 border border-red-200'
        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
    }`}>
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full animate-pulse ${
          connectionStatus === 'connected' ? 'bg-green-500' : 
          connectionStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
        }`}></div>
        <span className="text-xs">
          {connectionStatus === 'connected' ? 'Connected' : 
           connectionStatus === 'disconnected' ? 'Disconnected' : 'Checking...'}
        </span>
        {connectionStatus === 'disconnected' && (
          <button 
            onClick={checkConnectionStatus}
            className="ml-2 text-xs underline hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );

  // If not authenticated, show login/register
  if (!user) {
    return (
      <div className="App min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <ConnectionStatus />
        
        {/* Enhanced Header */}
        <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🏥</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Digital One Health</h1>
                  <p className="text-blue-100 text-sm">Secure Health Data Platform</p>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setActiveTab('login')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'login' 
                      ? 'bg-white text-blue-700 shadow-lg' 
                      : 'text-white hover:bg-white hover:bg-opacity-20'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setActiveTab('register')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'register' 
                      ? 'bg-white text-blue-700 shadow-lg' 
                      : 'text-white hover:bg-white hover:bg-opacity-20'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-md mx-auto mt-12 px-4">
          {activeTab === 'login' ? (
            <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                <p className="text-gray-600">Sign in to access your health records</p>
              </div>
              
              <form onSubmit={login} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your username"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your password"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">MFA Token (if enabled)</label>
                  <input
                    type="text"
                    value={loginForm.mfa_token}
                    onChange={(e) => setLoginForm({...loginForm, mfa_token: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="6-digit code (optional)"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading || connectionStatus !== 'connected'}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Signing In...</span>
                    </>
                  ) : connectionStatus !== 'connected' ? (
                    <span>Connecting to Server...</span>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Account</h2>
                <p className="text-gray-600">Join our secure health platform</p>
              </div>
              
              <form onSubmit={register} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={registerForm.full_name}
                    onChange={(e) => setRegisterForm({...registerForm, full_name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Choose a username"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your email"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Create a strong password"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    value={registerForm.role}
                    onChange={(e) => setRegisterForm({...registerForm, role: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  >
                    <option value="individual">Individual</option>
                    <option value="healthcare_provider">Healthcare Provider</option>
                    <option value="researcher">Researcher</option>
                  </select>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading || connectionStatus !== 'connected'}
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:from-green-700 hover:to-blue-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </>
                  ) : connectionStatus !== 'connected' ? (
                    <span>Connecting to Server...</span>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </main>

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
    );
  }

  // Authenticated user interface
  return (
    <div className="App min-h-screen bg-gray-50">
      <ConnectionStatus />
      
      {/* Enhanced Header */}
      <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🏥</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Digital One Health</h1>
                <p className="text-blue-100 text-sm">Welcome, {user.full_name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                user.role === 'healthcare_provider' ? 'bg-blue-100 text-blue-800' :
                user.role === 'researcher' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {user.role.replace('_', ' ').toUpperCase()}
              </span>
              
              {!user.mfa_enabled && (
                <button
                  onClick={setupMFA}
                  className="hidden sm:flex items-center space-x-1 px-3 py-1 bg-white bg-opacity-20 text-white rounded-lg text-sm hover:bg-opacity-30 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Setup MFA</span>
                </button>
              )}
              
              <button
                onClick={logout}
                className="flex items-center space-x-1 px-3 py-1 bg-white bg-opacity-20 text-white rounded-lg text-sm hover:bg-opacity-30 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {['dashboard', 'records', 'create', 'blockchain'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {tab === 'dashboard' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" /></svg>}
                  {tab === 'records' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  {tab === 'create' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>}
                  {tab === 'blockchain' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
                  <span className="capitalize">{tab}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">Overview of your health records and system status</p>
              </div>
              <button
                onClick={loadDashboardData}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            </div>

            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-sm font-medium">
                      {user.role === 'admin' ? 'Total Records' : 'My Records'}
                    </p>
                    <p className="text-3xl font-bold text-blue-900">
                      {dashboardStats.my_records || dashboardStats.total_records || healthRecords.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 text-sm font-medium">Public Records</p>
                    <p className="text-3xl font-bold text-green-900">
                      {dashboardStats.my_public_records || dashboardStats.public_records || 
                       healthRecords.filter(r => r.is_public).length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-600 text-sm font-medium">Private Records</p>
                    <p className="text-3xl font-bold text-orange-900">
                      {dashboardStats.my_private_records || dashboardStats.private_records || 
                       healthRecords.filter(r => !r.is_public).length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {user.role === 'admin' && (
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-600 text-sm font-medium">Total Users</p>
                      <p className="text-3xl font-bold text-purple-900">
                        {dashboardStats.total_users || 'N/A'}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Records */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Health Records</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {healthRecords.slice(0, 6).map((record) => (
                  <div key={record.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <div className="flex items-start space-x-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${getRecordTypeColor(record.record_type)}`}>
                        {getRecordTypeIcon(record.record_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1 truncate">{record.title}</h3>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{record.description}</p>
                        
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            record.is_public ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {record.is_public ? '🌐 Public' : '🔒 Private'}
                          </span>
                          
                          <div className="flex space-x-2">
                            {record.can_verify && (
                              <button
                                onClick={() => verifyRecord(record.id)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                title="Verify blockchain integrity"
                              >
                                🔗
                              </button>
                            )}
                            
                            {record.can_change_privacy && (
                              <button
                                onClick={() => toggleRecordPrivacy(record.id, record.is_public)}
                                className="text-gray-600 hover:text-gray-800 text-sm"
                                title="Toggle privacy"
                              >
                                {record.is_public ? '🔓' : '🔒'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Health Records</h1>
                <p className="text-gray-600 mt-1">Manage and view your health records</p>
              </div>
              <button
                onClick={loadDashboardData}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {healthRecords.map((record) => (
                <div key={record.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                  <div className="flex items-start space-x-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${getRecordTypeColor(record.record_type)}`}>
                      {getRecordTypeIcon(record.record_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1 truncate">{record.title}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{record.description}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Subject:</span>
                      <span className="text-sm font-medium truncate ml-2">{record.subject_name}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Type:</span>
                      <span className="text-sm font-medium capitalize">{record.record_type}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Privacy:</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.is_public ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {record.is_public ? '🌐 Public' : '🔒 Private'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Verified:</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.is_verified ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {record.is_verified ? '✅ Verified' : '⏳ Unverified'}
                      </span>
                    </div>

                    {/* Permission Indicators */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Permissions:</span>
                      <div className="flex space-x-1">
                        {record.can_modify && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full" title="Can modify">
                            ✏️
                          </span>
                        )}
                        {record.can_change_privacy && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full" title="Can change privacy">
                            🔒
                          </span>
                        )}
                        {record.can_verify && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full" title="Can verify">
                            🔗
                          </span>
                        )}
                        {!record.can_modify && !record.can_change_privacy && !record.can_verify && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full" title="Read only">
                            👁️
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 mt-6 pt-4 border-t border-gray-200">
                    {record.can_verify && (
                      <button
                        onClick={() => verifyRecord(record.id)}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-all duration-200 flex items-center justify-center space-x-1"
                      >
                        <span>🔗</span>
                        <span>Verify</span>
                      </button>
                    )}
                    
                    {record.can_change_privacy && (
                      <button
                        onClick={() => toggleRecordPrivacy(record.id, record.is_public)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all duration-200"
                        title="Toggle privacy"
                      >
                        {record.is_public ? '🔓' : '🔒'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'create' && (user.role === 'healthcare_provider' || user.role === 'individual' || user.role === 'admin') && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Health Record</h1>
              <p className="text-gray-600">Add a new health record to the secure blockchain system</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <form onSubmit={createHealthRecord} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={recordForm.title}
                    onChange={(e) => setRecordForm({...recordForm, title: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g., Annual Checkup, Blood Test Results"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <textarea
                    value={recordForm.description}
                    onChange={(e) => setRecordForm({...recordForm, description: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    rows={3}
                    placeholder="Detailed description of the health record"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Record Type</label>
                    <select
                      value={recordForm.record_type}
                      onChange={(e) => setRecordForm({...recordForm, record_type: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      required
                    >
                      <option value="human">👤 Human</option>
                      <option value="animal">🐾 Animal</option>
                      <option value="plant">🌱 Plant</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subject ID *</label>
                    <input
                      type="text"
                      value={recordForm.subject_id}
                      onChange={(e) => setRecordForm({...recordForm, subject_id: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="e.g., PAT001, DOG123"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject Name *</label>
                  <input
                    type="text"
                    value={recordForm.subject_name}
                    onChange={(e) => setRecordForm({...recordForm, subject_name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Name of the patient/subject"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <textarea
                      value={recordForm.data.notes || ''}
                      onChange={(e) => setRecordForm({
                        ...recordForm, 
                        data: { ...recordForm.data, notes: e.target.value }
                      })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      rows={3}
                      placeholder="Clinical notes, observations, etc."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vital Signs</label>
                    <textarea
                      value={recordForm.data.vital_signs || ''}
                      onChange={(e) => setRecordForm({
                        ...recordForm, 
                        data: { ...recordForm.data, vital_signs: e.target.value }
                      })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      rows={3}
                      placeholder="Blood pressure, temperature, etc."
                    />
                  </div>
                </div>
                
                <div className="flex items-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={recordForm.is_public}
                    onChange={(e) => setRecordForm({...recordForm, is_public: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_public" className="ml-3 block text-sm text-blue-900">
                    <span className="font-medium">Make this record public</span>
                    <span className="block text-blue-700">Visible to researchers and healthcare providers</span>
                  </label>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating Record...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Create Health Record</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'blockchain' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Blockchain Security</h1>
              <p className="text-gray-600">Monitor blockchain integrity and security features</p>
            </div>
            <BlockchainStats />
          </div>
        )}
      </main>

      {/* MFA Setup Modal */}
      {showMFASetup && mfaSetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h3 className="text-xl font-semibold mb-6 text-center">Setup Multi-Factor Authentication</h3>
            
            <div className="space-y-6">
              <div className="text-center">
                <img src={mfaSetup.qr_code} alt="MFA QR Code" className="mx-auto mb-4 rounded-xl" />
                <p className="text-sm text-gray-600 mb-2">
                  Scan this QR code with your authenticator app
                </p>
                <p className="text-xs font-mono bg-gray-100 p-3 rounded-lg">
                  {mfaSetup.manual_entry_key}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter verification code</label>
                <input
                  type="text"
                  placeholder="6-digit code"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.target.value.length === 6) {
                      enableMFA(e.target.value);
                    }
                  }}
                />
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                <h4 className="font-medium text-yellow-800 mb-2">Backup Codes</h4>
                <p className="text-sm text-yellow-700 mb-3">
                  Save these codes in a safe place. You can use them if you lose access to your authenticator.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {mfaSetup.backup_codes.map((code, index) => (
                    <div key={index} className="bg-white p-2 rounded border">{code}</div>
                  ))}
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowMFASetup(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blockchain Verification Modal */}
      {showBlockchainVerification && (
        <BlockchainVerification
          recordId={selectedRecordId}
          onClose={() => {
            setShowBlockchainVerification(false);
            setSelectedRecordId(null);
          }}
        />
      )}

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
  );
}

export default App;