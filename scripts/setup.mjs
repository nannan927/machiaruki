#!/usr/bin/env node
import { execSync } from 'node:child_process';

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const registry = process.env.npm_config_registry || 'https://registry.npmjs.org/';
const reachable = run(`npm ping --registry ${registry}`);

if (!reachable) {
  console.error('\n[setup] npm registry is unreachable from this environment.');
  console.error(`[setup] current registry: ${registry}`);
  console.error('[setup] Please set an accessible registry, then run npm install again.');
  console.error('[setup] Example: npm config set registry https://<your-private-registry>/\n');
  process.exit(1);
}

console.log('[setup] npm registry is reachable. Run: npm install');
