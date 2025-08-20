from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

class UserBase(BaseModel):
    username: str
    email: str
    role: str
    full_name: str

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_active: bool = True
    email_verified: bool = False
    email_verification_token: Optional[str] = None
    email_verification_expires: Optional[datetime] = None
    mfa_enabled: bool = False
    mfa_secret: Optional[str] = None
    backup_codes: Optional[List[str]] = None
    hashed_password: str
    failed_login_attempts: int = 0
    account_locked_until: Optional[datetime] = None
    last_login: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class User(UserBase):
    id: str
    is_active: bool = True
    email_verified: bool = False
    mfa_enabled: bool = False
    last_login: Optional[datetime] = None
    created_at: datetime

class UserLogin(BaseModel):
    username: str
    password: str
    mfa_token: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class MFASetup(BaseModel):
    qr_code: str
    manual_entry_key: str
    backup_codes: List[str]
class EmailVerification(BaseModel):
    message: str
    verification_required: bool = True

class EmailVerificationConfirm(BaseModel):
    token: str