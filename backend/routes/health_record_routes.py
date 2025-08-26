from fastapi import APIRouter, Depends, Query
from typing import List, Dict, Any
from ..controllers.health_record_controller import HealthRecordController
from ..controllers.auth_controller import AuthController
from ..models.health_record import HealthRecordCreate, HealthRecordUpdate
from ..models.user import User

router = APIRouter(prefix="/health-records", tags=["health-records"])
health_record_controller = HealthRecordController()
auth_controller = AuthController()

@router.post("", response_model=dict)
async def create_health_record(
    record_data: HealthRecordCreate,
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Create a new health record"""
    return await health_record_controller.create_health_record(record_data, current_user)

@router.get("", response_model=List[Dict[str, Any]])
async def get_health_records(
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Get health records for current user"""
    return await health_record_controller.get_health_records(current_user)

@router.get("/{record_id}", response_model=Dict[str, Any])
async def get_health_record(
    record_id: str,
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Get a specific health record"""
    return await health_record_controller.get_health_record(record_id, current_user)

@router.put("/{record_id}", response_model=dict)
async def update_health_record(
    record_id: str,
    update_data: HealthRecordUpdate,
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Update a health record - RESTRICTED: Only original creator can modify"""
    return await health_record_controller.update_health_record(record_id, update_data, current_user)

@router.put("/{record_id}/privacy")
async def update_record_privacy(
    record_id: str,
    is_public: bool = Query(...),
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Update privacy settings for a record - RESTRICTED: Only original creator can change"""
    return await health_record_controller.update_record_privacy(record_id, is_public, current_user)

@router.get("/{record_id}/verify", response_model=dict)
async def verify_record_integrity(
    record_id: str,
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Verify blockchain integrity of a record"""
    return await health_record_controller.verify_record_integrity(record_id, current_user)