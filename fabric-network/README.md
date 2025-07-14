# Digital One Health - Hyperledger Fabric Network

This directory contains a complete Hyperledger Fabric network implementation for the Digital One Health System, providing enterprise-grade blockchain capabilities with proper network topology, smart contracts, and integration.

## 🏗️ Network Architecture

### Organizations
- **Hospital Organization** (`HospitalMSP`)
  - Healthcare providers and medical institutions
  - Can create, read, and update health records
  - Full access to patient data with proper permissions

- **Research Organization** (`ResearchMSP`)
  - Research institutions and academic organizations
  - Read-only access to public health records
  - Cannot create or modify patient data

- **Individual Organization** (`IndividualMSP`)
  - Individual patients and users
  - Can create and manage their own health records
  - Can view public records from other users

- **Orderer Organization** (`OrdererMSP`)
  - Network administration and consensus
  - Manages transaction ordering and block creation

### Network Components
- **1 Orderer Node** - Transaction ordering and consensus
- **3 Peer Nodes** - One for each organization
- **3 Certificate Authorities** - Identity management for each org
- **1 Channel** - `healthrecords` channel for all health data
- **Smart Contract** - Health records chaincode with business logic

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Hyperledger Fabric binaries (v2.4+)
- Node.js (v14+) for chaincode and application
- jq for JSON processing

### 1. Start the Network
```bash
cd fabric-network/scripts
chmod +x network.sh
./network.sh up
```

This command will:
- Generate crypto material for all organizations
- Create genesis block and channel configuration
- Start all Docker containers
- Create and join the healthrecords channel
- Deploy and initialize the health records chaincode

### 2. Test the Network
```bash
# Check network status
docker ps

# View logs
docker logs peer0.hospital.digitalonehealth.com
docker logs orderer.digitalonehealth.com

# Test chaincode
peer chaincode query -C healthrecords -n health-records -c '{"Args":["queryPublicHealthRecords"]}'
```

### 3. Start the Application Gateway
```bash
cd fabric-network/application
npm install
npm start
```

The Fabric Gateway API will be available at `http://localhost:3001`

### 4. Stop the Network
```bash
./network.sh down
```

### 5. Clean Everything
```bash
./network.sh clean
```

## 📋 Smart Contract Functions

### Health Record Management
- `createHealthRecord(recordId, patientId, recordType, title, description, data, isPublic, createdBy)`
- `readHealthRecord(recordId)`
- `updateHealthRecord(recordId, newData, updatedBy)`
- `updateRecordPrivacy(recordId, isPublic, updatedBy)`

### Query Functions
- `queryHealthRecordsByPatient(patientId)`
- `queryPublicHealthRecords()`
- `verifyRecordIntegrity(recordId)`
- `getRecordHistory(recordId)`

### Access Control
- **Hospital**: Full CRUD access to all records
- **Research**: Read-only access to public records
- **Individual**: CRUD access to own records, read access to public records
- **Admin**: Full access to all functions

## 🔐 Security Features

### Identity Management
- X.509 certificate-based identity
- Separate Certificate Authorities for each organization
- TLS encryption for all communications

### Access Control
- Organization-based permissions
- Role-based access control in smart contracts
- Private data collections for sensitive information

### Data Integrity
- Cryptographic hashing of all health records
- Blockchain-based audit trail
- Immutable transaction history

### Privacy Protection
- Public/private record classification
- Organization-based data isolation
- Encrypted data storage

## 🌐 API Endpoints

### Health Records
```
POST   /api/health-records              - Create health record
GET    /api/health-records/:id          - Get health record
PUT    /api/health-records/:id          - Update health record
PUT    /api/health-records/:id/privacy  - Update privacy settings
```

### Queries
```
GET    /api/patients/:id/health-records - Get patient's records
GET    /api/health-records/public       - Get public records
```

### Verification
```
GET    /api/health-records/:id/verify   - Verify record integrity
GET    /api/health-records/:id/history  - Get record history
```

### System
```
GET    /health                          - Health check
```

## 🔧 Configuration

### Network Configuration
- **Channel**: `healthrecords`
- **Chaincode**: `health-records`
- **Consensus**: Raft ordering service
- **TLS**: Enabled for all communications

