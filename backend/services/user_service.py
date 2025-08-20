from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime, timedelta

from backend.models.user import UserCreate, UserInDB, User
from backend.database import get_database
from backend.utils.security import get_password_hash

class UserService:
    def __init__(self):
        self.db: AsyncIOMotorDatabase = None

    async def get_db(self):
        if self.db is None:
            self.db = await get_database()
        return self.db

    async def create_user(self, user_data: UserCreate, hashed_password: str) -> UserInDB:
        """Create a new user in the database"""
        try:
            db = await self.get_db()
            
            user = UserInDB(
                username=user_data.username,
                email=user_data.email,
                role=user_data.role,
                full_name=user_data.full_name,
                hashed_password=hashed_password
            )
            
            result = await db.users.insert_one(user.dict())
            if result.inserted_id is None:
                raise Exception("Failed to insert user into database")
                
            return user
        except Exception as e:
            print(f"Error creating user: {e}")
            raise

    async def get_user_by_username(self, username: str) -> Optional[UserInDB]:
        """Get user by username"""
        try:
            if not username:
                return None
                
            db = await self.get_db()
            user_data = await db.users.find_one({"username": username})
            
            if user_data is None:
                return None
                
            return UserInDB(**user_data)
        except Exception as e:
            print(f"Error getting user by username: {e}")
            return None

    async def get_user_by_email(self, email: str) -> Optional[UserInDB]:
        """Get user by email"""
        try:
            if not email:
                return None
                
            db = await self.get_db()
            user_data = await db.users.find_one({"email": email})
            
            if user_data is None:
                return None
                
            return UserInDB(**user_data)
        except Exception as e:
            print(f"Error getting user by email: {e}")
            return None

    async def get_user_by_id(self, user_id: str) -> Optional[UserInDB]:
        """Get user by ID"""
        try:
            if not user_id:
                return None
                
            db = await self.get_db()
            user_data = await db.users.find_one({"id": user_id})
            
            if user_data is None:
                return None
                
            return UserInDB(**user_data)
        except Exception as e:
            print(f"Error getting user by ID: {e}")
            return None

    async def get_user_by_username_or_email(self, username: str, email: str) -> Optional[UserInDB]:
        """Check if user exists by username or email"""
        try:
            if not username and not email:
                return None
                
            db = await self.get_db()
            user_data = await db.users.find_one({
                "$or": [{"username": username}, {"email": email}]
            })
            
            if user_data is None:
                return None
                
            return UserInDB(**user_data)
        except Exception as e:
            print(f"Error checking user existence: {e}")
            return None

    async def get_user_by_verification_token(self, token: str) -> Optional[UserInDB]:
        """Get user by email verification token"""
        try:
            if not token:
                return None
                
            db = await self.get_db()
            user_data = await db.users.find_one({"email_verification_token": token})
            
            if user_data is None:
                return None
                
            return UserInDB(**user_data)
        except Exception as e:
            print(f"Error getting user by verification token: {e}")
            return None

    async def get_admin_user(self) -> Optional[UserInDB]:
        """Get the admin user (should only be one)"""
        try:
            db = await self.get_db()
            user_data = await db.users.find_one({"role": "admin"})
            
            if user_data is None:
                return None
                
            return UserInDB(**user_data)
        except Exception as e:
            print(f"Error getting admin user: {e}")
            return None

    async def create_default_admin(self) -> Optional[UserInDB]:
        """Create default admin user if none exists"""
        try:
            # Check if admin already exists
            existing_admin = await self.get_admin_user()
            if existing_admin is not None:
                return existing_admin

            # Create default admin
            admin_data = UserCreate(
                username="admin",
                email="admin@digitalonehealth.com",
                password="Admin123!",
                role="admin",
                full_name="System Administrator"
            )
            
            hashed_password = get_password_hash(admin_data.password)
            admin_user = await self.create_user(admin_data, hashed_password)
            
            # Auto-verify admin email
            await self.verify_email(admin_user.id)
            
            print("✅ Default admin user created:")
            print(f"   Username: admin")
            print(f"   Password: Admin123!")
            print(f"   Email: admin@digitalonehealth.com")
            
            return admin_user
        except Exception as e:
            print(f"Error creating default admin: {e}")
            return None

    async def set_email_verification_token(self, user_id: str, token: str, expires: datetime) -> bool:
        """Set email verification token for user"""
        try:
            if not user_id:
                return False
                
            db = await self.get_db()
            result = await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "email_verification_token": token,
                        "email_verification_expires": expires,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error setting email verification token: {e}")
            return False

    async def verify_email(self, user_id: str) -> bool:
        """Mark user email as verified"""
        try:
            if not user_id:
                return False
                
            db = await self.get_db()
            result = await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "email_verified": True,
                        "updated_at": datetime.utcnow()
                    },
                    "$unset": {
                        "email_verification_token": "",
                        "email_verification_expires": ""
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error verifying email: {e}")
            return False

    async def increment_failed_login_attempts(self, user_id: str) -> bool:
        """Increment failed login attempts and lock account if necessary"""
        try:
            if not user_id:
                return False
                
            db = await self.get_db()
            
            # Get current user
            user = await self.get_user_by_id(user_id)
            if not user:
                return False
            
            failed_attempts = user.failed_login_attempts + 1
            update_data = {
                "failed_login_attempts": failed_attempts,
                "updated_at": datetime.utcnow()
            }
            
            # Lock account after 5 failed attempts for 30 minutes
            if failed_attempts >= 5:
                lock_until = datetime.utcnow() + timedelta(minutes=30)
                update_data["account_locked_until"] = lock_until
            
            result = await db.users.update_one(
                {"id": user_id},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error incrementing failed login attempts: {e}")
            return False

    async def reset_failed_login_attempts(self, user_id: str) -> bool:
        """Reset failed login attempts"""
        try:
            if not user_id:
                return False
                
            db = await self.get_db()
            result = await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "failed_login_attempts": 0,
                        "updated_at": datetime.utcnow()
                    },
                    "$unset": {
                        "account_locked_until": ""
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error resetting failed login attempts: {e}")
            return False

    async def update_last_login(self, user_id: str) -> bool:
        """Update last login timestamp"""
        try:
            if not user_id:
                return False
                
            db = await self.get_db()
            result = await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "last_login": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating last login: {e}")
            return False

    async def update_mfa_secret(self, user_id: str, secret: str, backup_codes: List[str]) -> bool:
        """Update MFA secret and backup codes for user"""
        try:
            if not user_id:
                return False
                
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
        except Exception as e:
            print(f"Error updating MFA secret: {e}")
            return False

    async def enable_mfa(self, user_id: str) -> bool:
        """Enable MFA for user"""
        try:
            if not user_id:
                return False
                
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
        except Exception as e:
            print(f"Error enabling MFA: {e}")
            return False

    async def get_all_users(self) -> List[UserInDB]:
        """Get all users (admin only)"""
        try:
            db = await self.get_db()
            users_cursor = db.users.find({})
            users = await users_cursor.to_list(1000)
            return [UserInDB(**user) for user in users if user is not None]
        except Exception as e:
            print(f"Error getting all users: {e}")
            return []

    async def update_user_status(self, user_id: str, is_active: bool) -> bool:
        """Update user active status"""
        try:
            if not user_id:
                return False
                
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
        except Exception as e:
            print(f"Error updating user status: {e}")
            return False