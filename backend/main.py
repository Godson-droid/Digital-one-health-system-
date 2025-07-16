from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time
import asyncio
from pathlib import Path

from .routes import auth_routes, health_record_routes, blockchain_routes
from .database import close_database, get_database
from .config import DEBUG, CORS_ORIGINS, REQUEST_TIMEOUT, HOST, PORT
from .services.user_service import UserService
from .services.fabric_integration_service import get_fabric_security_service

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
    debug=DEBUG,
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None
)

# CRITICAL FIX: Enhanced CORS middleware for deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for deployment
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Accept",
        "Accept-Language", 
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-CSRF-Token",
        "X-Process-Time",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "Cache-Control",
        "Pragma"
    ],
    expose_headers=["X-Process-Time"],
    max_age=3600,
)

# Request timeout middleware with better error handling
@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    try:
        start_time = time.time()
        
        # Set a timeout for the request
        response = await asyncio.wait_for(
            call_next(request), 
            timeout=REQUEST_TIMEOUT
        )
        
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        
        # Add CORS headers to all responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        
        return response
    except asyncio.TimeoutError:
        logger.error(f"Request timeout after {REQUEST_TIMEOUT} seconds for {request.url}")
        return JSONResponse(
            status_code=408,
            content={"detail": f"Request timeout after {REQUEST_TIMEOUT} seconds"},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            }
        )
    except Exception as e:
        logger.error(f"Request processing error: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            }
        )

# Enhanced health check endpoint - CRITICAL FIX
@app.get("/health")
async def health_check():
    """Enhanced health check endpoint for deployment monitoring"""
    try:
        # Test database connection
        db = await get_database()
        if db is not None:
            await db.command('ping')
            db_status = "connected"
        else:
            db_status = "disconnected"
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "healthy",
                "timestamp": time.time(),
                "database": db_status,
                "version": "2.0.0",
                "cors": "enabled",
                "backend_url": "https://digital-one-health-system.onrender.com",
                "api_endpoints": {
                    "auth": "/api/auth",
                    "health_records": "/api/health-records",
                    "blockchain": "/api/blockchain"
                }
            },
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            }
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": time.time(),
                "error": str(e),
                "database": "disconnected"
            },
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", 
                "Access-Control-Allow-Headers": "*"
            }
        )

# Root endpoint with API information
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return JSONResponse(
        content={
            "message": "Digital One Health System API",
            "version": "2.0.0",
            "status": "running",
            "docs": "/docs",
            "health": "/health",
            "api_base": "/api",
            "endpoints": {
                "authentication": "/api/auth",
                "health_records": "/api/health-records", 
                "blockchain": "/api/blockchain"
            }
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        }
    )

# OPTIONS handler for preflight requests
@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle OPTIONS requests for CORS preflight"""
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600"
        }
    )

# Include routers with error handling
try:
    app.include_router(auth_routes.router, prefix="/api")
    app.include_router(health_record_routes.router, prefix="/api")
    app.include_router(blockchain_routes.router, prefix="/api")
    logger.info("All routes loaded successfully")
except Exception as e:
    logger.error(f"Error loading routes: {e}")

# Legacy endpoints for backward compatibility
@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Legacy dashboard stats endpoint"""
    return JSONResponse(
        content={
            "message": "Please use the new MVC endpoints",
            "new_endpoints": {
                "blockchain_stats": "/api/blockchain/stats",
                "health_records": "/api/health-records"
            }
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        }
    )

@app.get("/api/system/status")
async def system_status():
    """System status endpoint"""
    try:
        # Test database connection
        db = await get_database()
        if db is not None:
            await db.command('ping')
            db_status = "connected"
        else:
            db_status = "disconnected"
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        db_status = "disconnected"
    
    return JSONResponse(
        content={
            "status": "healthy",
            "version": "2.0.0",
            "architecture": "MVC",
            "database": db_status,
            "cors_origins": CORS_ORIGINS,
            "request_timeout": REQUEST_TIMEOUT,
            "features": {
                "encryption": "AES-256 enabled",
                "mfa": "TOTP 90-second window",
                "blockchain": "Proof of Work enabled",
                "admin_policy": "Single admin enforced"
            }
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        }
    )

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {exc} for request {request.url}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error occurred"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        }
    )

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    try:
        logger.info("🚀 Digital One Health System v2.0 with Enterprise Security starting up...")
        logger.info(f"CORS Origins: {CORS_ORIGINS}")
        logger.info(f"Request Timeout: {REQUEST_TIMEOUT}s")
        
        # Test database connection with timeout
        try:
            db = await asyncio.wait_for(get_database(), timeout=15)
            if db is not None:
                logger.info("Database connection established")
            else:
                logger.error("Database connection returned None")
        except asyncio.TimeoutError:
            logger.error("Database connection timeout during startup")
        except Exception as e:
            logger.error(f"Database connection failed during startup: {e}")
        
        # Create default admin user if none exists
        try:
            user_service = UserService()
            admin_user = await user_service.create_default_admin()
            if admin_user is not None:
                logger.info("Default admin user setup completed")
            else:
                logger.info("Admin user already exists or creation failed")
        except Exception as e:
            logger.error(f"Admin user creation failed: {e}")
        
        logger.info("Application startup complete")
    except Exception as e:
        logger.error(f"Startup error: {e}")
    
    # Initialize Fabric Security Service (ENABLED for Render)
    try:
        logger.info("🔐 Initializing Full Hyperledger Fabric Enterprise Security...")
        fabric_service = await get_fabric_security_service()
        await fabric_service.initialize()
        logger.info("✅ Full Hyperledger Fabric enterprise security enabled")
    except Exception as e:
        logger.info(f"ℹ️ Hyperledger Fabric security will be available when network is deployed: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    try:
        await close_database()
        fabric_service = await get_fabric_security_service()
        await fabric_service.close()
        logger.info("Application shutdown complete")
    except Exception as e:
        logger.error(f"Shutdown error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=HOST, 
        port=PORT,
        timeout_keep_alive=30,
        timeout_graceful_shutdown=10
    )