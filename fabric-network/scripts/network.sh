#!/bin/bash

# Digital One Health Hyperledger Fabric Network Management Script

export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to generate crypto material
generate_crypto() {
    print_header "Generating Crypto Material"
    
    # Create organizations directory
    mkdir -p organizations/fabric-ca
    
    # Generate crypto material for all organizations
    print_status "Generating certificates using cryptogen..."
    
    # Create cryptogen config
    cat > crypto-config.yaml << EOF
OrdererOrgs:
  - Name: Orderer
    Domain: digitalonehealth.com
    Specs:
      - Hostname: orderer

PeerOrgs:
  - Name: Hospital
    Domain: hospital.digitalonehealth.com
    Template:
      Count: 1
    Users:
      Count: 1

  - Name: Research
    Domain: research.digitalonehealth.com
    Template:
      Count: 1
    Users:
      Count: 1

  - Name: Individual
    Domain: individual.digitalonehealth.com
    Template:
      Count: 1
    Users:
      Count: 1
EOF

    cryptogen generate --config=./crypto-config.yaml --output="organizations"
    
    if [ $? -eq 0 ]; then
        print_status "Crypto material generated successfully"
    else
        print_error "Failed to generate crypto material"
        exit 1
    fi
}

# Function to generate genesis block and channel configuration
generate_genesis() {
    print_header "Generating Genesis Block and Channel Configuration"
    
    mkdir -p system-genesis-block
    mkdir -p channel-artifacts
    
    # Generate genesis block
    print_status "Generating genesis block..."
    configtxgen -profile DigitalOneHealthOrdererGenesis -channelID system-channel -outputBlock ./system-genesis-block/genesis.block
    
    if [ $? -eq 0 ]; then
        print_status "Genesis block generated successfully"
    else
        print_error "Failed to generate genesis block"
        exit 1
    fi
    
    # Generate channel configuration transaction
    print_status "Generating channel configuration transaction..."
    configtxgen -profile HealthRecordsChannel -outputCreateChannelTx ./channel-artifacts/healthrecords.tx -channelID healthrecords
    
    if [ $? -eq 0 ]; then
        print_status "Channel configuration generated successfully"
    else
        print_error "Failed to generate channel configuration"
        exit 1
    fi
    
    # Generate anchor peer transactions
    print_status "Generating anchor peer transactions..."
    configtxgen -profile HealthRecordsChannel -outputAnchorPeersUpdate ./channel-artifacts/HospitalMSPanchors.tx -channelID healthrecords -asOrg HospitalMSP
    configtxgen -profile HealthRecordsChannel -outputAnchorPeersUpdate ./channel-artifacts/ResearchMSPanchors.tx -channelID healthrecords -asOrg ResearchMSP
    configtxgen -profile HealthRecordsChannel -outputAnchorPeersUpdate ./channel-artifacts/IndividualMSPanchors.tx -channelID healthrecords -asOrg IndividualMSP
}

# Function to start the network
start_network() {
    print_header "Starting Digital One Health Network"
    
    # Start the network
    print_status "Starting Docker containers..."
    docker-compose -f docker-compose.yml up -d
    
    if [ $? -eq 0 ]; then
        print_status "Network started successfully"
        sleep 10
    else
        print_error "Failed to start network"
        exit 1
    fi
}

