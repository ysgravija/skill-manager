#!/usr/bin/env node
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSkillServer } from '../../../../src/server.mjs';

const runDir = await mkdtemp(path.join(os.tmpdir(), 'skill-manager-verify-'));
console.log(`RUN_DIR=${runDir}`);
const seedDir = path.join(runDir, 'roots', 'verification-seed');
await mkdir(path.join(seedDir, 'references'), { recursive: true });
await writeFile(path.join(seedDir, 'SKILL.md'), `---
name: Verification Seed
description: Isolated skill for browser verification.
---

# Verification Seed

Read the [reference guide](references/guide.md) before using this skill.
`);
await writeFile(path.join(seedDir, 'references', 'guide.md'), '# Reference guide\n\nThe isolated reference is readable.\n');

const { server } = await createSkillServer({
  dataDir: path.join(runDir, 'data'),
  roots: [{ agent: 'Verification', path: path.join(runDir, 'roots') }]
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const url = `http://127.0.0.1:${server.address().port}`;
await writeFile(path.join(runDir, 'instance.json'), JSON.stringify({ pid: process.pid, url, seedDir }, null, 2));
console.log(`READY_URL=${url}`);

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(() => process.exit(0));
  server.closeAllConnections();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
