const { verifyToken } = require('../../../common/jwtHelper');

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

    if (decoded.role !== 'employee' && decoded.role !== 'company_admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    req.companyCode = decoded.companyCode;
    req.userId = decoded.employeeId || 'admin';
    req.role = decoded.role;
    next();
  } catch (err) {
    console.error('[email.auth.middleware]', err.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

module.exports = { requireEmployee };
