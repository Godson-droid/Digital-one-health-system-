import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent
env_file = ROOT_DIR / '.env'

# Only load .env if it exists
if env_file.exists():
    load_dotenv(env_file)

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Encryption Configuration
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', 'your-encryption-key-change-in-production')

# Database Configuration
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'digital_one_health')

# Blockchain Configuration - Reset to difficulty 1 for easier deployment
BLOCKCHAIN_DIFFICULTY = int(os.environ.get('BLOCKCHAIN_DIFFICULTY', '1'))

# Security Configuration
MFA_INTERVAL = int(os.environ.get('MFA_INTERVAL', '90'))  # seconds

# Application Configuration
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

# CORS Configuration - Updated for deployment
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')

# If CORS_ORIGINS is just '*', allow all origins for development
if CORS_ORIGINS == ['*']:
    CORS_ORIGINS = ["*"]
else:
    # Clean up origins and add common deployment URLs
    cleaned_origins = []
    for origin in CORS_ORIGINS:
        origin = origin.strip()
        if origin:
            cleaned_origins.append(origin)
    
    # Add common localhost origins for development
    dev_origins = [
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ]
    
    for dev_origin in dev_origins:
        if dev_origin not in cleaned_origins:
            cleaned_origins.append(dev_origin)
    
    CORS_ORIGINS = cleaned_origins

# Timeout Configuration
REQUEST_TIMEOUT = int(os.environ.get('REQUEST_TIMEOUT', '30'))  # seconds
DATABASE_TIMEOUT = int(os.environ.get('DATABASE_TIMEOUT', '10'))  # seconds

# Server Configuration
HOST = os.environ.get('HOST', '0.0.0.0')
PORT = int(os.environ.get('PORT', '8001'))