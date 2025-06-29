import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def test_mongodb_connection():
    """Test MongoDB connection and create initial collections"""
    try:
        # Get connection details
        mongo_url = os.environ.get('MONGO_URL')
        db_name = os.environ.get('DB_NAME')
        
        print(f"🔗 Connecting to MongoDB...")
        print(f"Database: {db_name}")
        
        # Create client and connect
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        # Test connection
        await client.admin.command('ping')
        print("✅ MongoDB connection successful!")
        
        # List existing collections
        collections = await db.list_collection_names()
        print(f"📁 Existing collections: {collections}")
        
        # Create indexes for better performance
        print("🔧 Setting up database indexes...")
        
        # Users collection indexes
        await db.users.create_index("username", unique=True)
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        
        # Health records collection indexes
        await db.health_records.create_index("id", unique=True)
        await db.health_records.create_index("owner_id")
        await db.health_records.create_index("is_public")
        await db.health_records.create_index("record_type")
        
        # Blockchain collection indexes
        await db.blockchain.create_index("index", unique=True)
        await db.blockchain.create_index("data.record_id")
        await db.blockchain.create_index("hash", unique=True)
        
        print("✅ Database indexes created successfully!")
        
        # Get database stats
        stats = await db.command("dbStats")
        print(f"📊 Database stats:")
        print(f"   - Collections: {stats.get('collections', 0)}")
        print(f"   - Data size: {stats.get('dataSize', 0)} bytes")
        print(f"   - Storage size: {stats.get('storageSize', 0)} bytes")
        
        # Close connection
        client.close()
        print("🎉 Database setup complete!")
        
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    asyncio.run(test_mongodb_connection())