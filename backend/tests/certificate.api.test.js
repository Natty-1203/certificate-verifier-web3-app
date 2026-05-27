'use strict';

const request = require('supertest');
const app     = require('../src/app');

// ── Mock the Fabric gateway so tests don't need a real network ────────────────
jest.mock('../src/fabric/gateway', () => ({
    issueCertificate:         jest.fn(),
    verifyCertificate:        jest.fn(),
    verifyByHash:             jest.fn(),
    revokeCertificate:        jest.fn(),
    queryCertificateHistory:  jest.fn(),
    getCertificate:           jest.fn(),
}));

const fabricGateway = require('../src/fabric/gateway');

// ── Shared test data ──────────────────────────────────────────────────────────
const VALID_BODY = {
    certificateID:  'CERT-2024-001',
    studentName:    'Abebe Kebede',
    studentID:      'ETS0123/14',
    department:     'Computer Science',
    cgpa:           3.85,
    graduationYear: 2024,
    sha256Hash:     'a'.repeat(64),
    ipfsCID:        'QmXyz123abc',
};

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /health', () => {
    test('returns 200 and status ok', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/certificates  (IssueCertificate)', () => {

    test('201 — issues certificate with valid body', async () => {
        fabricGateway.issueCertificate.mockResolvedValue({
            success: true, certificateID: 'CERT-2024-001', issuedAt: new Date().toISOString(),
        });

        const res = await request(app)
            .post('/api/certificates')
            .send(VALID_BODY);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.certificateID).toBe('CERT-2024-001');
    });

    test('400 — rejects request with missing fields', async () => {
        const res = await request(app)
            .post('/api/certificates')
            .send({ certificateID: 'CERT-001' }); // missing all other fields

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('400 — rejects invalid cgpa', async () => {
        const res = await request(app)
            .post('/api/certificates')
            .send({ ...VALID_BODY, cgpa: 5.0 });

        expect(res.status).toBe(400);
    });

    test('400 — rejects invalid sha256Hash format', async () => {
        const res = await request(app)
            .post('/api/certificates')
            .send({ ...VALID_BODY, sha256Hash: 'not-a-hash' });

        expect(res.status).toBe(400);
    });

    test('409 — handles duplicate error from chaincode', async () => {
        fabricGateway.issueCertificate.mockRejectedValue(
            new Error('DUPLICATE — certificate ID already exists')
        );

        const res = await request(app)
            .post('/api/certificates')
            .send(VALID_BODY);

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/certificates/:id/verify  (VerifyCertificate)', () => {

    test('200 — returns VALID for existing cert', async () => {
        fabricGateway.verifyCertificate.mockResolvedValue({
            exists: true, isValid: true, isRevoked: false, status: 'VALID',
        });

        const res = await request(app).get('/api/certificates/CERT-001/verify');

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('VALID');
    });

    test('200 — returns NOT_FOUND for unknown cert', async () => {
        fabricGateway.verifyCertificate.mockResolvedValue({
            exists: false, isValid: false, isRevoked: false, status: 'NOT_FOUND',
        });

        const res = await request(app).get('/api/certificates/UNKNOWN/verify');
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('NOT_FOUND');
    });

    test('200 — returns REVOKED for revoked cert', async () => {
        fabricGateway.verifyCertificate.mockResolvedValue({
            exists: true, isValid: false, isRevoked: true, status: 'REVOKED',
        });

        const res = await request(app).get('/api/certificates/CERT-001/verify');
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('REVOKED');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/certificates/verify/hash/:hash  (VerifyByHash)', () => {

    test('200 — verifies by hash successfully', async () => {
        fabricGateway.verifyByHash.mockResolvedValue({
            exists: true, isValid: true, status: 'VALID',
        });

        const res = await request(app)
            .get(`/api/certificates/verify/hash/${'a'.repeat(64)}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('VALID');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/certificates/:id/revoke  (RevokeCertificate)', () => {

    test('200 — revokes a certificate with a reason', async () => {
        fabricGateway.revokeCertificate.mockResolvedValue({
            success: true, certificateID: 'CERT-001', revokedAt: new Date().toISOString(),
        });

        const res = await request(app)
            .patch('/api/certificates/CERT-001/revoke')
            .send({ reason: 'Document forgery detected' });

        expect(res.status).toBe(200);
        expect(res.body.data.success).toBe(true);
    });

    test('403 — handles access denied from chaincode', async () => {
        fabricGateway.revokeCertificate.mockRejectedValue(
            new Error('ACCESS DENIED — caller has role ISSUER. Required: ADMIN')
        );

        const res = await request(app)
            .patch('/api/certificates/CERT-001/revoke')
            .send({ reason: 'test' });

        expect(res.status).toBe(403);
    });

    test('409 — handles already revoked error', async () => {
        fabricGateway.revokeCertificate.mockRejectedValue(
            new Error('ALREADY_REVOKED — certificate is already revoked')
        );

        const res = await request(app)
            .patch('/api/certificates/CERT-001/revoke')
            .send({ reason: 'test' });

        expect(res.status).toBe(409);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/certificates/:id/history', () => {

    test('200 — returns audit history', async () => {
        fabricGateway.queryCertificateHistory.mockResolvedValue({
            certificateID: 'CERT-001',
            count: 2,
            history: [
                { txID: 'tx1', timestamp: '2024-01-01T00:00:00Z', isDelete: false },
                { txID: 'tx2', timestamp: '2024-06-01T00:00:00Z', isDelete: false },
            ],
        });

        const res = await request(app).get('/api/certificates/CERT-001/history');

        expect(res.status).toBe(200);
        expect(res.body.data.count).toBe(2);
        expect(res.body.data.history).toHaveLength(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('404 handler', () => {
    test('returns 404 for unknown routes', async () => {
        const res = await request(app).get('/api/nonexistent');
        expect(res.status).toBe(404);
    });
});