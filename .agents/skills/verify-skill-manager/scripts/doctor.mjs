#!/usr/bin/env node
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir || !path.isAbsolute(runDir)) {
  console.error('Usage: doctor.mjs /absolute/run-directory');
  process.exit(2);
}
const { pid, url, seedDir } = JSON.parse(await readFile(path.join(runDir, 'instance.json'), 'utf8'));
process.kill(pid, 0);
const response = await fetch(`${url}/api/skills`);
if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
const { skills } = await response.json();
const seedFile = await realpath(path.join(seedDir, 'SKILL.md'));
const seed = skills.find((skill) => skill.name === 'Verification Seed' && skill.canonicalPath === seedFile);
if (!seed || skills.length !== 1) throw new Error('Instance does not serve the isolated verification fixture');
console.log(`HEALTHY pid=${pid} url=${url} data=${path.join(runDir, 'data')} skills=1`);
