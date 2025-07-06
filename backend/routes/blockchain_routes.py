from fastapi import APIRouter, Depends, HTTPException
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
    """Get blockchain statistics with auto-repair"""
    try:
        # First attempt to get stats
        stats = await blockchain_service.get_blockchain_stats()
        
        # If chain integrity is false, attempt auto-repair
        if not stats.get("chain_integrity", False):
            print("Chain integrity issues detected, attempting auto-repair...")
            repair_success = await blockchain_service.auto_repair_chain()
            
            if repair_success:
                # Get updated stats after repair
                stats = await blockchain_service.get_blockchain_stats()
                print("✅ Blockchain auto-repair completed")
            else:
                print("⚠️ Blockchain auto-repair failed")
        
        return stats
    except Exception as e:
        print(f"Error getting blockchain stats: {e}")
        return {
            "total_blocks": 0,
            "latest_block_index": -1,
            "chain_integrity": False,
            "difficulty": 1
        }

@router.get("/verify-chain")
async def verify_blockchain_integrity(
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Verify the integrity of the entire blockchain with auto-repair"""
    try:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Attempt verification with auto-repair
        is_valid = await blockchain_service.verify_chain_integrity()
        
        # If verification fails, attempt full rebuild
        if not is_valid:
            print("Chain verification failed, attempting full rebuild...")
            rebuild_success = await blockchain_service.rebuild_chain_integrity()
            
            if rebuild_success:
                # Re-verify after rebuild
                is_valid = await blockchain_service.verify_chain_integrity()
                return {
                    "chain_integrity": is_valid,
                    "repaired": True,
                    "message": "Chain integrity issues detected and repaired"
                }
            else:
                return {
                    "chain_integrity": False,
                    "repaired": False,
                    "message": "Chain integrity issues detected but repair failed"
                }
        
        return {
            "chain_integrity": is_valid,
            "repaired": False,
            "message": "Chain integrity verified successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error verifying blockchain integrity: {e}")
        return {
            "chain_integrity": False,
            "repaired": False,
            "message": f"Verification error: {str(e)}"
        }

@router.post("/rebuild-chain")
async def rebuild_blockchain_integrity(
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Rebuild blockchain integrity (admin only)"""
    try:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        success = await blockchain_service.rebuild_chain_integrity()
        
        if success:
            # Verify after rebuild
            is_valid = await blockchain_service.verify_chain_integrity()
            return {
                "success": success,
                "chain_integrity": is_valid,
                "message": "Chain integrity rebuilt successfully"
            }
        else:
            return {
                "success": False,
                "chain_integrity": False,
                "message": "Failed to rebuild chain integrity"
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error rebuilding blockchain integrity: {e}")
        return {
            "success": False,
            "chain_integrity": False,
            "message": f"Rebuild error: {str(e)}"
        }

@router.post("/auto-repair")
async def auto_repair_blockchain(
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Automatically repair blockchain integrity issues"""
    try:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        success = await blockchain_service.auto_repair_chain()
        
        # Get updated stats after repair
        stats = await blockchain_service.get_blockchain_stats()
        
        return {
            "success": success,
            "chain_integrity": stats.get("chain_integrity", False),
            "total_blocks": stats.get("total_blocks", 0),
            "message": "Auto-repair completed successfully" if success else "Auto-repair failed"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during auto-repair: {e}")
        return {
            "success": False,
            "chain_integrity": False,
            "message": f"Auto-repair error: {str(e)}"
        }

@router.get("/record/{record_id}/history", response_model=List[Dict[str, Any]])
async def get_record_blockchain_history(
    record_id: str,
    current_user: User = Depends(auth_controller.get_current_user)
):
    """Get blockchain history for a specific record"""
    try:
        return await blockchain_service.get_record_history(record_id)
    except Exception as e:
        print(f"Error getting record history: {e}")
        return []