import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import QRCode from 'react-qr-code';
import './App.css';

// Backend URL configuration
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://digital-one-health-system-cjum.onrender.com'
  : 'http://localhost:8001';

const API = `${BACKEND_URL}/api`;

// Configure axios defaults
axios.defaults.timeout = 30000;
axios.defaults.headers.common['Content-Type'] = 'application/json';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [healthRecords, setHealthRecords] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaData, setMfaData] = useState(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);

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
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      checkConnection();
    } else {
      setConnectionStatus('disconnected');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const checkConnection = async () => {
    try {
      setConnectionStatus('checking');
      const response = await axios.get(`${BACKEND_URL}/health`, {
        timeout: 10000,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (response.status === 200) {
        setConnectionStatus('connected');
        console.log('✅ Backend connection successful');
      }
    } catch (error) {
      console.error('❌ Backend connection failed:', error);
      setConnectionStatus('disconnected');
      
      if (error.code === 'ECONNABORTED') {
        toast.error('Connection timeout - server may be starting up');
      } else if (error.response?.status === 401) {
        handleLogout();
      } else {
        toast.error('Unable to connect to server');
      }
    }
  };

  const makeRequest = async (method, url, data = null, customTimeout = 30000) => {
    try {
      const config = {
        method,
        url: `${API}${url}`,
        timeout: customTimeout,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      };

      if (data) {
        config.data = data;
      }

      console.log(`🔄 ${method} ${url}`, data ? { data } : '');
      const response = await axios(config);
      console.log(`✅ ${method} ${url} - Success:`, response.data);
      return response;
    } catch (error) {
      console.error(`❌ ${method} ${url} - Error:`, error);
      
      if (error.code === 'ECONNABORTED') {
        toast.error(`Request timeout after ${customTimeout/1000} seconds`);
      } else if (error.response?.status === 401) {
        toast.error('Authentication failed');
        handleLogout();
      } else if (error.response?.status === 403) {
        toast.error('Access denied');
      } else if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error(`Network error: ${error.message}`);
      }
      throw error;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await makeRequest('POST', '/auth/login', loginForm);
      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setLoginForm({ username: '', password: '', mfa_token: '' });
      setCurrentView('dashboard');
      toast.success('Login successful!');
      
      // Check if MFA is enabled
      if (!userData.mfa_enabled) {
        toast.info('Please set up MFA for enhanced security');
        setShowMFASetup(true);
      }
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.full_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await makeRequest('POST', '/auth/register', registerForm);
      toast.success('Registration successful! Please login and set up MFA.');
      setRegisterForm({ username: '', email: '', password: '', role: 'individual', full_name: '' });
      setCurrentView('login');
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupMFA = async () => {
    setLoading(true);
    try {
      const response = await makeRequest('POST', '/auth/setup-mfa');
      setMfaData(response.data);
      setShowMFASetup(true);
      toast.success('MFA setup initiated. Please scan the QR code with your authenticator app.');
    } catch (error) {
      console.error('MFA setup failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const enableMFA = async (mfaToken) => {
    if (!mfaToken) {
      toast.error('Please enter the MFA token from your authenticator app');
      return;
    }

    setLoading(true);
    try {
      await makeRequest('POST', `/auth/enable-mfa?mfa_token=${mfaToken}`);
      setMfaEnabled(true);
      setShowMFASetup(false);
      toast.success('MFA enabled successfully!');
      
      // Update user data
      const updatedUser = { ...user, mfa_enabled: true };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('MFA enable failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [recordsResponse, statsResponse] = await Promise.all([
        makeRequest('GET', '/health-records'),
        makeRequest('GET', '/dashboard/stats').catch(() => ({ data: {} }))
      ]);
      
      setHealthRecords(recordsResponse.data || []);
      setDashboardStats(statsResponse.data || {});
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    if (!recordForm.title || !recordForm.description || !recordForm.subject_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // Generate subject_id if not provided
      if (!recordForm.subject_id) {
        recordForm.subject_id = `${recordForm.record_type}_${Date.now()}`;
      }

      await makeRequest('POST', '/health-records', recordForm);
      toast.success('Health record created successfully!');
      setShowCreateForm(false);
      setRecordForm({
        title: '', description: '', record_type: 'human', subject_id: '', subject_name: '',
        is_public: false, symptoms: '', diagnosis: '', treatment: '', vital_signs: {},
        lab_results: {}, medications: [], allergies: [], species: '', breed: '', age: '',
        weight: '', vaccination_status: '', location: '', environmental_factors: {},
        soil_conditions: '', climate_data: {}, plant_health_status: '', growth_stage: '',
        patient_id: '', patient_name: '', date_of_birth: '', gender: '', contact_info: ''
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to create record:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrivacy = async (recordId, isPublic) => {
    try {
      await makeRequest('PUT', `/health-records/${recordId}/privacy?is_public=${isPublic}`);
      toast.success(`Record privacy updated to ${isPublic ? 'public' : 'private'}`);
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to update privacy:', error);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentView('login');
    setConnectionStatus('disconnected');
    toast.info('Logged out successfully');
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
      <span className="capitalize">{connectionStatus}</span>
      {connectionStatus === 'disconnected' && (
        <button onClick={checkConnection} className="ml-1 text-red-600 hover:text-red-800">
          ↻
        </button>
      )}
    </div>
  );

  // MFA Setup Modal
  const MFASetupModal = () => {
    const [mfaToken, setMfaToken] = useState('');

    const handleSetupMFA = async () => {
      if (!mfaData) {
        await setupMFA();
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Set Up Multi-Factor Authentication</h3>
            <p className="text-gray-600 text-sm">MFA is required for enhanced security</p>
          </div>

          {!mfaData ? (
            <div className="text-center">
              <button
                onClick={handleSetupMFA}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? 'Setting up...' : 'Start MFA Setup'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">Scan this QR code with your authenticator app:</p>
                <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block">
                  <QRCode
                    value={`otpauth://totp/Digital%20One%20Health:${user?.email}?secret=${mfaData.manual_entry_key}&issuer=Digital%20One%20Health&algorithm=SHA1&digits=6&period=30`}
                    size={200}
                    level="M"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Manual entry key: <code className="bg-gray-100 px-2 py-1 rounded">{mfaData.manual_entry_key}</code>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter verification code from your app:
                </label>
                <input
                  type="text"
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value)}
                  placeholder="000000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono"
                  maxLength="6"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => enableMFA(mfaToken)}
                  disabled={loading || !mfaToken}
                  className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Verifying...' : 'Enable MFA'}
                </button>
              </div>

              {mfaData.backup_codes && (
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                  <p className="text-sm font-medium text-yellow-800 mb-2">Backup Codes (save these safely):</p>
                  <div className="grid grid-cols-1 gap-1 text-xs font-mono">
                    {mfaData.backup_codes.map((code, index) => (
                      <span key={index} className="bg-white px-2 py-1 rounded border">{code}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Create Record Form
  const CreateRecordForm = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Create Health Record</h3>
              <p className="text-sm text-gray-600">Add detailed health information to the secure platform</p>
            </div>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateRecord} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
            <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Basic Information
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                <input
                  type="text"
                  value={recordForm.title}
                  onChange={(e) => setRecordForm({...recordForm, title: e.target.value})}
                  placeholder="Record title"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <option value="plant">🌱 Plant/Environment Health</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Name *</label>
                <input
                  type="text"
                  value={recordForm.subject_name}
                  onChange={(e) => setRecordForm({...recordForm, subject_name: e.target.value})}
                  placeholder="Name of the subject"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject ID</label>
                <input
                  type="text"
                  value={recordForm.subject_id}
                  onChange={(e) => setRecordForm({...recordForm, subject_id: e.target.value})}
                  placeholder="Unique identifier (auto-generated if empty)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea
                value={recordForm.description}
                onChange={(e) => setRecordForm({...recordForm, description: e.target.value})}
                placeholder="Detailed description of the health record"
                rows="3"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div className="mt-4">
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

          {/* Conditional sections based on record type */}
          {recordForm.record_type === 'human' && (
            <>
              {/* Patient Information */}
              <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                <h4 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Patient Information
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Patient ID</label>
                    <input
                      type="text"
                      value={recordForm.patient_id}
                      onChange={(e) => setRecordForm({...recordForm, patient_id: e.target.value})}
                      placeholder="Patient identification number"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Patient Name</label>
                    <input
                      type="text"
                      value={recordForm.patient_name}
                      onChange={(e) => setRecordForm({...recordForm, patient_name: e.target.value})}
                      placeholder="Full patient name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                    <input
                      type="date"
                      value={recordForm.date_of_birth}
                      onChange={(e) => setRecordForm({...recordForm, date_of_birth: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                    <select
                      value={recordForm.gender}
                      onChange={(e) => setRecordForm({...recordForm, gender: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Information</label>
                    <input
                      type="text"
                      value={recordForm.contact_info}
                      onChange={(e) => setRecordForm({...recordForm, contact_info: e.target.value})}
                      placeholder="Phone, email, or emergency contact"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              <div className="bg-red-50 p-6 rounded-2xl border border-red-200">
                <h4 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Medical Information
                </h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Symptoms</label>
                    <textarea
                      value={recordForm.symptoms}
                      onChange={(e) => setRecordForm({...recordForm, symptoms: e.target.value})}
                      placeholder="Describe symptoms experienced"
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis</label>
                    <textarea
                      value={recordForm.diagnosis}
                      onChange={(e) => setRecordForm({...recordForm, diagnosis: e.target.value})}
                      placeholder="Medical diagnosis or assessment"
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Treatment</label>
                    <textarea
                      value={recordForm.treatment}
                      onChange={(e) => setRecordForm({...recordForm, treatment: e.target.value})}
                      placeholder="Treatment plan or procedures"
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {recordForm.record_type === 'animal' && (
            <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
              <h4 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Animal Information
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Species</label>
                  <input
                    type="text"
                    value={recordForm.species}
                    onChange={(e) => setRecordForm({...recordForm, species: e.target.value})}
                    placeholder="Animal species"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Breed</label>
                  <input
                    type="text"
                    value={recordForm.breed}
                    onChange={(e) => setRecordForm({...recordForm, breed: e.target.value})}
                    placeholder="Animal breed"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                  <input
                    type="text"
                    value={recordForm.age}
                    onChange={(e) => setRecordForm({...recordForm, age: e.target.value})}
                    placeholder="Animal age"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Weight</label>
                  <input
                    type="text"
                    value={recordForm.weight}
                    onChange={(e) => setRecordForm({...recordForm, weight: e.target.value})}
                    placeholder="Animal weight"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vaccination Status</label>
                  <textarea
                    value={recordForm.vaccination_status}
                    onChange={(e) => setRecordForm({...recordForm, vaccination_status: e.target.value})}
                    placeholder="Vaccination history and status"
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {recordForm.record_type === 'plant' && (
            <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200">
              <h4 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Plant/Environment Information
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={recordForm.location}
                    onChange={(e) => setRecordForm({...recordForm, location: e.target.value})}
                    placeholder="Geographic location"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Plant Health Status</label>
                  <input
                    type="text"
                    value={recordForm.plant_health_status}
                    onChange={(e) => setRecordForm({...recordForm, plant_health_status: e.target.value})}
                    placeholder="Current health status"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Growth Stage</label>
                  <input
                    type="text"
                    value={recordForm.growth_stage}
                    onChange={(e) => setRecordForm({...recordForm, growth_stage: e.target.value})}
                    placeholder="Current growth stage"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Soil Conditions</label>
                  <input
                    type="text"
                    value={recordForm.soil_conditions}
                    onChange={(e) => setRecordForm({...recordForm, soil_conditions: e.target.value})}
                    placeholder="Soil type and conditions"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Record</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Record Detail Modal
  const RecordDetailModal = ({ record, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 bg-gradient-to-br ${getRecordTypeColor(record.record_type)} rounded-xl flex items-center justify-center text-white text-xl`}>
                {getRecordTypeIcon(record.record_type)}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{record.title}</h3>
                <p className="text-sm text-gray-600">{record.record_type} health record</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
            <h4 className="text-lg font-semibold text-blue-900 mb-4">Basic Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Subject:</span>
                <span className="ml-2 text-gray-900">{record.subject_name}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Subject ID:</span>
                <span className="ml-2 text-gray-900 font-mono text-xs">{record.subject_id}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Privacy:</span>
                <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  record.is_public ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {record.is_public ? '🌐 Public' : '🔒 Private'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Created:</span>
                <span className="ml-2 text-gray-900">{new Date(record.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="mt-4">
              <span className="font-medium text-gray-700">Description:</span>
              <p className="mt-1 text-gray-900">{record.description}</p>
            </div>
          </div>

          {/* Conditional content based on record type */}
          {record.record_type === 'human' && (
            <>
              {(record.patient_name || record.patient_id || record.date_of_birth || record.gender || record.contact_info) && (
                <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                  <h4 className="text-lg font-semibold text-green-900 mb-4">Patient Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {record.patient_name && (
                      <div>
                        <span className="font-medium text-gray-700">Patient Name:</span>
                        <span className="ml-2 text-gray-900">{record.patient_name}</span>
                      </div>
                    )}
                    {record.patient_id && (
                      <div>
                        <span className="font-medium text-gray-700">Patient ID:</span>
                        <span className="ml-2 text-gray-900">{record.patient_id}</span>
                      </div>
                    )}
                    {record.date_of_birth && (
                      <div>
                        <span className="font-medium text-gray-700">Date of Birth:</span>
                        <span className="ml-2 text-gray-900">{record.date_of_birth}</span>
                      </div>
                    )}
                    {record.gender && (
                      <div>
                        <span className="font-medium text-gray-700">Gender:</span>
                        <span className="ml-2 text-gray-900 capitalize">{record.gender}</span>
                      </div>
                    )}
                    {record.contact_info && (
                      <div className="md:col-span-2">
                        <span className="font-medium text-gray-700">Contact:</span>
                        <span className="ml-2 text-gray-900">{record.contact_info}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(record.symptoms || record.diagnosis || record.treatment) && (
                <div className="bg-red-50 p-6 rounded-2xl border border-red-200">
                  <h4 className="text-lg font-semibold text-red-900 mb-4">Medical Information</h4>
                  <div className="space-y-4 text-sm">
                    {record.symptoms && (
                      <div>
                        <span className="font-medium text-gray-700">Symptoms:</span>
                        <p className="mt-1 text-gray-900">{record.symptoms}</p>
                      </div>
                    )}
                    {record.diagnosis && (
                      <div>
                        <span className="font-medium text-gray-700">Diagnosis:</span>
                        <p className="mt-1 text-gray-900">{record.diagnosis}</p>
                      </div>
                    )}
                    {record.treatment && (
                      <div>
                        <span className="font-medium text-gray-700">Treatment:</span>
                        <p className="mt-1 text-gray-900">{record.treatment}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {record.record_type === 'animal' && (
            <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
              <h4 className="text-lg font-semibold text-green-900 mb-4">Animal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {record.species && (
                  <div>
                    <span className="font-medium text-gray-700">Species:</span>
                    <span className="ml-2 text-gray-900">{record.species}</span>
                  </div>
                )}
                {record.breed && (
                  <div>
                    <span className="font-medium text-gray-700">Breed:</span>
                    <span className="ml-2 text-gray-900">{record.breed}</span>
                  </div>
                )}
                {record.age && (
                  <div>
                    <span className="font-medium text-gray-700">Age:</span>
                    <span className="ml-2 text-gray-900">{record.age}</span>
                  </div>
                )}
                {record.weight && (
                  <div>
                    <span className="font-medium text-gray-700">Weight:</span>
                    <span className="ml-2 text-gray-900">{record.weight}</span>
                  </div>
                )}
                {record.vaccination_status && (
                  <div className="md:col-span-2">
                    <span className="font-medium text-gray-700">Vaccination Status:</span>
                    <p className="mt-1 text-gray-900">{record.vaccination_status}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {record.record_type === 'plant' && (
            <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200">
              <h4 className="text-lg font-semibold text-yellow-900 mb-4">Plant/Environment Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {record.location && (
                  <div>
                    <span className="font-medium text-gray-700">Location:</span>
                    <span className="ml-2 text-gray-900">{record.location}</span>
                  </div>
                )}
                {record.plant_health_status && (
                  <div>
                    <span className="font-medium text-gray-700">Health Status:</span>
                    <span className="ml-2 text-gray-900">{record.plant_health_status}</span>
                  </div>
                )}
                {record.growth_stage && (
                  <div>
                    <span className="font-medium text-gray-700">Growth Stage:</span>
                    <span className="ml-2 text-gray-900">{record.growth_stage}</span>
                  </div>
                )}
                {record.soil_conditions && (
                  <div>
                    <span className="font-medium text-gray-700">Soil Conditions:</span>
                    <span className="ml-2 text-gray-900">{record.soil_conditions}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Record ID: <span className="font-mono">{record.id}</span>
            </div>
            
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              {record.can_change_privacy && (
                <button
                  onClick={() => handleUpdatePrivacy(record.id, !record.is_public)}
                  className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    record.is_public 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d={record.is_public 
                        ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        : "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                      } 
                    />
                  </svg>
                  <span>Make {record.is_public ? 'Private' : 'Public'}</span>
                </button>
              )}
              
              <button
                onClick={onClose}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200"
              >
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Login Form
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Digital One Health</h1>
              <p className="text-gray-600">Secure Health Data Platform</p>
              <div className="mt-4">
                <ConnectionStatus />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
              <div className="flex space-x-1 mb-6">
                <button
                  onClick={() => setCurrentView('login')}
                  className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                    currentView === 'login' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setCurrentView('register')}
                  className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                    currentView === 'register' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Register
                </button>
              </div>

              {currentView === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
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
                      placeholder="000000"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-mono"
                      maxLength="6"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
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
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Creating account...</span>
                      </>
                    ) : (
                      <span>Create Account</span>
                    )}
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

  // Main Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
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
              <ConnectionStatus />
              
              {/* Navigation Menu */}
              <div className="hidden md:flex items-center space-x-1">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    currentView === 'dashboard' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Dashboard
                </button>
                
                {/* Health Data Dropdown */}
                <div className="relative group">
                  <button className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 flex items-center space-x-1">
                    <span>Health Data</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setRecordForm({...recordForm, record_type: 'human'});
                          setShowCreateForm(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <span>👤</span>
                        <span>Human Health</span>
                      </button>
                      <button
                        onClick={() => {
                          setRecordForm({...recordForm, record_type: 'animal'});
                          setShowCreateForm(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <span>🐾</span>
                        <span>Animal Health</span>
                      </button>
                      <button
                        onClick={() => {
                          setRecordForm({...recordForm, record_type: 'plant'});
                          setShowCreateForm(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <span>🌱</span>
                        <span>Environment Health</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setCurrentView('records')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    currentView === 'records' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  View Records
                </button>
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                  <p className="text-xs text-gray-600 capitalize">{user.role.replace('_', ' ')}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl flex items-center justify-center text-white font-medium">
                  {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {currentView === 'dashboard' && (
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Welcome back, {user.full_name}!</h2>
                  <p className="text-blue-100">Manage your secure health data with confidence</p>
                  {!user.mfa_enabled && (
                    <div className="mt-4 bg-yellow-500 bg-opacity-20 border border-yellow-300 rounded-xl p-4">
                      <p className="text-yellow-100 text-sm mb-2">🔒 Enhanced Security Recommended</p>
                      <button
                        onClick={setupMFA}
                        className="bg-yellow-500 text-yellow-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-400 transition-colors"
                      >
                        Set up MFA
                      </button>
                    </div>
                  )}
                </div>
                <div className="hidden md:block">
                  <div className="w-24 h-24 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-blue-600">{healthRecords.length}</p>
                    <p className="text-gray-600 text-sm font-medium">Total Records</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-green-600">{healthRecords.filter(r => r.is_public).length}</p>
                    <p className="text-gray-600 text-sm font-medium">Public Records</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-red-600">{healthRecords.filter(r => !r.is_public).length}</p>
                    <p className="text-gray-600 text-sm font-medium">Private Records</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-purple-600">{healthRecords.filter(r => r.is_verified).length}</p>
                    <p className="text-gray-600 text-sm font-medium">Verified Records</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Records */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Recent Health Records</h3>
                <button
                  onClick={() => setCurrentView('records')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  View all →
                </button>
              </div>

              {healthRecords.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No health records yet</h4>
                  <p className="text-gray-600 mb-4">Create your first health record to get started</p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200"
                  >
                    Create First Record
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {healthRecords.slice(0, 6).map((record) => (
                    <div
                      key={record.id}
                      onClick={() => setSelectedRecord(record)}
                      className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${getRecordTypeColor(record.record_type)} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                          {getRecordTypeIcon(record.record_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{record.title}</h4>
                          <p className="text-sm text-gray-600 truncate">{record.subject_name}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              record.is_public ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {record.is_public ? '🌐 Public' : '🔒 Private'}
                            </span>
                            {record.is_verified && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                ✓ Verified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'records' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Health Records</h2>
                <p className="text-gray-600">Manage your secure health data</p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create Record</span>
              </button>
            </div>

            {healthRecords.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                <svg className="w-20 h-20 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-medium text-gray-900 mb-2">No health records found</h3>
                <p className="text-gray-600 mb-6">Create your first health record to get started with secure data management</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200"
                >
                  Create First Record
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {healthRecords.map((record) => (
                  <div
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-start space-x-4 mb-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${getRecordTypeColor(record.record_type)} rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0`}>
                        {getRecordTypeIcon(record.record_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{record.title}</h3>
                        <p className="text-sm text-gray-600 truncate">{record.subject_name}</p>
                        <p className="text-xs text-gray-500 capitalize">{record.record_type} health</p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{record.description}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          record.is_public ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {record.is_public ? '🌐 Public' : '🔒 Private'}
                        </span>
                        {record.is_verified && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            ✓ Verified
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(record.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showMFASetup && <MFASetupModal />}
      {showCreateForm && <CreateRecordForm />}
      {selectedRecord && (
        <RecordDetailModal 
          record={selectedRecord} 
          onClose={() => setSelectedRecord(null)} 
        />
      )}

      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
}

export default App;