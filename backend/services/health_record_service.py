from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

from ..models.health_record import HealthRecordCreate, HealthRecordInDB, HealthRecord, HealthRecordUpdate
from ..models.user import User
from ..utils.encryption import encrypt_data, decrypt_data
from ..database import get_database

class HealthRecordService:
    def __init__(self):
        self.db: AsyncIOMotorDatabase = None

    async def get_db(self):
        if not self.db:
            self.db = await get_database()
        return self.db

    async def create_record(self, record_data: HealthRecordCreate, owner_id: str) -> HealthRecordInDB:
        """Create a new health record with encryption"""
        db = await self.get_db()
        
        # Encrypt sensitive data
        encrypted_data = encrypt_data(json.dumps(record_data.data))
        
        record = HealthRecordInDB(
            title=record_data.title,
            description=record_data.description,
            record_type=record_data.record_type,
            subject_id=record_data.subject_id,
            subject_name=record_data.subject_name,
            data={"encrypted": encrypted_data},
            is_public=record_data.is_public,
            owner_id=owner_id,
            created_by=owner_id
        )
        
        await db.health_records.insert_one(record.dict())
        return record

    async def get_record_by_id(self, record_id: str) -> Optional[HealthRecordInDB]:
        """Get health record by ID"""
        db = await self.get_db()
        record_data = await db.health_records.find_one({"id": record_id})
        if not record_data:
            return None
        
        # Decrypt data if encrypted
        if record_data.get("data", {}).get("encrypted"):
            try:
                decrypted_data = decrypt_data(record_data["data"]["encrypted"])
                record_data["data"] = json.loads(decrypted_data)
            except Exception:
                record_data["data"] = {"error": "Decryption failed"}
        
        return HealthRecordInDB(**record_data)

    async def get_records_for_user(self, user: User) -> List[HealthRecordInDB]:
        """Get health records based on user role and permissions"""
        db = await self.get_db()
        
        # Build query based on user role
        query = {}
        if user.role == "individual":
            query = {"owner_id": user.id}
        elif user.role == "healthcare_provider":
            query = {"$or": [{"owner_id": user.id}, {"is_public": True}]}
        elif user.role == "researcher":
            query = {"is_public": True}
        # Admin can see all records (no query filter)
        
        records_cursor = db.health_records.find(query)
        records = await records_cursor.to_list(1000)
        
        # Decrypt data for authorized users
        decrypted_records = []
        for record_data in records:
            if record_data.get("data", {}).get("encrypted"):
                try:
                    # Check if user has access to decrypt
                    if (user.role == "admin" or 
                        record_data["owner_id"] == user.id or
                        (record_data["is_public"] and user.role in ["healthcare_provider", "researcher"])):
                        decrypted_data = decrypt_data(record_data["data"]["encrypted"])
                        record_data["data"] = json.loads(decrypted_data)
                    else:
                        record_data["data"] = {"message": "Access denied"}
                except Exception:
                    record_data["data"] = {"error": "Decryption failed"}
            
            decrypted_records.append(HealthRecordInDB(**record_data))
        
        return decrypted_records

    async def update_record(self, record_id: str, update_data: HealthRecordUpdate) -> HealthRecordInDB:
        """Update a health record"""
        db = await self.get_db()
        
        update_dict = {}
        if update_data.title is not None:
            update_dict["title"] = update_data.title
        if update_data.description is not None:
            update_dict["description"] = update_data.description
        if update_data.is_public is not None:
            update_dict["is_public"] = update_data.is_public
        if update_data.data is not None:
            # Encrypt the new data
            encrypted_data = encrypt_data(json.dumps(update_data.data))
            update_dict["data"] = {"encrypted": encrypted_data}
        
        update_dict["updated_at"] = datetime.utcnow()
        
        await db.health_records.update_one(
            {"id": record_id},
            {"$set": update_dict}
        )
        
        return await self.get_record_by_id(record_id)

    async def update_privacy(self, record_id: str, is_public: bool) -> bool:
        """Update privacy setting for a record"""
        db = await self.get_db()
        result = await db.health_records.update_one(
            {"id": record_id},
            {
                "$set": {
                    "is_public": is_public,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    async def update_blockchain_info(self, record_id: str, blockchain_hash: str, block_number: int) -> bool:
        """Update blockchain information for a record"""
        db = await self.get_db()
        result = await db.health_records.update_one(
            {"id": record_id},
            {
                "$set": {
                    "blockchain_hash": blockchain_hash,
                    "block_number": block_number,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    async def delete_record(self, record_id: str) -> bool:
        """Soft delete a health record"""
        db = await self.get_db()
        result = await db.health_records.update_one(
            {"id": record_id},
            {
                "$set": {
                    "is_active": False,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    async def get_records_count_by_type(self, user: User) -> Dict[str, int]:
        """Get count of records by type for dashboard"""
        db = await self.get_db()
        
        # Build query based on user role
        query = {}
        if user.role == "individual":
            query = {"owner_id": user.id}
        elif user.role == "healthcare_provider":
            query = {"$or": [{"owner_id": user.id}, {"is_public": True}]}
        elif user.role == "researcher":
            query = {"is_public": True}
        
        pipeline = [
            {"$match": query},
            {"$group": {"_id": "$record_type", "count": {"$sum": 1}}}
        ]
        
        result = await db.health_records.aggregate(pipeline).to_list(100)
        return {item["_id"]: item["count"] for item in result}