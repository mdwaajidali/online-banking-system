import { AuditLog } from '../models/AuditLog.js';

export async function audit(req, action, { actor, target, details } = {}) {
  try {
    await AuditLog.create({ actor: actor ?? req.user?._id, action, target, details, ip: req.ip });
  } catch (err) {
    console.error('Audit log write failed', err);
  }
}
