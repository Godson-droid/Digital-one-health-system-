import hashlib
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.blockchain import Block, BlockData, Blockchain, IntegrityCheck
from ..database import get_database

class BlockchainService:
    def __init__(self):
        self.db: AsyncIOMotorDatabase = None
        self.difficulty = 4  # Number of leading zeros required in hash

    async def get_db(self):
        if not self.db:
            self.db = await get_database()
        return self.db

    def calculate_hash(self, data: Any) -> str:
        """Calculate SHA-256 hash of data"""
        try:
            if isinstance(data, dict):
                data_string = json.dumps(data, sort_keys=True, default=str)
            else:
                data_string = str(data)
            return hashlib.sha256(data_string.encode()).hexdigest()
        except Exception as e:
            print(f"Error calculating hash: {e}")
            return hashlib.sha256(str(data).encode()).hexdigest()

    def calculate_block_hash(self, block: Block) -> str:
        """Calculate hash for a block"""
        try:
            block_string = f"{block.index}{block.timestamp}{json.dumps(block.data.dict(), sort_keys=True)}{block.previous_hash}{block.nonce}"
            return hashlib.sha256(block_string.encode()).hexdigest()
        except Exception as e:
            print(f"Error calculating block hash: {e}")
            return hashlib.sha256(f"{block.index}{block.timestamp}{block.previous_hash}{block.nonce}".encode()).hexdigest()

    def mine_block(self, block: Block) -> Block:
        """Mine a block using proof of work"""
        try:
            target = "0" * self.difficulty
            
            while not block.hash.startswith(target):
                block.nonce += 1
                block.hash = self.calculate_block_hash(block)
                
                # Prevent infinite loops
                if block.nonce > 1000000:
                    print("Warning: Mining taking too long, reducing difficulty")
                    self.difficulty = max(1, self.difficulty - 1)
                    target = "0" * self.difficulty
            
            return block
        except Exception as e:
            print(f"Error mining block: {e}")
            block.hash = self.calculate_block_hash(block)
            return block

    async def get_latest_block(self) -> Optional[Block]:
        """Get the latest block in the chain"""
        try:
            db = await self.get_db()
            latest_block_data = await db.blockchain.find_one(
                {},
                sort=[("index", -1)]
            )
            return Block(**latest_block_data) if latest_block_data else None
        except Exception as e:
            print(f"Error getting latest block: {e}")
            return None

    async def create_genesis_block(self) -> Block:
        """Create the genesis block"""
        try:
            genesis_data = BlockData(
                record_id="genesis",
                action="genesis",
                data_hash="0",
                timestamp=datetime.utcnow(),
                user_id="system"
            )
            
            genesis_block = Block(
                index=0,
                data=genesis_data,
                previous_hash="0",
                hash=""
            )
            
            genesis_block.hash = self.calculate_block_hash(genesis_block)
            return genesis_block
        except Exception as e:
            print(f"Error creating genesis block: {e}")
            raise

    async def add_block(self, record_id: str, action: str, data_hash: str, user_id: str) -> Block:
        """Add a new block to the blockchain"""
        try:
            db = await self.get_db()
            
            # Get the latest block
            latest_block = await self.get_latest_block()
            
            # Create genesis block if chain is empty
            if not latest_block:
                genesis_block = await self.create_genesis_block()
                await db.blockchain.insert_one(genesis_block.dict())
                latest_block = genesis_block

            # Create new block
            block_data = BlockData(
                record_id=record_id,
                action=action,
                data_hash=data_hash,
                timestamp=datetime.utcnow(),
                user_id=user_id
            )

            new_block = Block(
                index=latest_block.index + 1,
                data=block_data,
                previous_hash=latest_block.hash,
                hash=""
            )

            # Mine the block
            new_block = self.mine_block(new_block)

            # Save to database
            await db.blockchain.insert_one(new_block.dict())
            
            return new_block
        except Exception as e:
            print(f"Error adding block: {e}")
            raise

    async def verify_chain_integrity(self) -> bool:
        """Verify the integrity of the entire blockchain"""
        try:
            db = await self.get_db()
            
            # Get all blocks ordered by index
            blocks_cursor = db.blockchain.find({}).sort("index", 1)
            blocks_data = await blocks_cursor.to_list(10000)
            
            if not blocks_data:
                return True  # Empty chain is valid
            
            blocks = [Block(**block_data) for block_data in blocks_data]
            
            for i in range(1, len(blocks)):
                current_block = blocks[i]
                previous_block = blocks[i - 1]
                
                # Verify current block's hash
                if current_block.hash != self.calculate_block_hash(current_block):
                    return False
                
                # Verify link to previous block
                if current_block.previous_hash != previous_block.hash:
                    return False
            
            return True
        except Exception as e:
            print(f"Error verifying chain integrity: {e}")
            return False

    async def verify_record_integrity(self, record_id: str) -> bool:
        """Verify the integrity of a specific record using blockchain"""
        try:
            db = await self.get_db()
            
            # Get all blocks for this record
            blocks_cursor = db.blockchain.find(
                {"data.record_id": record_id}
            ).sort("index", 1)
            blocks_data = await blocks_cursor.to_list(1000)
            
            if not blocks_data:
                return False  # No blockchain record found
            
            # Verify each block's integrity
            for block_data in blocks_data:
                block = Block(**block_data)
                calculated_hash = self.calculate_block_hash(block)
                
                if block.hash != calculated_hash:
                    return False
            
            return True
        except Exception as e:
            print(f"Error verifying record integrity: {e}")
            return False

    async def get_record_history(self, record_id: str) -> List[Dict[str, Any]]:
        """Get the complete blockchain history for a record"""
        try:
            db = await self.get_db()
            
            blocks_cursor = db.blockchain.find(
                {"data.record_id": record_id}
            ).sort("index", 1)
            blocks_data = await blocks_cursor.to_list(1000)
            
            history = []
            for block_data in blocks_data:
                block = Block(**block_data)
                history.append({
                    "block_index": block.index,
                    "timestamp": block.timestamp,
                    "action": block.data.action,
                    "user_id": block.data.user_id,
                    "hash": block.hash,
                    "is_valid": block.hash == self.calculate_block_hash(block)
                })
            
            return history
        except Exception as e:
            print(f"Error getting record history: {e}")
            return []

    async def get_blockchain_stats(self) -> Dict[str, Any]:
        """Get blockchain statistics"""
        try:
            db = await self.get_db()
            
            total_blocks = await db.blockchain.count_documents({})
            
            # Get latest block
            latest_block = await self.get_latest_block()
            
            # Verify chain integrity
            is_chain_valid = await self.verify_chain_integrity()
            
            return {
                "total_blocks": total_blocks,
                "latest_block_index": latest_block.index if latest_block else -1,
                "chain_integrity": is_chain_valid,
                "difficulty": self.difficulty
            }
        except Exception as e:
            print(f"Error getting blockchain stats: {e}")
            return {
                "total_blocks": 0,
                "latest_block_index": -1,
                "chain_integrity": False,
                "difficulty": self.difficulty
            }

    async def perform_integrity_check(self, record_id: str) -> IntegrityCheck:
        """Perform a comprehensive integrity check on a record"""
        try:
            db = await self.get_db()
            
            # Get the record
            record = await db.health_records.find_one({"id": record_id})
            if not record:
                raise ValueError("Record not found")
            
            # Calculate current hash of record
            current_hash = self.calculate_hash(record)
            
            # Get blockchain hash
            blockchain_hash = record.get("blockchain_hash", "")
            block_number = record.get("block_number", 0)
            
            # Verify blockchain integrity for this record
            is_valid = await self.verify_record_integrity(record_id)
            
            return IntegrityCheck(
                record_id=record_id,
                is_valid=is_valid,
                blockchain_hash=blockchain_hash,
                current_hash=current_hash,
                block_number=block_number
            )
        except Exception as e:
            print(f"Error performing integrity check: {e}")
            return IntegrityCheck(
                record_id=record_id,
                is_valid=False,
                blockchain_hash="",
                current_hash="",
                block_number=0
            )