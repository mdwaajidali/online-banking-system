import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { config } from './config/env.js';

await connectDB();

if (!config.isProd) {
  const { seedDemoData, DEMO_USERS } = await import('./seed.js');
  if (await seedDemoData()) {
    console.log('Empty database: loaded demo data. Sign in with:');
    for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(8)} ${u.email}  /  ${u.password}`);
  }
}

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

async function shutdown() {
  server.close();
  await disconnectDB();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
