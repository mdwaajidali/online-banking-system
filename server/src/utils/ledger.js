import mongoose from 'mongoose';
import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { HttpError } from './httpError.js';
import { newReference } from './money.js';
import { config } from '../config/env.js';

async function runInTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    // withTransaction retries automatically on write conflicts, so concurrent
    // transfers from the same account are processed one after another, never both at once.
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function sentToday(userId, session) {
  const [row] = await Transaction.aggregate([
    { $match: { initiatedBy: userId, kind: 'transfer', direction: 'debit', createdAt: { $gte: startOfToday() } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).session(session ?? null);
  return row?.total ?? 0;
}

export async function transfer({ user, fromAccountNumber, toAccountNumber, amount, description, idempotencyKey }) {
  if (idempotencyKey) {
    const existing = await Transaction.findOne({ initiatedBy: user._id, idempotencyKey });
    if (existing) return summarize(existing, true);
  }
  if (fromAccountNumber === toAccountNumber) {
    throw new HttpError(400, 'You cannot send money to the same account');
  }

  try {
    return await runInTransaction(async (session) => {
      const from = await Account.findOne({ accountNumber: fromAccountNumber, owner: user._id }).session(session);
      if (!from) throw new HttpError(404, 'We could not find that account on your profile');
      if (from.status !== 'active') throw new HttpError(400, `Your account is ${from.status}. Please contact the bank.`);

      const to = await Account.findOne({ accountNumber: toAccountNumber }).session(session);
      if (!to || to.status === 'closed') throw new HttpError(404, 'No account exists with that number');
      if (to.status !== 'active') throw new HttpError(400, 'That account cannot receive money right now');

      const used = await sentToday(user._id, session);
      if (used + amount > config.dailyTransferLimit) {
        throw new HttpError(400, 'This would go over your daily transfer limit');
      }

      // Conditional update: only succeeds if the balance is still enough at the moment of writing.
      const debited = await Account.findOneAndUpdate(
        { _id: from._id, status: 'active', balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { returnDocument: 'after', session }
      );
      if (!debited) throw new HttpError(400, 'Not enough balance for this transfer');

      const credited = await Account.findOneAndUpdate(
        { _id: to._id, status: 'active' },
        { $inc: { balance: amount } },
        { returnDocument: 'after', session }
      );
      if (!credited) throw new HttpError(400, 'That account cannot receive money right now');

      const receiver = await User.findById(to.owner).session(session);
      const reference = newReference();
      const [debit] = await Transaction.create(
        [
          {
            account: from._id,
            direction: 'debit',
            kind: 'transfer',
            amount,
            balanceAfter: debited.balance,
            reference,
            description,
            counterparty: { accountNumber: to.accountNumber, name: receiver?.name },
            initiatedBy: user._id,
            idempotencyKey,
          },
          {
            account: to._id,
            direction: 'credit',
            kind: 'transfer',
            amount,
            balanceAfter: credited.balance,
            reference,
            description,
            counterparty: { accountNumber: from.accountNumber, name: user.name },
            initiatedBy: user._id,
          },
        ],
        { session, ordered: true }
      );
      return summarize(debit, false);
    });
  } catch (err) {
    // Two identical requests raced each other: return the one that won instead of paying twice.
    if (err?.code === 11000 && idempotencyKey) {
      const existing = await Transaction.findOne({ initiatedBy: user._id, idempotencyKey });
      if (existing) return summarize(existing, true);
    }
    throw err;
  }
}

/** Cash deposit / withdrawal recorded by bank staff at the counter. */
export async function cashMovement({ staff, accountNumber, amount, direction, description }) {
  return runInTransaction(async (session) => {
    const account = await Account.findOne({ accountNumber }).session(session);
    if (!account) throw new HttpError(404, 'No account exists with that number');
    if (account.status !== 'active') throw new HttpError(400, `Account is ${account.status}`);

    const filter = { _id: account._id, status: 'active' };
    if (direction === 'debit') filter.balance = { $gte: amount };
    const updated = await Account.findOneAndUpdate(
      filter,
      { $inc: { balance: direction === 'credit' ? amount : -amount } },
      { returnDocument: 'after', session }
    );
    if (!updated) throw new HttpError(400, 'Not enough balance in the account');

    const [tx] = await Transaction.create(
      [
        {
          account: account._id,
          direction,
          kind: direction === 'credit' ? 'deposit' : 'withdrawal',
          amount,
          balanceAfter: updated.balance,
          reference: newReference(direction === 'credit' ? 'DEP' : 'WDL'),
          description: description || (direction === 'credit' ? 'Cash deposit' : 'Cash withdrawal'),
          initiatedBy: staff._id,
        },
      ],
      { session }
    );
    return { reference: tx.reference, balance: updated.balance };
  });
}

function summarize(tx, duplicate) {
  return {
    reference: tx.reference,
    amount: tx.amount,
    balanceAfter: tx.balanceAfter,
    to: tx.counterparty,
    createdAt: tx.createdAt,
    duplicate,
  };
}
