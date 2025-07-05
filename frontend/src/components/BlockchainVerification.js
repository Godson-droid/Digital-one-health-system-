import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

// Backend URL configuration - Updated for your deployment
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://digital-one-health-system.onrender.com';
const API = `${BACKEND_URL}/api`;

const BlockchainVerification = ({ recordId, onClose }) => {
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [blockchainHistory, setBlockchainHistory] = useState([]);

  const verifyRecord = async () => {
    if (!recordId) {
      toast.error('No record ID provided');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/health-records/${recordId}/verify`, { timeout: 45000 });
      setVerificationResult(response.data || {});
      
      // Get blockchain history
      try {
        const historyResponse = await axios.get(`${API}/blockchain/record/${recordId}/history`, { timeout: 30000 });
        setBlockchainHistory(Array.isArray(historyResponse.data) ? historyResponse.data : []);
      } catch (historyError) {
        console.error('Failed to get blockchain history:', historyError);
        setBlockchainHistory([]);
      }
      
      if (response.data?.is_verified) {
        toast.success('Record integrity verified successfully!');
      } else {
        toast.error('Record integrity verification failed!');
      }
    } catch (error) {
      console.error('Failed to verify record integrity:', error);
      if (error.code !== 'ECONNABORTED') {
        toast.error('Failed to verify record integrity');
      }
      setVerificationResult({
        record_id: recordId,
        is_verified: false,
        verified_at: new Date().toISOString(),
        error: error.response?.data?.detail || 'Verification failed'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (recordId) {
      verifyRecord();
    }
  }, [recordId]);

  const getActionIcon = (action) => {
    const icons = {
      create: '📝',
      update: '✏️',
      privacy_change: '🔒',
      genesis: '🌟'
    };
    return icons[action] || '📄';
  };

  const getActionColor = (action) => {
    const colors = {
      create: 'text-green-600',
      update: 'text-blue-600',
      privacy_change: 'text-orange-600',
      genesis: 'text-purple-600'
    };
    return colors[action] || 'text-gray-600';
  };

  return (
    <div className="modal-overlay-professional">
      <div className="modal-content-professional max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Blockchain Verification</h3>
              <p className="text-sm text-gray-600">Cryptographic integrity verification</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Verifying blockchain integrity...</p>
            <p className="text-gray-500 text-sm mt-2">Checking cryptographic hashes and block linkage</p>
          </div>
        ) : verificationResult ? (
          <div className="space-y-6">
            {/* Verification Status */}
            <div className={`p-6 rounded-xl border-2 ${
              verificationResult.is_verified 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
                  verificationResult.is_verified ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <span className="text-2xl">
                    {verificationResult.is_verified ? '✅' : '❌'}
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className={`text-lg font-semibold ${
                    verificationResult.is_verified ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {verificationResult.is_verified 
                      ? 'Record Integrity Verified' 
                      : 'Record Integrity Check Failed'
                    }
                  </h4>
                  <p className={`text-sm ${
                    verificationResult.is_verified ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {verificationResult.is_verified 
                      ? 'All cryptographic hashes match and blockchain linkage is valid'
                      : 'Integrity verification failed - potential tampering detected'
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Verified: {verificationResult.verified_at ? new Date(verificationResult.verified_at).toLocaleString() : 'Unknown'}
                  </p>
                  {verificationResult.error && (
                    <p className="text-sm text-red-600 mt-2 font-medium">
                      Error: {verificationResult.error}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Blockchain History */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Blockchain Transaction History
              </h4>
              
              {blockchainHistory.length === 0 ? (
                <div className="bg-gray-50 p-8 rounded-lg border text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500 font-medium">No blockchain history found</p>
                  <p className="text-gray-400 text-sm">This record may not have been properly secured</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {blockchainHistory.map((entry, index) => (
                    <div key={index} className="professional-card p-4 border-l-4 border-l-blue-500">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-lg">{getActionIcon(entry.action)}</span>
                            <div>
                              <span className="font-semibold text-gray-900">
                                Block #{entry.block_index || 'Unknown'}
                              </span>
                              <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                entry.is_valid 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {entry.is_valid ? '✓ Valid' : '✗ Invalid'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">Action:</span>
                              <span className={`ml-2 font-medium ${getActionColor(entry.action)}`}>
                                {entry.action?.replace('_', ' ') || 'Unknown'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">User:</span>
                              <span className="ml-2 font-medium text-gray-700">
                                {entry.user_id || 'Unknown'}
                              </span>
                            </div>
                            <div className="md:col-span-2">
                              <span className="text-gray-500">Timestamp:</span>
                              <span className="ml-2 font-medium text-gray-700">
                                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right ml-4">
                          <p className="text-xs text-gray-500 font-mono">
                            Hash: {entry.hash ? `${entry.hash.substring(0, 12)}...` : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Technical Details */}
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Technical Verification Details
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-blue-700 mb-2">
                    <span className="font-semibold">Record ID:</span>
                  </p>
                  <p className="font-mono text-xs bg-white p-2 rounded border break-all">
                    {verificationResult.record_id || 'Unknown'}
                  </p>
                </div>
                
                <div>
                  <p className="text-blue-700 mb-2">
                    <span className="font-semibold">Blockchain Hash:</span>
                  </p>
                  <p className="font-mono text-xs bg-white p-2 rounded border break-all">
                    {verificationResult.blockchain_hash 
                      ? verificationResult.blockchain_hash
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-100 rounded border border-blue-300">
                <p className="text-blue-800 text-sm">
                  <strong>Verification Method:</strong> SHA-256 cryptographic hashing with proof-of-work consensus validation
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={verifyRecord}
                disabled={loading}
                className="btn-professional btn-primary"
              >
                {loading ? (
                  <>
                    <div className="loading-spinner w-4 h-4"></div>
                    Re-verifying...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Re-verify
                  </>
                )}
              </button>
              
              <button
                onClick={onClose}
                className="btn-professional btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Verification Data</h4>
            <p className="text-gray-600 mb-4">Click below to start the blockchain verification process</p>
            <button
              onClick={verifyRecord}
              className="btn-professional btn-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Start Verification
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockchainVerification;