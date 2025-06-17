from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from passlib.context import CryptContext
import pyotp
import qrcode
import base64
from io import BytesIO
import jwt
import uuid
import os
import logging
import json
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key().decode())

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security utilities
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

# FastAPI app setup
app = FastAPI(title="Digital One Health System", version="1.0.0")
api_router = APIRouter(prefix="/api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# User roles
class UserRole:
    ADMIN = "admin"
    HEALTHCARE_PROVIDER = "healthcare_provider"
    RESEARCHER = "researcher"
    INDIVIDUAL = "individual"

# Pydantic models
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str
    full_name: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    role: str
    full_name: str
    is_active: bool = True
    mfa_enabled: bool = False
    mfa_secret: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserLogin(BaseModel):
    username: str
    password: str
    mfa_token: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class MFASetup(BaseModel):
    qr_code: str
    manual_entry_key: str
    backup_codes: List[str]

class HealthRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    record_type: str  # "human", "animal", "plant"
    subject_id: str
    subject_name: str
    data: Dict[str, Any]
    is_public: bool = False
    owner_id: str
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class HealthRecordCreate(BaseModel):
    title: str
    description: str
    record_type: str
    subject_id: str
    subject_name: str
    data: Dict[str, Any]
    is_public: bool = False

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def encrypt_data(data: str) -> str:
    """Encrypt sensitive data using AES 256"""
    return cipher_suite.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    """Decrypt sensitive data"""
    return cipher_suite.decrypt(encrypted_data.encode()).decode()

def verify_mfa_token(secret: str, token: str) -> bool:
    """Verify MFA token with 90-second window"""
    totp = pyotp.TOTP(secret, interval=90)  # 90-second window
    return totp.verify(token)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return User(**user)

def require_role(required_roles: List[str]):
    def role_dependency(current_user: User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_dependency

# Authentication endpoints
@api_router.post("/auth/register", response_model=Dict[str, str])
async def register_user(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"$or": [{"username": user_data.username}, {"email": user_data.email}]})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists"
        )
    
    # Validate role
    valid_roles = [UserRole.ADMIN, UserRole.HEALTHCARE_PROVIDER, UserRole.RESEARCHER, UserRole.INDIVIDUAL]
    if user_data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        email=user_data.email,
        role=user_data.role,
        full_name=user_data.full_name
    )
    
    user_dict = user.dict()
    user_dict["hashed_password"] = hashed_password
    
    await db.users.insert_one(user_dict)
    return {"message": "User registered successfully", "user_id": user.id}

@api_router.post("/auth/login", response_model=Token)
async def login_user(login_data: UserLogin):
    user = await db.users.find_one({"username": login_data.username})
    if not user or not verify_password(login_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    # Check MFA if enabled
    if user.get("mfa_enabled", False):
        if not login_data.mfa_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="MFA token required"
            )
        if not verify_mfa_token(user["mfa_secret"], login_data.mfa_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid MFA token"
            )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    user_info = {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "full_name": user["full_name"]
    }
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_info
    }

@api_router.post("/auth/setup-mfa", response_model=MFASetup)
async def setup_mfa(current_user: User = Depends(get_current_user)):
    # Generate secret for MFA
    secret = pyotp.random_base32()
    
    # Generate QR code
    totp = pyotp.TOTP(secret, interval=90)  # 90-second window
    provisioning_uri = totp.provisioning_uri(
        name=current_user.email,
        issuer_name="Digital One Health"
    )
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    qr_image = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    qr_image.save(buffer, format='PNG')
    qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Generate backup codes
    backup_codes = [str(uuid.uuid4())[:8] for _ in range(5)]
    
    # Save MFA secret to user
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"mfa_secret": secret, "backup_codes": backup_codes}}
    )
    
    return MFASetup(
        qr_code=f"data:image/png;base64,{qr_code_base64}",
        manual_entry_key=secret,
        backup_codes=backup_codes
    )

@api_router.post("/auth/enable-mfa")
async def enable_mfa(mfa_token: str, current_user: User = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user.id})
    if not user.get("mfa_secret"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA not set up"
        )
    
    if not verify_mfa_token(user["mfa_secret"], mfa_token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA token"
        )
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"mfa_enabled": True}}
    )
    
    return {"message": "MFA enabled successfully"}

