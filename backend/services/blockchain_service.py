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
        if isinstance(data, dict):
            data_string = json.dumps(data, sort_keys=True, default=str)
        else:
            data_string = str(data)
        return hashlib.sha256(data_string.encode()).hexdigest()

    def calculate_block_hash(self, block: Block) -> str:
        """Calculate hash for a block"""
        block_string = f"{block.index}{block.timestamp}{json.dumps(block.data.dict(), sort_keys=True)}{block.previous_hash}{block.nonce}"
        return hashlib.sha256(block_string.encode()).hexdigest()

    def mine_block(self, block: Block) -> Block:
        """Mine a block using proof of work"""
        target = "0" * self.difficulty
        
        while not block.hash.startswith(target):
            block.nonce += 1
            block.hash = self.calculate_block_hash(block)
        
        return block

    async def get_latest_block(self) -> Optional[Block]:
        """Get the latest block in the chain"""
        db = await self.get_db()
        latest_block_data = await db.blockchain.find_one(
            {},
            sort=[("index", -1)]
        )
        return Block(**latest_block_data) if latest_block_data else None

    async def create_genesis_block(self) -> Block:
        """Create the genesis block"""
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

    async def add_block(self, record_id: str, action: str, data_hash: str, user_id: str) -> Block:
        """Add a new block to the blockchain"""
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

    async def verify_chain_integrity(self) -> bool:
        """Verify the integrity of the entire blockchain"""
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

    async def verify_record_integrity(self, record_id: str) -> bool:
        """Verify the integrity of a specific record using blockchain"""
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

    async def get_record_history(self, record_id: str) -> List[Dict[str, Any]]:
        """Get the complete blockchain history for a record"""
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

    async def get_blockchain_stats(self) -> Dict[str, Any]:
        """Get blockchain statistics"""
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

    async def perform_integrity_check(self, record_id: str) -> IntegrityCheck:
        """Perform a comprehensive integrity check on a record"""
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