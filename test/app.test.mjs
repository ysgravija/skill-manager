import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSkillServer } from '../src/server.mjs';

let temporaryDirectory;
let dataDirectory;
let roots;
let running;
let baseUrl;

async function start() {
  const result = await createSkillServer({ dataDir: dataDirectory, roots });
  await new Promise((resolve, reject) => {
    result.server.once('error', reject);
    result.server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = result.server.address();
  running = result.server;
  baseUrl = `http://127.0.0.1:${port}`;
}

function stop() {
  if (!running) return Promise.resolve();
  return new Promise((resolve, reject) => running.close((error) => error ? reject(error) : resolve()));
}

async function request(route, options = {}) {
  return fetch(`${baseUrl}${route}`, {
    ...options,
    headers: { origin: baseUrl, ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers }
  });
}

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'skill-manager-test-'));
  dataDirectory = path.join(temporaryDirectory, 'data');
  const firstRoot = path.join(temporaryDirectory, 'agent-one');
  const secondRoot = path.join(temporaryDirectory, 'agent-two');
  const skillDirectory = path.join(firstRoot, 'daily-brief');
  await mkdir(path.join(skillDirectory, 'references', 'examples'), { recursive: true });
  await mkdir(secondRoot, { recursive: true });
  await writeFile(path.join(skillDirectory, 'SKILL.md'), '---\nname: "Daily brief"\ndescription: >-\n  Summarizes active work\n  without invented telemetry.\n---\n\n# Instructions\n\nWrite the brief.\n');
  await writeFile(path.join(skillDirectory, 'references', 'format.md'), '# Format\n\nLead with the result.\n');
  await writeFile(path.join(skillDirectory, 'references', 'examples', 'short.md'), '# Short example\n');
  await writeFile(path.join(temporaryDirectory, 'outside.md'), 'Outside the skill');
  await symlink(path.join(temporaryDirectory, 'outside.md'), path.join(skillDirectory, 'references', 'outside.md'));
  await symlink(skillDirectory, path.join(secondRoot, 'brief-alias'));
  await symlink(skillDirectory, path.join(secondRoot, 'second-brief-alias'));
  await symlink(path.join(skillDirectory, 'SKILL.md'), path.join(secondRoot, 'unrelated-file-link'));
  roots = [{ agent: 'Agent One', path: firstRoot }, { agent: 'Agent Two', path: secondRoot }];
  await start();
});

after(async () => {
  await stop();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

test('deduplicates symlinked skills and retains source locations', async () => {
  const response = await request('/api/skills');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.skills.length, 1);
  assert.equal(body.skills[0].name, 'Daily brief');
  assert.equal(body.skills[0].description, 'Summarizes active work without invented telemetry.');
  assert.deepEqual(body.skills[0].locations.map((location) => location.agent), ['Agent One', 'Agent Two', 'Agent Two']);
  assert.equal(body.stats.recordedUses, 0);
  assert.equal(body.skills[0].supportingFileCount, 2);
  assert.equal('files' in body.skills[0], false);
});

test('shows the file hierarchy and previews only indexed files in the skill folder', async () => {
  const list = await (await request('/api/skills')).json();
  const id = list.skills[0].id;
  const detail = await (await request(`/api/skills/${id}`)).json();
  assert.deepEqual(detail.files, [
    { name: 'SKILL.md', path: 'SKILL.md', type: 'file' },
    { name: 'references', path: 'references', type: 'directory', children: [
      { name: 'examples', path: 'references/examples', type: 'directory', children: [
        { name: 'short.md', path: 'references/examples/short.md', type: 'file' }
      ] },
      { name: 'format.md', path: 'references/format.md', type: 'file' }
    ] }
  ]);
  const preview = await request(`/api/skills/${id}/files?path=references%2Fformat.md`);
  assert.equal(preview.status, 200);
  assert.deepEqual(await preview.json(), { path: 'references/format.md', content: '# Format\n\nLead with the result.\n', previewable: true });
  assert.equal((await request(`/api/skills/${id}/files?path=references%2Foutside.md`)).status, 404);
  assert.equal((await request(`/api/skills/${id}/files?path=..%2Foutside.md`)).status, 404);
  assert.equal((await request(`/api/skills/${id}/files?path=SKILL.md&path=references%2Fformat.md`)).status, 400);
  assert.equal((await request(`/api/skills/${'0'.repeat(64)}/files?path=SKILL.md`)).status, 404);
});

test('rejects foreign origins and path traversal', async () => {
  const foreign = await request('/api/skills', { headers: { origin: 'http://localhost:9999' } });
  assert.equal(foreign.status, 403);
  const crossSite = await request('/api/skills', { headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(crossSite.status, 403);
  const traversal = await request('/%2e%2e/%2e%2e/etc/passwd');
  assert.equal(traversal.status, 404);
});

test('allows opening the home page from another site', async () => {
  const response = await fetch(`${baseUrl}/`, {
    headers: { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' }
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<title>Skill Manager<\/title>/);
});

test('validates creation and never overwrites an existing slug', async () => {
  const invalid = await request('/api/skills', { method: 'POST', body: JSON.stringify({ name: 'Bad', slug: '../bad', description: '', instructions: 'No' }) });
  assert.equal(invalid.status, 400);
  const input = { name: 'Release notes', slug: 'release-notes', description: 'Writes a concise release note.', instructions: '# Instructions\n\nDescribe the shipped change.' };
  const created = await request('/api/skills', { method: 'POST', body: JSON.stringify(input) });
  assert.equal(created.status, 201);
  const skill = await created.json();
  assert.equal(skill.name, 'Release notes');
  assert.equal(skill.locations[0].agent, 'Skill Manager');
  const duplicate = await request('/api/skills', { method: 'POST', body: JSON.stringify(input) });
  assert.equal(duplicate.status, 409);
});

test('persists metadata and manual usage through a restart', async () => {
  const list = await (await request('/api/skills')).json();
  const skill = list.skills.find((item) => item.name === 'Daily brief');
  const changed = await request(`/api/skills/${skill.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ favorite: true, notes: 'Use before the morning check-in.', status: 'archived' })
  });
  assert.equal(changed.status, 200);
  assert.equal((await request(`/api/skills/${skill.id}/usage`, { method: 'POST', body: '{}' })).status, 201);
  assert.equal((await request(`/api/skills/${skill.id}/usage`, { method: 'POST', body: '{}' })).status, 201);

  await stop();
  running = null;
  await start();

  const detail = await (await request(`/api/skills/${skill.id}`)).json();
  assert.equal(detail.favorite, true);
  assert.equal(detail.notes, 'Use before the morning check-in.');
  assert.equal(detail.status, 'archived');
  assert.equal(detail.usageCount, 2);
  assert.equal(detail.lastUsedAt !== null, true);
  const restartedList = await (await request('/api/skills')).json();
  assert.equal(restartedList.stats.favorites, 1);
  assert.equal(restartedList.stats.recordedUses, 2);
});

test('rejects unknown skill IDs and unexpected fields', async () => {
  const missing = '0'.repeat(64);
  assert.equal((await request(`/api/skills/${missing}`)).status, 404);
  const list = await (await request('/api/skills')).json();
  const id = list.skills[0].id;
  const extra = await request(`/api/skills/${id}`, { method: 'PATCH', body: JSON.stringify({ favorite: true, path: '/tmp/other' }) });
  assert.equal(extra.status, 400);
});
