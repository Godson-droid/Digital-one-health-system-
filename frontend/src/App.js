import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import QRCode from 'react-qr-code';

// Backend URL configuration
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://digital-one-health-system-cjum.onrender.com'
  : 'http://localhost:8001';

const API = `${BACKEND_URL}/api`;

// Configure axios defaults
axios.defaults.timeout = 30000;
axios.defaults.headers.common['Content-Type'] = 'application/json';

const App = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [healthRecords, setHealthRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [showMfaSetup, setShowMfaSetup] = useState(false);

  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '', mfa_token: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '', email: '', password: '', role: 'individual', full_name: ''
  });
  const [recordForm, setRecordForm] = useState({
    title: '', description: '', record_type: 'human', subject_id: '', subject_name: '',
    is_public: false, symptoms: '', diagnosis: '', treatment: '', vital_signs: {},
    lab_results: {}, medications: [], allergies: [], species: '', breed: '', age: '',
    weight: '', vaccination_status: '', location: '', environmental_factors: {},
    soil_conditions: '', climate_data: {}, plant_health_status: '', growth_stage: '',
    patient_id: '', patient_name: '', date_of_birth: '', gender: '', contact_info: ''
  });

  useEffect(() => {
    checkConnection();
    if (token) {
      getCurrentUser();
    }
  }, [token]);

  const checkConnection = async () => {
    try {
      setConnectionStatus('checking');
      const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 10000 });
      if (response.status === 200) {
        setConnectionStatus('connected');
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionStatus('disconnected');
      if (error.code === 'ECONNABORTED') {
        toast.error('Connection timeout - server may be starting up');
      } else {
        toast.error('Unable to connect to server');
      }
    }
  };

  const getCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      
      // Check if MFA is required but not enabled
      if (!response.data.mfa_enabled) {
        setShowMfaSetup(true);
        toast.warning('MFA setup is required for account security');
      }
    } catch (error) {
      console.error('Failed to get current user:', error);
      if (error.response?.status === 401) {
        logout();
      }
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, loginForm);
      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setCurrentView('dashboard');
      setLoginForm({ username: '', password: '', mfa_token: '' });
      toast.success('Login successful!');
      
      // Check if MFA is required but not enabled
      if (!userData.mfa_enabled) {
        setShowMfaSetup(true);
        toast.warning('MFA setup is required for account security');
      }
    } catch (error) {
      console.error('Login failed:', error);
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const register = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/register`, registerForm);
      toast.success('Registration successful! Please login and setup MFA.');
      setCurrentView('login');
      setRegisterForm({ username: '', email: '', password: '', role: 'individual', full_name: '' });
    } catch (error) {
      console.error('Registration failed:', error);
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const setupMFA = async () => {
    try {
      const response = await axios.post(`${API}/auth/setup-mfa`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMfaSetup(response.data);
    } catch (error) {
      console.error('MFA setup failed:', error);
      toast.error('Failed to setup MFA');
    }
  };

  const enableMFA = async (mfaToken) => {
    try {
      await axios.post(`${API}/auth/enable-mfa?mfa_token=${mfaToken}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('MFA enabled successfully!');
      setShowMfaSetup(false);
      setMfaSetup(null);
      getCurrentUser();
    } catch (error) {
      console.error('MFA enable failed:', error);
      toast.error('Failed to enable MFA. Please check your token.');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentView('login');
    toast.info('Logged out successfully');
  };

  const fetchHealthRecords = async () => {
    try {
      const response = await axios.get(`${API}/health-records`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHealthRecords(response.data || []);
    } catch (error) {
      console.error('Failed to fetch health records:', error);
      toast.error('Failed to load health records');
    }
  };

  const createHealthRecord = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/health-records`, recordForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Health record created successfully!');
      setCurrentView('records');
      fetchHealthRecords();
      setRecordForm({
        title: '', description: '', record_type: 'human', subject_id: '', subject_name: '',
        is_public: false, symptoms: '', diagnosis: '', treatment: '', vital_signs: {},
        lab_results: {}, medications: [], allergies: [], species: '', breed: '', age: '',
        weight: '', vaccination_status: '', location: '', environmental_factors: {},
        soil_conditions: '', climate_data: {}, plant_health_status: '', growth_stage: '',
        patient_id: '', patient_name: '', date_of_birth: '', gender: '', contact_info: ''
      });
    } catch (error) {
      console.error('Failed to create health record:', error);
      toast.error(error.response?.data?.detail || 'Failed to create health record');
    } finally {
      setLoading(false);
    }
  };

  const updateRecordPrivacy = async (recordId, isPublic) => {
    try {
      await axios.put(`${API}/health-records/${recordId}/privacy?is_public=${isPublic}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Record privacy updated to ${isPublic ? 'public' : 'private'}`);
      fetchHealthRecords();
    } catch (error) {
      console.error('Failed to update privacy:', error);
      toast.error('Failed to update record privacy');
    }
  };

  useEffect(() => {
    if (currentView === 'records' && token) {
      fetchHealthRecords();
    }
  }, [currentView, token]);

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

  const ConnectionStatus = () => (
    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
      connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
      connectionStatus === 'checking' ? 'bg-yellow-100 text-yellow-800' :
      'bg-red-100 text-red-800'
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        connectionStatus === 'connected' ? 'bg-green-500' :
        connectionStatus === 'checking' ? 'bg-yellow-500 animate-pulse' :
        'bg-red-500'
      }`}></div>
      <span>{connectionStatus === 'connected' ? 'Connected' : 
             connectionStatus === 'checking' ? 'Connecting...' : 'Disconnected'}</span>
    </div>
  );

  const MFASetupModal = () => {
    const [mfaToken, setMfaToken] = useState('');

    const handleSetupMFA = async () => {
      await setupMFA();
    };

    const handleEnableMFA = async () => {
      if (mfaToken.length === 6) {
        await enableMFA(mfaToken);
      } else {
        toast.error('Please enter a valid 6-digit code');
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">MFA Setup Required</h3>
            <p className="text-gray-600 text-sm">Multi-factor authentication is mandatory for account security</p>
          </div>

          {!mfaSetup ? (
            <div className="text-center">
              <p className="text-gray-600 mb-4">Click below to generate your MFA QR code</p>
              <button
                onClick={handleSetupMFA}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium"
              >
                Generate MFA Setup
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">Scan this QR code with your authenticator app:</p>
                <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block">
                  <QRCode 
                    value={`otpauth://totp/Digital%20One%20Health:${user?.email}?secret=${mfaSetup.manual_entry_key}&issuer=Digital%20One%20Health`}
                    size={200}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Manual entry key: <code className="bg-gray-100 px-2 py-1 rounded">{mfaSetup.manual_entry_key}</code>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter 6-digit code from your authenticator app:
                </label>
                <input
                  type="text"
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono"
                  placeholder="000000"
                  maxLength="6"
                />
              </div>

              <button
                onClick={handleEnableMFA}
                disabled={mfaToken.length !== 6}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-4 rounded-xl hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                Enable MFA
              </button>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Backup Codes:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {mfaSetup.backup_codes?.map((code, index) => (
                    <div key={index} className="bg-white p-2 rounded border text-center">
                      {code}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-blue-700 mt-2">Save these codes in a secure location</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-green-600 rounded-2xl flex items-center justify-center mr-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="text-left">
                <h1 className="text-3xl font-bold text-gray-900">Digital One Health</h1>
                <p className="text-gray-600">Secure Health Data Platform</p>
              </div>
            </div>
            <ConnectionStatus />
          </div>

          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex mb-6">
                <button
                  onClick={() => setCurrentView('login')}
                  className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all duration-200 ${
                    currentView === 'login' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setCurrentView('register')}
                  className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all duration-200 ${
                    currentView === 'register' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Register
                </button>
              </div>

              {currentView === 'login' ? (
                <form onSubmit={login} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <input
                      type="text"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">MFA Code (if enabled)</label>
                    <input
                      type="text"
                      value={loginForm.mfa_token}
                      onChange={(e) => setLoginForm({...loginForm, mfa_token: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-mono"
                      placeholder="000000"
                      maxLength="6"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </button>
                </form>
              ) : (
                <form onSubmit={register} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={registerForm.full_name}
                      onChange={(e) => setRegisterForm({...registerForm, full_name: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <input
                      type="text"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <input
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select
                      value={registerForm.role}
                      onChange={(e) => setRegisterForm({...registerForm, role: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="individual">Individual</option>
                      <option value="healthcare_provider">Healthcare Provider</option>
                      <option value="researcher">Researcher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-4 rounded-xl hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                  >
                    {loading ? 'Registering...' : 'Register'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
        <ToastContainer position="top-right" autoClose={5000} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-green-600 rounded-xl flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Digital One Health</h1>
                  <p className="text-xs text-gray-600">Secure Health Platform</p>
                </div>
              </div>
              <ConnectionStatus />
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-1">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                    currentView === 'dashboard' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Dashboard
                </button>

                {/* Health Data Dropdown */}
                <div className="relative group">
                  <button className="px-4 py-2 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-all duration-200 flex items-center space-x-1">
                    <span>Health Data</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-2">
                      <button
                        onClick={() => {setCurrentView('create-record'); setRecordForm({...recordForm, record_type: 'human'});}}
                        className="w-full text-left px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center space-x-2"
                      >
                        <span>👤</span>
                        <span>Human Health</span>
                      </button>
                      <button
                        onClick={() => {setCurrentView('create-record'); setRecordForm({...recordForm, record_type: 'animal'});}}
                        className="w-full text-left px-4 py-2 text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors flex items-center space-x-2"
                      >
                        <span>🐾</span>
                        <span>Animal Health</span>
                      </button>
                      <button
                        onClick={() => {setCurrentView('create-record'); setRecordForm({...recordForm, record_type: 'plant'});}}
                        className="w-full text-left px-4 py-2 text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 transition-colors flex items-center space-x-2"
                      >
                        <span>🌱</span>
                        <span>Plant & Environment</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setCurrentView('records')}
                  className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                    currentView === 'records' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  View Records
                </button>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                  <p className="text-xs text-gray-600 capitalize">{user?.role?.replace('_', ' ')}</p>
                </div>
                <button
                  onClick={logout}
                  className="bg-red-100 text-red-700 px-4 py-2 rounded-xl hover:bg-red-200 transition-all duration-200 font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-white border-t border-gray-200">
        <div className="flex justify-around py-2">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg ${
              currentView === 'dashboard' ? 'text-blue-600' : 'text-gray-600'
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            </svg>
            <span className="text-xs">Dashboard</span>
          </button>
          <button
            onClick={() => setCurrentView('create-record')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg ${
              currentView === 'create-record' ? 'text-blue-600' : 'text-gray-600'
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs">Create</span>
          </button>
          <button
            onClick={() => setCurrentView('records')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg ${
              currentView === 'records' ? 'text-blue-600' : 'text-gray-600'
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs">Records</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {currentView === 'dashboard' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Digital One Health</h2>
              <p className="text-gray-600">Secure health data management platform</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{healthRecords.length}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Total Records</h3>
                <p className="text-gray-600 text-sm">Health records in your account</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {healthRecords.filter(r => r.is_verified).length}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Verified Records</h3>
                <p className="text-gray-600 text-sm">Records with integrity verification</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {user?.mfa_enabled ? '✓' : '✗'}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">MFA Status</h3>
                <p className="text-gray-600 text-sm">
                  {user?.mfa_enabled ? 'Multi-factor authentication enabled' : 'MFA setup required'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Records</h3>
              {healthRecords.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-600 mb-4">No health records yet</p>
                  <button
                    onClick={() => setCurrentView('create-record')}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium"
                  >
                    Create Your First Record
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {healthRecords.slice(0, 3).map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 bg-gradient-to-br ${getRecordTypeColor(record.record_type)} rounded-xl flex items-center justify-center text-white text-lg`}>
                          {getRecordTypeIcon(record.record_type)}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{record.title}</h4>
                          <p className="text-sm text-gray-600">{record.subject_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          record.is_public 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {record.is_public ? 'Public' : 'Private'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'create-record' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Health Record</h2>
                <p className="text-gray-600">Add detailed health information to the secure platform</p>
              </div>

              <form onSubmit={createHealthRecord} className="space-y-8">
                {/* Basic Information */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                      <input
                        type="text"
                        value={recordForm.title}
                        onChange={(e) => setRecordForm({...recordForm, title: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Record title"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Record Type *</label>
                      <select
                        value={recordForm.record_type}
                        onChange={(e) => setRecordForm({...recordForm, record_type: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="human">👤 Human Health</option>
                        <option value="animal">🐾 Animal Health</option>
                        <option value="plant">🌱 Plant & Environment</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject Name *</label>
                      <input
                        type="text"
                        value={recordForm.subject_name}
                        onChange={(e) => setRecordForm({...recordForm, subject_name: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Name of the subject"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject ID</label>
                      <input
                        type="text"
                        value={recordForm.subject_id}
                        onChange={(e) => setRecordForm({...recordForm, subject_id: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Unique identifier (auto-generated if empty)"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                      <textarea
                        value={recordForm.description}
                        onChange={(e) => setRecordForm({...recordForm, description: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows="3"
                        placeholder="Detailed description of the health record"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={recordForm.is_public}
                          onChange={(e) => setRecordForm({...recordForm, is_public: e.target.checked})}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Make this record public (visible to researchers and healthcare providers)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Patient Information (Human/Animal) */}
                {(recordForm.record_type === 'human' || recordForm.record_type === 'animal') && (
                  <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                    <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {recordForm.record_type === 'human' ? 'Patient Information' : 'Animal Information'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {recordForm.record_type === 'human' ? 'Patient ID' : 'Animal ID'}
                        </label>
                        <input
                          type="text"
                          value={recordForm.patient_id}
                          onChange={(e) => setRecordForm({...recordForm, patient_id: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="Patient identification number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {recordForm.record_type === 'human' ? 'Patient Name' : 'Animal Name'}
                        </label>
                        <input
                          type="text"
                          value={recordForm.patient_name}
                          onChange={(e) => setRecordForm({...recordForm, patient_name: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="Full patient name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {recordForm.record_type === 'human' ? 'Date of Birth' : 'Age'}
                        </label>
                        <input
                          type={recordForm.record_type === 'human' ? 'date' : 'text'}
                          value={recordForm.record_type === 'human' ? recordForm.date_of_birth : recordForm.age}
                          onChange={(e) => setRecordForm({
                            ...recordForm, 
                            [recordForm.record_type === 'human' ? 'date_of_birth' : 'age']: e.target.value
                          })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder={recordForm.record_type === 'human' ? '' : 'Age of animal'}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {recordForm.record_type === 'human' ? 'Gender' : 'Species'}
                        </label>
                        <input
                          type="text"
                          value={recordForm.record_type === 'human' ? recordForm.gender : recordForm.species}
                          onChange={(e) => setRecordForm({
                            ...recordForm, 
                            [recordForm.record_type === 'human' ? 'gender' : 'species']: e.target.value
                          })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder={recordForm.record_type === 'human' ? 'Gender' : 'Animal species'}
                        />
                      </div>
                      {recordForm.record_type === 'animal' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Breed</label>
                            <input
                              type="text"
                              value={recordForm.breed}
                              onChange={(e) => setRecordForm({...recordForm, breed: e.target.value})}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              placeholder="Animal breed"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Weight</label>
                            <input
                              type="text"
                              value={recordForm.weight}
                              onChange={(e) => setRecordForm({...recordForm, weight: e.target.value})}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              placeholder="Animal weight"
                            />
                          </div>
                        </>
                      )}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Contact Information</label>
                        <input
                          type="text"
                          value={recordForm.contact_info}
                          onChange={(e) => setRecordForm({...recordForm, contact_info: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="Phone, email, or emergency contact"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Plant/Environment Information */}
                {recordForm.record_type === 'plant' && (
                  <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200">
                    <h3 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Plant & Environment Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                        <input
                          type="text"
                          value={recordForm.location}
                          onChange={(e) => setRecordForm({...recordForm, location: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="Geographic location"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Plant Health Status</label>
                        <input
                          type="text"
                          value={recordForm.plant_health_status}
                          onChange={(e) => setRecordForm({...recordForm, plant_health_status: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="Current health status"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Growth Stage</label>
                        <input
                          type="text"
                          value={recordForm.growth_stage}
                          onChange={(e) => setRecordForm({...recordForm, growth_stage: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="Current growth stage"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Soil Conditions</label>
                        <input
                          type="text"
                          value={recordForm.soil_conditions}
                          onChange={(e) => setRecordForm({...recordForm, soil_conditions: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="Soil type and conditions"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Medical Information (Human/Animal) */}
                {(recordForm.record_type === 'human' || recordForm.record_type === 'animal') && (
                  <div className="bg-red-50 p-6 rounded-2xl border border-red-200">
                    <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Medical Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Symptoms</label>
                        <textarea
                          value={recordForm.symptoms}
                          onChange={(e) => setRecordForm({...recordForm, symptoms: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          rows="3"
                          placeholder="Describe symptoms experienced"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis</label>
                        <textarea
                          value={recordForm.diagnosis}
                          onChange={(e) => setRecordForm({...recordForm, diagnosis: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          rows="3"
                          placeholder="Medical diagnosis or assessment"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Treatment</label>
                        <textarea
                          value={recordForm.treatment}
                          onChange={(e) => setRecordForm({...recordForm, treatment: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          rows="3"
                          placeholder="Treatment plan or procedures"
                        />
                      </div>
                      {recordForm.record_type === 'animal' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Vaccination Status</label>
                          <input
                            type="text"
                            value={recordForm.vaccination_status}
                            onChange={(e) => setRecordForm({...recordForm, vaccination_status: e.target.value})}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            placeholder="Current vaccination status"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setCurrentView('dashboard')}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                  >
                    {loading ? 'Creating...' : 'Create Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {currentView === 'records' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Health Records</h2>
                <p className="text-gray-600">Manage your health data records</p>
              </div>
              <button
                onClick={() => setCurrentView('create-record')}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Record</span>
              </button>
            </div>

            {healthRecords.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                <svg className="w-20 h-20 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Records Found</h3>
                <p className="text-gray-600 mb-6">Start by creating your first health record</p>
                <button
                  onClick={() => setCurrentView('create-record')}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium"
                >
                  Create First Record
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {healthRecords.map((record) => (
                  <div key={record.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${getRecordTypeColor(record.record_type)} rounded-xl flex items-center justify-center text-white text-xl`}>
                        {getRecordTypeIcon(record.record_type)}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          record.is_public 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
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

                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 mb-1">{record.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{record.subject_name}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{record.description}</p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <span>Created: {new Date(record.created_at).toLocaleDateString()}</span>
                      <span className="capitalize">{record.record_type}</span>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="flex-1 bg-blue-100 text-blue-700 py-2 px-3 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                      >
                        View Details
                      </button>
                      {record.can_change_privacy && (
                        <button
                          onClick={() => updateRecordPrivacy(record.id, !record.is_public)}
                          className="bg-gray-100 text-gray-700 py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          {record.is_public ? 'Make Private' : 'Make Public'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Record Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${getRecordTypeColor(selectedRecord.record_type)} rounded-xl flex items-center justify-center text-white text-xl`}>
                    {getRecordTypeIcon(selectedRecord.record_type)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{selectedRecord.title}</h3>
                    <p className="text-gray-600">{selectedRecord.subject_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Basic Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-600">Type:</span> <span className="capitalize">{selectedRecord.record_type}</span></div>
                    <div><span className="text-gray-600">Subject ID:</span> <span>{selectedRecord.subject_id}</span></div>
                    <div><span className="text-gray-600">Created:</span> <span>{new Date(selectedRecord.created_at).toLocaleString()}</span></div>
                    <div><span className="text-gray-600">Privacy:</span> <span>{selectedRecord.is_public ? 'Public' : 'Private'}</span></div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Security Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className={`w-3 h-3 rounded-full ${selectedRecord.is_verified ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                      <span>{selectedRecord.is_verified ? 'Verified' : 'Pending Verification'}</span>
                    </div>
                    <div className="text-gray-600">Data integrity protected by cryptographic security</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-xl">{selectedRecord.description}</p>
              </div>

              {selectedRecord.symptoms && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Symptoms</h4>
                  <p className="text-gray-700 bg-red-50 p-4 rounded-xl border border-red-200">{selectedRecord.symptoms}</p>
                </div>
              )}

              {selectedRecord.diagnosis && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Diagnosis</h4>
                  <p className="text-gray-700 bg-blue-50 p-4 rounded-xl border border-blue-200">{selectedRecord.diagnosis}</p>
                </div>
              )}

              {selectedRecord.treatment && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Treatment</h4>
                  <p className="text-gray-700 bg-green-50 p-4 rounded-xl border border-green-200">{selectedRecord.treatment}</p>
                </div>
              )}

              {selectedRecord.record_type === 'animal' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedRecord.species && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Species</h4>
                      <p className="text-gray-700">{selectedRecord.species}</p>
                    </div>
                  )}
                  {selectedRecord.breed && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Breed</h4>
                      <p className="text-gray-700">{selectedRecord.breed}</p>
                    </div>
                  )}
                  {selectedRecord.age && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Age</h4>
                      <p className="text-gray-700">{selectedRecord.age}</p>
                    </div>
                  )}
                  {selectedRecord.weight && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Weight</h4>
                      <p className="text-gray-700">{selectedRecord.weight}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedRecord.record_type === 'plant' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedRecord.location && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Location</h4>
                      <p className="text-gray-700">{selectedRecord.location}</p>
                    </div>
                  )}
                  {selectedRecord.plant_health_status && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Health Status</h4>
                      <p className="text-gray-700">{selectedRecord.plant_health_status}</p>
                    </div>
                  )}
                  {selectedRecord.growth_stage && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Growth Stage</h4>
                      <p className="text-gray-700">{selectedRecord.growth_stage}</p>
                    </div>
                  )}
                  {selectedRecord.soil_conditions && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Soil Conditions</h4>
                      <p className="text-gray-700">{selectedRecord.soil_conditions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MFA Setup Modal */}
      {showMfaSetup && <MFASetupModal />}

      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
};

export default App;