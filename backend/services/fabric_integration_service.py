"""
Hyperledger Fabric Integration Service
Connects the FastAPI backend with the Hyperledger Fabric network
"""

import asyncio
import json
import logging
from typing import Dict, Any, List, Optional
import aiohttp
from datetime import datetime

from ..config import DEBUG

logger = logging.getLogger(__name__)

class FabricIntegrationService:
    """Service to integrate with Hyperledger Fabric network"""
    
    def __init__(self):
        self.fabric_gateway_url = "http://localhost:3001"
        self.session = None
        self.is_connected = False
    
    async def initialize(self):
        """Initialize the Fabric integration service"""
        try:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
            
            # Test connection to Fabric Gateway
            await self.test_connection()
            logger.info("Fabric Integration Service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Fabric Integration Service: {e}")
            self.is_connected = False
    
    async def test_connection(self):
        """Test connection to Fabric Gateway"""
        try:
            async with self.session.get(f"{self.fabric_gateway_url}/health") as response:
                if response.status == 200:
                    self.is_connected = True
                    logger.info("Connected to Hyperledger Fabric Gateway")
                else:
                    self.is_connected = False
                    logger.warning(f"Fabric Gateway health check failed: {response.status}")
        except Exception as e:
            self.is_connected = False
            logger.error(f"Failed to connect to Fabric Gateway: {e}")
    
    async def create_health_record_on_fabric(self, record_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a health record on the Fabric network"""
        if not self.is_connected:
            logger.warning("Fabric network not connected, skipping blockchain storage")
            return None
        
        try:
            fabric_record = {
                "recordType": record_data.get("record_type", "human"),
                "title": record_data.get("title", ""),
                "description": record_data.get("description", ""),
                "data": record_data.get("data", {}),
                "isPublic": record_data.get("is_public", False),
                "createdBy": record_data.get("created_by", ""),
                "patientId": record_data.get("subject_id", "")
            }
            
            async with self.session.post(
                f"{self.fabric_gateway_url}/api/health-records",
                json=fabric_record
            ) as response:
                if response.status == 201:
                    result = await response.json()
                    logger.info(f"Health record created on Fabric: {result.get('data', {}).get('recordId')}")
                    return result
                else:
                    logger.error(f"Failed to create record on Fabric: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Error creating health record on Fabric: {e}")
            return None
    
    async def verify_record_integrity_on_fabric(self, record_id: str) -> Optional[Dict[str, Any]]:
        """Verify record integrity on the Fabric network"""
        if not self.is_connected:
            return None
        
        try:
            async with self.session.get(
                f"{self.fabric_gateway_url}/api/health-records/{record_id}/verify"
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get('data', {})
                else:
                    logger.error(f"Failed to verify record on Fabric: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Error verifying record on Fabric: {e}")
            return None
    
    async def get_record_history_from_fabric(self, record_id: str) -> List[Dict[str, Any]]:
        """Get record history from the Fabric network"""
        if not self.is_connected:
            return []
        
        try:
            async with self.session.get(
                f"{self.fabric_gateway_url}/api/health-records/{record_id}/history"
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get('data', [])
                else:
                    logger.error(f"Failed to get record history from Fabric: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error getting record history from Fabric: {e}")
            return []
    
    async def update_record_privacy_on_fabric(self, record_id: str, is_public: bool, updated_by: str) -> bool:
        """Update record privacy on the Fabric network"""
        if not self.is_connected:
            return False
        
        try:
            async with self.session.put(
                f"{self.fabric_gateway_url}/api/health-records/{record_id}/privacy",
                json={"isPublic": is_public, "updatedBy": updated_by}
            ) as response:
                if response.status == 200:
                    logger.info(f"Record privacy updated on Fabric: {record_id}")
                    return True
                else:
                    logger.error(f"Failed to update record privacy on Fabric: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"Error updating record privacy on Fabric: {e}")
            return False
    
    async def query_public_records_from_fabric(self) -> List[Dict[str, Any]]:
        """Query public records from the Fabric network"""
        if not self.is_connected:
            return []
        
        try:
            async with self.session.get(
                f"{self.fabric_gateway_url}/api/health-records/public"
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get('data', [])
                else:
                    logger.error(f"Failed to query public records from Fabric: {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error querying public records from Fabric: {e}")
            return []
    
    async def close(self):
        """Close the Fabric integration service"""
        if self.session:
            await self.session.close()
            logger.info("Fabric Integration Service closed")

# Global instance
fabric_service = FabricIntegrationService()

async def get_fabric_service() -> FabricIntegrationService:
    """Get the global Fabric service instance"""
    if not fabric_service.session:
        await fabric_service.initialize()
    return fabric_service