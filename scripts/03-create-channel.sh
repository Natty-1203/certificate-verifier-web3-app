#!/bin/bash
set -e

# Prevent Git Bash from converting paths starting with / into Windows paths
export MSYS_NO_PATHCONV=1

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

CHANNEL_NAME="certificate-channel"
ORDERER="orderer.example.com:7050"
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"

echo -e "${YELLOW}======================================================${NC}"
echo -e "${YELLOW}  STEP 3: Creating and joining channel: $CHANNEL_NAME${NC}"
echo -e "${YELLOW}======================================================${NC}"

# ── Create the channel ────────────────────────────────────────────────────────
echo -e "\n${YELLOW}Creating channel...${NC}"
set +e
docker exec cli peer channel create \
  -o $ORDERER \
  -c $CHANNEL_NAME \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.tx \
  --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block \
  --tls \
  --cafile $ORDERER_CA
CREATE_STATUS=$?
set -e

if [ $CREATE_STATUS -ne 0 ]; then
  echo -e "${YELLOW}Channel already exists. Fetching channel block...${NC}"
  docker exec cli peer channel fetch 0 \
    /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block \
    -o $ORDERER \
    -c $CHANNEL_NAME \
    --tls \
    --cafile $ORDERER_CA
else
  echo -e "${GREEN}✓ Channel created${NC}"
fi

# ── Join peer to the channel ──────────────────────────────────────────────────
echo -e "\n${YELLOW}Joining peer to channel...${NC}"
if docker exec cli peer channel list | grep -q "$CHANNEL_NAME"; then
  echo -e "${GREEN}✓ Peer already joined channel${NC}"
else
  docker exec cli peer channel join \
    -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block
  echo -e "${GREEN}✓ Peer joined channel${NC}"
fi

# ── Update anchor peers ───────────────────────────────────────────────────────
echo -e "\n${YELLOW}Updating anchor peer...${NC}"
docker exec cli peer channel update \
  -o $ORDERER \
  -c $CHANNEL_NAME \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/Org1MSPanchors.tx \
  --tls \
  --cafile $ORDERER_CA

echo -e "${GREEN}✓ Anchor peer updated${NC}"

# ── Verify channel membership ─────────────────────────────────────────────────
echo -e "\n${YELLOW}Verifying channel...${NC}"
docker exec cli peer channel list

echo -e "\n${GREEN}======================================================"
echo -e "  STEP 3 COMPLETE — Channel is ready"
echo -e "======================================================${NC}"