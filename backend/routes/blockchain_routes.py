from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from ..services.blockchain_service import BlockchainService
from ..controllers.auth_controller import AuthController
from ..models.user import User

router = APIRouter(prefix="/blockchain", tags=["blockchain"])
blockchain_service = BlockchainService()
auth_controller = AuthController()

@router.get("/stats", response_model=Dict[str, Any])
async def get_blockchain_stats(
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Get blockchain statistics"""
    return await blockchain_service.get_blockchain_stats()

@router.get("/verify-chain")
async def verify_blockchain_integrity(
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Verify the integrity of the entire blockchain"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    is_valid = await blockchain_service.verify_chain_integrity()
    return {"chain_integrity": is_valid}

@router.get("/record/{record_id}/history", response_model=List[Dict[str, Any]])
async def get_record_blockchain_history(
    record_id: str,
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Get blockchain history for a specific record"""
    return await blockchain_service.get_record_history(record_id)