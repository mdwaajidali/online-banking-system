# Kosh Bank: Online Banking Management System (MERN)

This repository contains my first MERN stack project from university, rebuilt to be secure and easy to use.

A secure, easy-to-use online banking system built with **MongoDB, Express, React and Node.js**.

Customers can open accounts, check balances, send money and download statements.
Bank staff can manage customers, record cash deposits and withdrawals, freeze accounts, and review a security log.

---

## Quick start

You need **Node.js 20 or newer**. You do **not** need to install MongoDB: in development a local database
starts automatically. The first run downloads it (about 390 MB, one time only).

```bash
npm run install:all   # installs root, server and client packages
npm run dev           # starts the API (port 5000) and the website (port 5173)
```

Open http://localhost:5173.

### Demo logins (development only)

The database is filled with demo data the first time it starts:

| Role       | Email             | Password      |
|------------|-------------------|---------------|
| Customer   | aarav@demo.bank   | Aarav@12345   |
| Customer   | diya@demo.bank    | Diya@12345    |
| Bank staff | admin@demo.bank   | Admin@12345   |

To wipe everything and reload the demo data, stop `npm run dev` and run `npm run seed`.

### Run the tests

```bash
npm test
```

13 automated API tests cover sign-in, lockout, injection attempts, CSRF, transfers, overdraft races,
duplicate-submit protection and access control.

---

## Features

**Customers**
- Open an account online and get a 12-digit account number immediately
- Dashboard with total balance, a show/hide balances toggle, accounts and recent activity
- **Send money** in two steps (fill in, then review and confirm). The receiver's name is shown
  (e.g. "Diya P.") as soon as the account number is typed, so you know it's the right person
- Move money between your own accounts
- Quick-amount buttons, plain-language error messages, daily limit shown up front
- Statement with filters (money in/out, date range, search), paging, **CSV download** (opens in Excel) and print
- Printable receipt with a reference number for every transfer
- Open up to 3 accounts (savings or current), with optional nicknames
- Change password, and see when you last signed in

**Bank staff (admin)**
- Overview: customers, accounts, money held, today's transactions
- Search customers by name, email, phone or account number
- Record cash **deposits and withdrawals**
- **Freeze and unfreeze** accounts; disable profiles (which signs the person out at once)
- View any account's statement
- **Activity log** of sign-ins, lockouts, transfers and staff actions, with IP addresses

**Easy to use for everyone**
- Large 17px base text, high contrast, big buttons (46px+ tap targets)
- Works on phones; dark mode follows the device setting
- Fully keyboard-usable with visible focus rings, a skip link and screen-reader labels
- Respects "reduce motion"

---

## Security

| Threat | Protection |
|---|---|
| Password theft from the database | Passwords hashed with **bcrypt** (cost 12); never returned by the API |
| Password guessing | **Lockout** after 5 wrong attempts (15 min) + **rate limiting** per IP |
| Finding out who has an account | The same "email or password is incorrect" message and timing whether or not the email exists |
| Stolen session token (XSS) | Session JWT kept in an **httpOnly** cookie that JavaScript can't read |
| Cross-site request forgery | **SameSite=Strict** cookie + a required custom header on every change |
| Old sessions staying valid | Logout, password change and "disable profile" **invalidate tokens on the server** (token versioning) |
| Walk-away on a shared computer | Automatic sign-out after 5 minutes idle, with a 60-second warning |
| NoSQL injection | Every request body is **validated with zod** to exact types, so objects like `{"$gt": ""}` are rejected |
| Spending money twice at the same moment | Transfers run in a **MongoDB transaction** with a conditional balance check, so 10 simultaneous transfers can't overdraw |
| Double-clicking "Send" | **Idempotency key** per transfer, so a repeated request returns the first result instead of paying again |
| Seeing other people's accounts | Every query is scoped to the signed-in owner; staff routes need the admin role |
| Harvesting names by guessing account numbers | Receiver lookup is rate-limited and shows only a masked name |
| Rounding errors | Money stored as whole **paise (integers)**, never floating point |
| Common web attacks | **helmet** security headers, 10 KB body limit, `Cache-Control: no-store` on all API responses |
| Accountability | Audit log of logins, lockouts, transfers and admin actions |

