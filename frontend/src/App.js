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
    console.log('Request headers:', config.headers);
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
    console.log('Response headers:', response.headers);
    return response;
  },
  (error) => {
    console.error('❌ API Error Details:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method
    });
    
    if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout - server may be starting up. Please try again.');
    } else if (error.response?.status === 0 || !error.response) {
      toast.error('Cannot connect to server. Please check your connection.');
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    } else if (error.response?.status === 401) {
      toast.error('Authentication required. Please log in.');
    } else if (error.response?.status === 403) {
      toast.error('Access denied. Insufficient permissions.');
    } else if (error.response?.status === 404) {
      toast.error('Resource not found.');
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
    subject_name: '', data: {}, is_public: false
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
      toast.success('Connected to backend successfully!');
      
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
        toast.success('Connected to backend via root endpoint!');
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
      await axios.post(`${API}/health-records`, recordForm, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('Health record created successfully!');
      setRecordForm({
        title: '', description: '', record_type: 'human', subject_id: '', 
        subject_name: '', data: {}, is_public: false
      });
      loadDashboardData();
    } catch (error) {
      console.error('Failed to create health record:', error);
      toast.error('Failed to create health record');
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
      toast.error('Failed to update privacy settings');
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

  // Connection Status Component
  const ConnectionStatus = () => (
    <div className={`fixed top-4 right-4 z-50 px-3 py-2 rounded-lg text-sm font-medium ${
      connectionStatus === 'connected' 
        ? 'bg-green-100 text-green-800 border border-green-200' 
        : connectionStatus === 'disconnected'
        ? 'bg-red-100 text-red-800 border border-red-200'
        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
    }`}>
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          connectionStatus === 'connected' ? 'bg-green-500' : 
          connectionStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
        }`}></div>
        <span>
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
      <div className="text-xs text-gray-600 mt-1">
        Backend: {BACKEND_URL}
      </div>
    </div>
  );

  // If not authenticated, show login/register
  if (!user) {
    return (
      <div className="App min-h-screen bg-gray-50">
        <ConnectionStatus />
        
        {/* Header */}
        <header className="professional-nav">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="nav-brand">
                <span>🏥 Digital One Health</span>
                <div className="nav-subtitle">Secure Health Data Platform</div>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => setActiveTab('login')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'login' 
                      ? 'bg-white text-blue-700' 
                      : 'text-white hover:bg-blue-600'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setActiveTab('register')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'register' 
                      ? 'bg-white text-blue-700' 
                      : 'text-white hover:bg-blue-600'
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
            <div className="professional-card p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Sign In to Your Account
              </h2>
              
              <form onSubmit={login} className="space-y-4">
                <div>
                  <label className="form-label-professional">Username</label>
                  <input
                    type="text"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                    className="form-input-professional"
                    required
                  />
                </div>
                
                <div>
                  <label className="form-label-professional">Password</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    className="form-input-professional"
                    required
                  />
                </div>
                
                <div>
                  <label className="form-label-professional">MFA Token (if enabled)</label>
                  <input
                    type="text"
                    value={loginForm.mfa_token}
                    onChange={(e) => setLoginForm({...loginForm, mfa_token: e.target.value})}
                    className="form-input-professional"
                    placeholder="6-digit code"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading || connectionStatus !== 'connected'}
                  className="btn-professional btn-primary w-full"
                >
                  {isLoading ? (
                    <>
                      <div className="loading-spinner w-4 h-4"></div>
                      Signing In...
                    </>
                  ) : connectionStatus !== 'connected' ? (
                    'Connecting to Server...'
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Default admin credentials:
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Username: admin | Password: Admin123!
                </p>
              </div>
            </div>
          ) : (
            <div className="professional-card p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Create Your Account
              </h2>
              
              <form onSubmit={register} className="space-y-4">
                <div>
                  <label className="form-label-professional">Full Name</label>
                  <input
                    type="text"
                    value={registerForm.full_name}
                    onChange={(e) => setRegisterForm({...registerForm, full_name: e.target.value})}
                    className="form-input-professional"
                    required
                  />
                </div>
                
                <div>
                  <label className="form-label-professional">Username</label>
                  <input
                    type="text"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                    className="form-input-professional"
                    required
                  />
                </div>
                
                <div>
                  <label className="form-label-professional">Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                    className="form-input-professional"
                    required
                  />
                </div>
                
                <div>
                  <label className="form-label-professional">Password</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    className="form-input-professional"
                    required
                  />
                </div>
                
                <div>
                  <label className="form-label-professional">Role</label>
                  <select
                    value={registerForm.role}
                    onChange={(e) => setRegisterForm({...registerForm, role: e.target.value})}
                    className="form-input-professional"
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
                  className="btn-professional btn-primary w-full"
                >
                  {isLoading ? (
                    <>
                      <div className="loading-spinner w-4 h-4"></div>
                      Creating Account...
                    </>
                  ) : connectionStatus !== 'connected' ? (
                    'Connecting to Server...'
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>
            </div>
          )}
        </main>

        <ToastContainer position="top-right" autoClose={5000} />
      </div>
    );
  }

  // Authenticated user interface
  return (
    <div className="App min-h-screen bg-gray-50">
      <ConnectionStatus />
      
      {/* Header */}
      <header className="professional-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="nav-brand">
              <span>🏥 Digital One Health</span>
              <div className="nav-subtitle">Welcome, {user.full_name}</div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className={`status-badge ${
                user.role === 'admin' ? 'status-verified' : 'status-public'
              }`}>
                {user.role.replace('_', ' ').toUpperCase()}
              </span>
              
              {!user.mfa_enabled && (
                <button
                  onClick={setupMFA}
                  className="btn-professional btn-secondary text-sm"
                >
                  Setup MFA
                </button>
              )}
              
              <button
                onClick={logout}
                className="btn-professional btn-secondary"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['dashboard', 'records', 'create', 'blockchain'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <button
                onClick={loadDashboardData}
                className="btn-professional btn-secondary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value text-blue-600">
                  {dashboardStats.my_records || dashboardStats.total_records || healthRecords.length}
                </div>
                <div className="stat-label">
                  {user.role === 'admin' ? 'Total Records' : 'My Records'}
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-value text-green-600">
                  {dashboardStats.my_public_records || dashboardStats.public_records || 
                   healthRecords.filter(r => r.is_public).length}
                </div>
                <div className="stat-label">Public Records</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-value text-orange-600">
                  {dashboardStats.my_private_records || dashboardStats.private_records || 
                   healthRecords.filter(r => !r.is_public).length}
                </div>
                <div className="stat-label">Private Records</div>
              </div>
              
              {user.role === 'admin' && (
                <div className="stat-card">
                  <div className="stat-value text-purple-600">
                    {dashboardStats.total_users || 'N/A'}
                  </div>
                  <div className="stat-label">Total Users</div>
                </div>
              )}
            </div>

            {/* Recent Records */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Health Records</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {healthRecords.slice(0, 6).map((record) => (
                  <div key={record.id} className="record-card">
                    <div className="flex items-start">
                      <div className={`record-type-icon ${getRecordTypeColor(record.record_type)}`}>
                        {getRecordTypeIcon(record.record_type)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{record.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{record.description}</p>
                        
                        <div className="flex items-center justify-between">
                          <span className={`status-badge ${
                            record.is_public ? 'status-public' : 'status-private'
                          }`}>
                            {record.is_public ? 'Public' : 'Private'}
                          </span>
                          
                          <div className="flex space-x-2">
                            <button
                              onClick={() => verifyRecord(record.id)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                              title="Verify blockchain integrity"
                            >
                              🔗 Verify
                            </button>
                            
                            {(user.role === 'admin' || record.owner_id === user.id) && (
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
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-900">Health Records</h1>
              <button
                onClick={loadDashboardData}
                className="btn-professional btn-secondary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {healthRecords.map((record) => (
                <div key={record.id} className="professional-card p-6">
                  <div className="flex items-start mb-4">
                    <div className={`record-type-icon ${getRecordTypeColor(record.record_type)}`}>
                      {getRecordTypeIcon(record.record_type)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{record.title}</h3>
                      <p className="text-sm text-gray-600">{record.description}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Subject:</span>
                      <span className="text-sm font-medium">{record.subject_name}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Type:</span>
                      <span className="text-sm font-medium capitalize">{record.record_type}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Privacy:</span>
                      <span className={`status-badge ${
                        record.is_public ? 'status-public' : 'status-private'
                      }`}>
                        {record.is_public ? 'Public' : 'Private'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Verified:</span>
                      <span className={`status-badge ${
                        record.is_verified ? 'status-verified' : 'status-unverified'
                      }`}>
                        {record.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => verifyRecord(record.id)}
                      className="btn-professional btn-primary text-sm flex-1"
                    >
                      🔗 Verify
                    </button>
                    
                    {(user.role === 'admin' || record.owner_id === user.id) && (
                      <button
                        onClick={() => toggleRecordPrivacy(record.id, record.is_public)}
                        className="btn-professional btn-secondary text-sm"
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

        {activeTab === 'create' && (user.role === 'healthcare_provider' || user.role === 'individual') && (
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Create Health Record</h1>
            
            <div className="professional-card p-8">
              <form onSubmit={createHealthRecord} className="space-y-6">
                <div>
                  <label className="form-label-professional">Title</label>
                  <input
                    type="text"
                    value={recordForm.title}
                    onChange={(e) => setRecordForm({...recordForm, title: e.target.value})}
                    className="form-input-professional"
                    required
                  />
                </div>
                
                <div>
                  <label className="form-label-professional">Description</label>
                  <textarea
                    value={recordForm.description}
                    onChange={(e) => setRecordForm({...recordForm, description: e.target.value})}
                    className="form-input-professional"
                    rows={3}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label-professional">Record Type</label>
                    <select
                      value={recordForm.record_type}
                      onChange={(e) => setRecordForm({...recordForm, record_type: e.target.value})}
                      className="form-input-professional"
                      required
                    >
                      <option value="human">Human</option>
                      <option value="animal">Animal</option>
                      <option value="plant">Plant</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label-professional">Subject ID</label>
                    <input
                      type="text"
                      value={recordForm.subject_id}
                      onChange={(e) => setRecordForm({...recordForm, subject_id: e.target.value})}
                      className="form-input-professional"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="form-label-professional">Subject Name</label>
                  <input
                    type="text"
                    value={recordForm.subject_name}
                    onChange={(e) => setRecordForm({...recordForm, subject_name: e.target.value})}
                    className="form-input-professional"
                    required
                  />
                </div>
                
                <div>
                  <label className="form-label-professional">Medical Data (JSON format)</label>
                  <textarea
                    value={JSON.stringify(recordForm.data, null, 2)}
                    onChange={(e) => {
                      try {
                        const data = JSON.parse(e.target.value);
                        setRecordForm({...recordForm, data});
                      } catch (error) {
                        // Invalid JSON, keep the text for user to fix
                      }
                    }}
                    className="form-input-professional font-mono"
                    rows={6}
                    placeholder='{"notes": "Patient notes", "vital_signs": "120/80 mmHg"}'
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={recordForm.is_public}
                    onChange={(e) => setRecordForm({...recordForm, is_public: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_public" className="ml-2 block text-sm text-gray-900">
                    Make this record public (visible to researchers and healthcare providers)
                  </label>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-professional btn-primary w-full"
                >
                  {isLoading ? (
                    <>
                      <div className="loading-spinner w-4 h-4"></div>
                      Creating Record...
                    </>
                  ) : (
                    'Create Health Record'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'blockchain' && (
          <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">Blockchain Security</h1>
            <BlockchainStats />
          </div>
        )}
      </main>

      {/* MFA Setup Modal */}
      {showMFASetup && mfaSetup && (
        <div className="modal-overlay-professional">
          <div className="modal-content-professional max-w-md">
            <h3 className="text-xl font-semibold mb-4">Setup Multi-Factor Authentication</h3>
            
            <div className="space-y-4">
              <div className="text-center">
                <img src={mfaSetup.qr_code} alt="MFA QR Code" className="mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  Scan this QR code with your authenticator app
                </p>
                <p className="text-xs font-mono bg-gray-100 p-2 rounded">
                  {mfaSetup.manual_entry_key}
                </p>
              </div>
              
              <div>
                <label className="form-label-professional">Enter verification code</label>
                <input
                  type="text"
                  placeholder="6-digit code"
                  className="form-input-professional"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.target.value.length === 6) {
                      enableMFA(e.target.value);
                    }
                  }}
                />
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">Backup Codes</h4>
                <p className="text-sm text-yellow-700 mb-2">
                  Save these codes in a safe place. You can use them if you lose access to your authenticator.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {mfaSetup.backup_codes.map((code, index) => (
                    <div key={index} className="bg-white p-1 rounded">{code}</div>
                  ))}
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowMFASetup(false)}
                  className="btn-professional btn-secondary flex-1"
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

      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
}

export default App;