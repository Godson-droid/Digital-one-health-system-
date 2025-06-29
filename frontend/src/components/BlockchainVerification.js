import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

// Set backend URL with fallback
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
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
      const response = await axios.get(`${API}/health-records/${recordId}/verify`);
      setVerificationResult(response.data);
      
      // Get blockchain history
      const historyResponse = await axios.get(`${API}/blockchain/record/${recordId}/history`);
      setBlockchainHistory(historyResponse.data || []);
      
      if (response.data.is_verified) {
        toast.success('Record integrity verified!');
      } else {
        toast.error('Record integrity check failed!');
      }
    } catch (error) {
      console.error('Failed to verify record integrity:', error);
      toast.error('Failed to verify record integrity');
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

  React.useEffect(() => {
    if (recordId) {
      verifyRecord();
    }
  }, [recordId]);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-auto max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">🔗 Blockchain Verification</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Verifying blockchain integrity...</p>
            </div>
          ) : verificationResult ? (
            <div className="space-y-6">
              {/* Verification Status */}
              <div className={`p-4 rounded-lg ${
                verificationResult.is_verified 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center">
                  <span className="text-2xl mr-3">
                    {verificationResult.is_verified ? '✅' : '❌'}
                  </span>
                  <div>
                    <h4 className={`font-medium ${
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
                      Verified at: {new Date(verificationResult.verified_at).toLocaleString()}
                    </p>
                    {verificationResult.error && (
                      <p className="text-sm text-red-600 mt-1">
                        Error: {verificationResult.error}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Blockchain History */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3">📜 Blockchain History</h4>
                {blockchainHistory.length === 0 ? (
                  <div className="bg-gray-50 p-4 rounded-lg border text-center text-gray-500">
                    No blockchain history found for this record
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {blockchainHistory.map((entry, index) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">
                                Block #{entry.block_index}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                entry.is_valid 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {entry.is_valid ? '✓ Valid' : '✗ Invalid'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              Action: <span className="font-medium">{entry.action}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              User: <span className="font-medium">{entry.user_id}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              Time: {new Date(entry.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500 font-mono break-all max-w-xs">
                              Hash: {entry.hash ? entry.hash.substring(0, 16) + '...' : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Technical Details */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="text-md font-medium text-blue-900 mb-2">🔧 Technical Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700">
                      <span className="font-medium">Record ID:</span><br />
                      <span className="font-mono text-xs">{verificationResult.record_id}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-700">
                      <span className="font-medium">Blockchain Hash:</span><br />
                      <span className="font-mono text-xs">
                        {verificationResult.blockchain_hash 
                          ? verificationResult.blockchain_hash.substring(0, 32) + '...'
                          : 'N/A'
                        }
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={verifyRecord}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '🔄 Verifying...' : '🔄 Re-verify'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No verification data available</p>
              <button
                onClick={verifyRecord}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Start Verification
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockchainVerification;