from fastapi import HTTPException, status
from typing import List, Dict, Any
from datetime import datetime

from ..models.health_record import HealthRecordCreate, HealthRecord, HealthRecordUpdate
from ..models.user import User
from ..services.health_record_service import HealthRecordService
from ..services.blockchain_service import BlockchainService
from ..utils.permissions import check_record_access, can_modify_record

class HealthRecordController:
    def __init__(self):
        self.health_record_service = HealthRecordService()
        self.blockchain_service = BlockchainService()

    async def create_health_record(self, record_data: HealthRecordCreate, current_user: User) -> dict:
        """Create a new health record with blockchain integrity"""
        # Check permissions
        if current_user.role not in ["healthcare_provider", "individual"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create records"
            )

        # Create record
        record = await self.health_record_service.create_record(record_data, current_user.id)
        
        # Add to blockchain for integrity
        data_hash = self.blockchain_service.calculate_hash(record.dict())
        block = await self.blockchain_service.add_block(
            record_id=record.id,
            action="create",
            data_hash=data_hash,
            user_id=current_user.id
        )
        
        # Update record with blockchain info
        await self.health_record_service.update_blockchain_info(
            record.id, block.hash, block.index
        )

        return {"message": "Health record created successfully", "record_id": record.id}

    async def get_health_records(self, current_user: User) -> List[Dict[str, Any]]:
        """Get health records based on user role and permissions"""
        records = await self.health_record_service.get_records_for_user(current_user)
        
        # Verify blockchain integrity for each record
        verified_records = []
        for record in records:
            is_verified = await self.blockchain_service.verify_record_integrity(record.id)
            record_dict = record.dict()
            record_dict["is_verified"] = is_verified
            verified_records.append(record_dict)
        
        return verified_records

    async def get_health_record(self, record_id: str, current_user: User) -> Dict[str, Any]:
        """Get a specific health record with integrity check"""
        record = await self.health_record_service.get_record_by_id(record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Record not found"
            )

        # Check access permissions
        if not check_record_access(record, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Verify blockchain integrity
        is_verified = await self.blockchain_service.verify_record_integrity(record_id)
        
        record_dict = record.dict()
        record_dict["is_verified"] = is_verified
        
        return record_dict

    async def update_health_record(self, record_id: str, update_data: HealthRecordUpdate, current_user: User) -> dict:
        """Update a health record and log to blockchain"""
        record = await self.health_record_service.get_record_by_id(record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Record not found"
            )

        # Check modification permissions
        if not can_modify_record(record, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Update record
        updated_record = await self.health_record_service.update_record(record_id, update_data)
        
        # Add update to blockchain
        data_hash = self.blockchain_service.calculate_hash(updated_record.dict())
        block = await self.blockchain_service.add_block(
            record_id=record_id,
            action="update",
            data_hash=data_hash,
            user_id=current_user.id
        )
        
        # Update blockchain info
        await self.health_record_service.update_blockchain_info(
            record_id, block.hash, block.index
        )

        return {"message": "Health record updated successfully"}

    async def update_record_privacy(self, record_id: str, is_public: bool, current_user: User) -> dict:
        """Update privacy settings for a record"""
        record = await self.health_record_service.get_record_by_id(record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Record not found"
            )

        # Check modification permissions
        if not can_modify_record(record, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Update privacy
        await self.health_record_service.update_privacy(record_id, is_public)
        
        # Log privacy change to blockchain
        privacy_data = {"record_id": record_id, "is_public": is_public, "changed_by": current_user.id}
        data_hash = self.blockchain_service.calculate_hash(privacy_data)
        await self.blockchain_service.add_block(
            record_id=record_id,
            action="privacy_change",
            data_hash=data_hash,
            user_id=current_user.id
        )

        return {"message": "Privacy settings updated successfully"}

    async def verify_record_integrity(self, record_id: str, current_user: User) -> dict:
        """Verify the blockchain integrity of a specific record"""
        record = await self.health_record_service.get_record_by_id(record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Record not found"
            )

        # Check access permissions
        if not check_record_access(record, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Perform integrity check
        integrity_result = await self.blockchain_service.verify_record_integrity(record_id)
        blockchain_history = await self.blockchain_service.get_record_history(record_id)

        return {
            "record_id": record_id,
            "is_verified": integrity_result,
            "blockchain_history": blockchain_history,
            "verified_at": datetime.utcnow()
        }