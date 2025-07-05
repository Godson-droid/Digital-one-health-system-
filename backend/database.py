from motor.motor_asyncio import AsyncIOMotorClient
from motor.motor_asyncio import AsyncIOMotorDatabase
import os
import logging
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'digital_one_health')
database_timeout = int(os.environ.get('DATABASE_TIMEOUT', '10'))

client = None
database = None

async def get_database() -> AsyncIOMotorDatabase:
    """Get database instance with timeout and retry logic"""
    global client, database
    
    try:
        if not client:
            logger.info(f"Connecting to MongoDB: {mongo_url}")
            
            # Configure client with timeouts
            client = AsyncIOMotorClient(
                mongo_url,
                serverSelectionTimeoutMS=database_timeout * 1000,
                connectTimeoutMS=database_timeout * 1000,
                socketTimeoutMS=database_timeout * 1000,
                maxPoolSize=10,
                minPoolSize=1,
                maxIdleTimeMS=30000,
                waitQueueTimeoutMS=5000
            )
            
            database = client[db_name]
            
            # Test connection with timeout
            await asyncio.wait_for(
                client.admin.command('ping'), 
                timeout=database_timeout
            )
            logger.info("MongoDB connection successful")
        
        return database
    except asyncio.TimeoutError:
        logger.error(f"MongoDB connection timeout after {database_timeout} seconds")
        raise Exception(f"Database connection timeout after {database_timeout} seconds")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        # Reset client on connection failure
        client = None
        database = None
        raise

async def close_database():
    """Close database connection"""
    global client
    try:
        if client:
            client.close()
            client = None
            logger.info("MongoDB connection closed")
    except Exception as e:
        logger.error(f"Error closing database connection: {e}")

async def test_database_connection():
    """Test database connection"""
    try:
        db = await get_database()
        await db.command('ping')
        return True
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False