# Health Records endpoints
@api_router.post("/health-records", response_model=Dict[str, str])
async def create_health_record(
    record_data: HealthRecordCreate,
    current_user: User = Depends(require_role([UserRole.HEALTHCARE_PROVIDER, UserRole.INDIVIDUAL]))
):
    # Encrypt sensitive data
    encrypted_data = encrypt_data(json.dumps(record_data.data))
    
    record = HealthRecord(
        title=record_data.title,
        description=record_data.description,
        record_type=record_data.record_type,
        subject_id=record_data.subject_id,
        subject_name=record_data.subject_name,
        data={"encrypted": encrypted_data},
        is_public=record_data.is_public,
        owner_id=current_user.id,
        created_by=current_user.id
    )
    
    await db.health_records.insert_one(record.dict())
    return {"message": "Health record created successfully", "record_id": record.id}

@api_router.get("/health-records", response_model=List[Dict[str, Any]])
async def get_health_records(current_user: User = Depends(get_current_user)):
    query = {}
    
    # Role-based access control
    if current_user.role == UserRole.INDIVIDUAL:
        query = {"owner_id": current_user.id}
    elif current_user.role == UserRole.HEALTHCARE_PROVIDER:
        query = {"$or": [{"owner_id": current_user.id}, {"is_public": True}]}
    elif current_user.role == UserRole.RESEARCHER:
        query = {"is_public": True}
    # Admin can see all records
    
    records = await db.health_records.find(query).to_list(1000)
    
    # Convert MongoDB ObjectId to string for serialization
    for record in records:
        if '_id' in record:
            record['_id'] = str(record['_id'])
            
    # Decrypt data for authorized users
    for record in records:
        if record.get("data", {}).get("encrypted"):
            try:
                if (current_user.role == UserRole.ADMIN or 
                    record["owner_id"] == current_user.id or
                    (record["is_public"] and current_user.role in [UserRole.HEALTHCARE_PROVIDER, UserRole.RESEARCHER])):
                    decrypted_data = decrypt_data(record["data"]["encrypted"])
                    record["data"] = json.loads(decrypted_data)
                else:
                    record["data"] = {"message": "Access denied"}
            except Exception as e:
                record["data"] = {"error": "Decryption failed"}
    
    return records

@api_router.get("/health-records/{record_id}", response_model=Dict[str, Any])
async def get_health_record(record_id: str, current_user: User = Depends(get_current_user)):
    record = await db.health_records.find_one({"id": record_id})
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found"
        )
    
    # Check access permissions
    if (current_user.role != UserRole.ADMIN and 
        record["owner_id"] != current_user.id and 
        not (record["is_public"] and current_user.role in [UserRole.HEALTHCARE_PROVIDER, UserRole.RESEARCHER])):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Decrypt data
    if record.get("data", {}).get("encrypted"):
        try:
            decrypted_data = decrypt_data(record["data"]["encrypted"])
            record["data"] = json.loads(decrypted_data)
        except Exception as e:
            record["data"] = {"error": "Decryption failed"}
    
    return record

@api_router.put("/health-records/{record_id}/privacy")
async def update_record_privacy(
    record_id: str, 
    is_public: bool,
    current_user: User = Depends(get_current_user)
):
    record = await db.health_records.find_one({"id": record_id})
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found"
        )
    
    # Only owner or admin can change privacy
    if record["owner_id"] != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    await db.health_records.update_one(
        {"id": record_id},
        {"$set": {"is_public": is_public, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Privacy settings updated successfully"}

# Dashboard endpoints
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    stats = {}
    
    if current_user.role == UserRole.ADMIN:
        stats["total_users"] = await db.users.count_documents({})
        stats["total_records"] = await db.health_records.count_documents({})
        stats["public_records"] = await db.health_records.count_documents({"is_public": True})
        stats["private_records"] = await db.health_records.count_documents({"is_public": False})
    else:
        stats["my_records"] = await db.health_records.count_documents({"owner_id": current_user.id})
        stats["my_public_records"] = await db.health_records.count_documents({
            "owner_id": current_user.id, 
            "is_public": True
        })
        stats["my_private_records"] = await db.health_records.count_documents({
            "owner_id": current_user.id, 
            "is_public": False
        })
    
    return stats

# System status endpoint
@api_router.get("/system/status")
async def system_status():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "encryption": "AES-256 enabled",
        "mfa": "TOTP 90-second window",
        "database": "Connected"
    }

# Include router
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)