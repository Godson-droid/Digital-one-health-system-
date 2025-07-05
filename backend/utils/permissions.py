from ..models.health_record import HealthRecordInDB
from ..models.user import User

def check_record_access(record: HealthRecordInDB, user: User) -> bool:
    """Check if user has access to read a record"""
    try:
        if not record or not user:
            return False
            
        # Admin can access all records
        if user.role == "admin":
            return True
        
        # Owner can access their own records
        if record.owner_id == user.id:
            return True
        
        # Public records can be accessed by healthcare providers and researchers
        if record.is_public and user.role in ["healthcare_provider", "researcher"]:
            return True
        
        return False
    except Exception as e:
        print(f"Error checking record access: {e}")
        return False

def can_modify_record(record: HealthRecordInDB, user: User) -> bool:
    """Check if user can modify a record - STRICT PERMISSIONS"""
    try:
        if not record or not user:
            return False
            
        # Admin can modify all records
        if user.role == "admin":
            return True
        
        # CRITICAL: Only the original owner/creator can modify their own records
        # Both owner_id and created_by must match the current user
        if record.owner_id == user.id and record.created_by == user.id:
            return True
        
        # NO OTHER PERMISSIONS - Individual users cannot modify records they didn't create
        return False
    except Exception as e:
        print(f"Error checking modify permissions: {e}")
        return False

def can_view_record_details(record: HealthRecordInDB, user: User) -> bool:
    """Check if user can view detailed record information"""
    try:
        if not record or not user:
            return False
            
        # Admin can view all record details
        if user.role == "admin":
            return True
        
        # Owner can view their own record details
        if record.owner_id == user.id:
            return True
        
        # Healthcare providers can view public record details
        if record.is_public and user.role == "healthcare_provider":
            return True
        
        # Researchers can view public record details (limited)
        if record.is_public and user.role == "researcher":
            return True
        
        return False
    except Exception as e:
        print(f"Error checking view permissions: {e}")
        return False

def can_change_privacy(record: HealthRecordInDB, user: User) -> bool:
    """Check if user can change record privacy settings"""
    try:
        if not record or not user:
            return False
            
        # Admin can change privacy for all records
        if user.role == "admin":
            return True
        
        # ONLY the original owner/creator can change privacy
        if record.owner_id == user.id and record.created_by == user.id:
            return True
        
        return False
    except Exception as e:
        print(f"Error checking privacy change permissions: {e}")
        return False

def can_verify_record(record: HealthRecordInDB, user: User) -> bool:
    """Check if user can verify a record's blockchain integrity"""
    try:
        if not record or not user:
            return False
            
        # Admin can verify all records
        if user.role == "admin":
            return True
        
        # Record owner/creator can verify their own records
        if record.owner_id == user.id and record.created_by == user.id:
            return True
        
        # Healthcare providers can verify public records
        if record.is_public and user.role == "healthcare_provider":
            return True
        
        # Researchers can verify public records
        if record.is_public and user.role == "researcher":
            return True
        
        return False
    except Exception as e:
        print(f"Error checking verification permissions: {e}")
        return False

def require_role(required_roles: list):
    """Decorator to require specific roles"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            # This would be implemented with FastAPI dependencies
            return func(*args, **kwargs)
        return wrapper
    return decorator

def get_user_permissions(user: User) -> dict:
    """Get a summary of user permissions"""
    try:
        if not user:
            return {}
            
        permissions = {
            "can_create_records": user.role in ["healthcare_provider", "individual", "admin"],
            "can_view_all_records": user.role == "admin",
            "can_view_public_records": user.role in ["healthcare_provider", "researcher", "admin"],
            "can_modify_own_records": user.role in ["healthcare_provider", "individual", "admin"],
            "can_modify_any_records": user.role == "admin",
            "can_change_privacy": user.role in ["healthcare_provider", "individual", "admin"],
            "can_verify_blockchain": True,  # All authenticated users can verify records they have access to
            "can_access_blockchain_stats": True,  # All authenticated users can view stats
        }
        
        return permissions
    except Exception as e:
        print(f"Error getting user permissions: {e}")
        return {}