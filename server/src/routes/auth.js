import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Account } from '../models/Account.js';
import { validate, passwordSchema } from '../middleware/validate.js';
import { issueSession, requireAuth, COOKIE_NAME, cookieOptions } from '../middleware/auth.js';
import { generateAccountNumber } from '../utils/money.js';
import { audit } from '../utils/audit.js';
import { config } from '../config/env.js';

const router = Router();

// Slows down password guessing from one IP, on top of the per-account lockout below.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 20 : 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(80),
  email: z.string().trim().toLowerCase().email('Please enter a valid email'),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number')
    .optional()
    .or(z.literal('')),
  password: passwordSchema,
  accountType: z.enum(['savings', 'current']).default('savings'),
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, phone, password, accountType } = req.body;

  if (await User.exists({ email })) {
    return res.status(409).json({ error: 'An account with this email already exists. Try signing in.', field: 'email' });
  }

  const user = await User.create({
    name,
    email,
    phone: phone || undefined,
    passwordHash: await bcrypt.hash(password, 12),
  });
  const account = await Account.create({
    owner: user._id,
    type: accountType,
    accountNumber: await generateAccountNumber(),
  });

  await audit(req, 'user.register', { actor: user._id, target: account.accountNumber });
  issueSession(res, user);
  res.status(201).json({ user: user.toSafeJSON() });
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email'),
  password: z.string().min(1, 'Please enter your password').max(200),
});

// Same message whether the email exists or not, so attackers can't discover who has an account.
const BAD_LOGIN = 'Email or password is incorrect';
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +failedLoginAttempts +lockUntil');

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH); // same timing as a real check
    return res.status(401).json({ error: BAD_LOGIN });
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return res.status(423).json({ error: `Too many wrong attempts. Your sign-in is locked for ${mins} more minute(s).` });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    user.failedLoginAttempts += 1;
    const left = config.maxLoginAttempts - user.failedLoginAttempts;
    if (left <= 0) {
      user.lockUntil = new Date(Date.now() + config.lockMinutes * 60000);
      user.failedLoginAttempts = 0;
      await user.save();
      await audit(req, 'user.locked', { actor: user._id });
      return res.status(423).json({ error: `Too many wrong attempts. Sign-in is locked for ${config.lockMinutes} minutes.` });
    }
    await user.save();
    return res.status(401).json({ error: `${BAD_LOGIN}. ${left} attempt(s) left before a temporary lock.` });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ error: 'This profile has been disabled. Please contact the bank.' });
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  await audit(req, 'user.login', { actor: user._id });

  issueSession(res, user);
  res.json({ user: user.toSafeJSON() });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

router.post('/logout', requireAuth, async (req, res) => {
  // Invalidate the token on the server too, not just delete the cookie.
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  await audit(req, 'user.logout');
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: passwordSchema,
});

router.post('/change-password', requireAuth, authLimiter, validate(changePasswordSchema), async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect', field: 'currentPassword' });
  }
  if (req.body.currentPassword === req.body.newPassword) {
    return res.status(400).json({ error: 'New password must be different', field: 'newPassword' });
  }
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  user.tokenVersion += 1; // signs out every other device
  await user.save();
  await audit(req, 'user.password_changed');
  issueSession(res, user);
  res.json({ ok: true });
});

export default router;
