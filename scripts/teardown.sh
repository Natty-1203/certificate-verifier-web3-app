#!/bin/bash

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$SCRIPT_DIR/../network"

echo -e "${YELLOW}Tearing down the network...${NC}"

cd "$NETWORK_DIR"
docker compose down --volumes --remove-orphans

echo -e "${YELLOW}Removing generated crypto material...${NC}"
rm -rf crypto-config channel-artifacts fabric-ca-client

echo -e "${YELLOW}Removing chaincode containers & images...${NC}"
docker rm -f $(docker ps -aq --filter "name=dev-peer") 2>/dev/null || true
docker rmi -f $(docker images --filter=reference='dev-peer*' -q) 2>/dev/null || true

echo -e "${GREEN}✓ Everything cleaned up${NC}"