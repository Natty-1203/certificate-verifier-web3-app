'use strict';

// Valid roles — must match what's set in Fabric CA enrollment attributes
const ROLES = {
    ADMIN:   'ADMIN',
    ISSUER:  'ISSUER',
    STUDENT: 'STUDENT',
};

/**
 * Read the caller's role from their X.509 client identity attribute.
 * The attribute key is 'role' — set during Fabric CA enrollment.
 *
 * Returns the role string (e.g. 'ADMIN') or null if not set.
 */
function getCallerRole(ctx) {
    // ClientIdentity lets us read X.509 attributes from the caller's certificate
    const cid = ctx.clientIdentity;
    const role = cid.getAttributeValue('role');
    return role ? role.toUpperCase() : null;
}

/**
 * Get a human-readable identity string for the caller — used in audit logs.
 * Format: "CN=Admin@org1.example.com::Org1MSP"
 */
function getCallerIdentity(ctx) {
    const cid = ctx.clientIdentity;
    const id  = cid.getID();       // full X.509 DN string
    const msp = cid.getMSPID();
    return { id, msp };
}

/**
 * Throw an error if the caller doesn't have one of the required roles.
 *
 * Usage:
 *   requireRole(ctx, ROLES.ISSUER);
 *   requireRole(ctx, [ROLES.ADMIN, ROLES.ISSUER]);
 */
function requireRole(ctx, allowedRoles) {
    const callerRole = getCallerRole(ctx);
    const allowed    = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!callerRole || !allowed.includes(callerRole)) {
        const { id, msp } = getCallerIdentity(ctx);
        throw new Error(
            `ACCESS DENIED — caller "${id}" (MSP: ${msp}) has role "${callerRole}". ` +
            `Required: ${allowed.join(' or ')}.`
        );
    }
}

/**
 * Check if caller has a role — returns boolean (does not throw).
 * Useful for conditional logic inside functions.
 */
function hasRole(ctx, role) {
    const callerRole = getCallerRole(ctx);
    return callerRole === role.toUpperCase();
}

module.exports = { ROLES, getCallerRole, getCallerIdentity, requireRole, hasRole };