### Docker Ports
- Orderer: `7050` (client), `7053` (admin), `9443` (operations)
- Hospital Peer: `7051` (client), `9444` (operations)
- Research Peer: `9051` (client), `9445` (operations)
- Individual Peer: `11051` (client), `9446` (operations)
- Hospital CA: `7054`
- Research CA: `8054`
- Individual CA: `9054`

## 📊 Monitoring

### Operations Endpoints
- Orderer: `http://localhost:9443/metrics`
- Hospital Peer: `http://localhost:9444/metrics`
- Research Peer: `http://localhost:9445/metrics`
- Individual Peer: `http://localhost:9446/metrics`

### Logs
```bash
# View all container logs
docker-compose logs -f

# View specific service logs
docker logs -f peer0.hospital.digitalonehealth.com
docker logs -f orderer.digitalonehealth.com
```

## 🧪 Testing

### Unit Tests
```bash
cd chaincode/health-records
npm test
```

### Integration Tests
```bash
cd application
npm test
```

### Manual Testing
```bash
# Create a health record
curl -X POST http://localhost:3001/api/health-records \
  -H "Content-Type: application/json" \
  -d '{
    "recordType": "human",
    "title": "Test Record",
    "description": "Test Description",
    "data": {"notes": "Test notes"},
    "isPublic": false,
    "createdBy": "testuser"
  }'

# Query public records
curl http://localhost:3001/api/health-records/public
```

## 🔄 Integration with Existing System

### Backend Integration
The Fabric network can be integrated with your existing FastAPI backend by:

1. **Adding Fabric Gateway Service**
```python
# backend/services/fabric_service.py
import requests

class FabricService:
    def __init__(self):
        self.fabric_url = "http://localhost:3001"
    
    async def create_health_record(self, record_data):
        response = requests.post(f"{self.fabric_url}/api/health-records", json=record_data)
        return response.json()
```

2. **Updating Health Record Controller**
```python
# backend/controllers/health_record_controller.py
from ..services.fabric_service import FabricService

class HealthRecordController:
    def __init__(self):
        self.fabric_service = FabricService()
    
    async def create_health_record(self, record_data, current_user):
        # Store in MongoDB for fast access
        mongo_result = await self.health_record_service.create_record(record_data, current_user.id)
        
        # Store in Fabric for immutability
        fabric_result = await self.fabric_service.create_health_record({
            "recordType": record_data.record_type,
            "title": record_data.title,
            "description": record_data.description,
            "data": record_data.data,
            "isPublic": record_data.is_public,
            "createdBy": current_user.id
        })
        
        return mongo_result
```

## 🚨 Troubleshooting

### Common Issues

1. **Network fails to start**
   ```bash
   # Clean everything and restart
   ./network.sh clean
   ./network.sh up
   ```

2. **Chaincode installation fails**
   ```bash
   # Check peer logs
   docker logs peer0.hospital.digitalonehealth.com
   
   # Reinstall chaincode
   peer lifecycle chaincode install health-records.tar.gz
   ```

3. **Connection refused errors**
   ```bash
   # Check if all containers are running
   docker ps
   
   # Restart specific container
   docker restart peer0.hospital.digitalonehealth.com
   ```

4. **Certificate errors**
   ```bash
   # Regenerate crypto material
   ./network.sh clean
   ./network.sh up
   ```

### Debug Commands
```bash
# Check chaincode status
peer lifecycle chaincode querycommitted -C healthrecords

# Query installed chaincodes
peer lifecycle chaincode queryinstalled

# Check channel info
peer channel getinfo -c healthrecords

# Test chaincode
peer chaincode invoke -C healthrecords -n health-records -c '{"function":"initLedger","Args":[]}'
```

## 📚 Additional Resources

- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Fabric SDK for Node.js](https://hyperledger.github.io/fabric-sdk-node/)
- [Chaincode Development](https://hyperledger-fabric.readthedocs.io/en/latest/chaincode.html)
- [Network Configuration](https://hyperledger-fabric.readthedocs.io/en/latest/deployment_guide_overview.html)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.