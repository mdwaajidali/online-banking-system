import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { seedDemoData } from '../src/seed.js';
import { Account } from '../src/models/Account.js';

let app;
const H = { 'X-Requested-With': 'bms-web' };

before(async () => {
  await connectDB({ ephemeral: true });
  await seedDemoData({ reset: true });
  app = createApp();
});
after(disconnectDB);

async function login(email, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').set(H).send({ email, password });
  assert.equal(res.status, 200, res.body.error);
  return agent;
}

async function accountsOf(agent) {
  const res = await agent.get('/api/accounts');
  return res.body.accounts;
}

test('register creates a user with one account and a session cookie', async () => {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .set(H)
    .send({ name: 'Test User', email: 'test@example.com', password: 'Password123' });
  assert.equal(res.status, 201);
  const accounts = await accountsOf(agent);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].balance, 0);
});

test('weak passwords are rejected', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .set(H)
    .send({ name: 'Weak', email: 'weak@example.com', password: 'password' });
  assert.equal(res.status, 400);
});

test('requests without the CSRF header are blocked', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'aarav@demo.bank', password: 'Aarav@12345' });
  assert.equal(res.status, 403);
});

test('NoSQL injection in login is rejected', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .set(H)
    .send({ email: { $gt: '' }, password: { $gt: '' } });
  assert.equal(res.status, 400);
});

test('protected routes need a session', async () => {
  const res = await request(app).get('/api/accounts');
  assert.equal(res.status, 401);
});

test('account locks after 5 wrong passwords', async () => {
  await request(app)
    .post('/api/auth/register')
    .set(H)
    .send({ name: 'Lock Me', email: 'lock@example.com', password: 'Password123' });
  let res;
  for (let i = 0; i < 5; i++) {
    res = await request(app).post('/api/auth/login').set(H).send({ email: 'lock@example.com', password: 'wrong' });
  }
  assert.equal(res.status, 423);
  // Even the correct password is refused while locked.
  res = await request(app).post('/api/auth/login').set(H).send({ email: 'lock@example.com', password: 'Password123' });
  assert.equal(res.status, 423);
});

test('transfer moves money and records both sides', async () => {
  const aarav = await login('aarav@demo.bank', 'Aarav@12345');
  const diya = await login('diya@demo.bank', 'Diya@12345');
  const [from] = await accountsOf(aarav);
  const [to] = await accountsOf(diya);

  const res = await aarav
    .post('/api/transfers')
    .set(H)
    .send({ fromAccount: from.accountNumber, toAccount: to.accountNumber, amount: '100.50', description: 'Test' });
  assert.equal(res.status, 201, res.body.error);

  const [fromAfter] = await accountsOf(aarav);
  const [toAfter] = await accountsOf(diya);
  assert.equal(fromAfter.balance, from.balance - 10050);
  assert.equal(toAfter.balance, to.balance + 10050);
});

test('cannot overdraw, even with many transfers at once', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').set(H).send({ name: 'Racer', email: 'race@example.com', password: 'Password123' });
  const [acct] = await accountsOf(agent);
  await Account.updateOne({ accountNumber: acct.accountNumber }, { balance: 1000_00 }); // ₹1000
  const diya = await login('diya@demo.bank', 'Diya@12345');
  const [to] = await accountsOf(diya);

  // 10 parallel transfers of ₹300: only 3 can succeed.
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      agent.post('/api/transfers').set(H).send({ fromAccount: acct.accountNumber, toAccount: to.accountNumber, amount: 300 })
    )
  );
  const ok = results.filter((r) => r.status === 201).length;
  assert.equal(ok, 3);
  const [after] = await accountsOf(agent);
  assert.equal(after.balance, 100_00);
});

test('retrying with the same idempotency key does not pay twice', async () => {
  const aarav = await login('aarav@demo.bank', 'Aarav@12345');
  const diya = await login('diya@demo.bank', 'Diya@12345');
  const [from] = await accountsOf(aarav);
  const [to] = await accountsOf(diya);
  const body = { fromAccount: from.accountNumber, toAccount: to.accountNumber, amount: 50, idempotencyKey: crypto.randomUUID() };

  const [a, b] = await Promise.all([
    aarav.post('/api/transfers').set(H).send(body),
    aarav.post('/api/transfers').set(H).send(body),
  ]);
  assert.equal(a.body.reference, b.body.reference);
  const [after] = await accountsOf(aarav);
  assert.equal(after.balance, from.balance - 5000);
});

test("customers cannot send from or read someone else's account", async () => {
  const aarav = await login('aarav@demo.bank', 'Aarav@12345');
  const diya = await login('diya@demo.bank', 'Diya@12345');
  const [aaravAcct] = await accountsOf(aarav);
  const [diyaAcct] = await accountsOf(diya);

  const send = await aarav
    .post('/api/transfers')
    .set(H)
    .send({ fromAccount: diyaAcct.accountNumber, toAccount: aaravAcct.accountNumber, amount: 10 });
  assert.equal(send.status, 404);

  const read = await aarav.get(`/api/accounts/${diyaAcct.accountNumber}/transactions`);
  assert.equal(read.status, 404);
});

test('customers cannot use admin routes', async () => {
  const aarav = await login('aarav@demo.bank', 'Aarav@12345');
  const res = await aarav.get('/api/admin/customers');
  assert.equal(res.status, 403);
});

test('frozen accounts cannot send money; admin can deposit', async () => {
  const admin = await login('admin@demo.bank', 'Admin@12345');
  const diya = await login('diya@demo.bank', 'Diya@12345');
  const aarav = await login('aarav@demo.bank', 'Aarav@12345');
  const [diyaAcct] = await accountsOf(diya);
  const [aaravAcct] = await accountsOf(aarav);

  const dep = await admin.post(`/api/admin/accounts/${diyaAcct.accountNumber}/deposit`).set(H).send({ amount: 1000 });
  assert.equal(dep.status, 201);
  assert.equal(dep.body.balance, diyaAcct.balance + 1000_00);

  await admin.patch(`/api/admin/accounts/${diyaAcct.accountNumber}`).set(H).send({ status: 'frozen' });
  const send = await diya
    .post('/api/transfers')
    .set(H)
    .send({ fromAccount: diyaAcct.accountNumber, toAccount: aaravAcct.accountNumber, amount: 10 });
  assert.equal(send.status, 400);
  await admin.patch(`/api/admin/accounts/${diyaAcct.accountNumber}`).set(H).send({ status: 'active' });
});

test('logout invalidates the session on the server', async () => {
  const agent = await login('aarav@demo.bank', 'Aarav@12345');
  const cookie = (await agent.get('/api/auth/me')).headers['set-cookie'];
  await agent.post('/api/auth/logout').set(H);
  // Replaying the old cookie must not work.
  const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
  assert.equal(res.status, 401);
});
