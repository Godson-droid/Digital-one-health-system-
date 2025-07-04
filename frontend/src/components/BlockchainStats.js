import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

// Set backend URL with fallback
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

const BlockchainStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchBlockchainStats();
  }, []);

  const fetchBlockchainStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/blockchain/stats`);
      setStats(response.data || {});
    } catch (error) {
      console.error('Failed to fetch blockchain statistics:', error);
      toast.error('Failed to fetch blockchain statistics');
      setStats({
        total_blocks: 0,
        latest_block_index: -1,
        chain_integrity: false,
        difficulty: 1
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyChainIntegrity = async () => {
    setVerifying(true);
    try {
      const response = await axios.get(`${API}/blockchain/verify-chain`);
      if (response.data?.chain_integrity) {
        toast.success('Blockchain integrity verified successfully!');
      } else {
        toast.error('Blockchain integrity check failed!');
      }
      fetchBlockchainStats(); // Refresh stats
    } catch (error) {
      console.error('Failed to verify blockchain integrity:', error);
      toast.error('Failed to verify blockchain integrity');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="professional-card p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="professional-card p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Blockchain Security</h3>
            <p className="text-sm text-gray-600">Immutable data integrity verification</p>
          </div>
        </div>
        
        <button
          onClick={verifyChainIntegrity}
          disabled={verifying}
          className="btn-professional btn-secondary text-sm"
        >
          {verifying ? (
            <>
              <div className="loading-spinner w-4 h-4"></div>
              Verifying...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verify Chain
            </>
          )}
        </button>
      </div>

      {stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="stat-value text-blue-600">{stats.total_blocks || 0}</div>
              <div className="stat-label text-blue-700">Total Blocks</div>
            </div>
            
            <div className="stat-card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="stat-value text-green-600">
                #{stats.latest_block_index >= 0 ? stats.latest_block_index : 'N/A'}
              </div>
              <div className="stat-label text-green-700">Latest Block</div>
            </div>
            
            <div className="stat-card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="stat-value text-purple-600">{stats.difficulty || 1}</div>
              <div className="stat-label text-purple-700">Mining Difficulty</div>
            </div>
          </div>

          <div className={`blockchain-indicator ${
            stats.chain_integrity ? 'blockchain-valid' : 'blockchain-invalid'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                stats.chain_integrity ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <div className="flex-1">
                <div className="font-medium">
                  Chain Integrity: {stats.chain_integrity ? 'Valid' : 'Invalid'}
                </div>
                <div className="text-sm opacity-75">
                  {stats.chain_integrity 
                    ? 'All blocks verified and linked correctly' 
                    : 'Chain integrity issues detected'
                  }
                </div>
              </div>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d={stats.chain_integrity 
                    ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  } 
                />
              </svg>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Security Features
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>SHA-256 Cryptographic Hashing</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Proof-of-Work Consensus</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Immutable Record History</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Tamper-Proof Verification</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockchainStats;