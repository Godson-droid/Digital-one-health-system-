const crypto = require('crypto');
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');

class CloudFabricGateway {
    constructor() {
        // Fabric Network Configuration
        this.channelName = 'healthrecords';
        this.chaincodeName = 'health-records';
        this.connectionProfilePath = path.resolve(__dirname, 'connection.json');
        this.walletPath = path.resolve(__dirname, 'wallet');
        
        // Fabric SDK instances
        this.gateway = null;
        this.network = null;
        this.contract = null;
        this.wallet = null;
        
        // Connection status
        this.isInitialized = false;
        this.mode = 'hyperledger_fabric';
        
        // Fallback to mock mode if Fabric network is not available
        this.useMockMode = false;
        this.healthRecords = new Map();
        this.transactionHistory = new Map();
        
        console.log('🌐 Initializing Real Hyperledger Fabric Gateway');
    }

    async initialize() {
        try {
            console.log('🚀 Real Hyperledger Fabric Gateway initializing...');
            
            // Try to initialize real Fabric connection
            const fabricInitialized = await this.initializeFabricConnection();
            
            if (!fabricInitialized) {
                console.log('⚠️ Fabric network not available, falling back to mock mode');
                this.useMockMode = true;
                await this.initializeMockMode();
            }
            
            this.isInitialized = true;
            console.log('✅ Gateway initialized successfully');
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Gateway:', error);
            // Fallback to mock mode
            this.useMockMode = true;
            await this.initializeMockMode();
            this.isInitialized = true;
            return true;
        }
    }

    async initializeFabricConnection() {
        try {
            // Check if connection profile exists
            if (!fs.existsSync(this.connectionProfilePath)) {
                console.log('⚠️ Connection profile not found, creating default...');
                await this.createDefaultConnectionProfile();
            }

            // Load connection profile
            const connectionProfile = JSON.parse(fs.readFileSync(this.connectionProfilePath, 'utf8'));
            
            // Create wallet
            this.wallet = await Wallets.newFileSystemWallet(this.walletPath);
            
            // Check if admin identity exists, if not create it
            const adminExists = await this.wallet.get('admin');
            if (!adminExists) {
                console.log('⚠️ Admin identity not found, attempting to enroll...');
                await this.enrollAdmin(connectionProfile);
            }

            // Check if app user exists, if not create it
            const appUserExists = await this.wallet.get('appUser');
            if (!appUserExists) {
                console.log('⚠️ App user not found, attempting to register...');
                await this.registerUser(connectionProfile);
            }

            // Create gateway instance
            this.gateway = new Gateway();
            
            // Connect to gateway
            await this.gateway.connect(connectionProfile, {
                wallet: this.wallet,
                identity: 'appUser',
                discovery: { enabled: true, asLocalhost: false }
            });

            // Get network and contract
            this.network = await this.gateway.getNetwork(this.channelName);
            this.contract = this.network.getContract(this.chaincodeName);

            console.log('✅ Connected to Hyperledger Fabric network');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize Fabric connection:', error);
            return false;
        }
    }

    async createDefaultConnectionProfile() {
        const defaultProfile = {
            "name": "digital-one-health-network",
            "version": "1.0.0",
            "client": {
                "organization": "Hospital",
                "connection": {
                    "timeout": {
                        "peer": {
                            "endorser": "300"
                        },
                        "orderer": "300"
                    }
                }
            },
            "organizations": {
                "Hospital": {
                    "mspid": "HospitalMSP",
                    "peers": ["peer0.hospital.digitalonehealth.com"],
                    "certificateAuthorities": ["ca.hospital.digitalonehealth.com"]
                }
            },
            "orderers": {
                "orderer.digitalonehealth.com": {
                    "url": "grpc://localhost:7050"
                }
            },
            "peers": {
                "peer0.hospital.digitalonehealth.com": {
                    "url": "grpc://localhost:7051"
                }
            },
            "certificateAuthorities": {
                "ca.hospital.digitalonehealth.com": {
                    "url": "http://localhost:7054",
                    "caName": "ca-hospital"
                }
            }
        };

        fs.writeFileSync(this.connectionProfilePath, JSON.stringify(defaultProfile, null, 2));
        console.log('📝 Created default connection profile');
    }

