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
    symptoms: Optional[str] = ""
    diagnosis: Optional[str] = ""
    treatment: Optional[str] = ""
    vital_signs: Optional[Dict[str, Any]] = {}
    lab_results: Optional[Dict[str, Any]] = {}
    medications: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    # For animals
    species: Optional[str] = ""
    breed: Optional[str] = ""
    age: Optional[str] = ""
    weight: Optional[str] = ""
    vaccination_status: Optional[str] = ""
    # For plants/environment
    location: Optional[str] = ""
    environmental_factors: Optional[Dict[str, Any]] = {}
    soil_conditions: Optional[str] = ""
    climate_data: Optional[Dict[str, Any]] = {}
    plant_health_status: Optional[str] = ""
    growth_stage: Optional[str] = ""
    # Enhanced identification fields
    patient_id: Optional[str] = ""
    patient_name: Optional[str] = ""
    date_of_birth: Optional[str] = ""
    gender: Optional[str] = ""
    contact_info: Optional[str] = ""

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
    symptoms: Optional[str] = ""
    diagnosis: Optional[str] = ""
    treatment: Optional[str] = ""
    vital_signs: Optional[Dict[str, Any]] = {}
    lab_results: Optional[Dict[str, Any]] = {}
    medications: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    species: Optional[str] = ""
    breed: Optional[str] = ""
    age: Optional[str] = ""
    weight: Optional[str] = ""
    vaccination_status: Optional[str] = ""
    location: Optional[str] = ""
    environmental_factors: Optional[Dict[str, Any]] = {}
    soil_conditions: Optional[str] = ""
    climate_data: Optional[Dict[str, Any]] = {}
    plant_health_status: Optional[str] = ""
    growth_stage: Optional[str] = ""
    patient_id: Optional[str] = ""
    patient_name: Optional[str] = ""
    date_of_birth: Optional[str] = ""
    gender: Optional[str] = ""
    contact_info: Optional[str] = ""

class HealthRecord(HealthRecordBase):
    id: str
    owner_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    blockchain_hash: Optional[str] = None
    is_verified: bool = False
    # Enhanced display fields
    symptoms: Optional[str] = ""
    diagnosis: Optional[str] = ""
    treatment: Optional[str] = ""
    vital_signs: Optional[Dict[str, Any]] = {}
    lab_results: Optional[Dict[str, Any]] = {}
    medications: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    species: Optional[str] = ""
    breed: Optional[str] = ""
    age: Optional[str] = ""
    weight: Optional[str] = ""
    vaccination_status: Optional[str] = ""
    location: Optional[str] = ""
    environmental_factors: Optional[Dict[str, Any]] = {}
    soil_conditions: Optional[str] = ""
    climate_data: Optional[Dict[str, Any]] = {}
    plant_health_status: Optional[str] = ""
    growth_stage: Optional[str] = ""
    patient_id: Optional[str] = ""
    patient_name: Optional[str] = ""
    date_of_birth: Optional[str] = ""
    gender: Optional[str] = ""
    contact_info: Optional[str] = ""

class HealthRecordUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None