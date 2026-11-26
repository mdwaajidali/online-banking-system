import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import adminRoutes from './routes/admin.js';
import { requireCsrfHeader } from './middleware/auth.js';
import { config } from './config/env.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // correct client IPs for rate limiting behind a proxy (Render, Railway, nginx)
  app.use(helmet());
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.use('/api', requireCsrfHeader);
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store'); // never cache banking data in the browser or proxies
    next();
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', accountRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // In production the built React app is served from the same origin as the API.
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  // Express 5 forwards errors thrown in async handlers here.
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    const status = err.status && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({
      error: status === 500 ? 'Something went wrong on our side. Please try again.' : err.message,
      ...(status === 500 && !config.isProd ? { debug: err.message } : {}),
    });
  });

  return app;
}
