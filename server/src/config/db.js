import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './env.js';

let memoryServer = null;

/**
 * Connects to MongoDB.
 * - If MONGO_URI is set (e.g. MongoDB Atlas), that is used. It must support
 *   transactions (Atlas does; a local mongod needs to run as a replica set).
 * - Otherwise, in development, a local single-node replica set is started with
 *   mongodb-memory-server and its data is kept in server/.data so it survives restarts.
 */
export async function connectDB({ ephemeral = false } = {}) {
  let uri = config.mongoUri;

  if (!uri) {
    if (config.isProd) throw new Error('MONGO_URI is required in production');
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    const opts = { replSet: { count: 1, storageEngine: 'wiredTiger' } };
    if (!ephemeral) {
      const dbPath = path.resolve('.data/db');
      fs.mkdirSync(dbPath, { recursive: true });
      opts.instanceOpts = [{ dbPath, port: 27019 }];
    }
    console.log(ephemeral ? '' : 'No MONGO_URI set: starting local development database (first run downloads MongoDB, ~1 min)...');
    memoryServer = await MongoMemoryReplSet.create(opts);
    uri = memoryServer.getUri('bank');
  }

  await mongoose.connect(uri);
  if (!ephemeral) console.log('MongoDB connected');
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
