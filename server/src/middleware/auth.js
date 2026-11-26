import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';

export const COOKIE_NAME = 'bms_session';

export function cookieOptions() {
  return {
    httpOnly: true, // JavaScript in the browser can never read the token (protects against XSS theft)
    sameSite: 'strict', // browser won't send it on cross-site requests (protects against CSRF)
    secure: config.isProd,
    maxAge: config.sessionMinutes * 60 * 1000,
    path: '/',
  };
}

export function issueSession(res, user) {
  const token = jwt.sign({ sub: String(user._id), v: user.tokenVersion }, config.jwtSecret, {
    expiresIn: `${config.sessionMinutes}m`,
  });
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Please sign in' });

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active' || user.tokenVersion !== payload.v) {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
    return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
  }

  req.user = user;
  // Sliding session: each request while active pushes the expiry forward.
  issueSession(res, user);
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ error: 'You do not have access to this' });
    next();
  };
}

/**
 * Defense in depth against CSRF: state-changing requests must carry a custom
 * header, which a cross-site form or image tag cannot add.
 */
export function requireCsrfHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'bms-web') {
    return res.status(403).json({ error: 'Request blocked' });
  }
  next();
}
