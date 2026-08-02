import fs from 'fs/promises';
import path from 'path';
import { getAllRoles, getPermissionsForRole } from './data.js';

const DATA_DIR = path.resolve('api', 'data');
const LOGS_FILE = path.join(DATA_DIR, 'access_logs.json');
const LEARNING_FILE = path.join(DATA_DIR, 'learning.json');

async function readJsonSafe(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Simple frequency-based analysis
export async function analyzeAccessPatterns({ since } = {}) {
  const logs = (await readJsonSafe(LOGS_FILE)) || [];
  const sinceTs = since ? new Date(since).getTime() : 0;

  // Aggregate by user -> resource -> actions
  const agg = new Map();

  for (const entry of logs) {
    const ts = new Date(entry.timestamp).getTime();
    if (ts < sinceTs) continue;
    const user = entry.userId || 'unknown';
    const resource = entry.resource || 'unknown';
    const action = entry.action || 'read';

    const userMap = agg.get(user) || new Map();
    const res = userMap.get(resource) || { counts: {}, total: 0 };
    res.counts[action] = (res.counts[action] || 0) + 1;
    res.total += 1;
    userMap.set(resource, res);
    agg.set(user, userMap);
  }

  // Generate recommendations
  const recommendations = [];

  for (const [user, resources] of agg.entries()) {
    // Collate permissions used by user
    const usedPermissions = new Set();
    for (const [resource, info] of resources.entries()) {
      for (const action of Object.keys(info.counts)) usedPermissions.add(action);
    }

    // Suggest role narrowing: find smallest role covering usedPermissions
    let bestRole = null;
    for (const role of getAllRoles()) {
      const perms = new Set(getPermissionsForRole(role));
      let covers = true;
      for (const p of usedPermissions) if (!perms.has(p)) covers = false;
      if (covers) {
        if (!bestRole || getPermissionsForRole(role).length < getPermissionsForRole(bestRole).length) {
          bestRole = role;
        }
      }
    }

    // If bestRole is found and user likely has broader permissions, recommend role assignment
    if (bestRole) {
      recommendations.push({
        user,
        type: 'role_assignment',
        suggestedRole: bestRole,
        confidence: 0.7 + Math.min(0.3, usedPermissions.size / 10),
        rationale: `User uses ${[...usedPermissions].join(', ')}`
      });
    }

    // Permission optimization: identify unused permissions (by role definitions)
    // For demo purposes, if a user has actions only 'read' but holds 'write' elsewhere, suggest removal
    for (const role of getAllRoles()) {
      const rolePerms = getPermissionsForRole(role);
      // If user hasn't used some perms at all, recommend pruning those perms from role assignments
      const unused = rolePerms.filter((p) => !usedPermissions.has(p));
      if (unused.length > 0) {
        recommendations.push({
          user,
          type: 'permission_prune',
          role,
          unused,
          confidence: 0.5 + Math.min(0.4, unused.length / 10),
          rationale: `Permissions not observed in recent logs: ${unused.join(', ')}`
        });
      }
    }

    // Resource-level suggestions: if user hits a resource very frequently, suggest dedicated permission
    for (const [resource, info] of resources.entries()) {
      if (info.total > 50) {
        recommendations.push({
          user,
          type: 'resource_priority',
          resource,
          accessCount: info.total,
          confidence: Math.min(0.95, 0.5 + info.total / 200),
          rationale: `High activity on ${resource} (${info.total} accesses)`
        });
      }
    }
  }

  return { recommendations, snapshotCount: logs.length };
}

export async function recordAppliedRecommendations(applied) {
  const existing = (await readJsonSafe(LEARNING_FILE)) || { applied: [] };
  existing.applied.push(...applied.map((a) => ({ ...a, appliedAt: new Date().toISOString() })));
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LEARNING_FILE, JSON.stringify(existing, null, 2), 'utf8');
  return existing;
}
