const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '90d';

/**
 * Sign a JWT token for an employee.
 * @param {{ employeeId: string, companyCode: string, role?: string }} payload
 * @returns {string} JWT token
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify a JWT token and return the decoded payload.
 * @param {string} token
 * @returns {{ employeeId: string, companyCode: string, role?: string }}
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
