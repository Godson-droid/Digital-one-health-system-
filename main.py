"""
Digital One Health System - Main Entry Point
Secure health data management with blockchain integrity
"""

import sys
import os
from pathlib import Path

# Add backend directory to Python path for deployment compatibility
backend_dir = Path(__file__).parent / "backend"
if backend_dir.exists():
    sys.path.insert(0, str(backend_dir))

# Import and run the FastAPI application
try:
    from backend.main import app
    
    if __name__ == "__main__":
        import uvicorn
        
        # Get port from environment or default to 8001
        port = int(os.environ.get("PORT", 8001))
        host = os.environ.get("HOST", "0.0.0.0")
        
        print(f"🚀 Starting Digital One Health System on {host}:{port}")
        print("📊 Features: MVC Architecture + Blockchain Integrity")
        
        uvicorn.run(
            app, 
            host=host, 
            port=port,
            log_level="info"
        )
        
except ImportError as e:
    print(f"❌ Error importing backend application: {e}")
    print("Please ensure the backend directory and dependencies are properly set up.")
    sys.exit(1)