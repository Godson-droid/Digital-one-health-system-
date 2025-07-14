const axios = require('axios');

// Test the Fabric Gateway
async function testFabricNetwork() {
    try {
        console.log('🔍 Testing Hyperledger Fabric Network...');
        
        // Test health endpoint
        const healthResponse = await axios.get('http://localhost:3001/health');
        console.log('✅ Fabric Gateway Health:', healthResponse.data);
        
        // Test creating a health record
        const testRecord = {
            recordType: 'human',
            title: 'Test Health Record',
            description: 'Testing Fabric network integration',
            data: {
                vitals: {
                    bloodPressure: '120/80',
                    heartRate: '72',
                    temperature: '98.6'
                },
                diagnosis: 'Healthy',
                notes: 'Annual checkup - all normal'
            },
            isPublic: false,
            createdBy: 'test-doctor',
            patientId: 'test-patient-001'
        };
        
        console.log('📝 Creating test health record...');
        const createResponse = await axios.post('http://localhost:3001/api/health-records', testRecord);
        console.log('✅ Record Created:', createResponse.data);
        
        const recordId = createResponse.data.data.recordId;
        
        // Test reading the record
        console.log('📖 Reading health record...');
        const readResponse = await axios.get(`http://localhost:3001/api/health-records/${recordId}`);
        console.log('✅ Record Read:', readResponse.data);
        
        // Test verifying record integrity
        console.log('🔍 Verifying record integrity...');
        const verifyResponse = await axios.get(`http://localhost:3001/api/health-records/${recordId}/verify`);
        console.log('✅ Integrity Verified:', verifyResponse.data);
        
        // Test querying public records
        console.log('🌐 Querying public records...');
        const publicResponse = await axios.get('http://localhost:3001/api/health-records/public');
        console.log('✅ Public Records:', publicResponse.data);
        
        console.log('\n🎉 Hyperledger Fabric Network is fully operational!');
        console.log('🔗 Network Components:');
        console.log('   - Orderer: localhost:7050');
        console.log('   - Hospital Peer: localhost:7051');
        console.log('   - Research Peer: localhost:9051');
        console.log('   - Individual Peer: localhost:11051');
        console.log('   - Fabric Gateway: localhost:3001');
        
    } catch (error) {
        console.error('❌ Fabric Network Test Failed:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

// Run the test
testFabricNetwork();