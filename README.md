# Certificate System

A decentralized certificate issuance and verification system based on Hyperledger Fabric and IPFS.

## Project Structure

- **backend/**: Node.js Express application that exposes REST APIs to interact with the blockchain and IPFS.
- **chaincode/**: Hyperledger Fabric smart contracts containing the business logic for the certificate system.
- **network/**: Configuration files and generated artifacts to setup the Hyperledger Fabric network (docker-compose, configtx, etc.).
- **scripts/**: Shell scripts to easily start, stop, and configure the basic network components, generate crypto material, and deploy chaincode.
