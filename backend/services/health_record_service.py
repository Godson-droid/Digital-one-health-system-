from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

from backend.models.health_record import HealthRecordCreate, HealthRecordInDB, HealthRecord, HealthRecordUpdate
from backend.models.user import User
from backend.utils.encryption import encrypt_data, decrypt_data
from backend.database import get_database

class HealthRecordService:
    def __init__(self):
        self.db: AsyncIOMotorDatabase = None

    async def get_db(self):
        if self.db is None:
            self.db = await get_database()
        return self.db

    async def create_record(self, record_data: HealthRecordCreate, owner_id: str) -> HealthRecordInDB:
        """Create a new health record with encryption"""
        try:
            db = await self.get_db()
            
            # Validate input data
            if not record_data.title or not record_data.description:
                raise ValueError("Title and description are required")
            
            if not record_data.subject_id or not record_data.subject_name:
                raise ValueError("Subject ID and name are required")
            
            # Ensure data is not None
            data_to_encrypt = record_data.data if record_data.data is not None else {}
            
            # Encrypt sensitive data
            encrypted_data = encrypt_data(json.dumps(data_to_encrypt))
            
            record = HealthRecordInDB(
                title=record_data.title.strip(),
                description=record_data.description.strip(),
                record_type=record_data.record_type,
                subject_id=record_data.subject_id.strip(),
                subject_name=record_data.subject_name.strip(),
                data={"encrypted": encrypted_data},
                is_public=record_data.is_public,
                owner_id=owner_id,
                created_by=owner_id
            )
            
            # Insert into database
            result = await db.health_records.insert_one(record.dict())
            if result.inserted_id is None:
                raise Exception("Failed to insert record into database")
                
            return record
        except Exception as e:
            print(f"Error creating health record: {e}")
            raise

    async def get_record_by_id(self, record_id: str) -> Optional[HealthRecordInDB]:
        """Get health record by ID"""
        try:
            if not record_id:
                return None
                
            db = await self.get_db()
            record_data = await db.health_records.find_one({"id": record_id})
            
            if record_data is None:
                return None
            
            # Decrypt data if encrypted
            if record_data.get("data") is not None and record_data["data"].get("encrypted") is not None:
                try:
                    decrypted_data = decrypt_data(record_data["data"]["encrypted"])
                    record_data["data"] = json.loads(decrypted_data)
                except Exception as e:
                    print(f"Error decrypting data: {e}")
                    record_data["data"] = {"error": "Decryption failed"}
            
            return HealthRecordInDB(**record_data)
        except Exception as e:
            print(f"Error getting health record: {e}")
            return None

    async def get_records_for_user(self, user: User) -> List[HealthRecordInDB]:
        """Get health records based on user role and permissions - FIXED PUBLIC RECORD ACCESS"""
        try:
            db = await self.get_db()
            
            # Build query based on user role - ENHANCED FOR PUBLIC RECORD VISIBILITY
            query = {}
            if user.role == "individual":
                # Individual users can see:
                # 1. Their own records (both public and private)
                # 2. Public records from other users
                query = {
                    "$or": [
                        {"owner_id": user.id},  # Own records
                        {"is_public": True}     # Public records from others
                    ]
                }
            elif user.role == "healthcare_provider":
                # Healthcare providers can see:
                # 1. Their own records
                # 2. All public records
                query = {
                    "$or": [
                        {"owner_id": user.id},  # Own records
                        {"is_public": True}     # All public records
                    ]
                }
            elif user.role == "researcher":
                # Researchers can see:
                # 1. All public records only
                query = {"is_public": True}
            # Admin can see all records (no query filter)
            
            print(f"Query for user {user.username} (role: {user.role}): {query}")
            
            records_cursor = db.health_records.find(query)
            records = await records_cursor.to_list(1000)
            
            print(f"Found {len(records)} records for user {user.username}")
            
            # Decrypt data for authorized users
            decrypted_records = []
            for record_data in records:
                if record_data.get("data") is not None and record_data["data"].get("encrypted") is not None:
                    try:
                        # Check if user has access to decrypt
                        if (user.role == "admin" or 
                            record_data["owner_id"] == user.id or
                            (record_data["is_public"] and user.role in ["healthcare_provider", "researcher", "individual"])):
                            decrypted_data = decrypt_data(record_data["data"]["encrypted"])
                            record_data["data"] = json.loads(decrypted_data)
                        else:
                            record_data["data"] = {"message": "Access denied"}
                    except Exception as e:
                        print(f"Error decrypting record data: {e}")
                        record_data["data"] = {"error": "Decryption failed"}
                
                decrypted_records.append(HealthRecordInDB(**record_data))
            
            return decrypted_records
        except Exception as e:
            print(f"Error getting records for user: {e}")
            return []

    async def update_record(self, record_id: str, update_data: HealthRecordUpdate) -> Optional[HealthRecordInDB]:
        """Update a health record"""
        try:
            if not record_id:
                return None
                
            db = await self.get_db()
            
            update_dict = {}
            if update_data.title is not None:
                update_dict["title"] = update_data.title.strip()
            if update_data.description is not None:
                update_dict["description"] = update_data.description.strip()
            if update_data.is_public is not None:
                update_dict["is_public"] = update_data.is_public
            if update_data.data is not None:
                # Encrypt the new data
                encrypted_data = encrypt_data(json.dumps(update_data.data))
                update_dict["data"] = {"encrypted": encrypted_data}
            
            update_dict["updated_at"] = datetime.utcnow()
            
            result = await db.health_records.update_one(
                {"id": record_id},
                {"$set": update_dict}
            )
            
            if result.modified_count > 0:
                return await self.get_record_by_id(record_id)
            return None
        except Exception as e:
            print(f"Error updating health record: {e}")
            return None

    async def update_privacy(self, record_id: str, is_public: bool) -> bool:
        """Update privacy setting for a record"""
        try:
            if not record_id:
                return False
                
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
        except Exception as e:
            print(f"Error updating privacy: {e}")
            return False

    async def update_blockchain_info(self, record_id: str, blockchain_hash: str, block_number: int) -> bool:
        """Update blockchain information for a record"""
        try:
            if not record_id:
                return False
                
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
        except Exception as e:
            print(f"Error updating blockchain info: {e}")
            return False

    async def update_fabric_info(self, record_id: str, fabric_record_id: str, fabric_hash: str, transaction_id: str) -> bool:
        """Update Fabric blockchain information for a record"""
        try:
            if not record_id:
                return False
                
            db = await self.get_db()
            result = await db.health_records.update_one(
                {"id": record_id},
                {
                    "$set": {
                        "fabric_record_id": fabric_record_id,
                        "fabric_hash": fabric_hash,
                        "fabric_transaction_id": transaction_id,
                        "fabric_verified": True,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating Fabric info: {e}")
            return False
    async def delete_record(self, record_id: str) -> bool:
        """Soft delete a health record"""
        try:
            if not record_id:
                return False
                
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
        except Exception as e:
            print(f"Error deleting record: {e}")
            return False

    async def get_records_count_by_type(self, user: User) -> Dict[str, int]:
        """Get count of records by type for dashboard"""
        try:
            db = await self.get_db()
            
            # Build query based on user role - ENHANCED FOR PUBLIC RECORD VISIBILITY
            query = {}
            if user.role == "individual":
                query = {
                    "$or": [
                        {"owner_id": user.id},  # Own records
                        {"is_public": True}     # Public records from others
                    ]
                }
            elif user.role == "healthcare_provider":
                query = {
                    "$or": [
                        {"owner_id": user.id},  # Own records
                        {"is_public": True}     # All public records
                    ]
                }
            elif user.role == "researcher":
                query = {"is_public": True}
            
            pipeline = [
                {"$match": query},
                {"$group": {"_id": "$record_type", "count": {"$sum": 1}}}
            ]
            
            result = await db.health_records.aggregate(pipeline).to_list(100)
            return {item["_id"]: item["count"] for item in result}
        except Exception as e:
            print(f"Error getting records count by type: {e}")
            return {}