# Function to create and join channel
create_channel() {
    print_header "Creating and Joining Channel"
    
    # Set environment for Hospital peer
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="HospitalMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/hospital.digitalonehealth.com/peers/peer0.hospital.digitalonehealth.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/hospital.digitalonehealth.com/users/Admin@hospital.digitalonehealth.com/msp
    export CORE_PEER_ADDRESS=localhost:7051
    
    # Create channel
    print_status "Creating channel 'healthrecords'..."
    peer channel create -o localhost:7050 -c healthrecords -f ./channel-artifacts/healthrecords.tx --outputBlock ./channel-artifacts/healthrecords.block --tls --cafile ${PWD}/organizations/ordererOrganizations/digitalonehealth.com/orderers/orderer.digitalonehealth.com/msp/tlscacerts/tlsca.digitalonehealth.com-cert.pem
    
    # Join Hospital peer to channel
    print_status "Joining Hospital peer to channel..."
    peer channel join -b ./channel-artifacts/healthrecords.block
    
    # Set environment for Research peer
    export CORE_PEER_LOCALMSPID="ResearchMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/research.digitalonehealth.com/peers/peer0.research.digitalonehealth.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/research.digitalonehealth.com/users/Admin@research.digitalonehealth.com/msp
    export CORE_PEER_ADDRESS=localhost:9051
    
    # Join Research peer to channel
    print_status "Joining Research peer to channel..."
    peer channel join -b ./channel-artifacts/healthrecords.block
    
    # Set environment for Individual peer
    export CORE_PEER_LOCALMSPID="IndividualMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/individual.digitalonehealth.com/peers/peer0.individual.digitalonehealth.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/individual.digitalonehealth.com/users/Admin@individual.digitalonehealth.com/msp
    export CORE_PEER_ADDRESS=localhost:11051
    
    # Join Individual peer to channel
    print_status "Joining Individual peer to channel..."
    peer channel join -b ./channel-artifacts/healthrecords.block
    
    print_status "All peers joined channel successfully"
}

