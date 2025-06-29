from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime
import uuid

class BlockData(BaseModel):
    record_id: str
    action: str  # "create", "update", "delete"
    data_hash: str
    timestamp: datetime
    user_id: str

class Block(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    index: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: BlockData
    previous_hash: str
    hash: str
    nonce: int = 0

class Blockchain(BaseModel):
    chain: List[Block] = []
    difficulty: int = 4

class IntegrityCheck(BaseModel):
    record_id: str
    is_valid: bool
    blockchain_hash: str
    current_hash: str
    verified_at: datetime = Field(default_factory=datetime.utcnow)
    block_number: int