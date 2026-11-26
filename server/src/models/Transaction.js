import mongoose from 'mongoose';

/**
 * One ledger entry per account movement. A transfer creates two entries
 * (a debit on the sender, a credit on the receiver) sharing the same `reference`.
 */
const transactionSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    direction: { type: String, enum: ['credit', 'debit'], required: true },
    kind: { type: String, enum: ['transfer', 'deposit', 'withdrawal'], required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    balanceAfter: { type: Number, required: true },
    reference: { type: String, required: true, index: true },
    description: { type: String, trim: true, maxlength: 140 },
    counterparty: {
      accountNumber: String,
      name: String,
    },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Lets the client safely retry a transfer (double-click, flaky network) without paying twice.
    idempotencyKey: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

transactionSchema.index({ account: 1, createdAt: -1 });
transactionSchema.index(
  { initiatedBy: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