# Function to deploy chaincode
deploy_chaincode() {
    print_header "Deploying Health Records Chaincode"
    
    # Package chaincode
    print_status "Packaging chaincode..."
    peer lifecycle chaincode package health-records.tar.gz --path ../chaincode/health-records --lang node --label health-records_1.0
    
    # Install chaincode on Hospital peer
    export CORE_PEER_LOCALMSPID="HospitalMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/hospital.digitalonehealth.com/peers/peer0.hospital.digitalonehealth.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/hospital.digitalonehealth.com/users/Admin@hospital.digitalonehealth.com/msp
    export CORE_PEER_ADDRESS=localhost:7051
    
    print_status "Installing chaincode on Hospital peer..."
    peer lifecycle chaincode install health-records.tar.gz
    
    # Install chaincode on Research peer
    export CORE_PEER_LOCALMSPID="ResearchMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/research.digitalonehealth.com/peers/peer0.research.digitalonehealth.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/research.digitalonehealth.com/users/Admin@research.digitalonehealth.com/msp
    export CORE_PEER_ADDRESS=localhost:9051
    
    print_status "Installing chaincode on Research peer..."
    peer lifecycle chaincode install health-records.tar.gz
    
    # Install chaincode on Individual peer
    export CORE_PEER_LOCALMSPID="IndividualMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/individual.digitalonehealth.com/peers/peer0.individual.digitalonehealth.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/individual.digitalonehealth.com/users/Admin@individual.digitalonehealth.com/msp
    export CORE_PEER_ADDRESS=localhost:11051
    
    print_status "Installing chaincode on Individual peer..."
    peer lifecycle chaincode install health-records.tar.gz
    
    # Get package ID
    PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | jq -r '.installed_chaincodes[0].package_id')
    print_status "Package ID: $PACKAGE_ID"
    
    # Approve chaincode for each organization
    print_status "Approving chaincode for Hospital..."
    export CORE_PEER_LOCALMSPID="HospitalMSP"
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/hospital.digitalonehealth.com/users/Admin@hospital.digitalonehealth.com/msp
    export CORE_PEER_ADDRESS=localhost:7051
    peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.digitalonehealth.com --tls --cafile ${PWD}/organizations/ordererOrganizations/digitalonehealth.com/orderers/orderer.digitalonehealth.com/msp/tlscacerts/tlsca.digitalonehealth.com-cert.pem --channelID healthrecords --name health-records --version 1.0 --package-id $PACKAGE_ID --sequence 1
    
    print_status "Approving chaincode for Research..."
    export CORE_PEER_LOCALMSPID="ResearchMSP"
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/research.digitalonehealth.com/users/Admin@research.digitalonehealth.com/msp
    export CORE_PEER_ADDRESS=localhost:9051
    peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.digitalonehealth.com --tls --cafile ${PWD}/organizations/ordererOrganizations/digitalonehealth.com/orderers/orderer.digitalonehealth.com/msp/tlscacerts/tlsca.digitalonehealth.com-cert.pem --channelID healthrecords --name health-records --version 1.0 --package-id $PACKAGE_ID --sequence 1
    
    print_status "Approving chaincode for Individual..."
    export CORE_PEER_LOCALMSPID="IndividualMSP"
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/individual.digitalonehealth.com/users/Admin@individual.digitalonehealth.com/msp
    export CORE_PEER_ADDRESS=localhost:11051
    peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.digitalonehealth.com --tls --cafile ${PWD}/organizations/ordererOrganizations/digitalonehealth.com/orderers/orderer.digitalonehealth.com/msp/tlscacerts/tlsca.digitalonehealth.com-cert.pem --channelID healthrecords --name health-records --version 1.0 --package-id $PACKAGE_ID --sequence 1
    
    # Commit chaincode
    print_status "Committing chaincode..."
    peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.digitalonehealth.com --tls --cafile ${PWD}/organizations/ordererOrganizations/digitalonehealth.com/orderers/orderer.digitalonehealth.com/msp/tlscacerts/tlsca.digitalonehealth.com-cert.pem --channelID healthrecords --name health-records --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/hospital.digitalonehealth.com/peers/peer0.hospital.digitalonehealth.com/tls/ca.crt --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/research.digitalonehealth.com/peers/peer0.research.digitalonehealth.com/tls/ca.crt --peerAddresses localhost:11051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/individual.digitalonehealth.com/peers/peer0.individual.digitalonehealth.com/tls/ca.crt --version 1.0 --sequence 1
    
    # Initialize ledger
    print_status "Initializing ledger..."
    peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.digitalonehealth.com --tls --cafile ${PWD}/organizations/ordererOrganizations/digitalonehealth.com/orderers/orderer.digitalonehealth.com/msp/tlscacerts/tlsca.digitalonehealth.com-cert.pem -C healthrecords -n health-records --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/hospital.digitalonehealth.com/peers/peer0.hospital.digitalonehealth.com/tls/ca.crt --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/research.digitalonehealth.com/peers/peer0.research.digitalonehealth.com/tls/ca.crt -c '{"function":"initLedger","Args":[]}'
    
    print_status "Chaincode deployed and initialized successfully"
}

# Function to stop the network
stop_network() {
    print_header "Stopping Digital One Health Network"
    
    docker-compose -f docker-compose.yml down --volumes --remove-orphans
    docker system prune -f
    
    print_status "Network stopped and cleaned up"
}

# Function to clean up everything
cleanup() {
    print_header "Cleaning Up Network Artifacts"
    
    stop_network
    
    # Remove generated artifacts
    rm -rf organizations
    rm -rf system-genesis-block
    rm -rf channel-artifacts
    rm -f health-records.tar.gz
    rm -f crypto-config.yaml
    
    print_status "Cleanup completed"
}

# Main script logic
case "$1" in
    "up")
        print_header "Starting Digital One Health Hyperledger Fabric Network"
        generate_crypto
        generate_genesis
        start_network
        create_channel
        deploy_chaincode
        print_status "Network is ready! 🎉"
        ;;
    "down")
        stop_network
        ;;
    "clean")
        cleanup
        ;;
    "restart")
        cleanup
        $0 up
        ;;
    *)
        echo "Usage: $0 {up|down|clean|restart}"
        echo ""
        echo "Commands:"
        echo "  up       - Start the complete network"
        echo "  down     - Stop the network"
        echo "  clean    - Clean up all artifacts and containers"
        echo "  restart  - Clean and restart the network"
        exit 1
        ;;
esac