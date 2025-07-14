const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');

class FabricGateway {
    constructor() {
        this.gateway = null;
        this.wallet = null;
        this.contract = null;
        this.network = null;
    }

    async initialize() {
        try {
            // Create wallet
            const walletPath = path.join(process.cwd(), 'wallet');
            this.wallet = await Wallets.newFileSystemWallet(walletPath);

            // Check if admin identity exists
            const adminExists = await this.wallet.get('admin');
            if (!adminExists) {
                await this.enrollAdmin();
            }

            // Connect to gateway
            await this.connectGateway();
            
            console.log('Fabric Gateway initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Fabric Gateway:', error);
            throw error;
        }
    }

    async enrollAdmin() {
        try {
            // Create CA client
            const caInfo = {
                url: 'https://localhost:7054',
                caName: 'ca-hospital'
            };
            
            const caTLSCACerts = fs.readFileSync(path.join(__dirname, '../organizations/peerOrganizations/hospital.digitalonehealth.com/ca/ca.hospital.digitalonehealth.com-cert.pem'));
            const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

            // Enroll admin
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
            console.log('Successfully enrolled admin user and imported it into the wallet');
        } catch (error) {
            console.error('Failed to enroll admin user:', error);
            throw error;
        }
    }

    async connectGateway() {
        try {
            // Gateway connection options
            const connectionProfile = {
                name: 'digital-one-health-network',
                version: '1.0.0',
                client: {
                    organization: 'Hospital',
                    connection: {
                        timeout: {
                            peer: {
                                endorser: '300'
                            }
                        }
                    }
                },
                organizations: {
                    Hospital: {
                        mspid: 'HospitalMSP',
                        peers: ['peer0.hospital.digitalonehealth.com']
                    }
                },
                peers: {
                    'peer0.hospital.digitalonehealth.com': {
                        url: 'grpcs://localhost:7051',
                        tlsCACerts: {
                            pem: fs.readFileSync(path.join(__dirname, '../organizations/peerOrganizations/hospital.digitalonehealth.com/tlsca/tlsca.hospital.digitalonehealth.com-cert.pem')).toString()
                        },
                        grpcOptions: {
                            'ssl-target-name-override': 'peer0.hospital.digitalonehealth.com',
                            'hostnameOverride': 'peer0.hospital.digitalonehealth.com'
                        }
                    }
                }
            };

            this.gateway = new Gateway();
            await this.gateway.connect(connectionProfile, {
                wallet: this.wallet,
                identity: 'admin',
                discovery: { enabled: true, asLocalhost: true }
            });

            // Get network and contract
            this.network = await this.gateway.getNetwork('healthrecords');
            this.contract = this.network.getContract('health-records');

            console.log('Connected to Fabric Gateway successfully');
        } catch (error) {
            console.error('Failed to connect to gateway:', error);
            throw error;
        }
    }

    async createHealthRecord(recordData) {
        try {
            const result = await this.contract.submitTransaction(
                'createHealthRecord',
                recordData.recordId,
                recordData.patientId,
                recordData.recordType,
                recordData.title,
                recordData.description,
                JSON.stringify(recordData.data),
                recordData.isPublic.toString(),
                recordData.createdBy
            );

            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to create health record:', error);
            throw error;
        }
    }

    async readHealthRecord(recordId) {
        try {
            const result = await this.contract.evaluateTransaction('readHealthRecord', recordId);
            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to read health record:', error);
            throw error;
        }
    }

    async updateHealthRecord(recordId, newData, updatedBy) {
        try {
            const result = await this.contract.submitTransaction(
                'updateHealthRecord',
                recordId,
                JSON.stringify(newData),
                updatedBy
            );

            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to update health record:', error);
            throw error;
        }
    }

    async updateRecordPrivacy(recordId, isPublic, updatedBy) {
        try {
            const result = await this.contract.submitTransaction(
                'updateRecordPrivacy',
                recordId,
                isPublic.toString(),
                updatedBy
            );

            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to update record privacy:', error);
            throw error;
        }
    }

    async queryHealthRecordsByPatient(patientId) {
        try {
            const result = await this.contract.evaluateTransaction('queryHealthRecordsByPatient', patientId);
            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to query health records by patient:', error);
            throw error;
        }
    }

    async queryPublicHealthRecords() {
        try {
            const result = await this.contract.evaluateTransaction('queryPublicHealthRecords');
            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to query public health records:', error);
            throw error;
        }
    }

    async verifyRecordIntegrity(recordId) {
        try {
            const result = await this.contract.evaluateTransaction('verifyRecordIntegrity', recordId);
            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to verify record integrity:', error);
            throw error;
        }
    }

    async getRecordHistory(recordId) {
        try {
            const result = await this.contract.evaluateTransaction('getRecordHistory', recordId);
            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to get record history:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.gateway) {
            await this.gateway.disconnect();
            console.log('Disconnected from Fabric Gateway');
        }
    }
}

module.exports = FabricGateway;