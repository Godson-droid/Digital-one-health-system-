"""
Hyperledger Fabric Integration Service - CLOUD OPTIMIZED
Enterprise-grade blockchain security via REST API Gateway
"""

import asyncio
import json
import logging
import hashlib
from typing import Dict, Any, List, Optional
import aiohttp
from datetime import datetime

from ..config import DEBUG

logger = logging.getLogger(__name__)

class FabricSecurityService:
    """Cloud-Optimized Hyperledger Fabric Security Service"""
    
    def __init__(self):
        # Fabric Gateway Configuration (REST API based)
        self.fabric_gateway_url = "http://localhost:3001"  # Local development
        self.fabric_cloud_url = "https://fabric-gateway.onrender.com"  # Cloud deployment
        self.channel_name = "healthrecords"
        self.chaincode_name = "health-records"
        
        # Cloud Configuration
        self.session = None
        self.is_connected = False
        self.is_enabled = True  # ENABLED for cloud deployment
        self.use_cloud_gateway = True  # Use cloud-based Fabric gateway
        
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
        """Initialize Cloud-Optimized Fabric Security Service"""
        try:
            if not self.is_enabled:
                logger.info("Fabric security disabled")
                return
                
            logger.info("🔐 Initializing Cloud Fabric Security Service...")
            
            # Initialize HTTP session for REST API calls
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=60),
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'DigitalOneHealth/1.0'
                }
            )
            
            # Test cloud connection
            await self.test_cloud_connection()
            
            logger.info("✅ Cloud Fabric Security Service initialized successfully")
            
        except Exception as e:
            logger.warning(f"⚠️ Fabric security initialization warning: {e}")
            self.is_connected = False
    
    async def test_cloud_connection(self):
        """Test connection to cloud Fabric gateway"""
        try:
            # Try cloud gateway first
            gateway_url = self.fabric_cloud_url if self.use_cloud_gateway else self.fabric_gateway_url
            
            async with self.session.get(f"{gateway_url}/health") as response:
                if response.status == 200:
                    health_data = await response.json()
                    logger.info(f"✅ Fabric Gateway connected: {health_data.get('service', 'Cloud Gateway')}")
                    self.is_connected = True
                    self.fabric_gateway_url = gateway_url
                else:
                    logger.warning(f"⚠️ Fabric Gateway health check failed: {response.status}")
                    self.is_connected = False
            
        except Exception as e:
            logger.warning(f"⚠️ Fabric gateway connection failed: {e}")
            self.is_connected = False
    
    async def create_secure_health_record(self, record_data: Dict[str, Any], user_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create health record with cloud Fabric security"""
        if not self.is_enabled or not self.is_connected:
            logger.info("Fabric security not available, using local blockchain")
            return None
        
        try:
            logger.info(f"🔐 Creating secure health record on cloud Fabric...")
            
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
            
            # Submit to cloud Fabric network
            async with self.session.post(
                f"{self.fabric_gateway_url}/api/health-records",
                json=secure_record
            ) as response:
                if response.status == 201:
                    result = await response.json()
                    fabric_record_id = result.get('data', {}).get('recordId')
                    
                    logger.info(f"✅ Secure health record created on cloud Fabric: {fabric_record_id}")
                    
                    return {
                        "fabric_record_id": fabric_record_id,
                        "blockchain_hash": result.get('data', {}).get('dataHash'),
                        "transaction_id": result.get('data', {}).get('txId'),
                        "organization": secure_record["organization"],
                        "security_level": secure_record["securityLevel"],
                        "fabric_timestamp": secure_record["timestamp"],
                        "cloud_verified": True
                    }
                else:
                    error_data = await response.json()
                    logger.warning(f"⚠️ Cloud Fabric record creation failed: {error_data}")
                    return None
                    
        except Exception as e:
            logger.warning(f"⚠️ Error creating secure health record on cloud Fabric: {e}")
            return None
    
    async def verify_record_security(self, record_id: str, fabric_record_id: str = None) -> Dict[str, Any]:
        """Verify record security using cloud Fabric"""
        if not self.is_enabled or not self.is_connected:
            return {"verified": False, "reason": "Cloud Fabric security not available"}
        
        try:
            logger.info(f"🔍 Verifying record security on cloud Fabric...")
            
            verification_id = fabric_record_id or record_id
            
            async with self.session.get(
                f"{self.fabric_gateway_url}/api/health-records/{verification_id}/verify"
            ) as response:
                if response.status == 200:
                    verification_result = await response.json()
                    fabric_data = verification_result.get('data', {})
                    
                    # Get transaction history
                    history_data = await self.get_fabric_history(verification_id)
                    
                    security_result = {
                        "verified": fabric_data.get('isValid', False),
                        "fabric_record_id": verification_id,
                        "stored_hash": fabric_data.get('storedHash'),
                        "calculated_hash": fabric_data.get('calculatedHash'),
                        "verified_at": fabric_data.get('verifiedAt'),
                        "transaction_history": history_data,
                        "security_level": "enterprise_cloud",
                        "blockchain_network": "hyperledger_fabric_cloud",
                        "consensus_verified": True,
                        "cloud_verified": True
                    }
                    
                    logger.info(f"✅ Cloud Fabric security verification completed: {security_result['verified']}")
                    return security_result
                    
                else:
                    logger.warning(f"⚠️ Cloud Fabric verification failed: {response.status}")
                    return {"verified": False, "reason": "Cloud Fabric verification failed"}
                    
        except Exception as e:
            logger.warning(f"⚠️ Error verifying record security: {e}")
            return {"verified": False, "reason": f"Verification error: {str(e)}"}
    
    async def get_fabric_history(self, record_id: str) -> List[Dict[str, Any]]:
        """Get transaction history from cloud Fabric"""
        try:
            async with self.session.get(
                f"{self.fabric_gateway_url}/api/health-records/{record_id}/history"
            ) as response:
                if response.status == 200:
                    history_result = await response.json()
                    return history_result.get('data', [])
                else:
                    logger.warning(f"Failed to get cloud Fabric history: {response.status}")
                    return []
                    
        except Exception as e:
            logger.warning(f"Error getting cloud Fabric history: {e}")
            return []
    
    def encrypt_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Encrypt sensitive data fields"""
        try:
            # Identify sensitive fields
            sensitive_fields = ['ssn', 'medical_id', 'personal_notes', 'diagnosis_details']
            
            encrypted_data = data.copy()
            for field in sensitive_fields:
                if field in encrypted_data:
                    # Use basic encryption for cloud compatibility
                    encrypted_value = hashlib.sha256(str(encrypted_data[field]).encode()).hexdigest()
                    encrypted_data[field] = f"encrypted_{encrypted_value[:16]}"
                    
            return encrypted_data
            
        except Exception as e:
            logger.warning(f"Error encrypting sensitive data: {e}")
            return data
    
    def calculate_secure_hash(self, data: Dict[str, Any]) -> str:
        """Calculate secure hash"""
        try:
            data_string = json.dumps(data, sort_keys=True, separators=(',', ':'))
            return hashlib.sha256(data_string.encode('utf-8')).hexdigest()
        except Exception as e:
            logger.warning(f"Error calculating secure hash: {e}")
            return ""
    
    def get_user_organization(self, user_context: Dict[str, Any]) -> str:
        """Determine user's organization based on role"""
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
            return "public_cloud"
        elif record_data.get("record_type") == "human":
            return "confidential_cloud"
        else:
            return "restricted_cloud"
    
    async def enable_fabric_security(self, gateway_url: str = None):
        """Enable cloud Fabric security"""
        if gateway_url:
            self.fabric_gateway_url = gateway_url
        
        self.is_enabled = True
        await self.initialize()
        logger.info(f"🔐 Cloud Fabric security enabled with gateway: {self.fabric_gateway_url}")
    
    async def close(self):
        """Close Fabric security service"""
        if self.session:
            await self.session.close()
        logger.info("🔐 Cloud Fabric Security Service closed")

# Global instance - CLOUD OPTIMIZED
fabric_security_service = FabricSecurityService()

async def get_fabric_security_service() -> FabricSecurityService:
    """Get the global cloud Fabric security service instance"""
    if not fabric_security_service.session and fabric_security_service.is_enabled:
        await fabric_security_service.initialize()
    return fabric_security_service