from fastapi import APIRouter, Depends, Query
from ..controllers.auth_controller import AuthController
from ..models.user import UserCreate, UserLogin, Token, MFASetup, User, EmailVerification, EmailVerificationConfirm

router = APIRouter(prefix="/auth", tags=["authentication"])
auth_controller = AuthController()

@router.post("/register", response_model=EmailVerification)
async def register_user(user_data: UserCreate):
    """Register a new user"""
    return await auth_controller.register_user(user_data)

@router.post("/verify-email")
async def verify_email(verification_data: EmailVerificationConfirm):
    """Verify user email with token"""
    return await auth_controller.verify_email(verification_data)

@router.get("/verify-email/{token}")
async def verify_email_get(token: str):
    """Verify user email with token via GET request (for email links)"""
    verification_data = EmailVerificationConfirm(token=token)
    return await auth_controller.verify_email(verification_data)

@router.post("/resend-verification")
async def resend_verification_email(email: str = Query(...)):
    """Resend verification email"""
    return await auth_controller.resend_verification_email(email)

@router.post("/login", response_model=Token)
async def login_user(login_data: UserLogin):
    """Authenticate user and return token"""
    return await auth_controller.login_user(login_data)

@router.post("/setup-mfa", response_model=MFASetup)
async def setup_mfa(current_user: User = Depends(auth_controller.get_current_user)):
    """Setup MFA for user"""
    return await auth_controller.setup_mfa(current_user)

@router.post("/enable-mfa")
async def enable_mfa(
    mfa_token: str = Query(...),
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Enable MFA for user"""
    return await auth_controller.enable_mfa(mfa_token, current_user)

@router.get("/me", response_model=User)
async def get_current_user(current_user: User = Depends(auth_controller.get_current_user)):
    """Get current user information"""
    return current_user