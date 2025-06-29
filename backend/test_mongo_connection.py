import asyncio
import os
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
ROOT_DIR = Path(__file__).parent
env_file = ROOT_DIR / '.env'

if env_file.exists():
    load_dotenv(env_file)
    logger.info(f"Loaded environment from {env_file}")
else:
    logger.warning(f"No .env file found at {env_file}")

async def test_mongodb_connection():
    """Comprehensive MongoDB connection test"""
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
        
        # Test connection
        print("🔗 Testing MongoDB connection...")
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
        
        # Ping the database
        await client.admin.command('ping')
        print("✅ MongoDB ping successful!")
        
        # Get database
        db = client[db_name]
        
        # Test database operations
        print("🧪 Testing database operations...")
        
        # List collections
        collections = await db.list_collection_names()
        print(f"📁 Existing collections: {collections}")
        
        # Test write operation
        test_collection = db.connection_test
        test_doc = {
            "test": True,
            "timestamp": "2024-01-01T00:00:00Z",
            "message": "Connection test successful"
        }
        
        result = await test_collection.insert_one(test_doc)
        print(f"✅ Test write successful! Document ID: {result.inserted_id}")
        
        # Test read operation
        found_doc = await test_collection.find_one({"_id": result.inserted_id})
        if found_doc:
            print("✅ Test read successful!")
        else:
            print("❌ Test read failed!")
            
        # Clean up test document
        await test_collection.delete_one({"_id": result.inserted_id})
        print("🧹 Test document cleaned up")
        
        # Get database stats
        try:
            stats = await db.command("dbStats")
            print(f"📊 Database Statistics:")
            print(f"   - Collections: {stats.get('collections', 0)}")
            print(f"   - Data Size: {stats.get('dataSize', 0)} bytes")
            print(f"   - Storage Size: {stats.get('storageSize', 0)} bytes")
            print(f"   - Indexes: {stats.get('indexes', 0)}")
        except Exception as e:
            print(f"⚠️  Could not get database stats: {e}")
        
        # Test application collections
        print("\n🔍 Checking application collections...")
        app_collections = ['users', 'health_records', 'blockchain']
        
        for collection_name in app_collections:
            try:
                collection = db[collection_name]
                count = await collection.count_documents({})
                print(f"   - {collection_name}: {count} documents")
                
                # Check indexes
                indexes = await collection.list_indexes().to_list(100)
                index_names = [idx.get('name', 'unknown') for idx in indexes]
                print(f"     Indexes: {index_names}")
                
            except Exception as e:
                print(f"   - {collection_name}: Error - {e}")
        
        # Test connection with application database module
        print("\n🔧 Testing application database module...")
        try:
            sys.path.append(str(ROOT_DIR))
            from database import get_database
            
            app_db = await get_database()
            await app_db.command('ping')
            print("✅ Application database module working!")
            
        except Exception as e:
            print(f"❌ Application database module error: {e}")
        
        # Close connection
        client.close()
        
        print("\n" + "=" * 60)
        print("🎉 MONGODB CONNECTION TEST COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        
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
        print("5. Verify network connectivity")
        
        if "authentication failed" in str(e).lower():
            print("🔑 Authentication issue - check username/password")
        elif "timeout" in str(e).lower():
            print("⏰ Timeout issue - check network/firewall settings")
        elif "dns" in str(e).lower():
            print("🌐 DNS issue - check connection string format")
            
        return False

async def create_indexes():
    """Create necessary indexes for the application"""
    try:
        mongo_url = os.environ.get('MONGO_URL')
        db_name = os.environ.get('DB_NAME', 'digital_one_health')
        
        if not mongo_url:
            print("❌ MONGO_URL not found, cannot create indexes")
            return False
            
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        print("\n🔧 Creating application indexes...")
        
        # Users collection indexes
        await db.users.create_index("username", unique=True)
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        print("✅ Users indexes created")
        
        # Health records collection indexes
        await db.health_records.create_index("id", unique=True)
        await db.health_records.create_index("owner_id")
        await db.health_records.create_index("is_public")
        await db.health_records.create_index("record_type")
        await db.health_records.create_index("created_at")
        print("✅ Health records indexes created")
        
        # Blockchain collection indexes
        await db.blockchain.create_index("index", unique=True)
        await db.blockchain.create_index("data.record_id")
        await db.blockchain.create_index("hash", unique=True)
        await db.blockchain.create_index("timestamp")
        print("✅ Blockchain indexes created")
        
        client.close()
        print("🎉 All indexes created successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error creating indexes: {e}")
        return False

if __name__ == "__main__":
    print("Starting MongoDB connection test...")
    
    # Run connection test
    success = asyncio.run(test_mongodb_connection())
    
    if success:
        # Create indexes if connection successful
        asyncio.run(create_indexes())
        print("\n✅ MongoDB is ready for the application!")
        sys.exit(0)
    else:
        print("\n❌ MongoDB connection failed!")
        sys.exit(1)