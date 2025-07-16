const crypto = require('crypto');

class CloudFabricGateway {
    constructor() {
        // In-memory storage for cloud deployment
        this.healthRecords = new Map();
        this.transactionHistory = new Map();
        this.isInitialized = false;
        this.mode = 'cloud'; // Always cloud mode for Render deployment
        
        console.log('🌐 Initializing Cloud Fabric Gateway (Mock Mode)');
    }

    async initialize() {
        try {
            console.log('🚀 Cloud Fabric Gateway initializing...');
            
            // Initialize with sample data
            await this.initializeSampleData();
            
            this.isInitialized = true;
            console.log('✅ Cloud Fabric Gateway initialized successfully');
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Cloud Fabric Gateway:', error);
            throw error;
        }
    }

    async initializeSampleData() {
        // Create a sample health record for demonstration
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
                notes: 'Sample record created by Cloud Fabric Gateway'
            },
            isPublic: true,
            createdBy: 'system',
            organization: 'CloudMSP',
            timestamp: new Date().toISOString(),
            dataHash: this.calculateHash('sample-data'),
            previousHash: '0'
        };

        this.healthRecords.set(sampleRecord.recordId, sampleRecord);
        
        // Add to transaction history
        this.addToHistory(sampleRecord.recordId, 'CREATE', 'system', sampleRecord);
        
        console.log('📝 Sample health record created:', sampleRecord.recordId);
    }

    async createHealthRecord(recordData) {
        try {
            console.log('📝 Creating health record:', recordData.recordId);
            
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
                organization: 'CloudMSP',
                timestamp: new Date().toISOString(),
                dataHash: this.calculateHash(JSON.stringify(recordData.data || {})),
                previousHash: this.getLastRecordHash(recordData.patientId),
                txId: this.generateTransactionId()
            };

            // Store the record
            this.healthRecords.set(recordData.recordId, healthRecord);
            
            // Add to transaction history
            this.addToHistory(recordData.recordId, 'CREATE', recordData.createdBy || 'unknown', healthRecord);

            console.log('✅ Health record created successfully:', recordData.recordId);
            
            return {
                success: true,
                recordId: healthRecord.recordId,
                txId: healthRecord.txId,
                dataHash: healthRecord.dataHash,
                timestamp: healthRecord.timestamp
            };

        } catch (error) {
            console.error('❌ Error creating health record:', error);
            throw error;
        }
    }

    async readHealthRecord(recordId) {
        try {
            console.log('📖 Reading health record:', recordId);
            
            const record = this.healthRecords.get(recordId);
            if (!record) {
                throw new Error(`Health record ${recordId} not found`);
            }

            console.log('✅ Health record retrieved successfully:', recordId);
            return record;

        } catch (error) {
            console.error('❌ Error reading health record:', error);
            throw error;
        }
    }

    async updateHealthRecord(recordId, newData, updatedBy) {
        try {
            console.log('✏️ Updating health record:', recordId);
            
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

            console.log('✅ Health record updated successfully:', recordId);
            return updatedRecord;

        } catch (error) {
            console.error('❌ Error updating health record:', error);
            throw error;
        }
    }

    async updateRecordPrivacy(recordId, isPublic, updatedBy) {
        try {
            console.log('🔒 Updating record privacy:', recordId, 'isPublic:', isPublic);
            
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

            console.log('✅ Record privacy updated successfully:', recordId);
            return updatedRecord;

        } catch (error) {
            console.error('❌ Error updating record privacy:', error);
            throw error;
        }
    }

    async queryHealthRecordsByPatient(patientId) {
        try {
            console.log('🔍 Querying health records by patient:', patientId);
            
            const records = Array.from(this.healthRecords.values())
                .filter(record => record.patientId === patientId);

            console.log(`✅ Found ${records.length} records for patient:`, patientId);
            return records;

        } catch (error) {
            console.error('❌ Error querying health records by patient:', error);
            throw error;
        }
    }

    async queryPublicHealthRecords() {
        try {
            console.log('🌐 Querying public health records');
            
            const publicRecords = Array.from(this.healthRecords.values())
                .filter(record => record.isPublic === true);

            console.log(`✅ Found ${publicRecords.length} public records`);
            return publicRecords;

        } catch (error) {
            console.error('❌ Error querying public health records:', error);
            throw error;
        }
    }

    async verifyRecordIntegrity(recordId) {
        try {
            console.log('🔍 Verifying record integrity:', recordId);
            
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

            console.log(`✅ Record integrity verification completed:`, recordId, 'Valid:', isValid);
            return result;

        } catch (error) {
            console.error('❌ Error verifying record integrity:', error);
            throw error;
        }
    }

    async getRecordHistory(recordId) {
        try {
            console.log('📜 Getting record history:', recordId);
            
            const history = this.transactionHistory.get(recordId) || [];
            
            console.log(`✅ Retrieved ${history.length} history entries for record:`, recordId);
            return history;

        } catch (error) {
            console.error('❌ Error getting record history:', error);
            throw error;
        }
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
        console.log('🔌 Disconnecting Cloud Fabric Gateway');
        this.isInitialized = false;
    }

    // Status methods
    getStatus() {
        return {
            initialized: this.isInitialized,
            mode: this.mode,
            totalRecords: this.healthRecords.size,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = CloudFabricGateway;