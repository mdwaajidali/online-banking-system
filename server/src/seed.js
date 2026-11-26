import bcrypt from 'bcryptjs';
import { User } from './models/User.js';
import { Account } from './models/Account.js';
import { Transaction } from './models/Transaction.js';
import { AuditLog } from './models/AuditLog.js';
import { cashMovement, transfer } from './utils/ledger.js';
import { generateAccountNumber } from './utils/money.js';

// Demo logins for local development only. Never use these anywhere real.
export const DEMO_USERS = [
  { name: 'Bank Admin', email: 'admin@demo.bank', password: 'Admin@12345', role: 'admin' },
  { name: 'Aarav Sharma', email: 'aarav@demo.bank', password: 'Aarav@12345', phone: '9876543210', role: 'customer' },
  { name: 'Diya Patel', email: 'diya@demo.bank', password: 'Diya@12345', phone: '9123456780', role: 'customer' },
];

export async function seedDemoData({ reset = false } = {}) {
  if (reset) {
    await Promise.all([User.deleteMany({}), Account.deleteMany({}), Transaction.deleteMany({}), AuditLog.deleteMany({})]);
  } else if (await User.exists({})) {
    return false;
  }

  const users = {};
  for (const u of DEMO_USERS) {
    users[u.email] = await User.create({
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      passwordHash: await bcrypt.hash(u.password, 12),
    });
  }

  const admin = users['admin@demo.bank'];
  const aarav = users['aarav@demo.bank'];
  const diya = users['diya@demo.bank'];

  const aaravSavings = await Account.create({ owner: aarav._id, type: 'savings', accountNumber: await generateAccountNumber() });
  const aaravCurrent = await Account.create({ owner: aarav._id, type: 'current', nickname: 'Business', accountNumber: await generateAccountNumber() });
  const diyaSavings = await Account.create({ owner: diya._id, type: 'savings', accountNumber: await generateAccountNumber() });

  await cashMovement({ staff: admin, accountNumber: aaravSavings.accountNumber, amount: 85000_00, direction: 'credit', description: 'Opening deposit' });
  await cashMovement({ staff: admin, accountNumber: aaravCurrent.accountNumber, amount: 25000_00, direction: 'credit', description: 'Opening deposit' });
  await cashMovement({ staff: admin, accountNumber: diyaSavings.accountNumber, amount: 42000_00, direction: 'credit', description: 'Opening deposit' });
  await transfer({ user: aarav, fromAccountNumber: aaravSavings.accountNumber, toAccountNumber: diyaSavings.accountNumber, amount: 1500_00, description: 'Dinner split' });
  await transfer({ user: diya, fromAccountNumber: diyaSavings.accountNumber, toAccountNumber: aaravSavings.accountNumber, amount: 350_00, description: 'Movie tickets' });
  await transfer({ user: aarav, fromAccountNumber: aaravSavings.accountNumber, toAccountNumber: aaravCurrent.accountNumber, amount: 5000_00, description: 'Move to business account' });

  return true;
}

// `npm run seed` wipes the database and reloads the demo data.
if (process.argv[1]?.endsWith('seed.js')) {
  const { connectDB, disconnectDB } = await import('./config/db.js');
  await connectDB();
  await seedDemoData({ reset: true });
  console.log('Demo data loaded:');
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(8)} ${u.email}  /  ${u.password}`);
  await disconnectDB();
}
