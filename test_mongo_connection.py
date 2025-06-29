import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from backend directory
ROOT_DIR = Path(__file__).parent
backend_dir = ROOT_DIR / 'backend'
env_file = backend_dir / '.env'

if env_file.exists():
    load_dotenv(env_file)
    logger.info(f"Loaded environment from {env_file}")
else:
    # Try loading from current directory
    current_env = ROOT_DIR / '.env'
    if current_env.exists():
        load_dotenv(current_env)
        logger.info(f"Loaded environment from {current_env}")
    else:
        logger.warning(f"No .env file found at {env_file} or {current_env}")

def test_mongodb_connection():
    """Basic MongoDB connection test compatible with WebContainer"""
    try:
        # Get connection details from environment
        mongo_url = os.environ.get('MONGO_URL')
        db_name = os.environ.get('DB_NAME', 'digital_one_health')
        
        print("=" * 60)
        print("🔍 MONGODB CONNECTION TEST")
        print("=" * 60)
        
        # Check if connection string exists
        if not mongo_url:
            print("❌ MONGO_URL environment variable not found!")
            print("Please set MONGO_URL in your .env file")
            print("Expected location: backend/.env")
            return False
        
        # Mask sensitive parts of the connection string for display
        masked_url = mongo_url
        if "@" in mongo_url:
            parts = mongo_url.split("@")
            if len(parts) >= 2:
                credentials = parts[0].split("//")[-1]
                if ":" in credentials:
                    username = credentials.split(":")[0]
                    masked_url = mongo_url.replace(credentials, f"{username}:***")
        
        print(f"📡 Connection String: {masked_url}")
        print(f"🗄️  Database Name: {db_name}")
        print()
        
        # Basic validation of connection string format
        if not mongo_url.startswith(('mongodb://', 'mongodb+srv://')):
            print("❌ Invalid MongoDB connection string format!")
            print("Expected format: mongodb://... or mongodb+srv://...")
            return False
        
        print("✅ MongoDB connection string format is valid")
        
        # Test if we can import the database module
        print("🔧 Testing application database module...")
        try:
            # Add backend directory to Python path
            backend_path = str(backend_dir)
            if backend_path not in sys.path:
                sys.path.insert(0, backend_path)
            
            # Try to import database module
            import database
            print("✅ Database module imported successfully!")
            
            # Check if required functions exist
            if hasattr(database, 'get_database'):
                print("✅ get_database function found!")
            else:
                print("⚠️  get_database function not found in database module")
                
        except ImportError as e:
            print(f"❌ Could not import database module: {e}")
            print(f"Backend directory: {backend_dir}")
            print(f"Backend exists: {backend_dir.exists()}")
            return False
        except Exception as e:
            print(f"❌ Error testing database module: {e}")
            return False
        
        # Check for required environment variables
        print("\n🔍 Environment Variables Check:")
        required_vars = ['MONGO_URL', 'DB_NAME']
        optional_vars = ['SECRET_KEY', 'JWT_SECRET']
        
        all_vars_present = True
        for var in required_vars:
            value = os.environ.get(var)
            if value:
                print(f"✅ {var}: Set")
            else:
                print(f"❌ {var}: Not set")
                all_vars_present = False
        
        for var in optional_vars:
            value = os.environ.get(var)
            if value:
                print(f"✅ {var}: Set")
            else:
                print(f"⚠️  {var}: Not set (optional)")
        
        if not all_vars_present:
            print("\n❌ Some required environment variables are missing!")
            return False
        
        print("\n" + "=" * 60)
        print("🎉 BASIC MONGODB CONNECTION TEST COMPLETED!")
        print("=" * 60)
        print("\nNote: Full database connectivity test requires a standard Python environment.")
        print("This test validates configuration and module imports only.")
        
        return True
        
    except Exception as e:
        print(f"\n❌ MongoDB connection test failed!")
        print(f"Error: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        
        # Provide troubleshooting tips
        print("\n🔧 Troubleshooting Tips:")
        print("1. Check if your MongoDB Atlas cluster is running")
        print("2. Verify your IP address is whitelisted in MongoDB Atlas")
        print("3. Ensure your username/password are correct")
        print("4. Check if the database name exists")
        print("5. Verify the .env file is properly configured")
        
        return False

def check_environment():
    """Check environment setup"""
    print("🔍 Environment Check:")
    print(f"   - Current directory: {Path.cwd()}")
    print(f"   - Script location: {Path(__file__).parent}")
    print(f"   - Backend directory exists: {(Path(__file__).parent / 'backend').exists()}")
    
    # Check for .env files
    backend_env = Path(__file__).parent / 'backend' / '.env'
    root_env = Path(__file__).parent / '.env'
    
    print(f"   - Backend .env exists: {backend_env.exists()}")
    print(f"   - Root .env exists: {root_env.exists()}")
    
    # Check environment variables
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    
    print(f"   - MONGO_URL set: {'Yes' if mongo_url else 'No'}")
    print(f"   - DB_NAME set: {'Yes' if db_name else 'No'}")
    print()

def check_backend_files():
    """Check if required backend files exist"""
    print("📁 Backend Files Check:")
    
    required_files = [
        'backend/database.py',
        'backend/main.py',
        'backend/config.py',
        'backend/requirements.txt'
    ]
    
    all_files_exist = True
    for file_path in required_files:
        full_path = Path(__file__).parent / file_path
        exists = full_path.exists()
        print(f"   - {file_path}: {'✅ Exists' if exists else '❌ Missing'}")
        if not exists:
            all_files_exist = False
    
    print()
    return all_files_exist

if __name__ == "__main__":
    print("Starting MongoDB connection test (WebContainer compatible)...")
    
    # Check environment first
    check_environment()
    
    # Check backend files
    files_ok = check_backend_files()
    
    if not files_ok:
        print("❌ Some required backend files are missing!")
        sys.exit(1)
    
    # Run connection test
    success = test_mongodb_connection()
    
    if success:
        print("\n✅ MongoDB configuration appears to be correct!")
        print("Note: Run the backend server to test actual database connectivity.")
        sys.exit(0)
    else:
        print("\n❌ MongoDB configuration test failed!")
        sys.exit(1)