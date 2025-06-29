from motor.motor_asyncio import AsyncIOMotorClient
from motor.motor_asyncio import AsyncIOMotorDatabase
import os

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'digital_one_health')

client = AsyncIOMotorClient(mongo_url)
database = client[db_name]

async def get_database() -> AsyncIOMotorDatabase:
    """Get database instance"""
    return database

async def close_database():
    """Close database connection"""
    client.close()