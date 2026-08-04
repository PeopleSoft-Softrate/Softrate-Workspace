const { verifyToken } = require('../../../common/jwtHelper');

/**
 * Auth middleware for the email integration module.
 *
 * Validates:
 *  1. Bearer JWT token is present and valid
 *  2. The decoded role is 'company_admin'
 *
 * Sets req.companyCode for use in downstream handlers.
 */
function requireCompanyAdmin(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token required.' });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }

    if (decoded.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Company Admins can manage email integration.',
      });
    }

    // Attach companyCode to request for handlers
    req.companyCode = decoded.companyCode;
    req.userId = decoded.employeeId || 'admin';
    next();
  } catch (err) {
    console.error('[email.auth.middleware]', err.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

function requireEmployee(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization token required.' });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }

    // Allow both employee and company_admin roles
    if (decoded.role !== 'employee' && decoded.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    // Attach companyCode to request for handlers
    req.companyCode = decoded.companyCode;
    req.userId = decoded.employeeId || 'admin';
    req.role = decoded.role;
    next();
  } catch (err) {
    console.error('[email.auth.middleware]', err.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

module.exports = { requireCompanyAdmin, requireEmployee };
