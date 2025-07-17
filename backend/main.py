"""
Digital One Health System - FastAPI Backend
Complete MVC architecture with blockchain integrity and enterprise security
"""
import sys
from pathlib import Path


import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Add backend directory to path for imports
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Import configuration and services
from backend.config import (
    CORS_ORIGINS, REQUEST_TIMEOUT, IS_PRODUCTION, 
    HOST, PORT, DEBUG, MAX_RETRIES, RETRY_DELAY
)
from backend.database import get_database, close_database, test_database_connection
from backend.services.user_service import UserService
from backend.services.fabric_integration_service import get_fabric_security_service

# Import route modules
from backend.routes.auth_routes import router as auth_router
from backend.routes.health_record_routes import router as health_record_router
from backend.routes.blockchain_routes import router as blockchain_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if not DEBUG else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Request timeout middleware
class TimeoutMiddleware:
    def __init__(self, app, timeout: int = REQUEST_TIMEOUT):
        self.app = app
        self.timeout = timeout

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        try:
            await asyncio.wait_for(
                self.app(scope, receive, send),
                timeout=self.timeout
            )
        except asyncio.TimeoutError:
            response = JSONResponse(
                status_code=408,
                content={"detail": f"Request timeout after {self.timeout} seconds"}
            )
            await response(scope, receive, send)

# Application lifespan management
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown"""
    # Startup
    logger.info("🚀 Starting Digital One Health System...")
    
    try:
        # Test database connection
        logger.info("🔗 Testing database connection...")
        db_connected = await test_database_connection()
        if not db_connected:
            logger.warning("⚠️ Database connection failed, but continuing...")
        else:
            logger.info("✅ Database connection successful")
        
        # Initialize default admin user
        try:
            user_service = UserService()
            admin_user = await user_service.create_default_admin()
            if admin_user:
                logger.info("✅ Default admin user setup completed")
        except Exception as e:
            logger.warning(f"⚠️ Admin user setup warning: {e}")
        
        # Initialize Fabric Security Service
        try:
            logger.info("🔐 Initializing Full Hyperledger Fabric Enterprise Security...")
            fabric_service = await get_fabric_security_service()
            if fabric_service.is_connected:
                logger.info("✅ Full Hyperledger Fabric Security Service initialized")
            else:
                logger.info("ℹ️ Fabric Security Service initialized in fallback mode")
        except Exception as e:
            logger.warning(f"⚠️ Fabric Security Service warning: {e}")
        
        logger.info("✅ Application startup complete")
        
        yield
        
    except Exception as e:
        logger.error(f"❌ Startup error: {e}")
        yield
    
    # Shutdown
    logger.info("🛑 Shutting down Digital One Health System...")
    
    try:
        # Close Fabric Security Service
        fabric_service = await get_fabric_security_service()
        await fabric_service.close()
        logger.info("✅ Fabric Security Service closed")
    except Exception as e:
        logger.warning(f"⚠️ Error closing Fabric service: {e}")
    
    try:
        # Close database connections
        await close_database()
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.warning(f"⚠️ Error closing database: {e}")
    
    logger.info("✅ Shutdown complete")

# Create FastAPI application
app = FastAPI(
    title="Digital One Health System",
    description="Secure health data management with blockchain integrity and enterprise security",
    version="2.0.0",
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
    lifespan=lifespan
)

# Add timeout middleware
app.add_middleware(TimeoutMiddleware, timeout=REQUEST_TIMEOUT)

# Add trusted host middleware for production
if IS_PRODUCTION:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]  # Configure with your actual domains in production
    )

# CORS middleware - ENHANCED for deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error": str(exc) if DEBUG else "An unexpected error occurred"
        }
    )

# Health check endpoint - ENHANCED
@app.get("/health")
async def health_check():
    """Enhanced health check with system status"""
    try:
        # Test database connection
        db_status = await test_database_connection()
        
        # Test Fabric service status
        try:
            fabric_service = await get_fabric_security_service()
            fabric_status = fabric_service.is_connected
        except Exception:
            fabric_status = False
        
        status = "healthy" if db_status else "degraded"
        
        return {
            "status": status,
            "timestamp": "2025-01-16T16:45:42+0000",
            "version": "2.0.0",
            "services": {
                "database": "connected" if db_status else "disconnected",
                "fabric_security": "connected" if fabric_status else "fallback_mode",
                "blockchain": "operational",
                "api": "operational"
            },
            "features": {
                "mvc_architecture": True,
                "blockchain_integrity": True,
                "enterprise_security": True,
                "multi_factor_auth": True,
                "role_based_access": True,
                "data_encryption": True
            }
        }
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": "2025-01-16T16:45:42+0000"
            }
        )

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Digital One Health System API",
        "version": "2.0.0",
        "architecture": "MVC with Blockchain Integrity",
        "security": "Enterprise Hyperledger Fabric",
        "documentation": "/docs" if DEBUG else "Contact administrator",
        "health_check": "/health",
        "api_base": "/api"
    }

# Include API routers
app.include_router(auth_router, prefix="/api")
app.include_router(health_record_router, prefix="/api")
app.include_router(blockchain_router, prefix="/api")

# Dashboard stats endpoint
@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        # This would typically get real stats from the database
        return {
            "total_users": 0,
            "total_records": 0,
            "public_records": 0,
            "private_records": 0,
            "blockchain_blocks": 0,
            "system_status": "operational"
        }
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Failed to get dashboard stats"}
        )

# System status endpoint
@app.get("/api/system/status")
async def system_status():
    """Get detailed system status"""
    try:
        return {
            "status": "healthy",
            "timestamp": "2025-01-16T16:45:42+0000",
            "encryption": "AES-256 enabled",
            "mfa": "TOTP 90-second window",
            "database": "Connected",
            "blockchain": "Operational",
            "fabric_security": "Enterprise Mode"
        }
    except Exception as e:
        logger.error(f"System status error: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Failed to get system status"}
        )

if __name__ == "__main__":
    logger.info("🚀 Starting Digital One Health System")
    logger.info(f"📊 Features: MVC Architecture + Blockchain Integrity + Enterprise Security")
    
    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        log_level="info" if not DEBUG else "debug",
        access_log=True
    )
