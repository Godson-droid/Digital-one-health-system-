import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

// Set backend URL with fallback
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

const BlockchainStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockchainStats();
  }, []);

  const fetchBlockchainStats = async () => {
    try {
      const response = await axios.get(`${API}/blockchain/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch blockchain statistics:', error);
      toast.error('Failed to fetch blockchain statistics');
    } finally {
      setLoading(false);
    }
  };

  const verifyChainIntegrity = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/blockchain/verify-chain`);
      if (response.data.chain_integrity) {
        toast.success('Blockchain integrity verified!');
      } else {
        toast.error('Blockchain integrity check failed!');
      }
      fetchBlockchainStats(); // Refresh stats
    } catch (error) {
      console.error('Failed to verify blockchain integrity:', error);
      toast.error('Failed to verify blockchain integrity');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
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
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">🔗 Blockchain Status</h3>
        <button
          onClick={verifyChainIntegrity}
          disabled={loading}
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify Chain'}
        </button>
      </div>

      {stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.total_blocks || 0}</div>
              <div className="text-sm text-blue-800">Total Blocks</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">#{stats.latest_block_index >= 0 ? stats.latest_block_index : 'N/A'}</div>
              <div className="text-sm text-green-800">Latest Block</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${
                stats.chain_integrity ? 'bg-green-500' : 'bg-red-500'
              }`}></span>
              <span className="text-sm font-medium">
                Chain Integrity: {stats.chain_integrity ? 'Valid' : 'Invalid'}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Difficulty: {stats.difficulty || 4}
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-4">
            <p>🔒 All health records are secured with blockchain technology</p>
            <p>⛓️ Each record modification creates an immutable blockchain entry</p>
            <p>🛡️ Proof-of-work consensus ensures data integrity</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockchainStats;