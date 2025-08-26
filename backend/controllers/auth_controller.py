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

from ..models.user import UserCreate, UserLogin, User, Token, MFASetup, EmailVerification, EmailVerificationConfirm
from ..services.user_service import UserService
from ..services.blockchain_service import BlockchainService
from ..services.email_service import EmailService
from ..utils.security import verify_password, get_password_hash, create_access_token, verify_mfa_token
from ..config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

security = HTTPBearer()

class AuthController:
    def __init__(self):
        self.user_service = UserService()
        self.blockchain_service = BlockchainService()
        self.email_service = EmailService()

    async def register_user(self, user_data: UserCreate) -> EmailVerification:
        """Register a new user with mandatory MFA setup"""
        try:
            # Validate input data
            if not user_data.username or not user_data.password or not user_data.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username, password, and email are required"
                )
            
            # Enhanced password requirements
            if len(user_data.password) < 8:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password must be at least 8 characters long"
                )
            
            # Check password complexity
            if not any(c.isupper() for c in user_data.password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password must contain at least one uppercase letter"
                )
            
            if not any(c.islower() for c in user_data.password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password must contain at least one lowercase letter"
                )
            
            if not any(c.isdigit() for c in user_data.password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password must contain at least one number"
                )
            
            if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in user_data.password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password must contain at least one special character"
                )
            
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

            # Enforce single admin rule
            if user_data.role == "admin":
                existing_admin = await self.user_service.get_admin_user()
                if existing_admin:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="An admin user already exists. Only one admin is allowed."
                    )

            # Create user
            try:
                hashed_password = get_password_hash(user_data.password)
            except Exception as hash_error:
                print(f"Password hashing failed: {hash_error}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Password processing failed"
                )
            
            user = await self.user_service.create_user(user_data, hashed_password)
            
            # Auto-verify email (no email verification required)
            await self.user_service.verify_email(user.id)
            
            # Log user creation to blockchain
            try:
                await self.blockchain_service.add_block(
                    record_id=user.id,
                    action="user_created",
                    data_hash=self.blockchain_service.calculate_hash(user.dict()),
                    user_id=user.id
                )
            except Exception as e:
                print(f"Warning: Failed to log user creation to blockchain: {e}")

            return {
                "message": "User registered successfully. Please login and set up MFA for enhanced security.",
                "user_id": user.id
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Registration failed: {str(e)}"
            )

        # Force MFA setup after registration
        return {
            "message": "User registered successfully. MFA setup is required for account security.",
            "user_id": user.id,
            "mfa_required": True
        }

    async def login_user(self, login_data: UserLogin) -> Token:
        """Authenticate user and return token"""
        try:
            # Validate input
            if not login_data.username or not login_data.password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username and password are required"
                )
            
            user = await self.user_service.get_user_by_username(login_data.username)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect username or password"
                )
            
            # Check if account is locked
            if user.account_locked_until and user.account_locked_until > datetime.utcnow():
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail="Account is temporarily locked due to multiple failed login attempts. Please try again later."
                )
            
            # Verify password with enhanced error handling
            try:
                password_valid = verify_password(login_data.password, user.hashed_password)
            except Exception as verify_error:
                print(f"Password verification error: {verify_error}")
                password_valid = False
            
            if not password_valid:
                # Increment failed login attempts
                await self.user_service.increment_failed_login_attempts(user.id)
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

            # Reset failed login attempts and update last login
            await self.user_service.reset_failed_login_attempts(user.id)
            await self.user_service.update_last_login(user.id)

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
                "full_name": user.full_name,
                "email_verified": user.email_verified,
                "mfa_enabled": user.mfa_enabled
            }

            return Token(
                access_token=access_token,
                token_type="bearer",
                user=user_info
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Login failed: {str(e)}"
            )

    async def setup_mfa(self, current_user: User) -> MFASetup:
        """Setup MFA for user"""
        try:

            # Generate secret for MFA
            secret = pyotp.random_base32()

            # Generate provisioning URI for TOTP with standard 30-second interval
            totp = pyotp.TOTP(secret)
            provisioning_uri = totp.provisioning_uri(
                name=current_user.email,
                issuer_name="Digital One Health"
            )

            # Generate QR code from the provisioning URI
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(provisioning_uri)
            qr.make(fit=True)

            # Create QR code image
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
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"MFA setup failed: {str(e)}"
            )

    async def enable_mfa(self, mfa_token: str, current_user: User) -> dict:
        """Enable MFA for user"""
        try:
            user = await self.user_service.get_user_by_id(current_user.id)
            if not user or not user.mfa_secret:
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
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"MFA enable failed: {str(e)}"
            )

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