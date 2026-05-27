'use strict';

const { connectGateway, getContract } = require('./connection');

async function submitTransaction(role, fnName, ...args) {
    const { gateway, client } = await connectGateway(role);
    try {
        const contract    = await getContract(gateway);
        const stringArgs  = args.map(a => String(a));
        const resultBytes = await contract.submitTransaction(fnName, ...stringArgs);
        return JSON.parse(Buffer.from(resultBytes).toString());
    } finally {
        gateway.close();
        client.close();
    }
}

async function evaluateTransaction(role, fnName, ...args) {
    const { gateway, client } = await connectGateway(role);
    try {
        const contract    = await getContract(gateway);
        const stringArgs  = args.map(a => String(a));
        const resultBytes = await contract.evaluateTransaction(fnName, ...stringArgs);
        return JSON.parse(Buffer.from(resultBytes).toString());
    } finally {
        gateway.close();
        client.close();
    }
}

const fabricGateway = {

    // ISSUER role — only ISSUER can call this
    async issueCertificate(data) {
        return submitTransaction('ISSUER', 'IssueCertificate',
            data.certificateID, data.studentName, data.studentID,
            data.department, data.cgpa, data.graduationYear,
            data.sha256Hash, data.ipfsCID
        );
    },

    // Public — any role can verify
    async verifyCertificate(certificateID) {
        return evaluateTransaction('STUDENT', 'VerifyCertificate', certificateID);
    },

    // Public — any role can verify by hash
    async verifyByHash(sha256Hash) {
        return evaluateTransaction('STUDENT', 'VerifyByHash', sha256Hash);
    },

    // ADMIN role — only ADMIN can revoke
    async revokeCertificate(certificateID, reason) {
        return submitTransaction('ADMIN', 'RevokeCertificate', certificateID, reason);
    },

    // ADMIN role — only ADMIN can see history
    async queryCertificateHistory(certificateID) {
        return evaluateTransaction('ADMIN', 'QueryCertificateHistory', certificateID);
    },

    // ADMIN or ISSUER — both can get full record
    async getCertificate(certificateID) {
        return evaluateTransaction('ADMIN', 'GetCertificate', certificateID);
    },

    // finding something by sudent Id
async findByStudentID(studentID) {
    return evaluateTransaction('STUDENT', 'FindByStudentID', studentID);
},
};

module.exports = fabricGateway;