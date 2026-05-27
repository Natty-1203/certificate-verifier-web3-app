'use strict';

const { ChaincodeMockStub, Transform } = require('@theledger/fabric-mock-stub');
const CertificateContract = require('../lib/certificateContract');

// ── Test data ─────────────────────────────────────────────────────────────────
const VALID_CERT = {
    certificateID:  'CERT-2024-001',
    studentName:    'Abebe Kebede',
    studentID:      'ETS0123/14',
    department:     'Computer Science',
    cgpa:           '3.85',
    graduationYear: '2024',
    sha256Hash:     'a'.repeat(64),   // valid 64-char hex
    ipfsCID:        'QmXyz123abc',
};

// ── Helper: create a stub with a given role ───────────────────────────────────
function createStub(role = 'ISSUER') {
    const stub = new ChaincodeMockStub('CertificateContract', new CertificateContract());
    // Inject the role attribute into the mock identity
    stub.clientIdentity = {
        getAttributeValue: (key) => key === 'role' ? role : null,
        getID:    () => `CN=${role.toLowerCase()}@org1.example.com`,
        getMSPID: () => 'Org1MSP',
    };
    return stub;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('InitLedger', () => {

    test('should initialize successfully', async () => {
        const stub   = createStub('ADMIN');
        const result = await stub.mockInvoke('tx1', ['InitLedger']);
        expect(result.status).toBe(200);

        const payload = JSON.parse(result.payload.toString());
        expect(payload.success).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('IssueCertificate', () => {

    test('ISSUER can issue a valid certificate', async () => {
        const stub   = createStub('ISSUER');
        const args   = Object.values(VALID_CERT);
        const result = await stub.mockInvoke('tx2', ['IssueCertificate', ...args]);

        expect(result.status).toBe(200);
        const payload = JSON.parse(result.payload.toString());
        expect(payload.success).toBe(true);
        expect(payload.certificateID).toBe(VALID_CERT.certificateID);
    });

    test('ADMIN cannot issue a certificate', async () => {
        const stub   = createStub('ADMIN');
        const args   = Object.values(VALID_CERT);
        const result = await stub.mockInvoke('tx3', ['IssueCertificate', ...args]);

        expect(result.status).toBe(500);
        expect(result.message).toContain('ACCESS DENIED');
    });

    test('STUDENT cannot issue a certificate', async () => {
        const stub   = createStub('STUDENT');
        const result = await stub.mockInvoke('tx4', ['IssueCertificate', ...Object.values(VALID_CERT)]);

        expect(result.status).toBe(500);
        expect(result.message).toContain('ACCESS DENIED');
    });

    test('rejects duplicate certificateID', async () => {
        const stub = createStub('ISSUER');
        const args = Object.values(VALID_CERT);

        // First issue — should succeed
        await stub.mockInvoke('tx5', ['IssueCertificate', ...args]);

        // Second issue with same ID — should fail
        const result = await stub.mockInvoke('tx6', ['IssueCertificate', ...args]);
        expect(result.status).toBe(500);
        expect(result.message).toContain('DUPLICATE');
    });

    test('rejects duplicate sha256Hash', async () => {
        const stub = createStub('ISSUER');

        // Issue first cert
        await stub.mockInvoke('tx7', ['IssueCertificate', ...Object.values(VALID_CERT)]);

        // Issue second cert with different ID but same hash
        const cert2 = { ...VALID_CERT, certificateID: 'CERT-2024-002' };
        const result = await stub.mockInvoke('tx8', ['IssueCertificate', ...Object.values(cert2)]);

        expect(result.status).toBe(500);
        expect(result.message).toContain('DUPLICATE');
    });

    test('rejects invalid sha256Hash format', async () => {
        const stub    = createStub('ISSUER');
        const badCert = { ...VALID_CERT, sha256Hash: 'not-a-valid-hash' };
        const result  = await stub.mockInvoke('tx9', ['IssueCertificate', ...Object.values(badCert)]);

        expect(result.status).toBe(500);
        expect(result.message).toContain('INVALID_INPUT');
    });

    test('rejects cgpa above 4.0', async () => {
        const stub    = createStub('ISSUER');
        const badCert = { ...VALID_CERT, cgpa: '4.5' };
        const result  = await stub.mockInvoke('tx10', ['IssueCertificate', ...Object.values(badCert)]);

        expect(result.status).toBe(500);
        expect(result.message).toContain('INVALID_INPUT');
    });

    test('rejects missing required fields', async () => {
        const stub   = createStub('ISSUER');
        const result = await stub.mockInvoke('tx11', ['IssueCertificate', 'CERT-001']);

        expect(result.status).toBe(500);
        expect(result.message).toContain('INVALID_INPUT');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('VerifyCertificate', () => {

    test('returns VALID for an existing certificate', async () => {
        const stub = createStub('ISSUER');
        await stub.mockInvoke('tx12', ['IssueCertificate', ...Object.values(VALID_CERT)]);

        // Anyone can verify — switch to STUDENT
        stub.clientIdentity.getAttributeValue = () => 'STUDENT';
        const result = await stub.mockInvoke('tx13', ['VerifyCertificate', VALID_CERT.certificateID]);

        expect(result.status).toBe(200);
        const payload = JSON.parse(result.payload.toString());
        expect(payload.status).toBe('VALID');
        expect(payload.isValid).toBe(true);
    });

    test('returns NOT_FOUND for unknown certificateID', async () => {
        const stub   = createStub('STUDENT');
        const result = await stub.mockInvoke('tx14', ['VerifyCertificate', 'UNKNOWN-ID']);

        expect(result.status).toBe(200);
        const payload = JSON.parse(result.payload.toString());
        expect(payload.status).toBe('NOT_FOUND');
        expect(payload.exists).toBe(false);
    });

    test('returns REVOKED after revocation', async () => {
        const stub = createStub('ISSUER');
        await stub.mockInvoke('tx15', ['IssueCertificate', ...Object.values(VALID_CERT)]);

        // Revoke as ADMIN
        stub.clientIdentity.getAttributeValue = () => 'ADMIN';
        await stub.mockInvoke('tx16', ['RevokeCertificate', VALID_CERT.certificateID, 'Test revocation']);

        // Verify as STUDENT
        stub.clientIdentity.getAttributeValue = () => 'STUDENT';
        const result = await stub.mockInvoke('tx17', ['VerifyCertificate', VALID_CERT.certificateID]);

        const payload = JSON.parse(result.payload.toString());
        expect(payload.status).toBe('REVOKED');
        expect(payload.isValid).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('VerifyByHash', () => {

    test('returns VALID when hash matches an issued cert', async () => {
        const stub = createStub('ISSUER');
        await stub.mockInvoke('tx18', ['IssueCertificate', ...Object.values(VALID_CERT)]);

        const result = await stub.mockInvoke('tx19', ['VerifyByHash', VALID_CERT.sha256Hash]);
        const payload = JSON.parse(result.payload.toString());
        expect(payload.status).toBe('VALID');
    });

    test('returns NOT_FOUND for unknown hash', async () => {
        const stub   = createStub('STUDENT');
        const result = await stub.mockInvoke('tx20', ['VerifyByHash', 'b'.repeat(64)]);
        const payload = JSON.parse(result.payload.toString());
        expect(payload.status).toBe('NOT_FOUND');
    });

    test('rejects invalid hash format', async () => {
        const stub   = createStub('STUDENT');
        const result = await stub.mockInvoke('tx21', ['VerifyByHash', 'bad-hash']);
        expect(result.status).toBe(500);
        expect(result.message).toContain('INVALID_INPUT');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('RevokeCertificate', () => {

    test('ADMIN can revoke an existing certificate', async () => {
        const stub = createStub('ISSUER');
        await stub.mockInvoke('tx22', ['IssueCertificate', ...Object.values(VALID_CERT)]);

        stub.clientIdentity.getAttributeValue = () => 'ADMIN';
        const result = await stub.mockInvoke('tx23', ['RevokeCertificate', VALID_CERT.certificateID, 'Fraud detected']);

        expect(result.status).toBe(200);
        const payload = JSON.parse(result.payload.toString());
        expect(payload.success).toBe(true);
    });

    test('ISSUER cannot revoke', async () => {
        const stub = createStub('ISSUER');
        await stub.mockInvoke('tx24', ['IssueCertificate', ...Object.values(VALID_CERT)]);

        const result = await stub.mockInvoke('tx25', ['RevokeCertificate', VALID_CERT.certificateID, 'reason']);
        expect(result.status).toBe(500);
        expect(result.message).toContain('ACCESS DENIED');
    });

    test('cannot revoke a certificate that is already revoked', async () => {
        const stub = createStub('ISSUER');
        await stub.mockInvoke('tx26', ['IssueCertificate', ...Object.values(VALID_CERT)]);

        stub.clientIdentity.getAttributeValue = () => 'ADMIN';
        await stub.mockInvoke('tx27', ['RevokeCertificate', VALID_CERT.certificateID, 'First revoke']);

        // Try to revoke again
        const result = await stub.mockInvoke('tx28', ['RevokeCertificate', VALID_CERT.certificateID, 'Second revoke']);
        expect(result.status).toBe(500);
        expect(result.message).toContain('ALREADY_REVOKED');
    });

    test('cannot revoke a non-existent certificate', async () => {
        const stub   = createStub('ADMIN');
        const result = await stub.mockInvoke('tx29', ['RevokeCertificate', 'FAKE-ID', 'reason']);
        expect(result.status).toBe(500);
        expect(result.message).toContain('NOT_FOUND');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GetCertificate', () => {

    test('ADMIN can get a full certificate record', async () => {
        const stub = createStub('ISSUER');
        await stub.mockInvoke('tx30', ['IssueCertificate', ...Object.values(VALID_CERT)]);

        stub.clientIdentity.getAttributeValue = () => 'ADMIN';
        const result = await stub.mockInvoke('tx31', ['GetCertificate', VALID_CERT.certificateID]);

        expect(result.status).toBe(200);
        const cert = JSON.parse(result.payload.toString());
        expect(cert.studentName).toBe(VALID_CERT.studentName);
        expect(cert.department).toBe(VALID_CERT.department);
    });

    test('STUDENT cannot get a certificate record', async () => {
        const stub = createStub('ISSUER');
        await stub.mockInvoke('tx32', ['IssueCertificate', ...Object.values(VALID_CERT)]);

        stub.clientIdentity.getAttributeValue = () => 'STUDENT';
        const result = await stub.mockInvoke('tx33', ['GetCertificate', VALID_CERT.certificateID]);
        expect(result.status).toBe(500);
        expect(result.message).toContain('ACCESS DENIED');
    });
});