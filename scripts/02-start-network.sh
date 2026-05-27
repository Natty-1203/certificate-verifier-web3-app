#!/bin/bash
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${YELLOW}======================================================${NC}"
echo -e "${YELLOW}  STEP 2: Starting Fabric network (Docker)${NC}"
echo -e "${YELLOW}======================================================${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$SCRIPT_DIR/../network"
cd "$NETWORK_DIR"

# ── Tear down any existing containers ────────────────────────────────────────
echo -e "\n${YELLOW}Removing any existing containers...${NC}"
docker compose down --volumes --remove-orphans 2>/dev/null || true

# ── Start containers ──────────────────────────────────────────────────────────
echo -e "\n${YELLOW}Starting containers...${NC}"
docker compose up -d

# ── Wait for containers to be healthy ────────────────────────────────────────
echo -e "\n${YELLOW}Waiting for containers to be ready...${NC}"
sleep 8

# ── Verify all containers are running ────────────────────────────────────────
EXPECTED=("orderer.example.com" "peer0.org1.example.com" "couchdb" "cli" "ca.org1.example.com")

ALL_OK=true
for name in "${EXPECTED[@]}"; do
  STATUS=$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || echo "false")
  if [ "$STATUS" == "true" ]; then
    echo -e "  ${GREEN}✓ $name is running${NC}"
  else
    echo -e "  ${RED}✗ $name is NOT running${NC}"
    ALL_OK=false
  fi
done

if [ "$ALL_OK" = false ]; then
  echo -e "\n${RED}ERROR: Some containers failed to start. Check logs:${NC}"
  echo "  docker compose logs"
  exit 1
fi

echo -e "\n${GREEN}======================================================"
echo -e "  STEP 2 COMPLETE — Network is up"
echo -e "======================================================${NC}"