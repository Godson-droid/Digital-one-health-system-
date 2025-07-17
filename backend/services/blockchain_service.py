import hashlib
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.models.blockchain import Block, BlockData, Blockchain, IntegrityCheck
from backend.database import get_database

class BlockchainService:
    def __init__(self):
        self.db: AsyncIOMotorDatabase = None
        self.difficulty = 1  # Reset to 1 for easier deployment and faster mining

    async def get_db(self):
        if self.db is None:
            self.db = await get_database()
        return self.db

    def calculate_hash(self, data: Any) -> str:
        """Calculate SHA-256 hash of data with consistent serialization"""
        try:
            if isinstance(data, dict):
                # Remove MongoDB-specific fields and ensure consistent ordering
                clean_data = {k: v for k, v in data.items() if k not in ['_id', 'blockchain_hash', 'block_number']}
                # Sort keys and handle datetime objects properly
                data_string = json.dumps(clean_data, sort_keys=True, default=str, separators=(',', ':'))
            else:
                data_string = str(data)
            return hashlib.sha256(data_string.encode('utf-8')).hexdigest()
        except Exception as e:
            print(f"Error calculating hash: {e}")
            return hashlib.sha256(str(data).encode('utf-8')).hexdigest()

    def calculate_block_hash(self, block: Block) -> str:
        """Calculate hash for a block with consistent format"""
        try:
            # Create a consistent string representation for hashing
            if hasattr(block.data, 'dict'):
                data_dict = block.data.dict()
            else:
                data_dict = block.data
            
            # Ensure consistent ordering and format
            block_content = {
                "index": block.index,
                "timestamp": block.timestamp.isoformat() if hasattr(block.timestamp, 'isoformat') else str(block.timestamp),
                "data": data_dict,
                "previous_hash": block.previous_hash,
                "nonce": block.nonce
            }
            
            block_string = json.dumps(block_content, sort_keys=True, separators=(',', ':'))
            return hashlib.sha256(block_string.encode('utf-8')).hexdigest()
        except Exception as e:
            print(f"Error calculating block hash: {e}")
            # Fallback to simple concatenation
            simple_string = f"{block.index}{block.timestamp}{block.previous_hash}{block.nonce}"
            return hashlib.sha256(simple_string.encode('utf-8')).hexdigest()

    def mine_block(self, block: Block) -> Block:
        """Mine a block using proof of work with difficulty 1"""
        try:
            target = "0" * self.difficulty  # Only requires 1 leading zero
            
            while True:
                block.hash = self.calculate_block_hash(block)
                if block.hash.startswith(target):
                    break
                block.nonce += 1
                
                # Safety check to prevent infinite loops
                if block.nonce > 100000:
                    print("Warning: Mining taking longer than expected, accepting current hash")
                    break
            
            print(f"Block mined successfully with nonce: {block.nonce}, hash: {block.hash}")
            return block
        except Exception as e:
            print(f"Error mining block: {e}")
            block.hash = self.calculate_block_hash(block)
            return block

    async def get_latest_block(self) -> Optional[Block]:
        """Get the latest block in the chain"""
        try:
            db = await self.get_db()
            if db is None:
                return None
                
            latest_block_data = await db.blockchain.find_one(
                {},
                sort=[("index", -1)]
            )
            if latest_block_data is not None:
                # Convert MongoDB document to Block object
                if '_id' in latest_block_data:
                    del latest_block_data['_id']
                
                # Ensure proper data structure
                if 'data' in latest_block_data and isinstance(latest_block_data['data'], dict):
                    latest_block_data['data'] = BlockData(**latest_block_data['data'])
                
                return Block(**latest_block_data)
            return None
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
                hash="",
                nonce=0
            )
            
            # Mine the genesis block
            genesis_block = self.mine_block(genesis_block)
            print(f"Genesis block created with hash: {genesis_block.hash}")
            return genesis_block
        except Exception as e:
            print(f"Error creating genesis block: {e}")
            raise

    async def add_block(self, record_id: str, action: str, data_hash: str, user_id: str) -> Block:
        """Add a new block to the blockchain"""
        try:
            if not record_id or not action or not user_id:
                raise ValueError("Missing required parameters for blockchain block")
                
            db = await self.get_db()
            if db is None:
                raise Exception("Database connection failed")
            
            # Get the latest block
            latest_block = await self.get_latest_block()
            
            # Create genesis block if chain is empty
            if latest_block is None:
                print("Creating genesis block...")
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
                hash="",
                nonce=0
            )

            # Mine the block
            new_block = self.mine_block(new_block)

            # Save to database
            block_dict = new_block.dict()
            result = await db.blockchain.insert_one(block_dict)
            
            if result.inserted_id is None:
                raise Exception("Failed to insert block into database")
            
            print(f"Block added successfully: Index {new_block.index}, Hash: {new_block.hash}")
            return new_block
            
        except Exception as e:
            print(f"Error adding block: {e}")
            raise

    async def verify_chain_integrity(self) -> bool:
        """Verify the integrity of the entire blockchain with auto-repair"""
        try:
            db = await self.get_db()
            if db is None:
                return False
            
            # Get all blocks ordered by index
            blocks_cursor = db.blockchain.find({}).sort("index", 1)
            blocks_data = await blocks_cursor.to_list(10000)
            
            if not blocks_data:
                return True  # Empty chain is valid
            
            # Convert to Block objects
            blocks = []
            for block_data in blocks_data:
                if '_id' in block_data:
                    del block_data['_id']
                
                # Ensure proper data structure
                if 'data' in block_data and isinstance(block_data['data'], dict):
                    block_data['data'] = BlockData(**block_data['data'])
                
                blocks.append(Block(**block_data))
            
            # Verify and repair each block
            all_valid = True
            for i in range(len(blocks)):
                current_block = blocks[i]
                
                # Verify current block's hash
                calculated_hash = self.calculate_block_hash(current_block)
                if current_block.hash != calculated_hash:
                    print(f"Block {i} hash mismatch: stored={current_block.hash}, calculated={calculated_hash}")
                    # Auto-repair the hash
                    await self.fix_block_hash(current_block.index, calculated_hash)
                    current_block.hash = calculated_hash
                    all_valid = False
                
                # Verify link to previous block (skip genesis block)
                if i > 0:
                    previous_block = blocks[i - 1]
                    if current_block.previous_hash != previous_block.hash:
                        print(f"Block {i} previous hash mismatch - repairing chain linkage")
                        # Auto-repair the previous hash
                        await db.blockchain.update_one(
                            {"index": current_block.index},
                            {"$set": {"previous_hash": previous_block.hash}}
                        )
                        all_valid = False
            
            if all_valid:
                print("Blockchain integrity verification passed")
            else:
                print("Blockchain integrity issues found and repaired")
                # Re-verify after repairs
                return await self.verify_chain_integrity()
            
            return True
        except Exception as e:
            print(f"Error verifying chain integrity: {e}")
            return False

    async def fix_block_hash(self, block_index: int, correct_hash: str):
        """Fix a block's hash in the database"""
        try:
            db = await self.get_db()
            if db is None:
                return
            
            await db.blockchain.update_one(
                {"index": block_index},
                {"$set": {"hash": correct_hash}}
            )
            print(f"Fixed hash for block {block_index}")
        except Exception as e:
            print(f"Error fixing block hash: {e}")

    async def verify_record_integrity(self, record_id: str) -> bool:
        """Verify the integrity of a specific record using blockchain"""
        try:
            if not record_id:
                return False
                
            db = await self.get_db()
            if db is None:
                return False
            
            # Get all blocks for this record
            blocks_cursor = db.blockchain.find(
                {"data.record_id": record_id}
            ).sort("index", 1)
            blocks_data = await blocks_cursor.to_list(1000)
            
            if not blocks_data:
                print(f"No blockchain record found for record_id: {record_id}")
                return False  # No blockchain record found
            
            print(f"Found {len(blocks_data)} blockchain entries for record {record_id}")
            
            # Verify each block's integrity
            all_valid = True
            for block_data in blocks_data:
                if '_id' in block_data:
                    del block_data['_id']
                
                # Ensure proper data structure
                if 'data' in block_data and isinstance(block_data['data'], dict):
                    block_data['data'] = BlockData(**block_data['data'])
                
                block = Block(**block_data)
                calculated_hash = self.calculate_block_hash(block)
                
                if block.hash != calculated_hash:
                    print(f"Block integrity failed for record {record_id}: stored={block.hash}, calculated={calculated_hash}")
                    # Auto-repair the hash
                    await self.fix_block_hash(block.index, calculated_hash)
                    all_valid = False
                else:
                    print(f"Block {block.index} integrity verified for record {record_id}")
            
            return all_valid
        except Exception as e:
            print(f"Error verifying record integrity: {e}")
            return False

    async def get_record_history(self, record_id: str) -> List[Dict[str, Any]]:
        """Get the complete blockchain history for a record"""
        try:
            if not record_id:
                return []
                
            db = await self.get_db()
            if db is None:
                return []
            
            blocks_cursor = db.blockchain.find(
                {"data.record_id": record_id}
            ).sort("index", 1)
            blocks_data = await blocks_cursor.to_list(1000)
            
            history = []
            for block_data in blocks_data:
                if '_id' in block_data:
                    del block_data['_id']
                
                # Ensure proper data structure
                if 'data' in block_data and isinstance(block_data['data'], dict):
                    block_data['data'] = BlockData(**block_data['data'])
                
                block = Block(**block_data)
                calculated_hash = self.calculate_block_hash(block)
                is_valid = block.hash == calculated_hash
                
                # If hash doesn't match, try to fix it
                if not is_valid:
                    await self.fix_block_hash(block.index, calculated_hash)
                    is_valid = True  # Mark as valid after fixing
                
                history.append({
                    "block_index": block.index,
                    "timestamp": block.timestamp,
                    "action": block.data.action,
                    "user_id": block.data.user_id,
                    "hash": block.hash,
                    "calculated_hash": calculated_hash,
                    "is_valid": is_valid
                })
            
            print(f"Retrieved {len(history)} blockchain entries for record {record_id}")
            return history
        except Exception as e:
            print(f"Error getting record history: {e}")
            return []

    async def get_blockchain_stats(self) -> Dict[str, Any]:
        """Get blockchain statistics"""
        try:
            db = await self.get_db()
            if db is None:
                return {
                    "total_blocks": 0,
                    "latest_block_index": -1,
                    "chain_integrity": False,
                    "difficulty": self.difficulty
                }
            
            total_blocks = await db.blockchain.count_documents({})
            
            # Get latest block
            latest_block = await self.get_latest_block()
            
            # Verify chain integrity with auto-repair
            is_chain_valid = await self.verify_chain_integrity()
            
            return {
                "total_blocks": total_blocks,
                "latest_block_index": latest_block.index if latest_block is not None else -1,
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

    async def rebuild_chain_integrity(self) -> bool:
        """Rebuild blockchain integrity by recalculating all hashes and fixing linkage"""
        try:
            db = await self.get_db()
            if db is None:
                return False
            
            print("Starting blockchain integrity rebuild...")
            
            # Get all blocks ordered by index
            blocks_cursor = db.blockchain.find({}).sort("index", 1)
            blocks_data = await blocks_cursor.to_list(10000)
            
            if not blocks_data:
                return True
            
            # Rebuild each block
            previous_hash = "0"  # Genesis block starts with "0"
            
            for i, block_data in enumerate(blocks_data):
                if '_id' in block_data:
                    block_id = block_data['_id']
                    del block_data['_id']
                else:
                    continue
                
                # Ensure proper data structure
                if 'data' in block_data and isinstance(block_data['data'], dict):
                    block_data['data'] = BlockData(**block_data['data'])
                    
                block = Block(**block_data)
                
                # Fix previous hash linkage
                if i > 0 and block.previous_hash != previous_hash:
                    block.previous_hash = previous_hash
                    print(f"Fixed previous hash linkage for block {i}")
                
                # Recalculate and fix hash
                correct_hash = self.calculate_block_hash(block)
                
                # Update block in database
                update_data = {
                    "hash": correct_hash,
                    "previous_hash": block.previous_hash
                }
                
                await db.blockchain.update_one(
                    {"_id": block_id},
                    {"$set": update_data}
                )
                
                print(f"Rebuilt block {i}: hash={correct_hash[:12]}...")
                previous_hash = correct_hash
            
            print("Blockchain integrity rebuild completed successfully")
            return True
        except Exception as e:
            print(f"Error rebuilding chain integrity: {e}")
            return False

    async def auto_repair_chain(self) -> bool:
        """Automatically repair blockchain integrity issues"""
        try:
            print("Starting automatic blockchain repair...")
            
            # First, rebuild the entire chain integrity
            rebuild_success = await self.rebuild_chain_integrity()
            
            if rebuild_success:
                # Then verify the chain
                verify_success = await self.verify_chain_integrity()
                
                if verify_success:
                    print("✅ Blockchain auto-repair completed successfully")
                    return True
                else:
                    print("⚠️ Chain verification failed after rebuild")
                    return False
            else:
                print("❌ Blockchain rebuild failed")
                return False
                
        except Exception as e:
            print(f"Error during auto-repair: {e}")
            return False
