import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, amountSchema, accountNumberSchema } from '../middleware/validate.js';
import { generateAccountNumber, rupeesToPaise, maskName } from '../utils/money.js';
import { transfer, sentToday } from '../utils/ledger.js';
import { audit } from '../utils/audit.js';
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();
router.use(requireAuth);

const MAX_ACCOUNTS = 3;

router.get('/accounts', async (req, res) => {
  const accounts = await Account.find({ owner: req.user._id, status: { $ne: 'closed' } }).sort({ createdAt: 1 });
  const used = await sentToday(req.user._id);
  res.json({
    accounts: accounts.map((a) => a.toSafeJSON()),
    limits: { daily: config.dailyTransferLimit, usedToday: used },
  });
});

const openSchema = z.object({
  type: z.enum(['savings', 'current']),
  nickname: z.string().trim().max(40).optional(),
});

router.post('/accounts', validate(openSchema), async (req, res) => {
  if (req.user.role !== 'customer') throw new HttpError(403, 'Staff profiles cannot open accounts');
  const count = await Account.countDocuments({ owner: req.user._id, status: { $ne: 'closed' } });
  if (count >= MAX_ACCOUNTS) throw new HttpError(400, `You can have up to ${MAX_ACCOUNTS} accounts`);
  const account = await Account.create({
    owner: req.user._id,
    type: req.body.type,
    nickname: req.body.nickname || undefined,
    accountNumber: await generateAccountNumber(),
  });
  await audit(req, 'account.open', { target: account.accountNumber });
  res.status(201).json({ account: account.toSafeJSON() });
});

/** Recent activity across all of the user's accounts, for the dashboard. */
router.get('/transactions/recent', async (req, res) => {
  const ids = await Account.find({ owner: req.user._id }).distinct('_id');
  const items = await Transaction.find({ account: { $in: ids } })
    .sort({ createdAt: -1 })
    .limit(8)
    .populate('account', 'accountNumber');
  res.json({ transactions: items.map(toClientTx) });
});

const historyQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  direction: z.enum(['credit', 'debit', 'all']).default('all'),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  search: z.string().trim().max(60).optional(),
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/accounts/:number/transactions', async (req, res) => {
  const number = accountNumberSchema.safeParse(req.params.number);
  if (!number.success) throw new HttpError(400, 'Invalid account number');
  const q = historyQuery.safeParse(req.query);
  if (!q.success) throw new HttpError(400, q.error.issues[0].message);

  const accountFilter = { accountNumber: number.data };
  if (req.user.role !== 'admin') accountFilter.owner = req.user._id; // customers only ever see their own
  const account = await Account.findOne(accountFilter);
  if (!account) throw new HttpError(404, 'Account not found');

  const { page, limit, direction, from, to, search } = q.data;
  const filter = { account: account._id };
  if (direction !== 'all') filter.direction = direction;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00`);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999`);
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { description: rx },
      { reference: rx },
      { 'counterparty.name': rx },
      { 'counterparty.accountNumber': rx },
    ];
  }

  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Transaction.countDocuments(filter),
  ]);
  res.json({
    account: account.toSafeJSON(),
    transactions: items.map(toClientTx),
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
});

// Stops someone from guessing account numbers in bulk to harvest names.
const lookupLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many lookups. Please wait a few minutes.' },
});

router.get('/recipient/:number', lookupLimiter, async (req, res) => {
  const number = accountNumberSchema.safeParse(req.params.number);
  if (!number.success) throw new HttpError(400, 'Account numbers are 12 digits');
  const account = await Account.findOne({ accountNumber: number.data, status: 'active' });
  if (!account) throw new HttpError(404, 'No active account with that number');
  const owner = await User.findById(account.owner);
  res.json({
    accountNumber: account.accountNumber,
    name: maskName(owner.name),
    own: owner._id.equals(req.user._id),
  });
});

const transferSchema = z.object({
  fromAccount: accountNumberSchema,
  toAccount: accountNumberSchema,
  amount: amountSchema,
  description: z.string().trim().max(140).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

router.post('/transfers', validate(transferSchema), async (req, res) => {
  if (req.user.role !== 'customer') throw new HttpError(403, 'Staff profiles cannot make transfers');
  const amount = rupeesToPaise(req.body.amount);
  const result = await transfer({
    user: req.user,
    fromAccountNumber: req.body.fromAccount,
    toAccountNumber: req.body.toAccount,
    amount,
    description: req.body.description || undefined,
    idempotencyKey: req.body.idempotencyKey,
  });
  if (!result.duplicate) {
    await audit(req, 'transfer.create', {
      target: req.body.fromAccount,
      details: { to: req.body.toAccount, amount, reference: result.reference },
    });
  }
  res.status(result.duplicate ? 200 : 201).json(result);
});

export function toClientTx(t) {
  return {
    id: t._id,
    accountNumber: t.account?.accountNumber,
    direction: t.direction,
    kind: t.kind,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    reference: t.reference,
    description: t.description,
    counterparty: t.counterparty,
    createdAt: t.createdAt,
  };
}

export default router;
