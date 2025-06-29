from ..models.health_record import HealthRecordInDB
from ..models.user import User

def check_record_access(record: HealthRecordInDB, user: User) -> bool:
    """Check if user has access to read a record"""
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

def can_modify_record(record: HealthRecordInDB, user: User) -> bool:
    """Check if user can modify a record"""
    # Admin can modify all records
    if user.role == "admin":
        return True
    
    # Owner can modify their own records
    if record.owner_id == user.id:
        return True
    
    return False

def require_role(required_roles: list):
    """Decorator to require specific roles"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            # This would be implemented with FastAPI dependencies
            return func(*args, **kwargs)
        return wrapper
    return decorator