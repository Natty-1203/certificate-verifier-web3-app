#!/bin/bash
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

CHANNEL_NAME="certificate-channel"
CHAINCODE_NAME="certificate-chaincode"
CHAINCODE_VERSION="1.0"
CHAINCODE_SEQUENCE="1"
ORDERER="orderer.example.com:7050"
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
PEER_TLS_ROOTCERT="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
CHAINCODE_SRC_PATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$SCRIPT_DIR/../network"

echo -e "${YELLOW}======================================================${NC}"
echo -e "${YELLOW}  STEP 4: Deploying chaincode: $CHAINCODE_NAME${NC}"
echo -e "${YELLOW}======================================================${NC}"

# ── 4.1 Generate package-lock.json locally BEFORE packaging ──────────────────
echo -e "\n${YELLOW}Installing chaincode dependencies locally...${NC}"
cd "$SCRIPT_DIR/../chaincode"

# Use lockfile v2 for compatibility with Fabric nodeenv (npm 8 / Node 16).
npm install --package-lock-only --lockfile-version=2 --ignore-scripts --silent

if [ ! -f "package-lock.json" ]; then
  echo -e "${RED}ERROR: package-lock.json not generated. Check chaincode/package.json${NC}"
    exit 1
fi
echo -e "${GREEN}✓ package-lock.json ready${NC}"

cd "$NETWORK_DIR"

# Prevent MSYS path conversion on Windows Git Bash for Docker arguments.
export MSYS_NO_PATHCONV=1
export MSYS2_NO_PATHCONV=1

# ── 4.2 Package the chaincode ─────────────────────────────────────────────────
echo -e "\n${YELLOW}Packaging chaincode...${NC}"
docker exec cli peer lifecycle chaincode package \
  /tmp/${CHAINCODE_NAME}.tar.gz \
  --path "$CHAINCODE_SRC_PATH" \
  --lang node \
  --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}
echo -e "${GREEN}✓ Chaincode packaged${NC}"

# ── 4.3 Install the chaincode on the peer ────────────────────────────────────
echo -e "\n${YELLOW}Installing chaincode on peer...${NC}"
docker exec cli peer lifecycle chaincode install \
  /tmp/${CHAINCODE_NAME}.tar.gz
echo -e "${GREEN}✓ Chaincode installed${NC}"

# ── 4.4 Get the package ID ────────────────────────────────────────────────────
echo -e "\n${YELLOW}Getting package ID...${NC}"
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled 2>/dev/null \
  | grep "${CHAINCODE_NAME}_${CHAINCODE_VERSION}" \
  | sed 's/Package ID: //' \
  | sed 's/, Label:.*//' \
  | tr -d '[:space:]')

if [ -z "$PACKAGE_ID" ]; then
    echo -e "${RED}ERROR: Could not find package ID. Was chaincode installed?${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Package ID: $PACKAGE_ID${NC}"

# ── 4.5 Approve for Org1 ──────────────────────────────────────────────────────
echo -e "\n${YELLOW}Approving chaincode for Org1MSP...${NC}"
docker exec cli peer lifecycle chaincode approveformyorg \
  -o $ORDERER \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA
echo -e "${GREEN}✓ Chaincode approved${NC}"

# ── 4.6 Check commit readiness ────────────────────────────────────────────────
echo -e "\n${YELLOW}Checking commit readiness...${NC}"
docker exec cli peer lifecycle chaincode checkcommitreadiness \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --sequence $CHAINCODE_SEQUENCE \
  --output json \
  --tls \
  --cafile $ORDERER_CA

# ── 4.7 Commit the chaincode ──────────────────────────────────────────────────
echo -e "\n${YELLOW}Committing chaincode to channel...${NC}"
docker exec cli peer lifecycle chaincode commit \
  -o $ORDERER \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --sequence $CHAINCODE_SEQUENCE \
  --tls \
  --cafile $ORDERER_CA \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles $PEER_TLS_ROOTCERT
echo -e "${GREEN}✓ Chaincode committed${NC}"

# ── 4.8 Invoke InitLedger ─────────────────────────────────────────────────────
echo -e "\n${YELLOW}Initializing ledger...${NC}"
docker exec cli peer chaincode invoke \
  -o $ORDERER \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  -c '{"function":"InitLedger","Args":[]}' \
  --tls \
  --cafile $ORDERER_CA \
  --peerAddresses peer0.org1.example.com:7051 \
  --tlsRootCertFiles $PEER_TLS_ROOTCERT

sleep 3
echo -e "${GREEN}✓ Ledger initialized${NC}"

echo -e "\n${GREEN}======================================================"
echo -e "  STEP 4 COMPLETE — Chaincode is live"
echo -e "======================================================${NC}"