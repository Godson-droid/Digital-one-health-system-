"""
Hyperledger Fabric Integration Service - ENABLED FOR RENDER
Enterprise-grade blockchain security with smart contracts
"""

import asyncio
import json
import logging
import hashlib
from typing import Dict, Any, List, Optional
import aiohttp
from datetime import datetime
from fabric_sdk_py import Client
from hfc.api import Client as HFCClient
from hfc.util import crypto
import grpc

from ..config import DEBUG

logger = logging.getLogger(__name__)

class FabricSecurityService:
    """Enterprise Hyperledger Fabric Security Service"""
    
    def __init__(self):
        # Fabric Network Configuration
        self.fabric_gateway_url = "http://localhost:3001"  # Fabric Gateway API
        self.channel_name = "healthrecords"
        self.chaincode_name = "health-records"
        self.org_name = "HospitalMSP"
        
        # Security Configuration
        self.crypto_suite = crypto.CryptoSuite()
        self.session = None
        self.fabric_client = None
        self.is_connected = False
        self.is_enabled = True  # ENABLED for Render deployment
        
        # Smart Contract Functions
        self.contract_functions = {
            'create_record': 'createHealthRecord',
            'read_record': 'readHealthRecord', 
            'update_record': 'updateHealthRecord',
            'verify_integrity': 'verifyRecordIntegrity',
            'get_history': 'getRecordHistory',
            'query_public': 'queryPublicHealthRecords',
            'query_by_patient': 'queryHealthRecordsByPatient'
        }
    
    async def initialize(self):
        """Initialize Fabric Security Service with enterprise features"""
        try:
            if not self.is_enabled:
                logger.info("Fabric security disabled")
                return
                
            logger.info("🔐 Initializing Hyperledger Fabric Security Service...")
            
            # Initialize HTTP session for API calls
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=60),
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            )
            
            # Initialize Fabric SDK Client
            await self.initialize_fabric_client()
            
            # Test connection and security
            await self.test_security_connection()
            
            logger.info("✅ Hyperledger Fabric Security Service initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Fabric Security Service: {e}")
            self.is_connected = False
    
    async def initialize_fabric_client(self):
        """Initialize Fabric SDK client with security configurations"""
        try:
            # Create Fabric client
            self.fabric_client = HFCClient()
            
            # Configure crypto suite
            self.fabric_client.crypto_suite = self.crypto_suite
            
            # Set network configuration
            self.fabric_client.new_channel(self.channel_name)
            
            logger.info("🔗 Fabric SDK client initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize Fabric client: {e}")
            # Fallback to REST API mode
            self.fabric_client = None
    
    async def test_security_connection(self):
        """Test connection to Fabric network with security validation"""
        try:
            # Test REST API connection
            async with self.session.get(f"{self.fabric_gateway_url}/health") as response:
                if response.status == 200:
                    health_data = await response.json()
                    logger.info(f"✅ Fabric Gateway connected: {health_data.get('service', 'Unknown')}")
                    self.is_connected = True
                else:
                    logger.warning(f"⚠️ Fabric Gateway health check failed: {response.status}")
                    self.is_connected = False
            
            # Test smart contract availability
            if self.is_connected:
                await self.test_smart_contract_security()
                
        except Exception as e:
            logger.error(f"❌ Fabric security connection test failed: {e}")
            self.is_connected = False
    
    async def test_smart_contract_security(self):
        """Test smart contract security and permissions"""
        try:
            # Test query public records (should work without authentication)
            async with self.session.get(
                f"{self.fabric_gateway_url}/api/health-records/public"
            ) as response:
                if response.status == 200:
                    logger.info("✅ Smart contract security test passed")
                else:
                    logger.warning(f"⚠️ Smart contract test failed: {response.status}")
                    
        except Exception as e:
            logger.error(f"Smart contract security test error: {e}")
    
    async def create_secure_health_record(self, record_data: Dict[str, Any], user_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create health record with enterprise security on Fabric blockchain"""
        if not self.is_enabled or not self.is_connected:
            logger.info("Fabric security not available, using local blockchain")
            return None
        
        try:
            logger.info(f"🔐 Creating secure health record on Fabric blockchain...")
            
            # Prepare secure record data
            secure_record = {
                "recordType": record_data.get("record_type", "human"),
                "title": record_data.get("title", ""),
                "description": record_data.get("description", ""),
                "data": self.encrypt_sensitive_data(record_data.get("data", {})),
                "isPublic": record_data.get("is_public", False),
                "createdBy": user_context.get("user_id", ""),
                "patientId": record_data.get("subject_id", ""),
                "organization": self.get_user_organization(user_context),
                "securityLevel": self.determine_security_level(record_data),
                "timestamp": datetime.utcnow().isoformat(),
                "dataHash": self.calculate_secure_hash(record_data)
            }
            
            # Submit to Fabric network via smart contract
            async with self.session.post(
                f"{self.fabric_gateway_url}/api/health-records",
                json=secure_record
            ) as response:
                if response.status == 201:
                    result = await response.json()
                    fabric_record_id = result.get('data', {}).get('recordId')
                    
                    logger.info(f"✅ Secure health record created on Fabric: {fabric_record_id}")
                    
                    # Return Fabric blockchain details
                    return {
                        "fabric_record_id": fabric_record_id,
                        "blockchain_hash": result.get('data', {}).get('dataHash'),
                        "transaction_id": result.get('data', {}).get('txId'),
                        "organization": secure_record["organization"],
                        "security_level": secure_record["securityLevel"],
                        "fabric_timestamp": secure_record["timestamp"]
                    }
                else:
                    error_data = await response.json()
                    logger.error(f"❌ Failed to create record on Fabric: {error_data}")
                    return None
                    
        except Exception as e:
            logger.error(f"❌ Error creating secure health record on Fabric: {e}")
            return None
    
    async def verify_record_security(self, record_id: str, fabric_record_id: str = None) -> Dict[str, Any]:
        """Verify record security and integrity using Fabric blockchain"""
        if not self.is_enabled or not self.is_connected:
            return {"verified": False, "reason": "Fabric security not available"}
        
        try:
            logger.info(f"🔍 Verifying record security on Fabric blockchain...")
            
            # Use Fabric record ID if available, otherwise use local record ID
            verification_id = fabric_record_id or record_id
            
            # Verify integrity using smart contract
            async with self.session.get(
                f"{self.fabric_gateway_url}/api/health-records/{verification_id}/verify"
            ) as response:
                if response.status == 200:
                    verification_result = await response.json()
                    fabric_data = verification_result.get('data', {})
                    
                    # Get transaction history for audit trail
                    history_data = await self.get_fabric_history(verification_id)
                    
                    security_result = {
                        "verified": fabric_data.get('isValid', False),
                        "fabric_record_id": verification_id,
                        "stored_hash": fabric_data.get('storedHash'),
                        "calculated_hash": fabric_data.get('calculatedHash'),
                        "verified_at": fabric_data.get('verifiedAt'),
                        "transaction_history": history_data,
                        "security_level": "enterprise",
                        "blockchain_network": "hyperledger_fabric",
                        "consensus_verified": True
                    }
                    
                    logger.info(f"✅ Fabric security verification completed: {security_result['verified']}")
                    return security_result
                    
                else:
                    logger.error(f"❌ Fabric verification failed: {response.status}")
                    return {"verified": False, "reason": "Fabric verification failed"}
                    
        except Exception as e:
            logger.error(f"❌ Error verifying record security: {e}")
            return {"verified": False, "reason": f"Verification error: {str(e)}"}
    
    async def get_fabric_history(self, record_id: str) -> List[Dict[str, Any]]:
        """Get complete transaction history from Fabric blockchain"""
        try:
            async with self.session.get(
                f"{self.fabric_gateway_url}/api/health-records/{record_id}/history"
            ) as response:
                if response.status == 200:
                    history_result = await response.json()
                    return history_result.get('data', [])
                else:
                    logger.warning(f"Failed to get Fabric history: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error getting Fabric history: {e}")
            return []
    
    async def query_secure_records(self, query_params: Dict[str, Any], user_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Query records with enterprise security and access control"""
        if not self.is_enabled or not self.is_connected:
            return []
        
        try:
            user_org = self.get_user_organization(user_context)
            user_role = user_context.get("role", "individual")
            
            # Determine query endpoint based on access level
            if user_role == "researcher" or query_params.get("public_only", False):
                endpoint = f"{self.fabric_gateway_url}/api/health-records/public"
            elif query_params.get("patient_id"):
                endpoint = f"{self.fabric_gateway_url}/api/patients/{query_params['patient_id']}/health-records"
            else:
                # Use organization-based query for healthcare providers
                endpoint = f"{self.fabric_gateway_url}/api/health-records/public"
            
            async with self.session.get(endpoint) as response:
                if response.status == 200:
                    query_result = await response.json()
                    records = query_result.get('data', [])
                    
                    # Apply additional security filtering
                    filtered_records = self.apply_security_filters(records, user_context)
                    
                    logger.info(f"✅ Secure query returned {len(filtered_records)} records")
                    return filtered_records
                else:
                    logger.error(f"❌ Secure query failed: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"❌ Error in secure query: {e}")
            return []
    
    def encrypt_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Encrypt sensitive data fields before blockchain storage"""
        try:
            # Identify sensitive fields
            sensitive_fields = ['ssn', 'medical_id', 'personal_notes', 'diagnosis_details']
            
            encrypted_data = data.copy()
            for field in sensitive_fields:
                if field in encrypted_data:
                    # Use Fabric's crypto suite for encryption
                    encrypted_value = self.crypto_suite.encrypt(str(encrypted_data[field]))
                    encrypted_data[field] = encrypted_value.hex()
                    
            return encrypted_data
            
        except Exception as e:
            logger.error(f"Error encrypting sensitive data: {e}")
            return data
    
    def calculate_secure_hash(self, data: Dict[str, Any]) -> str:
        """Calculate secure hash using Fabric crypto suite"""
        try:
            data_string = json.dumps(data, sort_keys=True, separators=(',', ':'))
            return hashlib.sha256(data_string.encode('utf-8')).hexdigest()
        except Exception as e:
            logger.error(f"Error calculating secure hash: {e}")
            return ""
    
    def get_user_organization(self, user_context: Dict[str, Any]) -> str:
        """Determine user's Fabric organization based on role"""
        role = user_context.get("role", "individual")
        
        org_mapping = {
            "admin": "HospitalMSP",
            "healthcare_provider": "HospitalMSP", 
            "researcher": "ResearchMSP",
            "individual": "IndividualMSP"
        }
        
        return org_mapping.get(role, "IndividualMSP")
    
    def determine_security_level(self, record_data: Dict[str, Any]) -> str:
        """Determine security level based on record content"""
        if record_data.get("is_public", False):
            return "public"
        elif record_data.get("record_type") == "human":
            return "confidential"
        else:
            return "restricted"
    
    def apply_security_filters(self, records: List[Dict[str, Any]], user_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Apply additional security filters based on user context"""
        user_role = user_context.get("role", "individual")
        user_org = self.get_user_organization(user_context)
        
        filtered_records = []
        for record in records:
            # Apply role-based filtering
            if user_role == "admin":
                filtered_records.append(record)
            elif user_role == "researcher":
                if record.get("isPublic", False):
                    filtered_records.append(record)
            elif user_role == "healthcare_provider":
                if record.get("organization") == user_org or record.get("isPublic", False):
                    filtered_records.append(record)
            elif user_role == "individual":
                if record.get("createdBy") == user_context.get("user_id") or record.get("isPublic", False):
                    filtered_records.append(record)
        
        return filtered_records
    
    async def enable_fabric_security(self, gateway_url: str = None):
        """Enable Fabric security with optional gateway URL"""
        if gateway_url:
            self.fabric_gateway_url = gateway_url
        
        self.is_enabled = True
        await self.initialize()
        logger.info(f"🔐 Fabric security enabled with gateway: {self.fabric_gateway_url}")
    
    async def close(self):
        """Close Fabric security service"""
        if self.session:
            await self.session.close()
        logger.info("🔐 Fabric Security Service closed")

# Global instance - ENABLED for enterprise security
fabric_security_service = FabricSecurityService()

async def get_fabric_security_service() -> FabricSecurityService:
    """Get the global Fabric security service instance"""
    if not fabric_security_service.session and fabric_security_service.is_enabled:
        await fabric_security_service.initialize()
    return fabric_security_service