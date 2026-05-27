#!/bin/bash
set -e

# Make sure the bin folder containing cryptogen, configtxgen etc is in the PATH
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="${SCRIPT_DIR}/../bin:$PATH"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${GREEN}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   AASTU Certificate System — Full Deploy     ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

run_step() {
  local num="$1"
  local label="$2"
  local script="$3"

  echo -e "\n${YELLOW}▶ Running Step $num: $label${NC}"
  bash "$SCRIPT_DIR/$script"
  echo -e "${GREEN}✓ Step $num done${NC}\n"
  sleep 2
}

run_step 1 "Generate crypto material"   "01-generate-crypto.sh"
run_step 2 "Start Docker network"        "02-start-network.sh"
run_step 3 "Create channel"              "03-create-channel.sh"
run_step 4 "Deploy chaincode"            "04-deploy-chaincode.sh"
run_step 5 "Enroll identities"           "05-enroll-users.sh"

echo -e "${GREEN}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   ALL STEPS COMPLETE — System is live!       ║"
echo "  ╠══════════════════════════════════════════════╣"
echo "  ║   Start the backend:                         ║"
echo "  ║     cd backend && npm run dev                ║"
echo "  ║                                              ║"
echo "  ║   Health check:                              ║"
echo "  ║     curl http://localhost:3000/health        ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"