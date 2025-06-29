from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime

from ..models.user import UserCreate, UserInDB, User
from ..database import get_database

class UserService:
    def __init__(self):
        self.db: AsyncIOMotorDatabase = None

    async def get_db(self):
        if not self.db:
            self.db = await get_database()
        return self.db

    async def create_user(self, user_data: UserCreate, hashed_password: str) -> UserInDB:
        """Create a new user in the database"""
        db = await self.get_db()
        
        user = UserInDB(
            username=user_data.username,
            email=user_data.email,
            role=user_data.role,
            full_name=user_data.full_name,
            hashed_password=hashed_password
        )
        
        await db.users.insert_one(user.dict())
        return user

    async def get_user_by_username(self, username: str) -> Optional[UserInDB]:
        """Get user by username"""
        db = await self.get_db()
        user_data = await db.users.find_one({"username": username})
        return UserInDB(**user_data) if user_data else None

    async def get_user_by_id(self, user_id: str) -> Optional[UserInDB]:
        """Get user by ID"""
        db = await self.get_db()
        user_data = await db.users.find_one({"id": user_id})
        return UserInDB(**user_data) if user_data else None

    async def get_user_by_username_or_email(self, username: str, email: str) -> Optional[UserInDB]:
        """Check if user exists by username or email"""
        db = await self.get_db()
        user_data = await db.users.find_one({
            "$or": [{"username": username}, {"email": email}]
        })
        return UserInDB(**user_data) if user_data else None

    async def update_mfa_secret(self, user_id: str, secret: str, backup_codes: List[str]) -> bool:
        """Update MFA secret and backup codes for user"""
        db = await self.get_db()
        result = await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "mfa_secret": secret,
                    "backup_codes": backup_codes,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    async def enable_mfa(self, user_id: str) -> bool:
        """Enable MFA for user"""
        db = await self.get_db()
        result = await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "mfa_enabled": True,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    async def get_all_users(self) -> List[UserInDB]:
        """Get all users (admin only)"""
        db = await self.get_db()
        users_cursor = db.users.find({})
        users = await users_cursor.to_list(1000)
        return [UserInDB(**user) for user in users]

    async def update_user_status(self, user_id: str, is_active: bool) -> bool:
        """Update user active status"""
        db = await self.get_db()
        result = await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "is_active": is_active,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0