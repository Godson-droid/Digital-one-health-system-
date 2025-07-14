const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const FabricGateway = require('./fabric-gateway');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Initialize Fabric Gateway
let fabricGateway;

async function initializeFabric() {
    try {
        fabricGateway = new FabricGateway();
        await fabricGateway.initialize();
        console.log('Fabric Gateway initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Fabric Gateway:', error);
        process.exit(1);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Digital One Health Fabric Gateway',
        version: '1.0.0'
    });
});

// Create health record
app.post('/api/health-records', async (req, res) => {
    try {
        const recordData = {
            recordId: uuidv4(),
            patientId: req.body.patientId || uuidv4(),
            recordType: req.body.recordType,
            title: req.body.title,
            description: req.body.description,
            data: req.body.data,
            isPublic: req.body.isPublic || false,
            createdBy: req.body.createdBy
        };

        const result = await fabricGateway.createHealthRecord(recordData);
        
        res.status(201).json({
            success: true,
            message: 'Health record created successfully',
            data: result
        });
    } catch (error) {
        console.error('Error creating health record:', error);
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
        const { recordId } = req.params;
        const result = await fabricGateway.readHealthRecord(recordId);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error reading health record:', error);
        res.status(404).json({
            success: false,
            message: 'Health record not found or access denied',
            error: error.message
        });
    }
});

// Update health record
app.put('/api/health-records/:recordId', async (req, res) => {
    try {
        const { recordId } = req.params;
        const { data, updatedBy } = req.body;
        
        const result = await fabricGateway.updateHealthRecord(recordId, data, updatedBy);
        
        res.json({
            success: true,
            message: 'Health record updated successfully',
            data: result
        });
    } catch (error) {
        console.error('Error updating health record:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update health record',
            error: error.message
        });
    }
});

// Update record privacy
app.put('/api/health-records/:recordId/privacy', async (req, res) => {
    try {
        const { recordId } = req.params;
        const { isPublic, updatedBy } = req.body;
        
        const result = await fabricGateway.updateRecordPrivacy(recordId, isPublic, updatedBy);
        
        res.json({
            success: true,
            message: 'Record privacy updated successfully',
            data: result
        });
    } catch (error) {
        console.error('Error updating record privacy:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update record privacy',
            error: error.message
        });
    }
});

// Query health records by patient
app.get('/api/patients/:patientId/health-records', async (req, res) => {
    try {
        const { patientId } = req.params;
        const result = await fabricGateway.queryHealthRecordsByPatient(patientId);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error querying health records by patient:', error);
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
        const result = await fabricGateway.queryPublicHealthRecords();
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error querying public health records:', error);
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
        const { recordId } = req.params;
        const result = await fabricGateway.verifyRecordIntegrity(recordId);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error verifying record integrity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify record integrity',
            error: error.message
        });
    }
});

// Get record history
app.get('/api/health-records/:recordId/history', async (req, res) => {
    try {
        const { recordId } = req.params;
        const result = await fabricGateway.getRecordHistory(recordId);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error getting record history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get record history',
            error: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
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
        message: 'Endpoint not found'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    if (fabricGateway) {
        await fabricGateway.disconnect();
    }
    process.exit(0);
});

// Start server
async function startServer() {
    await initializeFabric();
    
    app.listen(PORT, () => {
        console.log(`🚀 Digital One Health Fabric Gateway running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`📋 API Documentation: http://localhost:${PORT}/api`);
    });
}

startServer().catch(console.error);

module.exports = app;