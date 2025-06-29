from motor.motor_asyncio import AsyncIOMotorClient
from motor.motor_asyncio import AsyncIOMotorDatabase
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'digital_one_health')

client = None
database = None

async def get_database() -> AsyncIOMotorDatabase:
    """Get database instance"""
    global client, database
    
    try:
        if not client:
            logger.info(f"Connecting to MongoDB: {mongo_url}")
            client = AsyncIOMotorClient(mongo_url)
            database = client[db_name]
            
            # Test connection
            await client.admin.command('ping')
            logger.info("MongoDB connection successful")
        
        return database
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        raise

async def close_database():
    """Close database connection"""
    global client
    try:
        if client:
            client.close()
            logger.info("MongoDB connection closed")
    except Exception as e:
        logger.error(f"Error closing database connection: {e}")