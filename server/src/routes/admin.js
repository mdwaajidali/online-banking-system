import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';
import { AuditLog } from '../models/AuditLog.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, amountSchema, accountNumberSchema } from '../middleware/validate.js';
import { rupeesToPaise } from '../utils/money.js';
import { cashMovement } from '../utils/ledger.js';
import { audit } from '../utils/audit.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/stats', async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [customers, accounts, frozen, deposits, todayTx] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Account.countDocuments({ status: { $ne: 'closed' } }),
    Account.countDocuments({ status: 'frozen' }),
    Account.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]),
    Transaction.countDocuments({ createdAt: { $gte: start }, direction: 'debit' }),
  ]);
  res.json({ customers, accounts, frozen, totalDeposits: deposits[0]?.total ?? 0, transactionsToday: todayTx });
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/customers', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  let userFilter = { role: 'customer' };

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const byAccount = await Account.find({ accountNumber: rx }).distinct('owner');
    userFilter = { role: 'customer', $or: [{ name: rx }, { email: rx }, { phone: rx }, { _id: { $in: byAccount } }] };
  }

  const users = await User.find(userFilter).sort({ createdAt: -1 }).limit(50);
  const accounts = await Account.find({ owner: { $in: users.map((u) => u._id) } }).sort({ createdAt: 1 });
  res.json({
    customers: users.map((u) => ({
      ...u.toSafeJSON(),
      accounts: accounts.filter((a) => a.owner.equals(u._id)).map((a) => a.toSafeJSON()),
    })),
  });
});

const cashSchema = z.object({
  amount: amountSchema,
  description: z.string().trim().max(140).optional(),
});

for (const [path, direction] of [
  ['deposit', 'credit'],
  ['withdraw', 'debit'],
]) {
  router.post(`/accounts/:number/${path}`, validate(cashSchema), async (req, res) => {
    const number = accountNumberSchema.safeParse(req.params.number);
    if (!number.success) throw new HttpError(400, 'Invalid account number');
    const amount = rupeesToPaise(req.body.amount);
    const result = await cashMovement({
      staff: req.user,
      accountNumber: number.data,
      amount,
      direction,
      description: req.body.description,
    });
    await audit(req, `admin.${path}`, { target: number.data, details: { amount, reference: result.reference } });
    res.status(201).json(result);
  });
}

const accountStatusSchema = z.object({ status: z.enum(['active', 'frozen']) });

router.patch('/accounts/:number', validate(accountStatusSchema), async (req, res) => {
  const number = accountNumberSchema.safeParse(req.params.number);
  if (!number.success) throw new HttpError(400, 'Invalid account number');
  const account = await Account.findOneAndUpdate(
    { accountNumber: number.data, status: { $ne: 'closed' } },
    { status: req.body.status },
    { returnDocument: 'after' }
  );
  if (!account) throw new HttpError(404, 'Account not found');
  await audit(req, `admin.account_${req.body.status === 'frozen' ? 'freeze' : 'unfreeze'}`, { target: number.data });
  res.json({ account: account.toSafeJSON() });
});

const userStatusSchema = z.object({ status: z.enum(['active', 'disabled']) });

router.patch('/users/:id', validate(userStatusSchema), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid user');
  const update = { status: req.body.status };
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'customer' },
    // Disabling a profile also ends all of its active sessions immediately.
    req.body.status === 'disabled' ? { ...update, $inc: { tokenVersion: 1 } } : update,
    { returnDocument: 'after' }
  );
  if (!user) throw new HttpError(404, 'Customer not found');
  await audit(req, `admin.user_${req.body.status}`, { target: user.email });
  res.json({ user: user.toSafeJSON() });
});

router.get('/audit', async (req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).populate('actor', 'name email role');
  res.json({
    logs: logs.map((l) => ({
      id: l._id,
      action: l.action,
      target: l.target,
      details: l.details,
      ip: l.ip,
      actor: l.actor ? { name: l.actor.name, email: l.actor.email, role: l.actor.role } : null,
      createdAt: l.createdAt,
    })),
  });
});

export default router;
