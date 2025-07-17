const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

// Import our Cloud Fabric Gateway
const CloudFabricGateway = require('./fabric-gateway');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Cloud Fabric Gateway
let fabricGateway;

async function initializeFabric() {
    try {
        console.log('🚀 Initializing Cloud Fabric Gateway...');
        fabricGateway = new CloudFabricGateway();
        await fabricGateway.initialize();
        console.log('✅ Cloud Fabric Gateway initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Cloud Fabric Gateway:', error);
        // Don't exit - continue with limited functionality
        fabricGateway = null;
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    const status = fabricGateway ? fabricGateway.getStatus() : { initialized: false, mode: 'error' };
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Digital One Health Hyperledger Fabric Gateway',
        version: '2.0.0',
        gateway: status,
        fabricConnected: status.fabricConnected || false,
        mode: status.mode || 'unknown',
        endpoints: {
            health: '/health',
            createRecord: 'POST /api/health-records',
            readRecord: 'GET /api/health-records/:recordId',
            updateRecord: 'PUT /api/health-records/:recordId',
            updatePrivacy: 'PUT /api/health-records/:recordId/privacy',
            queryByPatient: 'GET /api/patients/:patientId/health-records',
            queryPublic: 'GET /api/health-records/public',
            verifyIntegrity: 'GET /api/health-records/:recordId/verify',
            getHistory: 'GET /api/health-records/:recordId/history'
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Digital One Health Hyperledger Fabric Gateway',
        version: '2.0.0',
        status: 'running',
        mode: fabricGateway ? fabricGateway.getStatus().mode : 'unknown',
        fabricConnected: fabricGateway ? fabricGateway.getStatus().fabricConnected : false,
        documentation: '/health',
        timestamp: new Date().toISOString()
    });
});

// Create health record
app.post('/api/health-records', async (req, res) => {
    try {
        if (!fabricGateway) {
            return res.status(503).json({
                success: false,
                message: 'Fabric Gateway not initialized',
                error: 'Service unavailable'
            });
        }

        const recordData = {
            recordId: req.body.recordId || uuidv4(),
            patientId: req.body.patientId || req.body.recordId || uuidv4(),
            recordType: req.body.recordType || 'human',
            title: req.body.title || 'Untitled Record',
            description: req.body.description || '',
            data: req.body.data || {},
            isPublic: req.body.isPublic || false,
            createdBy: req.body.createdBy || 'unknown'
        };

        console.log('📝 Creating health record:', recordData.recordId);
        const result = await fabricGateway.createHealthRecord(recordData);
        
        res.status(201).json({
            success: true,
            message: 'Health record created successfully',
            data: {
                recordId: result.recordId,
                txId: result.txId,
                dataHash: result.dataHash,
                timestamp: result.timestamp
            }
        });
    } catch (error) {
        console.error('❌ Error creating health record:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create health record',
            error: error.message
        });
    }
});

// Get health record by ID
app.get('/api/health-records/:recordId', async (req, res) => {
    try {
        if (!fabricGateway) {
            return res.status(503).json({
                success: false,
                message: 'Fabric Gateway not initialized',
                error: 'Service unavailable'
            });
        }

        const { recordId } = req.params;
        console.log('📖 Reading health record:', recordId);
        
        const result = await fabricGateway.readHealthRecord(recordId);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error reading health record:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to read health record',
            error: error.message
        });
    }
});

// Update health record
app.put('/api/health-records/:recordId', async (req, res) => {
    try {
        if (!fabricGateway) {
            return res.status(503).json({
                success: false,
                message: 'Fabric Gateway not initialized',
                error: 'Service unavailable'
            });
        }

        const { recordId } = req.params;
        const { data, updatedBy } = req.body;
        
        console.log('✏️ Updating health record:', recordId);
        const result = await fabricGateway.updateHealthRecord(recordId, data, updatedBy);
        
        res.json({
            success: true,
            message: 'Health record updated successfully',
            data: result
        });
    } catch (error) {
        console.error('❌ Error updating health record:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to update health record',
            error: error.message
        });
    }
});

