'use strict';

const crypto = require('crypto');

/**
 * Build the composite key used to store a certificate on the ledger.
 * Format:  CERT~{certificateID}
 */
function certKey(ctx, certificateID) {
    return ctx.stub.createCompositeKey('CERT', [certificateID]);
}

/**
 * Build the composite key used to index a certificate by its SHA-256 hash.
 * Format:  HASH~{sha256Hash}
 * Value stored: the certificateID it maps to
 */
function hashKey(ctx, sha256Hash) {
    return ctx.stub.createCompositeKey('HASH', [sha256Hash.toLowerCase()]);
}

/**
 * Read a certificate from the ledger by its certificateID.
 * Returns the parsed object or null if not found.
 */
async function getCertFromLedger(ctx, certificateID) {
    const key  = certKey(ctx, certificateID);
    const data = await ctx.stub.getState(key);
    if (!data || data.length === 0) return null;
    return JSON.parse(data.toString());
}

/**
 * Write a certificate back to the ledger.
 */
async function putCertToLedger(ctx, cert) {
    const key = certKey(ctx, cert.certificateID);
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(cert)));
}

/**
 * Write the hash → certificateID reverse index to the ledger.
 */
async function putHashIndex(ctx, sha256Hash, certificateID) {
    const key = hashKey(ctx, sha256Hash);
    await ctx.stub.putState(key, Buffer.from(certificateID));
}

/**
 * Read a certificateID from the hash index.
 * Returns certificateID string or null.
 */
async function getCertIDByHash(ctx, sha256Hash) {
    const key  = hashKey(ctx, sha256Hash.toLowerCase());
    const data = await ctx.stub.getState(key);
    if (!data || data.length === 0) return null;
    return data.toString();
}

/**
 * Compute a SHA-256 hash of any string input.
 * Used for input validation — callers should provide the hash themselves,
 * but we can verify format here.
 */
function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Validate that a string looks like a valid SHA-256 hex hash.
 */
function isValidSHA256(hash) {
    return typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Emit a Fabric chaincode event (visible to backend listeners).
 */
function emitEvent(ctx, eventName, payload) {
    ctx.stub.setEvent(eventName, Buffer.from(JSON.stringify(payload)));
}

module.exports = {
    certKey,
    hashKey,
    getCertFromLedger,
    putCertToLedger,
    putHashIndex,
    getCertIDByHash,
    sha256,
    isValidSHA256,
    emitEvent,
};