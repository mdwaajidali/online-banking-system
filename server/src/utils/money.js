import crypto from 'node:crypto';
import { Account } from '../models/Account.js';

/** "1234.5" -> 123450 paise. Validation (max 2 decimals) happens in the zod schema. */
export function rupeesToPaise(value) {
  const [whole, frac = ''] = String(value).split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function formatINR(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
}

/** 12-digit account number, unique in the collection. */
export async function generateAccountNumber() {
  for (let i = 0; i < 10; i++) {
    const n = '50' + crypto.randomInt(0, 1e10).toString().padStart(10, '0');
    if (!(await Account.exists({ accountNumber: n }))) return n;
  }
  throw new Error('Could not generate a unique account number');
}

export function newReference(prefix = 'TXN') {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** "Rahul Sharma" -> "Rahul S." so a recipient can be confirmed without exposing full names. */
export function maskName(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.slice(1).map((p) => p[0].toUpperCase() + '.').join(' ')}`;
}
