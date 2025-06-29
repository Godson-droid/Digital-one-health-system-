from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from pathlib import Path

from .routes import auth_routes, health_record_routes, blockchain_routes
from .database import close_database
from .config import DEBUG, CORS_ORIGINS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Digital One Health System",
    description="Secure health data management with blockchain integrity",
    version="2.0.0",
    debug=DEBUG
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_routes.router, prefix="/api")
app.include_router(health_record_routes.router, prefix="/api")
app.include_router(blockchain_routes.router, prefix="/api")

# Legacy endpoints for backward compatibility
@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Legacy dashboard stats endpoint"""
    return {
        "message": "Please use the new MVC endpoints",
        "new_endpoints": {
            "blockchain_stats": "/api/blockchain/stats",
            "health_records": "/api/health-records"
        }
    }

@app.get("/api/system/status")
async def system_status():
    """System status endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "architecture": "MVC",
        "features": {
            "encryption": "AES-256 enabled",
            "mfa": "TOTP 90-second window",
            "blockchain": "Proof of Work enabled",
            "database": "MongoDB connected"
        }
    }

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await close_database()
    logger.info("Application shutdown complete")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)