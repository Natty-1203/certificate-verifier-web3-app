'use strict';

const { create } = require('kubo-rpc-client');
const crypto     = require('crypto');
const logger     = require('./logger');

// Connect to our IPFS node running in Docker
const ipfs = create({
    url: process.env.IPFS_API_URL || 'http://localhost:5001',
});

/**
 * Upload a file buffer to IPFS.
 * Returns the CID (Content Identifier) — the IPFS address of the file.
 *
 * The CID is deterministic — same file always produces same CID.
 * This is what we store on the blockchain.
 */
async function uploadToIPFS(fileBuffer, filename) {
    try {
        logger.info(`Uploading ${filename} to IPFS...`);

        const result = await ipfs.add(
            { path: filename, content: fileBuffer },
            { pin: true }   // pin = keep file permanently on this node
        );

        const cid = result.cid.toString();
        logger.info(`File uploaded to IPFS. CID: ${cid}`);

        return {
            cid,
            size:        result.size,
            gatewayURL:  `${process.env.IPFS_GATEWAY_URL}/${cid}`,
        };

    } catch (error) {
        throw new Error(`IPFS upload failed: ${error.message}`);
    }
}

/**
 * Compute SHA-256 hash of a file buffer.
 * This hash is what gets stored on the blockchain for tamper detection.
 *
 * If anyone modifies the PDF:
 *   - The file hash changes
 *   - The hash no longer matches what is on the blockchain
 *   - Verification fails → forgery detected
 */
function computeSHA256(fileBuffer) {
    return crypto
        .createHash('sha256')
        .update(fileBuffer)
        .digest('hex');
}

/**
 * Retrieve a file from IPFS by its CID.
 * Used to fetch the certificate PDF for display or download.
 */
async function getFromIPFS(cid) {
    try {
        const chunks = [];

        for await (const chunk of ipfs.cat(cid)) {
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);

    } catch (error) {
        throw new Error(`IPFS retrieval failed for CID ${cid}: ${error.message}`);
    }
}

/**
 * Verify that a file retrieved from IPFS matches
 * the hash stored on the blockchain.
 *
 * This is the core tamper-detection mechanism:
 *   1. Fetch PDF from IPFS using the CID stored on-chain
 *   2. Compute its hash
 *   3. Compare with hash stored on blockchain
 *   4. If they match → file is authentic
 *   5. If they differ → file was tampered with
 */
async function verifyFileIntegrity(cid, expectedHash) {
    try {
        const fileBuffer   = await getFromIPFS(cid);
        const actualHash   = computeSHA256(fileBuffer);
        const isAuthentic  = actualHash === expectedHash.toLowerCase();

        return {
            isAuthentic,
            actualHash,
            expectedHash: expectedHash.toLowerCase(),
            message: isAuthentic
                ? 'File integrity verified — document is authentic'
                : 'File integrity FAILED — document may have been tampered with',
        };

    } catch (error) {
        throw new Error(`Integrity check failed: ${error.message}`);
    }
}

/**
 * Check if the IPFS node is reachable.
 */
async function isIPFSReady() {
    try {
        const version = await ipfs.version();
        return { ready: true, version: version.version };
    } catch {
        return { ready: false, version: null };
    }
}

module.exports = {
    uploadToIPFS,
    computeSHA256,
    getFromIPFS,
    verifyFileIntegrity,
    isIPFSReady,
};