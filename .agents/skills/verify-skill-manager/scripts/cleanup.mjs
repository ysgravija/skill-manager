#!/usr/bin/env node
import { readFile, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir || !path.isAbsolute(runDir)) {
  console.error('Usage: cleanup.mjs /absolute/run-directory');
  process.exit(2);
}
const canonicalRunDir = await realpath(runDir);
const canonicalTempDir = await realpath(os.tmpdir());
if (path.dirname(canonicalRunDir) !== canonicalTempDir || !path.basename(canonicalRunDir).startsWith('skill-manager-verify-')) {
  throw new Error('Refusing to remove a directory outside the verification scratch area');
}
const { pid } = JSON.parse(await readFile(path.join(canonicalRunDir, 'instance.json'), 'utf8'));
try {
  process.kill(pid, 0);
  throw new Error('Verification server is still running; stop its terminal session first');
} catch (error) {
  if (error.code !== 'ESRCH') throw error;
}
await rm(canonicalRunDir, { recursive: true });
console.log(`REMOVED ${canonicalRunDir}`);
