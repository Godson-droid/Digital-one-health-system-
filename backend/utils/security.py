from passlib.context import CryptContext
from cryptography.fernet import Fernet
import jwt
import pyotp
from datetime import datetime, timedelta
from typing import Optional
import os
import bcrypt

# Security configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key().decode())

# Password hashing - FIXED for deployment compatibility
pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto",
    bcrypt__rounds=12,
    bcrypt__ident="2b"
)

# Encryption
try:
    cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
except Exception as e:
    print(f"Warning: Invalid encryption key, generating new one: {e}")
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    cipher_suite = Fernet(ENCRYPTION_KEY.encode())

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        if not plain_password or not hashed_password:
            return False
        
        # Handle both string and bytes for compatibility
        if isinstance(hashed_password, str):
            hashed_password = hashed_password.encode('utf-8')
        if isinstance(plain_password, str):
            plain_password = plain_password.encode('utf-8')
            
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"Password verification error: {e}")
        # Fallback to direct bcrypt verification
        try:
            return bcrypt.checkpw(plain_password, hashed_password)
        except Exception as fallback_error:
            print(f"Fallback password verification failed: {fallback_error}")
            return False
        return False

def get_password_hash(password: str) -> str:
    """Hash a password"""
    try:
        if not password:
            raise ValueError("Password cannot be empty")
        
        # Ensure password is string
        if isinstance(password, bytes):
            password = password.decode('utf-8')
            
        hashed = pwd_context.hash(password)
        
        # Ensure we return a string, not bytes
        if isinstance(hashed, bytes):
            hashed = hashed.decode('utf-8')
            
        return hashed
    except Exception as e:
        print(f"Password hashing error: {e}")
        # Fallback to direct bcrypt hashing
        try:
            if isinstance(password, str):
                password = password.encode('utf-8')
            salt = bcrypt.gensalt(rounds=12)
            hashed = bcrypt.hashpw(password, salt)
            return hashed.decode('utf-8')
        except Exception as fallback_error:
            print(f"Fallback password hashing failed: {fallback_error}")
            raise Exception(f"Password hashing failed: {str(e)}")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    try:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    except Exception as e:
        print(f"Error creating access token: {e}")
        raise

def verify_mfa_token(secret: str, token: str) -> bool:
    """Verify MFA token with standard 30-second window and enhanced validation"""
    try:
        if not secret or not token:
            return False
        
        # Clean the token - remove any spaces or non-digit characters
        clean_token = ''.join(filter(str.isdigit, str(token)))
        
        if len(clean_token) != 6:
            return False
        
        # Create TOTP instance with standard settings
        totp = pyotp.TOTP(secret)
        
        # Verify with a window of 2 (allows for 60 seconds before/after for better compatibility)
        return totp.verify(clean_token, valid_window=2)
    except Exception as e:
        print(f"Error verifying MFA token: {e}")
        return False