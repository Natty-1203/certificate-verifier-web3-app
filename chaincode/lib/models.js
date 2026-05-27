'use strict';

class CertificateRecord {
    constructor({
        certificateID, studentName, studentID, department,
        cgpa, graduationYear, sha256Hash, ipfsCID, issuerID, issuerMSP,
    }) {
        this.docType          = 'certificate';
        this.certificateID    = certificateID;
        this.studentName      = studentName.trim();
        this.studentID        = studentID;
        this.department       = department;
        this.cgpa             = cgpa;
        this.graduationYear   = graduationYear;
        this.sha256Hash       = sha256Hash.toLowerCase();
        this.ipfsCID          = ipfsCID;
        this.issuerID         = issuerID;
        this.issuerMSP        = issuerMSP;
        this.isRevoked        = false;
        this.revokedBy        = null;
        this.revocationReason = null;
        this.revokedAt        = null;
        this.issuedAt         = new Date().toISOString();
    }
}

class AuditEvent {
    constructor({ type, certificateID, actorID, actorMSP, txID }) {
        this.type          = type;
        this.certificateID = certificateID;
        this.actorID       = actorID;
        this.actorMSP      = actorMSP;
        this.txID          = txID;
        this.timestamp     = new Date().toISOString();
    }
}

class VerificationResult {
    constructor({ exists, isRevoked, certificate = null }) {
        this.exists      = exists;
        this.isValid     = exists && !isRevoked;
        this.isRevoked   = isRevoked;
        this.status      = !exists
            ? 'NOT_FOUND'
            : isRevoked
                ? 'REVOKED'
                : 'VALID';
        this.certificate = certificate;
    }
}

module.exports = { CertificateRecord, AuditEvent, VerificationResult };