---

## Project structure

```
├── package.json            root scripts (dev, test, build, seed)
├── server/                 Express + Mongoose API
│   ├── src/
│   │   ├── app.js          middleware, routes, error handler
│   │   ├── server.js       starts DB + HTTP server (auto-seeds demo data in dev)
│   │   ├── seed.js         demo users and transactions
│   │   ├── config/         env settings and DB connection
│   │   ├── models/         User, Account, Transaction (ledger), AuditLog
│   │   ├── middleware/     auth (JWT cookie, roles, CSRF), validation (zod)
│   │   ├── routes/         auth, accounts/transfers, admin
│   │   └── utils/          ledger (transactions), money helpers, audit
│   └── test/api.test.js    automated tests (node:test + supertest)
└── client/                 React (Vite) website
    └── src/
        ├── pages/          Login, Register, Dashboard, SendMoney, Statement, Profile, Admin*
        ├── components/     Layout, idle timeout, transaction list, UI pieces
        └── lib/            API client, auth context, formatting
```

### How a transfer works

1. The sender's account is loaded **only if it belongs to the signed-in user**.
2. The daily limit is checked.
3. The balance is reduced with a conditional update (`balance >= amount`). If two requests race,
   only the ones that still fit succeed.
4. The receiver is credited, and two ledger entries (debit + credit) are written with the same reference.
5. Steps 1–4 run in **one database transaction**: either everything happens or nothing does.

---

## Using MongoDB Atlas (free cloud database)

1. Create a free cluster at mongodb.com/atlas and copy its connection string.
2. Copy `server/.env.example` to `server/.env` and set:
   ```
   MONGO_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/bank
   JWT_SECRET=<a long random string, 32+ characters>
   ```
3. `npm run dev`. Demo data is loaded if the database is empty.

## Deploying (free: Render + MongoDB Atlas)

GitHub Pages can only host static files, so the app runs on **Render**, which deploys from this
GitHub repo and redeploys on every push. In production one Express server serves both the website
and the API from the same HTTPS address. It refuses to start without `MONGO_URI` and a strong
`JWT_SECRET`.

**1. Database (MongoDB Atlas)**
1. Create a free **M0** cluster at mongodb.com/atlas.
2. *Database Access*: add a database user with a password.
3. *Network Access*: allow `0.0.0.0/0` (Render's free tier has no fixed IP address).
4. *Connect → Drivers*: copy the connection string and add `/bank` before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/bank?retryWrites=true&w=majority`

**2. Load demo data (optional, from your computer)**
Put that string in `server/.env` as `MONGO_URI=...` and run `npm run seed`.
Then sign in to the live site as the admin and **change the admin password** under Profile.

**3. Web service (Render)**
1. render.com → sign in with GitHub → **New → Web Service** → pick this repo.
2. Settings:
   | Field | Value |
   |---|---|
   | Build command | `npm run install:all && npm run build` |
   | Start command | `npm start` |
   | Instance type | Free |
3. Environment variables:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | your Atlas connection string |
   | `JWT_SECRET` | a long random string (Render's "Generate" button works) |
4. **Create Web Service**. After a few minutes the site is live at `https://<name>.onrender.com`.

On the free plan the service sleeps after 15 minutes without visitors, so the first visit after that
takes about a minute to load.

## Ideas to extend it

- OTP / two-factor sign-in by email or SMS
- Saved payees (beneficiaries) with a cooling-off period for new ones
- Scheduled and recurring transfers
- Interest calculation on savings accounts
- Email alerts for every transaction
- Spending charts by category
