"""
Hyperledger Fabric Integration Service
Connects the FastAPI backend with external Hyperledger Fabric network via REST API
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
    """Service to integrate with external Hyperledger Fabric network via REST API"""
    
    def __init__(self):
        # For Render deployment, Fabric Gateway would be deployed separately
        # This could be on a different service or external infrastructure
        self.fabric_gateway_url = "http://localhost:3001"  # External Fabric Gateway
        self.session = None
        self.is_connected = False
        self.is_enabled = False  # Disabled by default for Render deployment
    
    async def initialize(self):
        """Initialize the Fabric integration service"""
        try:
            # Only initialize if Fabric integration is enabled
            if not self.is_enabled:
                logger.info("Fabric integration disabled for cloud deployment")
                return
                
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
            
            # Test connection to external Fabric Gateway
            await self.test_connection()
            logger.info("Fabric Integration Service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Fabric Integration Service: {e}")
            self.is_connected = False
    
    async def test_connection(self):
        """Test connection to external Fabric Gateway"""
        if not self.is_enabled:
            return False
            
        try:
            async with self.session.get(f"{self.fabric_gateway_url}/health") as response:
                if response.status == 200:
                    self.is_connected = True
                    logger.info("Connected to external Hyperledger Fabric Gateway")
                else:
                    self.is_connected = False
                    logger.warning(f"Fabric Gateway health check failed: {response.status}")
        except Exception as e:
            self.is_connected = False
            logger.error(f"Failed to connect to Fabric Gateway: {e}")
        
        return self.is_connected
    
    async def create_health_record_on_fabric(self, record_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a health record on the external Fabric network"""
        if not self.is_enabled or not self.is_connected:
            logger.info("Fabric network not available, skipping blockchain storage")
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
        """Verify record integrity on the external Fabric network"""
        if not self.is_enabled or not self.is_connected:
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
    
    async def enable_fabric_integration(self, gateway_url: str = None):
        """Enable Fabric integration with optional gateway URL"""
        if gateway_url:
            self.fabric_gateway_url = gateway_url
        
        self.is_enabled = True
        await self.initialize()
        logger.info(f"Fabric integration enabled with gateway: {self.fabric_gateway_url}")
    
    async def disable_fabric_integration(self):
        """Disable Fabric integration"""
        self.is_enabled = False
        self.is_connected = False
        if self.session:
            await self.session.close()
        logger.info("Fabric integration disabled")
    
    async def close(self):
        """Close the Fabric integration service"""
        if self.session:
            await self.session.close()
            logger.info("Fabric Integration Service closed")

# Global instance
fabric_service = FabricIntegrationService()

async def get_fabric_service() -> FabricIntegrationService:
    """Get the global Fabric service instance"""
    if not fabric_service.session and fabric_service.is_enabled:
        await fabric_service.initialize()
    return fabric_service