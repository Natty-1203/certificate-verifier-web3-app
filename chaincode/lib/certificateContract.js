'use strict';

const { Contract } = require('fabric-contract-api');

const { CertificateRecord, AuditEvent, VerificationResult } = require('./models');
const { requireRole, getCallerIdentity, ROLES }              = require('./accessControl');
const {
    getCertFromLedger,
    putCertToLedger,
    putHashIndex,
    getCertIDByHash,
    isValidSHA256,
    emitEvent,
} = require('./utils');

class CertificateContract extends Contract {

    constructor() {
        super('CertificateContract');
    }

    // ── 1. InitLedger ─────────────────────────────────────────────────────────
    async InitLedger(ctx) {
        console.log('CertificateContract: InitLedger called');

        emitEvent(ctx, 'INITIALIZED', {
            message:   'Certificate chaincode initialized successfully',
            timestamp: new Date().toISOString(),
            txID:      ctx.stub.getTxID(),
        });

        return JSON.stringify({ success: true, message: 'Ledger initialized' });
    }

    // ── 2. IssueCertificate ───────────────────────────────────────────────────
    async IssueCertificate(ctx, certificateID, studentName, studentID,
        department, cgpa, graduationYear, sha256Hash, ipfsCID) {

        requireRole(ctx, ROLES.ISSUER);

        if (!certificateID || !studentName || !studentID || !department
            || !cgpa || !graduationYear || !sha256Hash || !ipfsCID) {
            throw new Error('INVALID_INPUT — all fields are required');
        }

        if (!isValidSHA256(sha256Hash)) {
            throw new Error('INVALID_INPUT — sha256Hash must be a 64-character hex string');
        }

        const cgpaNum = parseFloat(cgpa);
        if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 4.0) {
            throw new Error('INVALID_INPUT — cgpa must be a number between 0.0 and 4.0');
        }

        const existing = await getCertFromLedger(ctx, certificateID);
        if (existing) {
            throw new Error(`DUPLICATE — certificate ID "${certificateID}" already exists`);
        }

        const existingHashCertID = await getCertIDByHash(ctx, sha256Hash);
        if (existingHashCertID) {
            throw new Error(
                `DUPLICATE — this document hash already exists under certificate "${existingHashCertID}"`
            );
        }

        const { id: issuerID, msp: issuerMSP } = getCallerIdentity(ctx);

        const cert = new CertificateRecord({
            certificateID,
            studentName,
            studentID,
            department,
            cgpa:           cgpaNum,
            graduationYear: parseInt(graduationYear),
            sha256Hash,
            ipfsCID,
            issuerID,
            issuerMSP,
        });

        await putCertToLedger(ctx, cert);
        await putHashIndex(ctx, sha256Hash, certificateID);

        const event = new AuditEvent({
            type:          'ISSUED',
            certificateID,
            actorID:       issuerID,
            actorMSP:      issuerMSP,
            txID:          ctx.stub.getTxID(),
        });
        emitEvent(ctx, 'CERTIFICATE_ISSUED', event);

