'use strict';

const { Contract } = require('fabric-contract-api');

class HealthRecordContract extends Contract {

    async initLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        
        const healthRecords = [
            {
                recordId: 'RECORD001',
                patientId: 'PATIENT001',
                recordType: 'human',
                title: 'Annual Health Checkup',
                description: 'Routine annual health examination',
                data: {
                    vitals: {
                        bloodPressure: '120/80',
                        heartRate: '72',
                        temperature: '98.6'
                    },
                    diagnosis: 'Healthy',
                    medications: []
                },
                isPublic: false,
                createdBy: 'DR001',
                organization: 'HospitalMSP',
                timestamp: new Date().toISOString(),
                dataHash: '',
                previousHash: ''
            }
        ];

        for (let i = 0; i < healthRecords.length; i++) {
            healthRecords[i].docType = 'healthRecord';
            healthRecords[i].dataHash = this.calculateHash(JSON.stringify(healthRecords[i].data));
            await ctx.stub.putState(healthRecords[i].recordId, Buffer.from(JSON.stringify(healthRecords[i])));
            console.info('Added <--> ', healthRecords[i]);
        }
        console.info('============= END : Initialize Ledger ===========');
    }

    async createHealthRecord(ctx, recordId, patientId, recordType, title, description, dataString, isPublic, createdBy) {
        console.info('============= START : Create Health Record ===========');

        // Check if record already exists
        const exists = await this.healthRecordExists(ctx, recordId);
        if (exists) {
            throw new Error(`The health record ${recordId} already exists`);
        }

        // Get caller's organization
        const clientMSPID = ctx.clientIdentity.getMSPID();
        
        // Parse data
        let data;
        try {
            data = JSON.parse(dataString);
        } catch (error) {
            throw new Error('Invalid data format. Must be valid JSON.');
        }

        // Calculate data hash for integrity
        const dataHash = this.calculateHash(dataString);

        // Get previous record hash for chaining
        const previousHash = await this.getLastRecordHash(ctx, patientId);

        const healthRecord = {
            docType: 'healthRecord',
            recordId,
            patientId,
            recordType,
            title,
            description,
            data,
            isPublic: isPublic === 'true',
            createdBy,
            organization: clientMSPID,
            timestamp: new Date().toISOString(),
            dataHash,
            previousHash
        };

        await ctx.stub.putState(recordId, Buffer.from(JSON.stringify(healthRecord)));

        // Create audit trail
        await this.createAuditTrail(ctx, recordId, 'CREATE', createdBy, clientMSPID);

        console.info('============= END : Create Health Record ===========');
        return JSON.stringify(healthRecord);
    }

    async readHealthRecord(ctx, recordId) {
        const healthRecordAsBytes = await ctx.stub.getState(recordId);
        if (!healthRecordAsBytes || healthRecordAsBytes.length === 0) {
            throw new Error(`The health record ${recordId} does not exist`);
        }

        const healthRecord = JSON.parse(healthRecordAsBytes.toString());
        const clientMSPID = ctx.clientIdentity.getMSPID();

        // Check access permissions
        if (!this.hasReadAccess(healthRecord, clientMSPID)) {
            throw new Error(`Access denied. You don't have permission to read this record.`);
        }

        return healthRecordAsBytes.toString();
    }

    async updateHealthRecord(ctx, recordId, newDataString, updatedBy) {
        console.info('============= START : Update Health Record ===========');

        const exists = await this.healthRecordExists(ctx, recordId);
        if (!exists) {
            throw new Error(`The health record ${recordId} does not exist`);
        }

        const healthRecordAsBytes = await ctx.stub.getState(recordId);
        const healthRecord = JSON.parse(healthRecordAsBytes.toString());
        const clientMSPID = ctx.clientIdentity.getMSPID();

        // Check update permissions
        if (!this.hasWriteAccess(healthRecord, clientMSPID)) {
            throw new Error(`Access denied. You don't have permission to update this record.`);
        }

        // Parse new data
        let newData;
        try {
            newData = JSON.parse(newDataString);
        } catch (error) {
            throw new Error('Invalid data format. Must be valid JSON.');
        }

        // Update record
        healthRecord.data = newData;
        healthRecord.dataHash = this.calculateHash(newDataString);
        healthRecord.lastUpdated = new Date().toISOString();
        healthRecord.lastUpdatedBy = updatedBy;

        await ctx.stub.putState(recordId, Buffer.from(JSON.stringify(healthRecord)));

        // Create audit trail
        await this.createAuditTrail(ctx, recordId, 'UPDATE', updatedBy, clientMSPID);

        console.info('============= END : Update Health Record ===========');
        return JSON.stringify(healthRecord);
    }

    async updateRecordPrivacy(ctx, recordId, isPublic, updatedBy) {
        console.info('============= START : Update Record Privacy ===========');

        const exists = await this.healthRecordExists(ctx, recordId);
        if (!exists) {
            throw new Error(`The health record ${recordId} does not exist`);
        }

        const healthRecordAsBytes = await ctx.stub.getState(recordId);
        const healthRecord = JSON.parse(healthRecordAsBytes.toString());
        const clientMSPID = ctx.clientIdentity.getMSPID();

        // Check update permissions
        if (!this.hasWriteAccess(healthRecord, clientMSPID)) {
            throw new Error(`Access denied. You don't have permission to update this record.`);
        }

        // Update privacy setting
        healthRecord.isPublic = isPublic === 'true';
        healthRecord.lastUpdated = new Date().toISOString();
        healthRecord.lastUpdatedBy = updatedBy;

        await ctx.stub.putState(recordId, Buffer.from(JSON.stringify(healthRecord)));

        // Create audit trail
        await this.createAuditTrail(ctx, recordId, 'PRIVACY_CHANGE', updatedBy, clientMSPID);

        console.info('============= END : Update Record Privacy ===========');
        return JSON.stringify(healthRecord);
    }

    async queryHealthRecordsByPatient(ctx, patientId) {
        const queryString = {
            selector: {
                docType: 'healthRecord',
                patientId: patientId
            }
        };

        const queryResults = await this.getQueryResultForQueryString(ctx, JSON.stringify(queryString));
        const clientMSPID = ctx.clientIdentity.getMSPID();

        // Filter results based on access permissions
        const filteredResults = queryResults.filter(record => {
            const healthRecord = JSON.parse(record.Record);
            return this.hasReadAccess(healthRecord, clientMSPID);
        });

        return JSON.stringify(filteredResults);
    }

    async queryPublicHealthRecords(ctx) {
        const queryString = {
            selector: {
                docType: 'healthRecord',
                isPublic: true
            }
        };

        const queryResults = await this.getQueryResultForQueryString(ctx, JSON.stringify(queryString));
        return JSON.stringify(queryResults);
    }

    async verifyRecordIntegrity(ctx, recordId) {
        const healthRecordAsBytes = await ctx.stub.getState(recordId);
        if (!healthRecordAsBytes || healthRecordAsBytes.length === 0) {
            throw new Error(`The health record ${recordId} does not exist`);
        }

        const healthRecord = JSON.parse(healthRecordAsBytes.toString());
        const currentDataHash = this.calculateHash(JSON.stringify(healthRecord.data));
        
        const integrityResult = {
            recordId: recordId,
            isValid: currentDataHash === healthRecord.dataHash,
            storedHash: healthRecord.dataHash,
            calculatedHash: currentDataHash,
            verifiedAt: new Date().toISOString()
        };

        return JSON.stringify(integrityResult);
    }

    async getRecordHistory(ctx, recordId) {
        const resultsIterator = await ctx.stub.getHistoryForKey(recordId);
        const results = [];

        while (true) {
            const res = await resultsIterator.next();

            if (res.value && res.value.value.toString()) {
                const jsonRes = {};
                jsonRes.TxId = res.value.tx_id;
                jsonRes.Timestamp = res.value.timestamp;
                jsonRes.IsDelete = res.value.is_delete.toString();
                
                try {
                    jsonRes.Value = JSON.parse(res.value.value.toString('utf8'));
                } catch (err) {
                    jsonRes.Value = res.value.value.toString('utf8');
                }
                
                results.push(jsonRes);
            }

            if (res.done) {
                await resultsIterator.close();
                break;
            }
        }

        return JSON.stringify(results);
    }

    // Helper functions
    async healthRecordExists(ctx, recordId) {
        const healthRecordAsBytes = await ctx.stub.getState(recordId);
        return healthRecordAsBytes && healthRecordAsBytes.length > 0;
    }

    hasReadAccess(healthRecord, clientMSPID) {
        // Admin (system) can read all
        if (clientMSPID === 'OrdererMSP') {
            return true;
        }

        // Owner organization can read
        if (healthRecord.organization === clientMSPID) {
            return true;
        }

        // Public records can be read by healthcare providers and researchers
        if (healthRecord.isPublic && (clientMSPID === 'HospitalMSP' || clientMSPID === 'ResearchMSP')) {
            return true;
        }

        // Individuals can read public records
        if (healthRecord.isPublic && clientMSPID === 'IndividualMSP') {
            return true;
        }

        return false;
    }

    hasWriteAccess(healthRecord, clientMSPID) {
        // Admin can write all
        if (clientMSPID === 'OrdererMSP') {
            return true;
        }

        // Only owner organization can write
        return healthRecord.organization === clientMSPID;
    }

    calculateHash(data) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    async getLastRecordHash(ctx, patientId) {
        const queryString = {
            selector: {
                docType: 'healthRecord',
                patientId: patientId
            },
            sort: [{ timestamp: 'desc' }],
            limit: 1
        };

        const queryResults = await this.getQueryResultForQueryString(ctx, JSON.stringify(queryString));
        
        if (queryResults.length > 0) {
            const lastRecord = JSON.parse(queryResults[0].Record);
            return lastRecord.dataHash;
        }
        
        return '0'; // Genesis hash
    }

    async createAuditTrail(ctx, recordId, action, userId, organization) {
        const auditId = `AUDIT_${recordId}_${Date.now()}`;
        const auditRecord = {
            docType: 'auditTrail',
            auditId,
            recordId,
            action,
            userId,
            organization,
            timestamp: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };

        await ctx.stub.putState(auditId, Buffer.from(JSON.stringify(auditRecord)));
    }

    async getQueryResultForQueryString(ctx, queryString) {
        const resultsIterator = await ctx.stub.getQueryResult(queryString);
        const results = [];

        while (true) {
            const res = await resultsIterator.next();

            if (res.value && res.value.value.toString()) {
                const jsonRes = {};
                jsonRes.Key = res.value.key;
                
                try {
                    jsonRes.Record = res.value.value.toString('utf8');
                } catch (err) {
                    jsonRes.Record = res.value.value.toString('utf8');
                }
                
                results.push(jsonRes);
            }

            if (res.done) {
                await resultsIterator.close();
                break;
            }
        }

        return results;
    }
}

module.exports = HealthRecordContract;