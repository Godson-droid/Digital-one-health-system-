import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import BlockchainStats from './components/BlockchainStats';
import BlockchainVerification from './components/BlockchainVerification';

// FIXED: Backend URL detection for deployment
const getBackendUrl = () => {
  // Check if we're in development or production
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Development environment
    return 'http://localhost:8001';
  } else {
    // Production environment - use the deployed backend URL
    return 'https://digital-one-health-system-cjum.onrender.com';
  }
};

const BACKEND_URL = getBackendUrl();
const API = `${BACKEND_URL}/api`;

// Enhanced axios configuration with better error handling
axios.defaults.timeout = 45000; // 45 seconds
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['Accept'] = 'application/json';

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

// FIXED: Response interceptor - don't show automatic error toasts
axios.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', error);
    
    // Only show automatic toasts for connection/timeout errors
    if (error.code === 'ECONNABORTED') {
      console.log('Request timeout detected');
    } else if (error.response?.status === 0 || !error.response) {
      console.log('Connection error detected');
    } else if (error.response?.status >= 500) {
      console.log('Server error detected');
    }
    
    // Don't show automatic toasts - let components handle their own errors
    return Promise.reject(error);
  }
);

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [healthRecords, setHealthRecords] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [showBlockchainVerification, setShowBlockchainVerification] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [mfaData, setMfaData] = useState(null);

  // Connection monitoring
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      console.log(`🔍 Checking connection to: ${BACKEND_URL}/health`);
      const response = await axios.get(`${BACKEND_URL}/health`, { 
        timeout: 10000,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.status === 200) {
        setConnectionStatus('connected');
        console.log('✅ Backend connection successful');
      } else {
        setConnectionStatus('error');
        console.log('⚠️ Backend responded with non-200 status');
      }
    } catch (error) {
      setConnectionStatus('error');
      console.error('❌ Backend connection failed:', error.message);
    }
  };

  // Check for existing session on app load
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        console.log('✅ Restored user session:', parsedUser.username);
      } catch (error) {
        console.error('❌ Error parsing stored user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // Load health records when user logs in or tab changes
  useEffect(() => {
    if (user && (activeTab === 'dashboard' || activeTab === 'records')) {
      loadHealthRecords();
    }
  }, [user, activeTab]);

  const loadHealthRecords = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      console.log('🔄 Loading health records...');
      const response = await axios.get(`${API}/health-records`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setHealthRecords(Array.isArray(response.data) ? response.data : []);
      console.log(`✅ Loaded ${response.data?.length || 0} health records`);
    } catch (error) {
      console.error('❌ Failed to load health records:', error);
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        setHealthRecords([]);
      }
    }
  };

  // FIXED: Login handler with proper error handling
  const handleLogin = async (loginData) => {
    try {
      console.log('🔄 Attempting login...');
      const response = await axios.post(`${API}/auth/login`, loginData);
      
      if (response.data?.access_token && response.data?.user) {
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setUser(response.data.user);
        toast.success(`Welcome back, ${response.data.user.full_name}!`);
        console.log('✅ Login successful');
        return { success: true };
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('❌ Login failed:', error);
      
      // Handle specific error cases
      let errorMessage = 'Login failed';
      
      if (error.response?.status === 401) {
        errorMessage = error.response?.data?.detail || 'Incorrect username or password';
      } else if (error.response?.status === 400) {
        errorMessage = error.response?.data?.detail || 'Invalid login data';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Login request timed out - please try again';
      } else if (!error.response) {
        errorMessage = 'Cannot connect to server - please check your connection';
      } else {
        errorMessage = error.response?.data?.detail || 'Login failed - please try again';
      }
      
      // Show error immediately
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // FIXED: Register handler with proper error handling
  const handleRegister = async (registerData) => {
    try {
      console.log('🔄 Attempting registration...');
      const response = await axios.post(`${API}/auth/register`, registerData);
      
      if (response.data?.message) {
        toast.success('Registration successful! Please log in.');
        console.log('✅ Registration successful');
        return { success: true };
      }
    } catch (error) {
      console.error('❌ Registration failed:', error);
      
      // Handle specific error cases
      let errorMessage = 'Registration failed';
      
      if (error.response?.status === 400) {
        errorMessage = error.response?.data?.detail || 'User already exists or invalid data';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Registration request timed out - please try again';
      } else if (!error.response) {
        errorMessage = 'Cannot connect to server - please check your connection';
      } else {
        errorMessage = error.response?.data?.detail || 'Registration failed - please try again';
      }
      
      // Show error immediately
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setHealthRecords([]);
    setActiveTab('dashboard');
    toast.info('Logged out successfully');
    console.log('✅ Logout successful');
  };

  const handleCreateRecord = async (recordData) => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔄 Creating health record...');
      
      const response = await axios.post(`${API}/health-records`, recordData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data?.message) {
        toast.success('Health record created successfully!');
        setShowCreateForm(false);
        loadHealthRecords();
        console.log('✅ Health record created');
      }
    } catch (error) {
      console.error('❌ Failed to create health record:', error);
      const message = error.response?.data?.detail || 'Failed to create health record';
      toast.error(message);
    }
  };

  const handleUpdatePrivacy = async (recordId, isPublic) => {
    try {
      const token = localStorage.getItem('token');
      console.log(`🔄 Updating privacy for record ${recordId}...`);
      
      await axios.put(`${API}/health-records/${recordId}/privacy?is_public=${isPublic}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      toast.success(`Record privacy updated to ${isPublic ? 'public' : 'private'}`);
      loadHealthRecords();
      console.log('✅ Privacy updated');
    } catch (error) {
      console.error('❌ Failed to update privacy:', error);
      const message = error.response?.data?.detail || 'Failed to update privacy';
      toast.error(message);
    }
  };

  const setupMFA = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔄 Setting up MFA...');
      
      const response = await axios.post(`${API}/auth/setup-mfa`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setMfaData(response.data);
      setShowMFASetup(true);
      console.log('✅ MFA setup initiated');
    } catch (error) {
      console.error('❌ Failed to setup MFA:', error);
      toast.error('Failed to setup MFA');
    }
  };

  const enableMFA = async (mfaToken) => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔄 Enabling MFA...');
      
      await axios.post(`${API}/auth/enable-mfa?mfa_token=${mfaToken}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      toast.success('MFA enabled successfully!');
      setShowMFASetup(false);
      setMfaData(null);
      console.log('✅ MFA enabled');
    } catch (error) {
      console.error('❌ Failed to enable MFA:', error);
      toast.error('Invalid MFA token');
    }
  };

  const openBlockchainVerification = (recordId) => {
    setSelectedRecordId(recordId);
    setShowBlockchainVerification(true);
  };

  const closeBlockchainVerification = () => {
    setShowBlockchainVerification(false);
    setSelectedRecordId(null);
  };

  // Connection status indicator
  const ConnectionStatus = () => (
    <div className={`flex items-center space-x-2 text-sm ${
      connectionStatus === 'connected' ? 'text-green-600' : 
      connectionStatus === 'error' ? 'text-red-600' : 'text-yellow-600'
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        connectionStatus === 'connected' ? 'bg-green-500' : 
        connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
      }`}></div>
      <span>
        {connectionStatus === 'connected' ? 'Connected' : 
         connectionStatus === 'error' ? 'Connection Error' : 'Checking...'}
      </span>
      <span className="text-gray-500">Backend: {BACKEND_URL}</span>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading Digital One Health...</p>
          <ConnectionStatus />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} onRegister={handleRegister} connectionStatus={connectionStatus} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
      
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">Digital One Health</h1>
                <p className="text-blue-200 text-sm">Secure Health Data Platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:block">
                <ConnectionStatus />
              </div>
              <div className="text-right">
                <p className="font-medium">{user.full_name}</p>
                <p className="text-blue-200 text-sm capitalize">{user.role.replace('_', ' ')}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-all duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {['dashboard', 'records', 'create', 'blockchain'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardTab 
            user={user} 
            healthRecords={healthRecords}
            onSetupMFA={setupMFA}
            onOpenVerification={openBlockchainVerification}
          />
        )}
        
        {activeTab === 'records' && (
          <RecordsTab 
            healthRecords={healthRecords}
            user={user}
            onUpdatePrivacy={handleUpdatePrivacy}
            onOpenVerification={openBlockchainVerification}
          />
        )}
        
        {activeTab === 'create' && (
          <CreateTab 
            user={user}
            onCreateRecord={handleCreateRecord}
          />
        )}
        
        {activeTab === 'blockchain' && (
          <BlockchainTab />
        )}
      </main>

      {/* Modals */}
      {showMFASetup && mfaData && (
        <MFASetupModal 
          mfaData={mfaData}
          onEnable={enableMFA}
          onClose={() => setShowMFASetup(false)}
        />
      )}

      {showBlockchainVerification && selectedRecordId && (
        <BlockchainVerification
          recordId={selectedRecordId}
          onClose={closeBlockchainVerification}
        />
      )}
    </div>
  );
}

// FIXED: Login Page Component with proper error handling
const LoginPage = ({ onLogin, onRegister, connectionStatus }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'individual',
    full_name: '',
    mfa_token: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(''); // Clear previous errors
    
    try {
      if (isLogin) {
        const result = await onLogin({
          username: formData.username,
          password: formData.password,
          mfa_token: formData.mfa_token || undefined
        });
        
        if (!result.success) {
          setError(result.error);
        }
      } else {
        const result = await onRegister(formData);
        
        if (result.success) {
          setIsLogin(true);
          setFormData({ ...formData, password: '', mfa_token: '' });
          setError('');
        } else {
          setError(result.error);
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError(''); // Clear errors when switching modes
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'individual',
      full_name: '',
      mfa_token: ''
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Digital One Health</h2>
            <p className="text-gray-600 mt-2">Secure Health Data Platform</p>
            
            {/* Connection Status */}
            <div className={`mt-4 flex items-center justify-center space-x-2 text-sm ${
              connectionStatus === 'connected' ? 'text-green-600' : 'text-red-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span>
                {connectionStatus === 'connected' ? 'Connected' : 'Connection Error'}
              </span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your username"
              />
            </div>

            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="individual">Individual</option>
                    <option value="healthcare_provider">Healthcare Provider</option>
                    <option value="researcher">Researcher</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>

            {isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MFA Token (if enabled)
                </label>
                <input
                  type="text"
                  value={formData.mfa_token}
                  onChange={(e) => setFormData({...formData, mfa_token: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter MFA token (optional)"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || connectionStatus !== 'connected'}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
                </div>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={switchMode}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Dashboard Tab Component
const DashboardTab = ({ user, healthRecords, onSetupMFA, onOpenVerification }) => {
  const myRecords = healthRecords.filter(record => record.owner_id === user.id);
  const publicRecords = healthRecords.filter(record => record.is_public && record.owner_id !== user.id);

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-blue-600">{myRecords.length}</p>
                <p className="text-blue-700 text-sm font-medium">My Records</p>
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
                <p className="text-3xl font-bold text-green-600">{publicRecords.length}</p>
                <p className="text-green-700 text-sm font-medium">Public Records</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-purple-600">{healthRecords.length}</p>
                <p className="text-purple-700 text-sm font-medium">Total Accessible</p>
              </div>
              <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Records */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Records</h3>
        {healthRecords.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 font-medium">No health records found</p>
            <p className="text-gray-400 text-sm">Create your first health record to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {healthRecords.slice(0, 5).map((record) => (
              <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    record.record_type === 'human' ? 'bg-blue-100 text-blue-600' :
                    record.record_type === 'animal' ? 'bg-green-100 text-green-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>
                    <span className="text-lg">
                      {record.record_type === 'human' ? '👤' :
                       record.record_type === 'animal' ? '🐾' : '🌱'}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{record.title}</h4>
                    <p className="text-sm text-gray-600">{record.subject_name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    record.is_public ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {record.is_public ? 'Public' : 'Private'}
                  </span>
                  {record.can_verify && (
                    <button
                      onClick={() => onOpenVerification(record.id)}
                      className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                    >
                      Verify
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Multi-Factor Authentication</h4>
                <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
              </div>
            </div>
            <button
              onClick={onSetupMFA}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Setup MFA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Records Tab Component
const RecordsTab = ({ healthRecords, user, onUpdatePrivacy, onOpenVerification }) => {
  const [filter, setFilter] = useState('all');

  const filteredRecords = healthRecords.filter(record => {
    if (filter === 'my') return record.owner_id === user.id;
    if (filter === 'public') return record.is_public;
    if (filter === 'private') return !record.is_public && record.owner_id === user.id;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-bold text-gray-900">Health Records</h2>
        
        <div className="flex space-x-2">
          {[
            { key: 'all', label: 'All Records' },
            { key: 'my', label: 'My Records' },
            { key: 'public', label: 'Public' },
            { key: 'private', label: 'Private' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No records found</h3>
          <p className="text-gray-600">No health records match your current filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredRecords.map((record) => (
            <div key={record.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    record.record_type === 'human' ? 'bg-blue-100 text-blue-600' :
                    record.record_type === 'animal' ? 'bg-green-100 text-green-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>
                    <span className="text-xl">
                      {record.record_type === 'human' ? '👤' :
                       record.record_type === 'animal' ? '🐾' : '🌱'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{record.title}</h3>
                    <p className="text-sm text-gray-600">{record.subject_name}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    record.is_public ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {record.is_public ? 'Public' : 'Private'}
                  </span>
                  {record.is_verified && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      ✓ Verified
                    </span>
                  )}
                </div>
              </div>

              <p className="text-gray-700 mb-4">{record.description}</p>

              <div className="flex flex-wrap gap-2 justify-between items-center">
                <div className="flex space-x-2">
                  {record.can_verify && (
                    <button
                      onClick={() => onOpenVerification(record.id)}
                      className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                    >
                      🔍 Verify
                    </button>
                  )}
                  
                  {record.can_change_privacy && (
                    <button
                      onClick={() => onUpdatePrivacy(record.id, !record.is_public)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      🔒 {record.is_public ? 'Make Private' : 'Make Public'}
                    </button>
                  )}
                </div>
                
                <p className="text-xs text-gray-500">
                  {new Date(record.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Create Tab Component
const CreateTab = ({ user, onCreateRecord }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    record_type: 'human',
    subject_id: '',
    subject_name: '',
    data: {
      notes: '',
      vital_signs: ''
    },
    is_public: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onCreateRecord(formData);
      setFormData({
        title: '',
        description: '',
        record_type: 'human',
        subject_id: '',
        subject_name: '',
        data: { notes: '', vital_signs: '' },
        is_public: false
      });
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setLoading(false);
    }
  };

  if (!['healthcare_provider', 'individual', 'admin'].includes(user.role)) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-600">You don't have permission to create health records.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Health Record</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Record Title
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter record title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Record Type
              </label>
              <select
                value={formData.record_type}
                onChange={(e) => setFormData({...formData, record_type: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="human">Human Health</option>
                <option value="animal">Animal Health</option>
                <option value="plant">Plant Health</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe the health record"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject ID
              </label>
              <input
                type="text"
                required
                value={formData.subject_id}
                onChange={(e) => setFormData({...formData, subject_id: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Unique identifier"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject Name
              </label>
              <input
                type="text"
                required
                value={formData.subject_name}
                onChange={(e) => setFormData({...formData, subject_name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Name of subject"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clinical Notes
            </label>
            <textarea
              value={formData.data.notes}
              onChange={(e) => setFormData({
                ...formData, 
                data: {...formData.data, notes: e.target.value}
              })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Clinical observations, diagnosis, treatment notes..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vital Signs
            </label>
            <textarea
              value={formData.data.vital_signs}
              onChange={(e) => setFormData({
                ...formData, 
                data: {...formData.data, vital_signs: e.target.value}
              })}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Blood pressure, temperature, etc."
            />
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="is_public"
              checked={formData.is_public}
              onChange={(e) => setFormData({...formData, is_public: e.target.checked})}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_public" className="text-sm font-medium text-gray-700">
              Make this record public (visible to researchers and healthcare providers)
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Creating Health Record...</span>
              </div>
            ) : (
              'Create Health Record'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// Blockchain Tab Component
const BlockchainTab = () => {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Blockchain Security</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Our blockchain technology ensures the integrity and immutability of all health records. 
          Every record is cryptographically secured and verified through our proof-of-work consensus mechanism.
        </p>
      </div>
      
      <BlockchainStats />
    </div>
  );
};

// MFA Setup Modal Component
const MFASetupModal = ({ mfaData, onEnable, onClose }) => {
  const [mfaToken, setMfaToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEnable = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onEnable(mfaToken);
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Setup Multi-Factor Authentication</h3>
          <p className="text-gray-600 text-sm">Scan the QR code with your authenticator app</p>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <img src={mfaData.qr_code} alt="MFA QR Code" className="mx-auto mb-4 rounded-lg" />
            <p className="text-xs text-gray-500 mb-2">Manual entry key:</p>
            <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono break-all">
              {mfaData.manual_entry_key}
            </code>
          </div>

          <form onSubmit={handleEnable} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter verification code
              </label>
              <input
                type="text"
                required
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-mono"
                placeholder="000000"
                maxLength={6}
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Enabling...' : 'Enable MFA'}
              </button>
            </div>
          </form>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Backup Codes</h4>
            <p className="text-yellow-700 text-sm mb-3">Save these codes in a safe place:</p>
            <div className="grid grid-cols-2 gap-2">
              {mfaData.backup_codes.map((code, index) => (
                <code key={index} className="bg-white px-2 py-1 rounded text-xs font-mono">
                  {code}
                </code>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;