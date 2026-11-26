import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production');
}

export const config = {
  isProd,
  // Hosting platforms (Render, Railway…) set PORT in production. In development the
  // Vite proxy always points at 5000, so we don't let a stray PORT variable move it.
  port: Number(isProd ? process.env.PORT : process.env.API_PORT) || 5000,
  mongoUri: process.env.MONGO_URI || '',
  // Dev-only fallback secret. Production refuses to start without a real one (see above).
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me-dev-only-secret',
  sessionMinutes: Number(process.env.SESSION_MINUTES) || 30,
  // Max a customer can send per day, in paise (default ₹2,00,000).
  dailyTransferLimit: Number(process.env.DAILY_TRANSFER_LIMIT_PAISE) || 200000_00,
  maxLoginAttempts: 5,
  lockMinutes: 15,
};