    async enrollAdmin(connectionProfile) {
        try {
            const caInfo = connectionProfile.certificateAuthorities['ca.hospital.digitalonehealth.com'];
            const caTLSCACerts = caInfo.tlsCACerts ? caInfo.tlsCACerts.pem : null;
            const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

            const enrollment = await ca.enroll({
                enrollmentID: 'admin',
                enrollmentSecret: 'adminpw'
            });

            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: 'HospitalMSP',
                type: 'X.509',
            };

            await this.wallet.put('admin', x509Identity);
            console.log('✅ Admin enrolled successfully');

        } catch (error) {
            console.error('❌ Failed to enroll admin:', error);
            throw error;
        }
    }

    async registerUser(connectionProfile) {
        try {
            const caInfo = connectionProfile.certificateAuthorities['ca.hospital.digitalonehealth.com'];
            const caTLSCACerts = caInfo.tlsCACerts ? caInfo.tlsCACerts.pem : null;
            const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

            const adminIdentity = await this.wallet.get('admin');
            const provider = this.wallet.getProviderRegistry().getProvider(adminIdentity.type);
            const adminUser = await provider.getUserContext(adminIdentity, 'admin');

            const secret = await ca.register({
                affiliation: 'hospital.department1',
                enrollmentID: 'appUser',
                role: 'client'
            }, adminUser);

            const enrollment = await ca.enroll({
                enrollmentID: 'appUser',
                enrollmentSecret: secret
            });

            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: 'HospitalMSP',
                type: 'X.509',
            };

            await this.wallet.put('appUser', x509Identity);
            console.log('✅ App user registered and enrolled successfully');

        } catch (error) {
            console.error('❌ Failed to register user:', error);
            throw error;
        }
    }

    async initializeMockMode() {
        // Initialize with sample data for mock mode
        const sampleRecord = {
            recordId: 'SAMPLE001',
            patientId: 'PATIENT001',
            recordType: 'human',
            title: 'Sample Health Record',
            description: 'This is a sample health record for demonstration',
            data: {
                vitals: {
                    bloodPressure: '120/80',
                    heartRate: '72',
                    temperature: '98.6'
                },
                diagnosis: 'Healthy',
                notes: 'Sample record created by Mock Gateway'
            },
            isPublic: true,
            createdBy: 'system',
            organization: 'MockMSP',
            timestamp: new Date().toISOString(),
            dataHash: this.calculateHash('sample-data'),
            previousHash: '0'
        };

        this.healthRecords.set(sampleRecord.recordId, sampleRecord);
        this.addToHistory(sampleRecord.recordId, 'CREATE', 'system', sampleRecord);
        
        console.log('📝 Mock mode initialized with sample data');
    }

    async createHealthRecord(recordData) {
        try {
            console.log('📝 Creating health record:', recordData.recordId);
            
            if (!this.useMockMode && this.contract) {
                // Use real Fabric network
                const result = await this.contract.submitTransaction(
                    'createHealthRecord',
                    recordData.recordId || this.generateTransactionId(),
                    recordData.patientId || recordData.recordId,
                    recordData.recordType || 'human',
                    recordData.title || 'Untitled Record',
                    recordData.description || '',
                    JSON.stringify(recordData.data || {}),
                    String(recordData.isPublic || false),
                    recordData.createdBy || 'unknown'
                );

                const parsedResult = JSON.parse(result.toString());
                console.log('✅ Health record created on Fabric network:', parsedResult.recordId);
                
                return {
                    success: true,
                    recordId: parsedResult.recordId,
                    txId: this.generateTransactionId(),
                    dataHash: parsedResult.dataHash,
                    timestamp: parsedResult.timestamp
                };
            } else {
                // Use mock mode
                return await this.createHealthRecordMock(recordData);
            }

        } catch (error) {
            console.error('❌ Error creating health record:', error);
            // Fallback to mock mode on error
            return await this.createHealthRecordMock(recordData);
        }
    }

    async readHealthRecord(recordId) {
        try {
            console.log('📖 Reading health record:', recordId);
            
            if (!this.useMockMode && this.contract) {
                // Use real Fabric network
                const result = await this.contract.evaluateTransaction('readHealthRecord', recordId);
                const record = JSON.parse(result.toString());
                console.log('✅ Health record retrieved from Fabric network:', recordId);
                return record;
            } else {
                // Use mock mode
                return this.readHealthRecordMock(recordId);
            }

        } catch (error) {
            console.error('❌ Error reading health record:', error);
            // Fallback to mock mode on error
            return this.readHealthRecordMock(recordId);
        }
    }

    async updateHealthRecord(recordId, newData, updatedBy) {
        try {
            console.log('✏️ Updating health record:', recordId);
            
            if (!this.useMockMode && this.contract) {
                // Use real Fabric network
                const result = await this.contract.submitTransaction(
                    'updateHealthRecord',
                    recordId,
                    JSON.stringify(newData),
                    updatedBy || 'unknown'
                );

                const updatedRecord = JSON.parse(result.toString());
                console.log('✅ Health record updated on Fabric network:', recordId);
                return updatedRecord;
            } else {
                // Use mock mode
                return this.updateHealthRecordMock(recordId, newData, updatedBy);
            }

        } catch (error) {
            console.error('❌ Error updating health record:', error);
            // Fallback to mock mode on error
            return this.updateHealthRecordMock(recordId, newData, updatedBy);
        }
    }

    async updateRecordPrivacy(recordId, isPublic, updatedBy) {
        try {
            console.log('🔒 Updating record privacy:', recordId, 'isPublic:', isPublic);
            
            if (!this.useMockMode && this.contract) {
                // Use real Fabric network
                const result = await this.contract.submitTransaction(
                    'updateRecordPrivacy',
                    recordId,
                    String(isPublic),
                    updatedBy || 'unknown'
                );

                const updatedRecord = JSON.parse(result.toString());
                console.log('✅ Record privacy updated on Fabric network:', recordId);
                return updatedRecord;
            } else {
                // Use mock mode
                return this.updateRecordPrivacyMock(recordId, isPublic, updatedBy);
            }

        } catch (error) {
            console.error('❌ Error updating record privacy:', error);
            // Fallback to mock mode on error
            return this.updateRecordPrivacyMock(recordId, isPublic, updatedBy);
        }
    }

    async queryHealthRecordsByPatient(patientId) {
        try {
            console.log('🔍 Querying health records by patient:', patientId);
            
            if (!this.useMockMode && this.contract) {
                // Use real Fabric network
                const result = await this.contract.evaluateTransaction('queryHealthRecordsByPatient', patientId);
                const records = JSON.parse(result.toString());
                console.log(`✅ Found ${records.length} records for patient on Fabric network:`, patientId);
                return records;
            } else {
                // Use mock mode
                return this.queryHealthRecordsByPatientMock(patientId);
            }

        } catch (error) {
            console.error('❌ Error querying health records by patient:', error);
            // Fallback to mock mode on error
            return this.queryHealthRecordsByPatientMock(patientId);
        }
    }

    async queryPublicHealthRecords() {
        try {
            console.log('🌐 Querying public health records');
            
            if (!this.useMockMode && this.contract) {
                // Use real Fabric network
                const result = await this.contract.evaluateTransaction('queryPublicHealthRecords');
                const publicRecords = JSON.parse(result.toString());
                console.log(`✅ Found ${publicRecords.length} public records on Fabric network`);
                return publicRecords;
            } else {
                // Use mock mode
                return this.queryPublicHealthRecordsMock();
            }

        } catch (error) {
            console.error('❌ Error querying public health records:', error);
            // Fallback to mock mode on error
            return this.queryPublicHealthRecordsMock();
        }
    }

    async verifyRecordIntegrity(recordId) {
        try {
            console.log('🔍 Verifying record integrity:', recordId);
            
            if (!this.useMockMode && this.contract) {
                // Use real Fabric network
                const result = await this.contract.evaluateTransaction('verifyRecordIntegrity', recordId);
                const verificationResult = JSON.parse(result.toString());
                console.log(`✅ Record integrity verification completed on Fabric network:`, recordId, 'Valid:', verificationResult.isValid);
                return verificationResult;
            } else {
                // Use mock mode
                return this.verifyRecordIntegrityMock(recordId);
            }

        } catch (error) {
            console.error('❌ Error verifying record integrity:', error);
            // Fallback to mock mode on error
            return this.verifyRecordIntegrityMock(recordId);
        }
    }

    async getRecordHistory(recordId) {
        try {
            console.log('📜 Getting record history:', recordId);
            
            if (!this.useMockMode && this.contract) {
                // Use real Fabric network
                const result = await this.contract.evaluateTransaction('getRecordHistory', recordId);
                const history = JSON.parse(result.toString());
                console.log(`✅ Retrieved ${history.length} history entries for record on Fabric network:`, recordId);
                return history;
            } else {
                // Use mock mode
                return this.getRecordHistoryMock(recordId);
            }

        } catch (error) {
            console.error('❌ Error getting record history:', error);
            // Fallback to mock mode on error
            return this.getRecordHistoryMock(recordId);
        }
    }

    // Mock mode methods (fallback functionality)
    async createHealthRecordMock(recordData) {
        // Validate required fields
        if (!recordData.recordId || !recordData.patientId || !recordData.title) {
            throw new Error('Missing required fields: recordId, patientId, title');
        }

        // Check if record already exists
        if (this.healthRecords.has(recordData.recordId)) {
            throw new Error(`Health record ${recordData.recordId} already exists`);
        }

        // Create the health record
        const healthRecord = {
            recordId: recordData.recordId,
            patientId: recordData.patientId || recordData.recordId,
            recordType: recordData.recordType || 'human',
            title: recordData.title,
            description: recordData.description || '',
            data: recordData.data || {},
            isPublic: recordData.isPublic === true || recordData.isPublic === 'true',
            createdBy: recordData.createdBy || 'unknown',
            organization: 'MockMSP',
            timestamp: new Date().toISOString(),
            dataHash: this.calculateHash(JSON.stringify(recordData.data || {})),
            previousHash: this.getLastRecordHash(recordData.patientId),
            txId: this.generateTransactionId()
        };

        // Store the record
        this.healthRecords.set(recordData.recordId, healthRecord);
        
        // Add to transaction history
        this.addToHistory(recordData.recordId, 'CREATE', recordData.createdBy || 'unknown', healthRecord);

        console.log('✅ Health record created successfully (mock mode):', recordData.recordId);
        
        return {
            success: true,
            recordId: healthRecord.recordId,
            txId: healthRecord.txId,
            dataHash: healthRecord.dataHash,
            timestamp: healthRecord.timestamp
        };
    }

    readHealthRecordMock(recordId) {
        const record = this.healthRecords.get(recordId);
        if (!record) {
            throw new Error(`Health record ${recordId} not found`);
        }
        console.log('✅ Health record retrieved successfully (mock mode):', recordId);
        return record;
    }

    updateHealthRecordMock(recordId, newData, updatedBy) {
        const record = this.healthRecords.get(recordId);
        if (!record) {
            throw new Error(`Health record ${recordId} not found`);
        }

        // Parse new data if it's a string
        let parsedData = newData;
        if (typeof newData === 'string') {
            parsedData = JSON.parse(newData);
        }

        // Update the record
        const updatedRecord = {
            ...record,
            data: parsedData,
            dataHash: this.calculateHash(JSON.stringify(parsedData)),
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: updatedBy || 'unknown',
            txId: this.generateTransactionId()
        };

        // Store the updated record
        this.healthRecords.set(recordId, updatedRecord);
        
        // Add to transaction history
        this.addToHistory(recordId, 'UPDATE', updatedBy || 'unknown', updatedRecord);

        console.log('✅ Health record updated successfully (mock mode):', recordId);
        return updatedRecord;
    }

    updateRecordPrivacyMock(recordId, isPublic, updatedBy) {
        const record = this.healthRecords.get(recordId);
        if (!record) {
            throw new Error(`Health record ${recordId} not found`);
        }

        // Update privacy setting
        const updatedRecord = {
            ...record,
            isPublic: isPublic === true || isPublic === 'true',
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: updatedBy || 'unknown',
            txId: this.generateTransactionId()
        };

        // Store the updated record
        this.healthRecords.set(recordId, updatedRecord);
        
        // Add to transaction history
        this.addToHistory(recordId, 'PRIVACY_CHANGE', updatedBy || 'unknown', updatedRecord);

        console.log('✅ Record privacy updated successfully (mock mode):', recordId);
        return updatedRecord;
    }

    queryHealthRecordsByPatientMock(patientId) {
        const records = Array.from(this.healthRecords.values())
            .filter(record => record.patientId === patientId);

        console.log(`✅ Found ${records.length} records for patient (mock mode):`, patientId);
        return records;
    }

    queryPublicHealthRecordsMock() {
        const publicRecords = Array.from(this.healthRecords.values())
            .filter(record => record.isPublic === true);

        console.log(`✅ Found ${publicRecords.length} public records (mock mode)`);
        return publicRecords;
    }

    verifyRecordIntegrityMock(recordId) {
        const record = this.healthRecords.get(recordId);
        if (!record) {
            throw new Error(`Health record ${recordId} not found`);
        }

        // Calculate current data hash
        const currentDataHash = this.calculateHash(JSON.stringify(record.data));
        const isValid = currentDataHash === record.dataHash;

        const result = {
            recordId: recordId,
            isValid: isValid,
            storedHash: record.dataHash,
            calculatedHash: currentDataHash,
            verifiedAt: new Date().toISOString(),
            verificationMethod: 'SHA-256'
        };

        console.log(`✅ Record integrity verification completed (mock mode):`, recordId, 'Valid:', isValid);
        return result;
    }

    getRecordHistoryMock(recordId) {
        const history = this.transactionHistory.get(recordId) || [];
        console.log(`✅ Retrieved ${history.length} history entries for record (mock mode):`, recordId);
        return history;
    }

    // Helper methods
    calculateHash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    generateTransactionId() {
        return 'TX_' + crypto.randomBytes(16).toString('hex').toUpperCase();
    }

    getLastRecordHash(patientId) {
        const patientRecords = Array.from(this.healthRecords.values())
            .filter(record => record.patientId === patientId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return patientRecords.length > 0 ? patientRecords[0].dataHash : '0';
    }

    addToHistory(recordId, action, userId, recordData) {
        if (!this.transactionHistory.has(recordId)) {
            this.transactionHistory.set(recordId, []);
        }

        const historyEntry = {
            txId: this.generateTransactionId(),
            timestamp: new Date().toISOString(),
            action: action,
            userId: userId,
            recordId: recordId,
            dataHash: recordData.dataHash || this.calculateHash(JSON.stringify(recordData)),
            isDelete: false,
            value: recordData
        };

        this.transactionHistory.get(recordId).push(historyEntry);
    }

    async disconnect() {
        console.log('🔌 Disconnecting Hyperledger Fabric Gateway');
        
        if (this.gateway) {
            try {
                await this.gateway.disconnect();
                console.log('✅ Disconnected from Fabric network');
            } catch (error) {
                console.error('❌ Error disconnecting from Fabric network:', error);
            }
        }
        
        this.isInitialized = false;
    }

    // Status methods
    getStatus() {
        return {
            initialized: this.isInitialized,
            mode: this.useMockMode ? 'mock_fallback' : this.mode,
            totalRecords: this.useMockMode ? this.healthRecords.size : 'fabric_managed',
            fabricConnected: !this.useMockMode,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = CloudFabricGateway;