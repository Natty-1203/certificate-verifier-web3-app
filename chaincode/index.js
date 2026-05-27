'use strict';

const { Contract } = require('fabric-contract-api');
const { CertificateContract } = require('./lib/certificateContract');

module.exports.contracts = [CertificateContract];