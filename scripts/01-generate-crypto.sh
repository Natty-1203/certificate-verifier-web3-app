#!/bin/bash
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${YELLOW}======================================================${NC}"
echo -e "${YELLOW}  STEP 1: Generating crypto material & channel artifacts${NC}"
echo -e "${YELLOW}======================================================${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$SCRIPT_DIR/../network"
cd "$NETWORK_DIR"

echo -e "\n${YELLOW}Cleaning previous crypto material...${NC}"
rm -rf crypto-config channel-artifacts
mkdir -p channel-artifacts

echo -e "\n${YELLOW}Running cryptogen...${NC}"
cryptogen generate \
  --config=./crypto-config.yaml \
  --output=./crypto-config
echo -e "${GREEN}✓ Crypto material generated${NC}"

# ── FIX: Windows generates backslashes — convert to forward slashes ───────────
echo -e "\n${YELLOW}Fixing path separators in MSP config files...${NC}"
find ./crypto-config -name "config.yaml" | while read f; do
    sed -i 's/\\/\//g' "$f"
done
echo -e "${GREEN}✓ Path separators fixed${NC}"

echo -e "\n${YELLOW}Generating genesis block...${NC}"
configtxgen \
  -profile      CertificateOrdererGenesis \
  -channelID    system-channel \
  -outputBlock  ./channel-artifacts/genesis.block \
  -configPath   .
echo -e "${GREEN}✓ Genesis block created${NC}"

echo -e "\n${YELLOW}Generating channel transaction...${NC}"
configtxgen \
  -profile               CertificateChannel \
  -outputCreateChannelTx ./channel-artifacts/certificate-channel.tx \
  -channelID             certificate-channel \
  -configPath            .
echo -e "${GREEN}✓ Channel transaction created${NC}"

echo -e "\n${YELLOW}Generating anchor peer update...${NC}"
configtxgen \
  -profile             CertificateChannel \
  -outputAnchorPeersUpdate ./channel-artifacts/Org1MSPanchors.tx \
  -channelID           certificate-channel \
  -asOrg               Org1MSP \
  -configPath          .
echo -e "${GREEN}✓ Anchor peer update created${NC}"

echo -e "\n${GREEN}======================================================"
echo -e "  STEP 1 COMPLETE"
echo -e "======================================================${NC}"