        return JSON.stringify({ success: true, certificateID, issuedAt: cert.issuedAt });
    }

    // ── 3. VerifyCertificate ──────────────────────────────────────────────────
    async VerifyCertificate(ctx, certificateID) {
        if (!certificateID) {
            throw new Error('INVALID_INPUT — certificateID is required');
        }

        const cert   = await getCertFromLedger(ctx, certificateID);
        const result = new VerificationResult({
            exists:      !!cert,
            isRevoked:   cert ? cert.isRevoked : false,
            certificate: cert,
        });

        return JSON.stringify(result);
    }

    // ── 4. VerifyByHash ───────────────────────────────────────────────────────
    async VerifyByHash(ctx, sha256Hash) {
        if (!sha256Hash) {
            throw new Error('INVALID_INPUT — sha256Hash is required');
        }

        if (!isValidSHA256(sha256Hash)) {
            throw new Error('INVALID_INPUT — sha256Hash must be a 64-character hex string');
        }

        const certID = await getCertIDByHash(ctx, sha256Hash);

        if (!certID) {
            const result = new VerificationResult({ exists: false, isRevoked: false });
            return JSON.stringify(result);
        }

        return this.VerifyCertificate(ctx, certID);
    }

    // ── 5. RevokeCertificate ──────────────────────────────────────────────────
    async RevokeCertificate(ctx, certificateID, reason) {
        requireRole(ctx, ROLES.ADMIN);

        if (!certificateID) {
            throw new Error('INVALID_INPUT — certificateID is required');
        }

        const cert = await getCertFromLedger(ctx, certificateID);
        if (!cert) {
            throw new Error(`NOT_FOUND — certificate "${certificateID}" does not exist`);
        }

        if (cert.isRevoked) {
            throw new Error(`ALREADY_REVOKED — certificate "${certificateID}" is already revoked`);
        }

        const { id: adminID, msp: adminMSP } = getCallerIdentity(ctx);

        cert.isRevoked        = true;
        cert.revokedBy        = adminID;
        cert.revocationReason = reason || 'No reason provided';
        cert.revokedAt        = new Date().toISOString();

        await putCertToLedger(ctx, cert);

        const event = new AuditEvent({
            type:          'REVOKED',
            certificateID,
            actorID:       adminID,
            actorMSP:      adminMSP,
            txID:          ctx.stub.getTxID(),
        });
        emitEvent(ctx, 'CERTIFICATE_REVOKED', event);

        return JSON.stringify({
            success:   true,
            certificateID,
            revokedAt: cert.revokedAt,
            revokedBy: adminID,
        });
    }

    // ── 6. QueryCertificateHistory ────────────────────────────────────────────
    async QueryCertificateHistory(ctx, certificateID) {
        requireRole(ctx, ROLES.ADMIN);

        if (!certificateID) {
            throw new Error('INVALID_INPUT — certificateID is required');
        }

        const { certKey } = require('./utils');
        const key         = certKey(ctx, certificateID);
        const iterator    = await ctx.stub.getHistoryForKey(key);
        const history     = [];

        let result = await iterator.next();
        while (!result.done) {
            history.push({
                txID:      result.value.txId,
                timestamp: new Date(
                    result.value.timestamp.seconds.low * 1000
                ).toISOString(),
                isDelete:  result.value.isDelete,
                value:     result.value.isDelete
                    ? null
                    : JSON.parse(result.value.value.toString()),
            });
            result = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify({ certificateID, history, count: history.length });
    }

    // ── 7. GetCertificate ─────────────────────────────────────────────────────
    async GetCertificate(ctx, certificateID) {
        requireRole(ctx, [ROLES.ADMIN, ROLES.ISSUER]);

        if (!certificateID) {
            throw new Error('INVALID_INPUT — certificateID is required');
        }

        const cert = await getCertFromLedger(ctx, certificateID);
        if (!cert) {
            throw new Error(`NOT_FOUND — certificate "${certificateID}" does not exist`);
        }

        return JSON.stringify(cert);
    }

    // ── 8. FindByStudentID ────────────────────────────────────────────────────────
// Role: PUBLIC — students can look up their own certificates
async FindByStudentID(ctx, studentID) {
    if (!studentID) {
        throw new Error('INVALID_INPUT — studentID is required');
    }

    // Rich query — requires CouchDB
    const query = JSON.stringify({
        selector: {
            docType:   'certificate',
            studentID: studentID,
        },
        sort: [{ issuedAt: 'desc' }],
    });

    const iterator = await ctx.stub.getQueryResult(query);
    const results  = [];

    let result = await iterator.next();
    while (!result.done) {
        const cert = JSON.parse(result.value.value.toString());
        results.push(cert);
        result = await iterator.next();
    }
    await iterator.close();

    return JSON.stringify(results);
}

}

module.exports = { CertificateContract };