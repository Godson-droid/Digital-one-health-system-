# Digital One Health System

A secure health data management platform with native blockchain integrity.

## Features

- **Native Proof-of-Work Blockchain**: SHA-256 hashing with mining for data integrity
- **Multi-Factor Authentication**: TOTP-based MFA with 90-second windows
- **Data Encryption**: AES-256 encryption for sensitive health records
- **Role-Based Access Control**: Granular permissions for different user types
- **MVC Architecture**: Clean separation of concerns with FastAPI backend
- **Responsive Frontend**: React.js with real-time connection monitoring

## Architecture

- **Frontend**: React.js with Tailwind CSS
- **Backend**: FastAPI with Python
- **Database**: MongoDB for data persistence
- **Blockchain**: Native Proof-of-Work implementation
- **Security**: JWT tokens, bcrypt password hashing, AES-256 data encryption

## Cryptographic Features

1. **Password Security**: bcrypt hashing with salt rounds
2. **Session Management**: JWT tokens with HMAC-SHA256 signatures
3. **Data Protection**: AES-256 symmetric encryption for health records
4. **Multi-Factor Authentication**: TOTP algorithm for additional security
5. **Blockchain Integrity**: SHA-256 proof-of-work consensus mechanism

## Getting Started

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

## Environment Variables

Create a `.env` file in the backend directory:

```
MONGO_URL=your_mongodb_connection_string
DB_NAME=digital_one_health
JWT_SECRET_KEY=your_jwt_secret_key
ENCRYPTION_KEY=your_encryption_key
```

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication
- `GET /api/health-records` - Get health records
- `POST /api/health-records` - Create health record
- `GET /api/blockchain/stats` - Blockchain statistics
- `GET /health` - System health check

## Security Model

The system implements multiple layers of cryptographic security:

1. **Authentication Layer**: JWT tokens with secure password hashing
2. **Data Layer**: AES-256 encryption for sensitive information
3. **Integrity Layer**: Native blockchain with SHA-256 proof-of-work
4. **Access Layer**: Role-based permissions with strict access controls

## Blockchain Features

- **Proof-of-Work Mining**: Configurable difficulty for block mining
- **Chain Integrity**: Automatic verification and repair capabilities
- **Immutable Audit Trail**: Complete history of all data changes
- **Cryptographic Linking**: SHA-256 hashes linking all blocks

## User Roles

- **Admin**: Full system access and management
- **Healthcare Provider**: Create and manage health records
- **Researcher**: Read-only access to public records
- **Individual**: Manage personal health records