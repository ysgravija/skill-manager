import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSkillServer } from '../src/server.mjs';

let server;
let dataDir;
let baseUrl;

before(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'skill-manager-markdown-'));
  ({ server } = await createSkillServer({ dataDir, roots: [] }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(dataDir, { recursive: true, force: true });
});

test('serves the Markdown renderer and its pinned browser dependencies', async () => {
  for (const asset of ['/markdown.js', '/vendor/marked.esm.js', '/vendor/purify.es.mjs']) {
    const response = await fetch(`${baseUrl}${asset}`, { headers: { origin: baseUrl } });
    assert.equal(response.status, 200, asset);
    assert.equal(response.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
    assert.ok((await response.text()).length > 100, asset);
  }
  const blocked = await fetch(`${baseUrl}/vendor/../../package.json`, { headers: { origin: baseUrl } });
  assert.equal(blocked.status, 404);
});
