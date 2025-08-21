import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import QRCode from 'react-qr-code';
import BlockchainStats from './components/BlockchainStats';
import BlockchainVerification from './components/BlockchainVerification';
import './App.css';

// Backend URL configuration - FIXED for your deployment
const BACKEND_URL = 'https://digital-one-health-system-cjum.onrender.com';
const API = `${BACKEND_URL}/api`;

// Enhanced axios configuration with better timeout and error handling
axios.defaults.timeout = 45000; // 45 seconds
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Add request/response interceptors for better debugging
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

axios.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ Response Error:', error.response?.status, error.response?.data || error.message);
    
    // Enhanced error handling for different scenarios
    if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout - please check your connection and try again');
    } else if (error.response?.status === 0 || !error.response) {
      toast.error('Cannot connect to server - please check if the backend is running');
    } else if (error.response?.status >= 500) {
      toast.error('Server error - please try again later');
    } else if (error.response?.status === 403) {
      toast.error('Access denied - please check your permissions');
    } else if (error.response?.status === 401) {
      toast.error('Authentication required - please log in again');
    }
    
    return Promise.reject(error);
  }
);

function App() {
  // State management
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  
  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '', mfaToken: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '', email: '', password: '', role: 'individual', fullName: ''
  });
  const [recordForm, setRecordForm] = useState({
    title: '', description: '', recordType: 'human', subjectId: '', subjectName: '',
    isPublic: false, symptoms: '', diagnosis: '', treatment: '', vitalSigns: '',
    labResults: '', medications: '', allergies: '', species: '', breed: '', age: '',
    weight: '', vaccinationStatus: '', location: '', environmentalFactors: '',
    soilConditions: '', climateData: '', plantHealthStatus: '', growthStage: '',
    patientId: '', patientName: '', dateOfBirth: '', gender: '', contactInfo: ''
  });
  
  // Data states
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({});
  const [mfaSetup, setMfaSetup] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [verificationRecord, setVerificationRecord] = useState(null);

  // Connection monitoring
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 10000 });
      if (response.status === 200) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionStatus('disconnected');
    }
  };

  // Auto-login on app start
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
        setCurrentView('dashboard');
        fetchRecords();
        fetchStats();
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Authentication functions
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      toast.error('Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, loginForm);
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setCurrentView('dashboard');
      
      toast.success(`Welcome back, ${userData.username}!`);
      
      // Fetch data after successful login
      await Promise.all([fetchRecords(), fetchStats()]);
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage = error.response?.data?.detail || 'Login failed';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.fullName) {
      toast.error('Please fill in all required fields');
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
      
      toast.success('Registration successful! Please check your email to verify your account.');
      setCurrentView('login');
      setRegisterForm({ username: '', email: '', password: '', role: 'individual', fullName: '' });
    } catch (error) {
      console.error('Registration failed:', error);
      const errorMessage = error.response?.data?.detail || 'Registration failed';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentView('login');
    setRecords([]);
    setStats({});
    toast.info('Logged out successfully');
  };

  // Data fetching functions
  const fetchRecords = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${API}/health-records`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecords(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch records:', error);
      if (error.response?.status !== 401) {
        toast.error('Failed to fetch health records');
      }
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${API}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data || {});
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // Don't show error toast for stats as it's not critical
    }
  };

  // Record management functions
  const handleCreateRecord = async (e) => {
    e.preventDefault();
    if (!recordForm.title || !recordForm.description || !recordForm.subjectName) {
      toast.error('Please fill in required fields: title, description, and subject name');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Prepare enhanced data structure
      const recordData = {
        title: recordForm.title,
        description: recordForm.description,
        record_type: recordForm.recordType,
        subject_id: recordForm.subjectId || `${recordForm.recordType}_${Date.now()}`,
        subject_name: recordForm.subjectName,
        is_public: recordForm.isPublic,
        data: {
          notes: recordForm.description,
          record_type: recordForm.recordType
        },
        // Enhanced fields for detailed patient data
        symptoms: recordForm.symptoms,
        diagnosis: recordForm.diagnosis,
        treatment: recordForm.treatment,
        vital_signs: recordForm.vitalSigns ? { notes: recordForm.vitalSigns } : {},
        lab_results: recordForm.labResults ? { notes: recordForm.labResults } : {},
        medications: recordForm.medications ? recordForm.medications.split(',').map(m => m.trim()) : [],
        allergies: recordForm.allergies ? recordForm.allergies.split(',').map(a => a.trim()) : [],
        species: recordForm.species,
        breed: recordForm.breed,
        age: recordForm.age,
        weight: recordForm.weight,
        vaccination_status: recordForm.vaccinationStatus,
        location: recordForm.location,
        environmental_factors: recordForm.environmentalFactors ? { notes: recordForm.environmentalFactors } : {},
        soil_conditions: recordForm.soilConditions,
        climate_data: recordForm.climateData ? { notes: recordForm.climateData } : {},
        plant_health_status: recordForm.plantHealthStatus,
        growth_stage: recordForm.growthStage,
        patient_id: recordForm.patientId,
        patient_name: recordForm.patientName,
        date_of_birth: recordForm.dateOfBirth,
        gender: recordForm.gender,
        contact_info: recordForm.contactInfo
      };

      await axios.post(`${API}/health-records`, recordData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Health record created successfully!');
      setCurrentView('dashboard');
      
      // Reset form
      setRecordForm({
        title: '', description: '', recordType: 'human', subjectId: '', subjectName: '',
        isPublic: false, symptoms: '', diagnosis: '', treatment: '', vitalSigns: '',
        labResults: '', medications: '', allergies: '', species: '', breed: '', age: '',
        weight: '', vaccinationStatus: '', location: '', environmentalFactors: '',
        soilConditions: '', climateData: '', plantHealthStatus: '', growthStage: '',
        patientId: '', patientName: '', dateOfBirth: '', gender: '', contactInfo: ''
      });
      
      await fetchRecords();
    } catch (error) {
      console.error('Failed to create record:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to create health record';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecordPrivacy = async (recordId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/health-records/${recordId}/privacy?is_public=${!currentStatus}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Record privacy updated to ${!currentStatus ? 'public' : 'private'}`);
      await fetchRecords();
    } catch (error) {
      console.error('Failed to update privacy:', error);
      toast.error('Failed to update record privacy');
    }
  };

  // MFA functions
  const setupMFA = async () => {
    try {
      const token = localStorage.getItem('token');
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
      const token = localStorage.getItem('token');
      await axios.post(`${API}/auth/enable-mfa?mfa_token=${mfaToken}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('MFA enabled successfully!');
      setMfaSetup(null);
      
      // Update user data
      const updatedUser = { ...user, mfa_enabled: true };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('MFA enable failed:', error);
      toast.error('Failed to enable MFA');
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
      human: 'bg-blue-100 text-blue-800 border-blue-200',
      animal: 'bg-green-100 text-green-800 border-green-200',
      plant: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatRecordData = (record) => {
    const sections = [];
    
    // Basic Information
    sections.push({
      title: 'Basic Information',
      icon: '📋',
      data: {
        'Subject ID': record.subject_id,
        'Subject Name': record.subject_name,
        'Record Type': record.record_type,
        'Created': new Date(record.created_at).toLocaleDateString(),
        'Privacy': record.is_public ? 'Public' : 'Private'
      }
    });

    // Patient-specific data for humans
    if (record.record_type === 'human') {
      const patientData = {};
      if (record.patient_id) patientData['Patient ID'] = record.patient_id;
      if (record.patient_name) patientData['Patient Name'] = record.patient_name;
      if (record.date_of_birth) patientData['Date of Birth'] = record.date_of_birth;
      if (record.gender) patientData['Gender'] = record.gender;
      if (record.contact_info) patientData['Contact Info'] = record.contact_info;
      
      if (Object.keys(patientData).length > 0) {
        sections.push({
          title: 'Patient Information',
          icon: '👤',
          data: patientData
        });
      }

      const medicalData = {};
      if (record.symptoms) medicalData['Symptoms'] = record.symptoms;
      if (record.diagnosis) medicalData['Diagnosis'] = record.diagnosis;
      if (record.treatment) medicalData['Treatment'] = record.treatment;
      if (record.medications && record.medications.length > 0) {
        medicalData['Medications'] = Array.isArray(record.medications) ? record.medications.join(', ') : record.medications;
      }
      if (record.allergies && record.allergies.length > 0) {
        medicalData['Allergies'] = Array.isArray(record.allergies) ? record.allergies.join(', ') : record.allergies;
      }
      
      if (Object.keys(medicalData).length > 0) {
        sections.push({
          title: 'Medical Information',
          icon: '🏥',
          data: medicalData
        });
      }
    }

    // Animal-specific data
    if (record.record_type === 'animal') {
      const animalData = {};
      if (record.species) animalData['Species'] = record.species;
      if (record.breed) animalData['Breed'] = record.breed;
      if (record.age) animalData['Age'] = record.age;
      if (record.weight) animalData['Weight'] = record.weight;
      if (record.vaccination_status) animalData['Vaccination Status'] = record.vaccination_status;
      
      if (Object.keys(animalData).length > 0) {
        sections.push({
          title: 'Animal Information',
          icon: '🐾',
          data: animalData
        });
      }
    }

    // Plant/Environment-specific data
    if (record.record_type === 'plant') {
      const plantData = {};
      if (record.location) plantData['Location'] = record.location;
      if (record.plant_health_status) plantData['Health Status'] = record.plant_health_status;
      if (record.growth_stage) plantData['Growth Stage'] = record.growth_stage;
      if (record.soil_conditions) plantData['Soil Conditions'] = record.soil_conditions;
      
      if (Object.keys(plantData).length > 0) {
        sections.push({
          title: 'Plant Information',
          icon: '🌱',
          data: plantData
        });
      }
    }

    return sections;
  };

  // Render functions
  const renderConnectionStatus = () => (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium ${
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
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Digital One Health</h1>
          <p className="text-gray-600">Secure Health Data Platform</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={loginForm.username}
              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">MFA Token (if enabled)</label>
            <input
              type="text"
              value={loginForm.mfaToken}
              onChange={(e) => setLoginForm({...loginForm, mfaToken: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter MFA token (optional)"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setCurrentView('register')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Don't have an account? Register here
          </button>
        </div>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600">Join Digital One Health Platform</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              value={registerForm.fullName}
              onChange={(e) => setRegisterForm({...registerForm, fullName: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Create a strong password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={registerForm.role}
              onChange={(e) => setRegisterForm({...registerForm, role: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setCurrentView('login')}
            className="text-green-600 hover:text-green-700 font-medium"
          >
            Already have an account? Sign in here
          </button>
        </div>
      </div>
    </div>
  );

  const renderCreateRecord = () => (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Health Record</h2>
              <p className="text-gray-600">Add detailed health information to the secure platform</p>
            </div>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleCreateRecord} className="space-y-8">
            {/* Basic Information */}
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                <span className="text-2xl mr-2">📋</span>
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    value={recordForm.recordType}
                    onChange={(e) => setRecordForm({...recordForm, recordType: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="human">👤 Human Health</option>
                    <option value="animal">🐾 Animal Health</option>
                    <option value="plant">🌱 Plant/Environmental Health</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject Name *</label>
                  <input
                    type="text"
                    value={recordForm.subjectName}
                    onChange={(e) => setRecordForm({...recordForm, subjectName: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Name of the subject"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject ID</label>
                  <input
                    type="text"
                    value={recordForm.subjectId}
                    onChange={(e) => setRecordForm({...recordForm, subjectId: e.target.value})}
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
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={recordForm.isPublic}
                      onChange={(e) => setRecordForm({...recordForm, isPublic: e.target.checked})}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Make this record public (visible to researchers and healthcare providers)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Human Health Fields */}
            {recordForm.recordType === 'human' && (
              <>
                <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                  <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                    <span className="text-2xl mr-2">👤</span>
                    Patient Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Patient ID</label>
                      <input
                        type="text"
                        value={recordForm.patientId}
                        onChange={(e) => setRecordForm({...recordForm, patientId: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Patient identification number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Patient Name</label>
                      <input
                        type="text"
                        value={recordForm.patientName}
                        onChange={(e) => setRecordForm({...recordForm, patientName: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Full patient name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                      <input
                        type="date"
                        value={recordForm.dateOfBirth}
                        onChange={(e) => setRecordForm({...recordForm, dateOfBirth: e.target.value})}
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
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contact Information</label>
                      <input
                        type="text"
                        value={recordForm.contactInfo}
                        onChange={(e) => setRecordForm({...recordForm, contactInfo: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Phone, email, or emergency contact"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 p-6 rounded-2xl border border-red-200">
                  <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
                    <span className="text-2xl mr-2">🏥</span>
                    Medical Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Symptoms</label>
                      <textarea
                        value={recordForm.symptoms}
                        onChange={(e) => setRecordForm({...recordForm, symptoms: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        rows="3"
                        placeholder="Describe symptoms experienced"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis</label>
                      <textarea
                        value={recordForm.diagnosis}
                        onChange={(e) => setRecordForm({...recordForm, diagnosis: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        rows="3"
                        placeholder="Medical diagnosis or assessment"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Treatment</label>
                      <textarea
                        value={recordForm.treatment}
                        onChange={(e) => setRecordForm({...recordForm, treatment: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        rows="3"
                        placeholder="Treatment plan or procedures"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Vital Signs</label>
                      <textarea
                        value={recordForm.vitalSigns}
                        onChange={(e) => setRecordForm({...recordForm, vitalSigns: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        rows="2"
                        placeholder="Blood pressure, temperature, pulse, etc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Lab Results</label>
                      <textarea
                        value={recordForm.labResults}
                        onChange={(e) => setRecordForm({...recordForm, labResults: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        rows="2"
                        placeholder="Laboratory test results"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Medications</label>
                      <input
                        type="text"
                        value={recordForm.medications}
                        onChange={(e) => setRecordForm({...recordForm, medications: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        placeholder="Medications (comma-separated)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
                      <input
                        type="text"
                        value={recordForm.allergies}
                        onChange={(e) => setRecordForm({...recordForm, allergies: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        placeholder="Known allergies (comma-separated)"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Animal Health Fields */}
            {recordForm.recordType === 'animal' && (
              <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                  <span className="text-2xl mr-2">🐾</span>
                  Animal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Species</label>
                    <input
                      type="text"
                      value={recordForm.species}
                      onChange={(e) => setRecordForm({...recordForm, species: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="e.g., Dog, Cat, Horse, Cattle"
                    />
                  </div>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                    <input
                      type="text"
                      value={recordForm.age}
                      onChange={(e) => setRecordForm({...recordForm, age: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Age of the animal"
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
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vaccination Status</label>
                    <textarea
                      value={recordForm.vaccinationStatus}
                      onChange={(e) => setRecordForm({...recordForm, vaccinationStatus: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      rows="2"
                      placeholder="Vaccination history and status"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={recordForm.location}
                      onChange={(e) => setRecordForm({...recordForm, location: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Location or farm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Plant/Environmental Health Fields */}
            {recordForm.recordType === 'plant' && (
              <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200">
                <h3 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center">
                  <span className="text-2xl mr-2">🌱</span>
                  Plant & Environmental Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={recordForm.location}
                      onChange={(e) => setRecordForm({...recordForm, location: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      placeholder="Geographic location or coordinates"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Plant Health Status</label>
                    <select
                      value={recordForm.plantHealthStatus}
                      onChange={(e) => setRecordForm({...recordForm, plantHealthStatus: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    >
                      <option value="">Select status</option>
                      <option value="healthy">Healthy</option>
                      <option value="diseased">Diseased</option>
                      <option value="stressed">Stressed</option>
                      <option value="recovering">Recovering</option>
                      <option value="dead">Dead</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Growth Stage</label>
                    <select
                      value={recordForm.growthStage}
                      onChange={(e) => setRecordForm({...recordForm, growthStage: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    >
                      <option value="">Select stage</option>
                      <option value="seedling">Seedling</option>
                      <option value="vegetative">Vegetative</option>
                      <option value="flowering">Flowering</option>
                      <option value="fruiting">Fruiting</option>
                      <option value="mature">Mature</option>
                      <option value="dormant">Dormant</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Soil Conditions</label>
                    <input
                      type="text"
                      value={recordForm.soilConditions}
                      onChange={(e) => setRecordForm({...recordForm, soilConditions: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      placeholder="pH, moisture, nutrients, etc."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Environmental Factors</label>
                    <textarea
                      value={recordForm.environmentalFactors}
                      onChange={(e) => setRecordForm({...recordForm, environmentalFactors: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      rows="2"
                      placeholder="Weather, pollution, pests, diseases, etc."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Climate Data</label>
                    <textarea
                      value={recordForm.climateData}
                      onChange={(e) => setRecordForm({...recordForm, climateData: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      rows="2"
                      placeholder="Temperature, humidity, rainfall, etc."
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                {loading ? 'Creating Record...' : 'Create Record'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  const renderRecordDetails = () => {
    if (!selectedRecord) return null;

    const sections = formatRecordData(selectedRecord);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${getRecordTypeColor(selectedRecord.record_type)}`}>
                  {getRecordTypeIcon(selectedRecord.record_type)}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedRecord.title}</h3>
                  <p className="text-sm text-gray-600">{selectedRecord.description}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setVerificationRecord(selectedRecord.id)}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Verify</span>
                </button>
                
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
          </div>

          <div className="p-6 space-y-6">
            {sections.map((section, index) => (
              <div key={index} className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="text-2xl mr-2">{section.icon}</span>
                  {section.title}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(section.data).map(([key, value]) => (
                    <div key={key} className="bg-white p-4 rounded-xl border border-gray-200">
                      <dt className="text-sm font-medium text-gray-600 mb-1">{key}</dt>
                      <dd className="text-sm text-gray-900 font-medium">
                        {value || 'Not specified'}
                      </dd>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Blockchain Status */}
            <div className={`p-6 rounded-2xl border-2 ${
              selectedRecord.is_verified 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <h4 className="text-lg font-semibold mb-4 flex items-center">
                <span className="text-2xl mr-2">🔐</span>
                Blockchain Security Status
              </h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium ${
                    selectedRecord.is_verified ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    {selectedRecord.is_verified ? 'Verified' : 'Pending Verification'}
                  </p>
                  <p className={`text-sm ${
                    selectedRecord.is_verified ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {selectedRecord.is_verified 
                      ? 'This record has been cryptographically verified on the blockchain'
                      : 'This record is secured but verification is pending'
                    }
                  </p>
                </div>
                <button
                  onClick={() => setVerificationRecord(selectedRecord.id)}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Verify Integrity</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMFASetup = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Setup Multi-Factor Authentication</h3>
          <p className="text-gray-600">Scan the QR code with your authenticator app</p>
        </div>

        {mfaSetup && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border-2 border-gray-200 text-center">
              <QRCode value={mfaSetup.qr_code.replace('data:image/png;base64,', '')} size={200} />
            </div>

            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="text-sm font-medium text-gray-700 mb-2">Manual Entry Key:</p>
              <p className="font-mono text-sm bg-white p-2 rounded border break-all">
                {mfaSetup.manual_entry_key}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter verification code from your app:
              </label>
              <input
                type="text"
                placeholder="000000"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-center font-mono text-lg"
                maxLength="6"
                onInput={(e) => {
                  if (e.target.value.length === 6) {
                    enableMFA(e.target.value);
                  }
                }}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setMfaSetup(null)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Digital One Health</h1>
                <p className="text-blue-100 text-sm">Secure Health Data Platform</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-white text-right">
                <p className="font-medium">{user?.full_name || user?.username}</p>
                <p className="text-blue-100 text-sm capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              
              {!user?.mfa_enabled && (
                <button
                  onClick={setupMFA}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium"
                >
                  Setup MFA
                </button>
              )}
              
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-blue-600">{records.length}</p>
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
                <p className="text-3xl font-bold text-green-600">
                  {records.filter(r => r.is_public).length}
                </p>
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
                <p className="text-3xl font-bold text-purple-600">
                  {records.filter(r => r.is_verified).length}
                </p>
                <p className="text-gray-600 text-sm font-medium">Verified Records</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-orange-600">
                  {user?.role === 'admin' ? stats.total_users || 0 : records.filter(r => r.owner_id === user?.id).length}
                </p>
                <p className="text-gray-600 text-sm font-medium">
                  {user?.role === 'admin' ? 'Total Users' : 'My Records'}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setCurrentView('create')}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Record</span>
          </button>
          
          <button
            onClick={fetchRecords}
            className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Health Records */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Health Records</h2>
                  <p className="text-gray-600">Manage and view health data records</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {records.length} record{records.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {records.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No records found</h3>
                  <p className="text-gray-600 mb-4">Create your first health record to get started</p>
                  <button
                    onClick={() => setCurrentView('create')}
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Create Record
                  </button>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {records.map((record) => (
                    <div
                      key={record.id}
                      className="border border-gray-200 rounded-2xl p-4 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${getRecordTypeColor(record.record_type)}`}>
                            {getRecordTypeIcon(record.record_type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold text-gray-900 truncate">{record.title}</h3>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRecordTypeColor(record.record_type)}`}>
                                {record.record_type}
                              </span>
                            </div>
                            
                            <p className="text-gray-600 text-sm mb-2 line-clamp-2">{record.description}</p>
                            
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>Subject: {record.subject_name}</span>
                              <span>•</span>
                              <span>{new Date(record.created_at).toLocaleDateString()}</span>
                              {record.symptoms && (
                                <>
                                  <span>•</span>
                                  <span className="text-red-600 font-medium">Symptoms recorded</span>
                                </>
                              )}
                              {record.diagnosis && (
                                <>
                                  <span>•</span>
                                  <span className="text-blue-600 font-medium">Diagnosis available</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            record.is_public 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.is_public ? '🌐 Public' : '🔒 Private'}
                          </span>
                          
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            record.is_verified 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {record.is_verified ? '✅ Verified' : '⏳ Pending'}
                          </span>
                          
                          {record.can_modify && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRecordPrivacy(record.id, record.is_public);
                              }}
                              className="text-blue-600 hover:text-blue-700 p-1 hover:bg-blue-50 rounded transition-colors"
                              title="Toggle privacy"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVerificationRecord(record.id);
                            }}
                            className="text-purple-600 hover:text-purple-700 p-1 hover:bg-purple-50 rounded transition-colors"
                            title="Verify blockchain integrity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Blockchain Stats */}
          <div className="lg:col-span-1">
            <BlockchainStats />
          </div>
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="App">
      {renderConnectionStatus()}
      
      {currentView === 'login' && renderLogin()}
      {currentView === 'register' && renderRegister()}
      {currentView === 'dashboard' && user && renderDashboard()}
      {currentView === 'create' && user && renderCreateRecord()}
      
      {selectedRecord && renderRecordDetails()}
      {mfaSetup && renderMFASetup()}
      {verificationRecord && (
        <BlockchainVerification 
          recordId={verificationRecord} 
          onClose={() => setVerificationRecord(null)} 
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