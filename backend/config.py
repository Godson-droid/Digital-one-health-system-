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

# CORS Configuration - CRITICAL FIX for deployment
CORS_ORIGINS = ["*"]  # Allow all origins for deployment

# Timeout Configuration - Increased for deployment
REQUEST_TIMEOUT = int(os.environ.get('REQUEST_TIMEOUT', '60'))  # seconds - increased for Render.com
DATABASE_TIMEOUT = int(os.environ.get('DATABASE_TIMEOUT', '20'))  # seconds - increased for cold starts

# Server Configuration
HOST = os.environ.get('HOST', '0.0.0.0')
PORT = int(os.environ.get('PORT', '8001'))

# Deployment specific configurations
DEPLOYMENT_ENV = os.environ.get('DEPLOYMENT_ENV', 'production')
IS_PRODUCTION = DEPLOYMENT_ENV.lower() == 'production'

# Cold start handling for serverless deployments
COLD_START_TIMEOUT = int(os.environ.get('COLD_START_TIMEOUT', '90'))  # seconds