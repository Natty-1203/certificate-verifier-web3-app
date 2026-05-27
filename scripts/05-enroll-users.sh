#!/bin/bash
set -e

# Make sure the bin folder containing fabric-ca-client is in the PATH
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="${SCRIPT_DIR}/../bin:$PATH"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$SCRIPT_DIR/../network"

CA_HOST="localhost"
CA_PORT="7054"
CA_NAME="ca-org1"
CA_CERT="$NETWORK_DIR/crypto-config/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem"

# In cryptogen based setup, the CA TLS cert is tlsca.org1.example.com-cert.pem. 
TLS_CERT="$NETWORK_DIR/crypto-config/peerOrganizations/org1.example.com/ca/tls-cert.pem"

FABRIC_CA_CLIENT_HOME="$NETWORK_DIR/fabric-ca-client"
mkdir -p "$FABRIC_CA_CLIENT_HOME"

export FABRIC_CA_CLIENT_HOME

echo -e "${YELLOW}======================================================${NC}"
echo -e "${YELLOW}  STEP 5: Enrolling identities with roles${NC}"
echo -e "${YELLOW}======================================================${NC}"

# ── 5.1 Enroll the bootstrap admin (CA admin, not ledger admin) ───────────────
echo -e "\n${YELLOW}Enrolling CA bootstrap admin...${NC}"
fabric-ca-client.exe enroll \
  -u https://admin:adminpw@${CA_HOST}:${CA_PORT} \
  --caname $CA_NAME \
  --tls.certfiles "$TLS_CERT"

echo -e "${GREEN}✓ CA admin enrolled${NC}"

# ── 5.2 Register & enroll ADMIN user (can revoke + audit) ────────────────────
echo -e "\n${YELLOW}Registering ADMIN user...${NC}"
fabric-ca-client register \
  --caname $CA_NAME \
  --id.name adminUser \
  --id.secret adminpw123 \
  --id.type client \
  --id.attrs 'role=ADMIN:ecert' \
  --tls.certfiles "$TLS_CERT"

echo -e "${YELLOW}Enrolling ADMIN user...${NC}"
fabric-ca-client enroll \
  -u https://adminUser:adminpw123@${CA_HOST}:${CA_PORT} \
  --caname $CA_NAME \
  -M "$FABRIC_CA_CLIENT_HOME/admin-msp" \
  --enrollment.attrs "role" \
  --tls.certfiles "$TLS_CERT"

echo -e "${GREEN}✓ ADMIN user enrolled → $FABRIC_CA_CLIENT_HOME/admin-msp${NC}"

# ── 5.3 Register & enroll ISSUER user (can issue certificates) ───────────────
echo -e "\n${YELLOW}Registering ISSUER user...${NC}"
fabric-ca-client register \
  --caname $CA_NAME \
  --id.name issuerUser \
  --id.secret issuerpw123 \
  --id.type client \
  --id.attrs 'role=ISSUER:ecert' \
  --tls.certfiles "$TLS_CERT"

echo -e "${YELLOW}Enrolling ISSUER user...${NC}"
fabric-ca-client enroll \
  -u https://issuerUser:issuerpw123@${CA_HOST}:${CA_PORT} \
  --caname $CA_NAME \
  -M "$FABRIC_CA_CLIENT_HOME/issuer-msp" \
  --enrollment.attrs "role" \
  --tls.certfiles "$TLS_CERT"

echo -e "${GREEN}✓ ISSUER user enrolled → $FABRIC_CA_CLIENT_HOME/issuer-msp${NC}"

# ── 5.4 Register & enroll STUDENT user (can verify only) ─────────────────────
echo -e "\n${YELLOW}Registering STUDENT user...${NC}"
fabric-ca-client register \
  --caname $CA_NAME \
  --id.name studentUser \
  --id.secret studentpw123 \
  --id.type client \
  --id.attrs 'role=STUDENT:ecert' \
  --tls.certfiles "$TLS_CERT"

echo -e "${YELLOW}Enrolling STUDENT user...${NC}"
fabric-ca-client enroll \
  -u https://studentUser:studentpw123@${CA_HOST}:${CA_PORT} \
  --caname $CA_NAME \
  -M "$FABRIC_CA_CLIENT_HOME/student-msp" \
  --enrollment.attrs "role" \
  --tls.certfiles "$TLS_CERT"

echo -e "${GREEN}✓ STUDENT user enrolled → $FABRIC_CA_CLIENT_HOME/student-msp${NC}"

echo -e "\n${GREEN}======================================================"
echo -e "  STEP 5 COMPLETE — All identities ready"
echo -e "======================================================"
echo -e ""
echo -e "  Credentials summary:"
echo -e "  ADMIN   → adminUser  / adminpw123"
echo -e "  ISSUER  → issuerUser / issuerpw123"
echo -e "  STUDENT → studentUser/ studentpw123"
echo -e "======================================================${NC}"
