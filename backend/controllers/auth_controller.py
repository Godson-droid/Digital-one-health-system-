from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from typing import Optional
import jwt
import pyotp
import qrcode
import base64
from io import BytesIO
import uuid

from ..models.user import UserCreate, UserLogin, User, Token, MFASetup
from ..services.user_service import UserService
from ..services.blockchain_service import BlockchainService
from ..utils.security import verify_password, get_password_hash, create_access_token, verify_mfa_token
from ..config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

security = HTTPBearer()

class AuthController:
    def __init__(self):
        self.user_service = UserService()
        self.blockchain_service = BlockchainService()

    async def register_user(self, user_data: UserCreate) -> dict:
        """Register a new user"""
        # Check if user exists
        existing_user = await self.user_service.get_user_by_username_or_email(
            user_data.username, user_data.email
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists"
            )

        # Validate role
        valid_roles = ["admin", "healthcare_provider", "researcher", "individual"]
        if user_data.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role"
            )

        # Create user
        hashed_password = get_password_hash(user_data.password)
        user = await self.user_service.create_user(user_data, hashed_password)
        
        # Log user creation to blockchain
        await self.blockchain_service.add_block(
            record_id=user.id,
            action="user_created",
            data_hash=self.blockchain_service.calculate_hash(user.dict()),
            user_id=user.id
        )

        return {"message": "User registered successfully", "user_id": user.id}

    async def login_user(self, login_data: UserLogin) -> Token:
        """Authenticate user and return token"""
        user = await self.user_service.get_user_by_username(login_data.username)
        if not user or not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password"
            )

        # Check MFA if enabled
        if user.mfa_enabled:
            if not login_data.mfa_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="MFA token required"
                )
            if not verify_mfa_token(user.mfa_secret, login_data.mfa_token):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid MFA token"
                )

        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )

        user_info = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name
        }

        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user_info
        )

    async def setup_mfa(self, current_user: User) -> MFASetup:
        """Setup MFA for user"""
        # Generate secret for MFA
        secret = pyotp.random_base32()

        # Generate QR code
        totp = pyotp.TOTP(secret, interval=90)
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
        await self.user_service.update_mfa_secret(current_user.id, secret, backup_codes)

        return MFASetup(
            qr_code=f"data:image/png;base64,{qr_code_base64}",
            manual_entry_key=secret,
            backup_codes=backup_codes
        )

    async def enable_mfa(self, mfa_token: str, current_user: User) -> dict:
        """Enable MFA for user"""
        user = await self.user_service.get_user_by_id(current_user.id)
        if not user.mfa_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA not set up"
            )

        if not verify_mfa_token(user.mfa_secret, mfa_token):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid MFA token"
            )

        await self.user_service.enable_mfa(current_user.id)
        return {"message": "MFA enabled successfully"}

    async def get_current_user(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
        """Get current authenticated user"""
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

        user = await self.user_service.get_user_by_username(username)
        if user is None:
            raise credentials_exception
        return User(**user.dict())