const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const { getState } = require('../data/store');

function getToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return req.cookies && req.cookies.token ? req.cookies.token : null;
}

async function attachUser(req, _res, next) {
  const token = getToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const state = await getState();
    const user = state.users.find((entry) => entry.id === payload.userId && entry.status === 'active');
    req.user = user || null;
    req.auth = payload;
  } catch (_error) {
    req.user = null;
    req.auth = null;
  }

  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  return next();
}

function requireRole(roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient role access.' });
    }

    return next();
  };
}

function requirePermission(permission) {
  return function permissionGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (!req.user.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({ message: `Missing permission: ${permission}` });
    }

    return next();
  };
}

module.exports = {
  attachUser,
  requireAuth,
  requirePermission,
  requireRole,
};
