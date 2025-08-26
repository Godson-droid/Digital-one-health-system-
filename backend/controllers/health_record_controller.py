from fastapi import HTTPException, status
from typing import List, Dict, Any
from datetime import datetime

from ..models.health_record import HealthRecordCreate, HealthRecord, HealthRecordUpdate
from ..models.user import User
from ..services.health_record_service import HealthRecordService
from ..services.blockchain_service import BlockchainService
from ..utils.permissions import check_record_access, can_modify_record, can_change_privacy, can_verify_record

class HealthRecordController:
    def __init__(self):
        self.health_record_service = HealthRecordService()
        self.blockchain_service = BlockchainService()
    async def create_health_record(self, record_data: HealthRecordCreate, current_user: User) -> dict:
        """Create a new health record with blockchain integrity"""
        try:
            # Check permissions - STRICT ROLE CHECKING
            if current_user.role not in ["healthcare_provider", "individual", "admin"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions to create records"
                )

            # Create record
            record = await self.health_record_service.create_record(record_data, current_user.id)
            
            # Add to blockchain for integrity
            try:
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
                
                print(f"Record {record.id} successfully added to blockchain with block {block.index}")
            except Exception as blockchain_error:
                print(f"Warning: Blockchain logging failed: {blockchain_error}")
                # Don't fail the record creation if blockchain fails, but log the error

            return {"message": "Health record created successfully", "record_id": record.id}
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error creating health record: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create health record: {str(e)}"
            )

    async def get_health_records(self, current_user: User) -> List[Dict[str, Any]]:
        """Get health records based on user role and permissions"""
        try:
            records = await self.health_record_service.get_records_for_user(current_user)
            
            # Verify blockchain integrity for each record and add permission flags
            verified_records = []
            for record in records:
                try:
                    is_verified = await self.blockchain_service.verify_record_integrity(record.id)
                except Exception as e:
                    print(f"Warning: Blockchain verification failed for record {record.id}: {e}")
                    is_verified = False
                    
                record_dict = record.dict()
                record_dict["is_verified"] = is_verified
                
                # Add permission flags for frontend
                record_dict["can_modify"] = can_modify_record(record, current_user)
                record_dict["can_change_privacy"] = can_change_privacy(record, current_user)
                record_dict["can_view_details"] = check_record_access(record, current_user)
                record_dict["can_verify"] = can_verify_record(record, current_user)
                
                verified_records.append(record_dict)
            
            return verified_records
        except Exception as e:
            print(f"Error getting health records: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get health records: {str(e)}"
            )

    async def get_health_record(self, record_id: str, current_user: User) -> Dict[str, Any]:
        """Get a specific health record with integrity check"""
        try:
            record = await self.health_record_service.get_record_by_id(record_id)
            if record is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Record not found"
                )

            # Check access permissions - STRICT ACCESS CONTROL
            if not check_record_access(record, current_user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied - you don't have permission to view this record"
                )

            # Verify blockchain integrity
            try:
                is_verified = await self.blockchain_service.verify_record_integrity(record_id)
            except Exception as e:
                print(f"Warning: Blockchain verification failed: {e}")
                is_verified = False
            
            record_dict = record.dict()
            record_dict["is_verified"] = is_verified
            
            # Add permission flags
            record_dict["can_modify"] = can_modify_record(record, current_user)
            record_dict["can_change_privacy"] = can_change_privacy(record, current_user)
            record_dict["can_verify"] = can_verify_record(record, current_user)
            
            return record_dict
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error getting health record: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get health record: {str(e)}"
            )

    async def update_health_record(self, record_id: str, update_data: HealthRecordUpdate, current_user: User) -> dict:
        """Update a health record and log to blockchain - STRICT: ONLY ORIGINAL CREATOR CAN MODIFY"""
        try:
            record = await self.health_record_service.get_record_by_id(record_id)
            if record is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Record not found"
                )

            # CRITICAL: Check modification permissions - ONLY ORIGINAL CREATOR CAN MODIFY
            # This prevents ANY unauthorized modifications, even by admins
            if not can_modify_record(record, current_user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied - records can only be modified by their original creator. This ensures data integrity and prevents unauthorized changes."
                )

            # Update record
            updated_record = await self.health_record_service.update_record(record_id, update_data)
            
            # Add update to blockchain
            try:
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
                print(f"Record {record_id} update logged to blockchain with block {block.index}")
            except Exception as blockchain_error:
                print(f"Warning: Blockchain logging failed: {blockchain_error}")

            return {"message": "Health record updated successfully"}
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error updating health record: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update health record: {str(e)}"
            )

    async def update_record_privacy(self, record_id: str, is_public: bool, current_user: User) -> dict:
        """Update privacy settings for a record - STRICT: ONLY ORIGINAL CREATOR CAN CHANGE"""
        try:
            record = await self.health_record_service.get_record_by_id(record_id)
            if record is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Record not found"
                )

            # CRITICAL: Check privacy change permissions - ONLY ORIGINAL CREATOR CAN CHANGE
            # This prevents unauthorized privacy changes by anyone other than the creator
            if not can_change_privacy(record, current_user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied - privacy settings can only be changed by the original record creator"
                )

            # Update privacy
            await self.health_record_service.update_privacy(record_id, is_public)
            
            # Log privacy change to blockchain
            try:
                privacy_data = {"record_id": record_id, "is_public": is_public, "changed_by": current_user.id}
                data_hash = self.blockchain_service.calculate_hash(privacy_data)
                block = await self.blockchain_service.add_block(
                    record_id=record_id,
                    action="privacy_change",
                    data_hash=data_hash,
                    user_id=current_user.id
                )
                print(f"Privacy change for record {record_id} logged to blockchain with block {block.index}")
            except Exception as blockchain_error:
                print(f"Warning: Blockchain logging failed: {blockchain_error}")

            return {"message": "Privacy settings updated successfully"}
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error updating privacy: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update privacy: {str(e)}"
            )

    async def verify_record_integrity(self, record_id: str, current_user: User) -> dict:
        """Verify the blockchain integrity of a specific record"""
        try:
            record = await self.health_record_service.get_record_by_id(record_id)
            if record is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Record not found"
                )

            # Check verification permissions - ENHANCED PERMISSIONS
            if not can_verify_record(record, current_user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied - you don't have permission to verify this record"
                )

            # Perform integrity check
            try:
                integrity_result = await self.blockchain_service.verify_record_integrity(record_id)
                blockchain_history = await self.blockchain_service.get_record_history(record_id)
                
                # Get current record hash for comparison
                current_hash = self.blockchain_service.calculate_hash(record.dict())
                
            except Exception as e:
                print(f"Warning: Blockchain verification failed: {e}")
                integrity_result = False
                blockchain_history = []
                current_hash = ""

            return {
                "record_id": record_id,
                "is_verified": integrity_result,
                "blockchain_history": blockchain_history,
                "current_hash": current_hash,
                "blockchain_hash": record.blockchain_hash if hasattr(record, 'blockchain_hash') else None,
                "security_level": "native_proof_of_work",
                "verified_at": datetime.utcnow()
            }
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error verifying record integrity: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to verify record integrity: {str(e)}"
            )