// Update record privacy
app.put('/api/health-records/:recordId/privacy', async (req, res) => {
    try {
        if (!fabricGateway) {
            return res.status(503).json({
                success: false,
                message: 'Fabric Gateway not initialized',
                error: 'Service unavailable'
            });
        }

        const { recordId } = req.params;
        const { isPublic, updatedBy } = req.body;
        
        console.log('🔒 Updating record privacy:', recordId, 'isPublic:', isPublic);
        const result = await fabricGateway.updateRecordPrivacy(recordId, isPublic, updatedBy);
        
        res.json({
            success: true,
            message: 'Record privacy updated successfully',
            data: result
        });
    } catch (error) {
        console.error('❌ Error updating record privacy:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to update record privacy',
            error: error.message
        });
    }
});

// Query health records by patient
app.get('/api/patients/:patientId/health-records', async (req, res) => {
    try {
        if (!fabricGateway) {
            return res.status(503).json({
                success: false,
                message: 'Fabric Gateway not initialized',
                error: 'Service unavailable'
            });
        }

        const { patientId } = req.params;
        console.log('🔍 Querying health records by patient:', patientId);
        
        const result = await fabricGateway.queryHealthRecordsByPatient(patientId);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error querying health records by patient:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to query health records',
            error: error.message
        });
    }
});

// Query public health records
app.get('/api/health-records/public', async (req, res) => {
    try {
        if (!fabricGateway) {
            return res.status(503).json({
                success: false,
                message: 'Fabric Gateway not initialized',
                error: 'Service unavailable'
            });
        }

        console.log('🌐 Querying public health records');
        const result = await fabricGateway.queryPublicHealthRecords();
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error querying public health records:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to query public health records',
            error: error.message
        });
    }
});

// Verify record integrity
app.get('/api/health-records/:recordId/verify', async (req, res) => {
    try {
        if (!fabricGateway) {
            return res.status(503).json({
                success: false,
                message: 'Fabric Gateway not initialized',
                error: 'Service unavailable'
            });
        }

        const { recordId } = req.params;
        console.log('🔍 Verifying record integrity:', recordId);
        
        const result = await fabricGateway.verifyRecordIntegrity(recordId);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error verifying record integrity:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to verify record integrity',
            error: error.message
        });
    }
});

// Get record history
app.get('/api/health-records/:recordId/history', async (req, res) => {
    try {
        if (!fabricGateway) {
            return res.status(503).json({
                success: false,
                message: 'Fabric Gateway not initialized',
                error: 'Service unavailable'
            });
        }

        const { recordId } = req.params;
        console.log('📜 Getting record history:', recordId);
        
        const result = await fabricGateway.getRecordHistory(recordId);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error getting record history:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: 'Failed to get record history',
            error: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('🚨 Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        availableEndpoints: {
            health: 'GET /health',
            createRecord: 'POST /api/health-records',
            readRecord: 'GET /api/health-records/:recordId',
            updateRecord: 'PUT /api/health-records/:recordId',
            updatePrivacy: 'PUT /api/health-records/:recordId/privacy',
            queryByPatient: 'GET /api/patients/:patientId/health-records',
            queryPublic: 'GET /api/health-records/public',
            verifyIntegrity: 'GET /api/health-records/:recordId/verify',
            getHistory: 'GET /api/health-records/:recordId/history'
        }
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    if (fabricGateway) {
        await fabricGateway.disconnect();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    if (fabricGateway) {
        await fabricGateway.disconnect();
    }
    process.exit(0);
});

// Start server
async function startServer() {
    try {
        // Initialize Fabric Gateway
        await initializeFabric();
        
        // Start HTTP server
        app.listen(PORT, '0.0.0.0', () => {
            console.log('🚀 Digital One Health Hyperledger Fabric Gateway started successfully!');
            console.log(`📡 Server running on port ${PORT}`);
            console.log(`🌐 Health check: http://localhost:${PORT}/health`);
            console.log(`📋 API base: http://localhost:${PORT}/api`);
            const status = fabricGateway ? fabricGateway.getStatus() : { mode: 'unknown', fabricConnected: false };
            console.log(`🔧 Mode: ${status.mode}`);
            console.log(`🔗 Fabric Connected: ${status.fabricConnected ? 'Yes' : 'No (Fallback Mode)'}`);
            console.log('✅ Ready to accept requests!');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer().catch(console.error);

module.exports = app;