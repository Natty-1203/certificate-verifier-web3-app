'use strict';

const grpc   = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ── Project root & dotenv ─────────────────────────────────────────────────────
// connection.js is at: certificate-system/backend/src/fabric/connection.js
// 3 levels up        : certificate-system/
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

// Explicitly tell dotenv WHERE the .env file is
// backend/.env = certificate-system/backend/.env
require('dotenv').config({
    path: path.resolve(__dirname, '../../.env')
});

// ── for Debuging — 
/*console.log('PROJECT_ROOT  :', PROJECT_ROOT);
console.log('TLS cert path :', process.env.FABRIC_TLS_CERT_PATH);
console.log('ISSUER cert   :', process.env.FABRIC_CERT_PATH_ISSUER);*/

// ── Resolve a .env path (relative to project root) → absolute path ────────────
function resolvePath(envPath) {
    if (!envPath) return null;
    return path.resolve(PROJECT_ROOT, envPath);
}

// ── Get role paths LAZILY — called inside functions, not at module load ───────
// This guarantees dotenv has already loaded before we read env vars
function getRolePaths(role) {
    const map = {
        ISSUER: {
            cert: resolvePath(process.env.FABRIC_CERT_PATH_ISSUER),
            key:  resolvePath(process.env.FABRIC_KEY_PATH_ISSUER),
        },
        ADMIN: {
            cert: resolvePath(process.env.FABRIC_CERT_PATH_ADMIN),
            key:  resolvePath(process.env.FABRIC_KEY_PATH_ADMIN),
        },
        STUDENT: {
            cert: resolvePath(process.env.FABRIC_CERT_PATH_STUDENT),
            key:  resolvePath(process.env.FABRIC_KEY_PATH_STUDENT),
        },
    };
    return map[role] || null;
}

// ── Validate required env vars ────────────────────────────────────────────────
function validateEnv() {
    const required = [
        'FABRIC_PEER_ENDPOINT',
        'FABRIC_PEER_HOST_ALIAS',
        'FABRIC_MSP_ID',
        'FABRIC_CHANNEL',
        'FABRIC_CHAINCODE',
        'FABRIC_TLS_CERT_PATH',
        'FABRIC_CERT_PATH_ISSUER',
        'FABRIC_KEY_PATH_ISSUER',
        'FABRIC_CERT_PATH_ADMIN',
        'FABRIC_KEY_PATH_ADMIN',
        'FABRIC_CERT_PATH_STUDENT',
        'FABRIC_KEY_PATH_STUDENT',
    ];

    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        throw new Error(
            `Missing .env variables:\n  ${missing.join('\n  ')}\n` +
            `Check: ${path.resolve(__dirname, '../../.env')}`
        );
    }
}

function loadTLSCredentials() {
    const tlsCertPath = resolvePath(process.env.FABRIC_TLS_CERT_PATH);

    if (!fs.existsSync(tlsCertPath)) {
        throw new Error(
            `TLS cert not found at:\n  ${tlsCertPath}\n` +
            `Did you run scripts/01-generate-crypto.sh ?`
        );
    }

    return grpc.credentials.createSsl(fs.readFileSync(tlsCertPath));
}

function loadIdentity(role) {
    const paths = getRolePaths(role);

    if (!paths?.cert) {
        throw new Error(`No cert path configured for role: ${role}`);
    }

    if (!fs.existsSync(paths.cert)) {
        throw new Error(
            `Identity cert not found for role ${role} at:\n  ${paths.cert}\n` +
            `Did you run scripts/05-enroll-users.sh ?`
        );
    }

    return {
        mspId:       process.env.FABRIC_MSP_ID,
        credentials: fs.readFileSync(paths.cert),
    };
}

function loadSigner(role) {
    const paths = getRolePaths(role);

    if (!paths?.key) {
        throw new Error(`No key path configured for role: ${role}`);
    }

    if (!fs.existsSync(paths.key)) {
        throw new Error(
            `Key directory not found for role ${role} at:\n  ${paths.key}\n` +
            `Did you run scripts/05-enroll-users.sh ?`
        );
    }

    const keyFiles = fs.readdirSync(paths.key);
    if (keyFiles.length === 0) {
        throw new Error(`No private key file found in:\n  ${paths.key}`);
    }

    const privateKey = crypto.createPrivateKey(
        fs.readFileSync(path.join(paths.key, keyFiles[0]))
    );
    return signers.newPrivateKeySigner(privateKey);
}

async function connectGateway(role = 'STUDENT') {
    validateEnv();

    const client = new grpc.Client(
        process.env.FABRIC_PEER_ENDPOINT,
        loadTLSCredentials(),
        { 'grpc.ssl_target_name_override': process.env.FABRIC_PEER_HOST_ALIAS }
    );

    const gateway = connect({
        client,
        identity: loadIdentity(role),
        signer:   loadSigner(role),
        hash:     hash.sha256,
    });

    return { gateway, client };
}

async function getContract(gateway) {
    const network  = gateway.getNetwork(process.env.FABRIC_CHANNEL);
    const contract = network.getContract(
        process.env.FABRIC_CHAINCODE,
        'CertificateContract'
    );
    return contract;
}

module.exports = { connectGateway, getContract };