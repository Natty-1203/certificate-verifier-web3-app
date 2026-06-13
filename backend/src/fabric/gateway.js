'use strict';

const { connectGateway, getContract } = require('./connection');
const logger = require('../utils/logger');

const FABRIC_ENABLED = process.env.FABRIC_ENABLED !== 'false';

let fabricAvailable = true;

async function tryConnect(role) {
    try {
        const result = await connectGateway(role);
        fabricAvailable = true;
        return result;
    } catch (err) {
        const isUnavailable = !FABRIC_ENABLED
            || err.message?.includes('ECONNREFUSED')
            || err.code === 14
            || err.code === 'ENOENT'
            || err.message?.includes('not found')
            || err.message?.includes('Failed to connect');
        if (isUnavailable) {
            fabricAvailable = false;
            const e = new Error('FABRIC_UNAVAILABLE');
            e.fabricUnavailable = true;
            throw e;
        }
        throw err;
    }
}

async function submitTransaction(role, fnName, ...args) {
    const { gateway, client } = await tryConnect(role);
    try {
        const contract    = await getContract(gateway);
        const stringArgs  = args.map(a => String(a));
        const resultBytes = await contract.submitTransaction(fnName, ...stringArgs);
        return JSON.parse(Buffer.from(resultBytes).toString());
    } catch (err) {
        if (isConnectionError(err)) {
            fabricAvailable = false;
            const e = new Error('FABRIC_UNAVAILABLE');
            e.fabricUnavailable = true;
            throw e;
        }
        throw err;
    } finally {
        gateway.close();
        client.close();
    }
}

async function evaluateTransaction(role, fnName, ...args) {
    const { gateway, client } = await tryConnect(role);
    try {
        const contract    = await getContract(gateway);
        const stringArgs  = args.map(a => String(a));
        const resultBytes = await contract.evaluateTransaction(fnName, ...stringArgs);
        return JSON.parse(Buffer.from(resultBytes).toString());
    } catch (err) {
        if (isConnectionError(err)) {
            fabricAvailable = false;
            const e = new Error('FABRIC_UNAVAILABLE');
            e.fabricUnavailable = true;
            throw e;
        }
        throw err;
    } finally {
        gateway.close();
        client.close();
    }
}

function isConnectionError(err) {
    return !FABRIC_ENABLED
        || err.code === 14
        || err.code === 'UNAVAILABLE'
        || err.message?.includes('ECONNREFUSED')
        || err.message?.includes('Failed to connect');
}

// ── Fallback implementations for when Fabric is not running ──────────────────

const fallbackCerts = new Map();

function fallbackIssueCertificate(data) {
    const record = {
        certificateID: data.certificateID,
        studentName: data.studentName,
        studentID: data.studentID,
        department: data.department,
        cgpa: data.cgpa,
        graduationYear: data.graduationYear,
        sha256Hash: data.sha256Hash,
        ipfsCID: data.ipfsCID,
        isRevoked: false,
        issuedAt: new Date().toISOString(),
        issuerMSP: 'Org1MSP',
        docType: 'certificate',
    };
    fallbackCerts.set(data.certificateID, record);
    fallbackCerts.set(data.sha256Hash, data.certificateID);
    logger.info(`[FALLBACK FABRIC] Certificate issued: ${data.certificateID}`);
    return { success: true, certificateID: data.certificateID };
}

function fallbackVerifyCertificate(certificateID) {
    const cert = fallbackCerts.get(certificateID);
    if (!cert) {
        return { exists: false, isRevoked: false, certificate: null };
    }
    return { exists: true, isRevoked: cert.isRevoked, certificate: cert };
}

function fallbackFindByHash(hash) {
    const certId = fallbackCerts.get(hash);
    if (!certId) return fallbackVerifyCertificate(hash);
    return fallbackVerifyCertificate(certId);
}

function fallbackRevokeCertificate(certificateID, reason) {
    const cert = fallbackCerts.get(certificateID);
    if (cert) {
        cert.isRevoked = true;
        cert.revocationReason = reason;
        cert.revokedAt = new Date().toISOString();
        logger.info(`[FALLBACK FABRIC] Certificate revoked: ${certificateID}`);
    }
    return { success: true };
}

function fallbackFindByStudentID(studentID) {
    const results = [];
    for (const [, cert] of fallbackCerts) {
        if (typeof cert === 'object' && cert.studentID === studentID) {
            results.push(cert);
        }
    }
    return results;
}

// ── Exported gateway with automatic fallback ─────────────────────────────────

function isFallback() {
    return !FABRIC_ENABLED || !fabricAvailable;
}

const fabricGateway = {

    async issueCertificate(data) {
        try {
            return await submitTransaction('ISSUER', 'IssueCertificate',
                data.certificateID, data.studentName, data.studentID,
                data.department, data.cgpa, data.graduationYear,
                data.sha256Hash, data.ipfsCID
            );
        } catch (err) {
            if (err.fabricUnavailable) {
                logger.warn('[FALLBACK] Fabric unavailable — issuing via local store');
                return fallbackIssueCertificate(data);
            }
            throw err;
        }
    },

    async verifyCertificate(certificateID) {
        try {
            return await evaluateTransaction('STUDENT', 'VerifyCertificate', certificateID);
        } catch (err) {
            if (err.fabricUnavailable) {
                return fallbackVerifyCertificate(certificateID);
            }
            throw err;
        }
    },

    async verifyByHash(sha256Hash) {
        try {
            return await evaluateTransaction('STUDENT', 'VerifyByHash', sha256Hash);
        } catch (err) {
            if (err.fabricUnavailable) {
                return fallbackFindByHash(sha256Hash);
            }
            throw err;
        }
    },

    async revokeCertificate(certificateID, reason) {
        try {
            return await submitTransaction('ADMIN', 'RevokeCertificate', certificateID, reason);
        } catch (err) {
            if (err.fabricUnavailable) {
                return fallbackRevokeCertificate(certificateID, reason);
            }
            throw err;
        }
    },

    async queryCertificateHistory(certificateID) {
        try {
            return await evaluateTransaction('ADMIN', 'QueryCertificateHistory', certificateID);
        } catch (err) {
            if (err.fabricUnavailable) return [];
            throw err;
        }
    },

    async getCertificate(certificateID) {
        try {
            return await evaluateTransaction('ADMIN', 'GetCertificate', certificateID);
        } catch (err) {
            if (err.fabricUnavailable) return null;
            throw err;
        }
    },

    async findByStudentID(studentID) {
        try {
            return await evaluateTransaction('STUDENT', 'FindByStudentID', studentID);
        } catch (err) {
            if (err.fabricUnavailable) return fallbackFindByStudentID(studentID);
            throw err;
        }
    },
};

module.exports = fabricGateway;
