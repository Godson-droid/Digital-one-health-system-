from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime
import uuid

class HealthRecordBase(BaseModel):
    title: str
    description: str
    record_type: str  # "human", "animal", "plant"
    subject_id: str
    subject_name: str
    data: Dict[str, Any]
    is_public: bool = False

class HealthRecordCreate(HealthRecordBase):
    # Enhanced data structure for different record types
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    vital_signs: Optional[Dict[str, Any]] = None
    lab_results: Optional[Dict[str, Any]] = None
    medications: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    # For animals
    species: Optional[str] = None
    breed: Optional[str] = None
    age: Optional[str] = None
    # For plants/environment
    location: Optional[str] = None
    environmental_factors: Optional[Dict[str, Any]] = None
    soil_conditions: Optional[str] = None
    climate_data: Optional[Dict[str, Any]] = None

class HealthRecordInDB(HealthRecordBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    blockchain_hash: Optional[str] = None
    previous_hash: Optional[str] = None
    block_number: Optional[int] = None
    # Enhanced fields
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    vital_signs: Optional[Dict[str, Any]] = None
    lab_results: Optional[Dict[str, Any]] = None
    medications: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    species: Optional[str] = None
    breed: Optional[str] = None
    age: Optional[str] = None
    location: Optional[str] = None
    environmental_factors: Optional[Dict[str, Any]] = None
    soil_conditions: Optional[str] = None
    climate_data: Optional[Dict[str, Any]] = None

class HealthRecord(HealthRecordBase):
    id: str
    owner_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    blockchain_hash: Optional[str] = None
    is_verified: bool = False
    # Enhanced display fields
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    vital_signs: Optional[Dict[str, Any]] = None
    species: Optional[str] = None
    location: Optional[str] = None

class HealthRecordUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    vital_signs: Optional[Dict[str, Any]] = None
    lab_results: Optional[Dict[str, Any]] = None
    medications: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    species: Optional[str] = None
    breed: Optional[str] = None
    age: Optional[str] = None
    location: Optional[str] = None
    environmental_factors: Optional[Dict[str, Any]] = None
    soil_conditions: Optional[str] = None
    climate_data: Optional[Dict[str, Any]] = None