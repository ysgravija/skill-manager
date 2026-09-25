import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillCatalog } from './catalog.mjs';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.dirname(sourceDir);
const publicDir = path.join(projectDir, 'public');
const MAX_BODY = 64 * 1024;
const staticFiles = new Map([
  ['/', [path.join(publicDir, 'index.html'), 'text/html; charset=utf-8']],
  ['/app.js', [path.join(publicDir, 'app.js'), 'text/javascript; charset=utf-8']],
  ['/markdown.js', [path.join(publicDir, 'markdown.js'), 'text/javascript; charset=utf-8']],
  ['/styles.css', [path.join(publicDir, 'styles.css'), 'text/css; charset=utf-8']],
  ['/vendor/marked.esm.js', [path.join(projectDir, 'node_modules/marked/lib/marked.esm.js'), 'text/javascript; charset=utf-8']],
  ['/vendor/purify.es.mjs', [path.join(projectDir, 'node_modules/dompurify/dist/purify.es.mjs'), 'text/javascript; charset=utf-8']]
]);

function json(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  response.end(body);
}

function isLocalHostname(hostname) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

function requestAllowed(request) {
  try {
    const host = new URL(`http://${request.headers.host}`).hostname;
    if (!isLocalHostname(host)) return false;
    const isHomeNavigation = request.method === 'GET'
      && new URL(request.url, `http://${request.headers.host}`).pathname === '/';
    if (request.headers['sec-fetch-site'] === 'cross-site' && !isHomeNavigation) return false;
    if (request.headers.origin) {
      const origin = new URL(request.headers.origin);
      if (origin.protocol !== 'http:' || origin.host !== request.headers.host) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function bodyJson(request) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    const error = new Error('Content-Type must be application/json');
    error.status = 415;
    throw error;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const error = new Error('Request body is too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON');
    error.status = 400;
    throw error;
  }
}

function exactObject(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => allowed.includes(key));
}

function validateMetadata(value) {
  if (!exactObject(value, ['favorite', 'notes', 'status']) || Object.keys(value).length === 0) return null;
  const parsed = {};
  if ('favorite' in value) {
    if (typeof value.favorite !== 'boolean') return null;
    parsed.favorite = value.favorite;
  }
  if ('notes' in value) {
    if (typeof value.notes !== 'string' || value.notes.length > 10000) return null;
    parsed.notes = value.notes;
  }
  if ('status' in value) {
    if (value.status !== 'active' && value.status !== 'archived') return null;
    parsed.status = value.status;
  }
  return parsed;
}

function validateCreate(value) {
  if (!exactObject(value, ['name', 'slug', 'description', 'instructions'])) return null;
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 100) return null;
  if (typeof value.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) || value.slug.length > 64) return null;
  if (typeof value.description !== 'string' || value.description.length > 500) return null;
  if (typeof value.instructions !== 'string' || !value.instructions.trim() || value.instructions.length > 50000) return null;
  return { name: value.name.trim(), slug: value.slug, description: value.description.trim(), instructions: value.instructions };
}

export async function createSkillServer(options = {}) {
  const dataDir = options.dataDir ?? process.env.SKILL_MANAGER_DATA_DIR ?? path.join(projectDir, 'data');
  const catalog = options.catalog ?? new SkillCatalog({ projectDir, dataDir, roots: options.roots });
  await catalog.initialize();
  const server = createServer(async (request, response) => {
    if (!requestAllowed(request)) return json(response, 403, { error: 'Requests must come from localhost' });
    const url = new URL(request.url, `http://${request.headers.host}`);
    try {
      if (url.pathname === '/api/skills' && request.method === 'GET') return json(response, 200, catalog.list());
      if (url.pathname === '/api/skills' && request.method === 'POST') {
        const input = validateCreate(await bodyJson(request));
        if (!input) return json(response, 400, { error: 'Invalid skill' });
        try {
          return json(response, 201, await catalog.create(input));
        } catch (error) {
          if (error.code === 'EEXIST') return json(response, 409, { error: error.message });
          throw error;
        }
      }
      if (url.pathname === '/api/rescan' && request.method === 'POST') {
        const input = await bodyJson(request);
        if (!exactObject(input, []) || Object.keys(input).length) return json(response, 400, { error: 'Request body must be empty JSON object' });
        return json(response, 200, { scanned: (await catalog.rescan()).skills.length });
      }
      const detail = url.pathname.match(/^\/api\/skills\/([a-f0-9]{64})$/);
      if (detail && request.method === 'GET') {
        const skill = catalog.get(detail[1]);
        return skill ? json(response, 200, skill) : json(response, 404, { error: 'Skill not found' });
      }
      const skillFile = url.pathname.match(/^\/api\/skills\/([a-f0-9]{64})\/files$/);
      if (skillFile && request.method === 'GET') {
        const paths = url.searchParams.getAll('path');
        if (paths.length !== 1 || !paths[0]) return json(response, 400, { error: 'File path is required' });
        const file = await catalog.getFile(skillFile[1], paths[0]);
        return file ? json(response, 200, file) : json(response, 404, { error: 'File not found' });
      }
      if (detail && request.method === 'PATCH') {
        const input = validateMetadata(await bodyJson(request));
        if (!input) return json(response, 400, { error: 'Invalid metadata' });
        const skill = await catalog.updateMetadata(detail[1], input);
        return skill ? json(response, 200, skill) : json(response, 404, { error: 'Skill not found' });
      }
      const usage = url.pathname.match(/^\/api\/skills\/([a-f0-9]{64})\/usage$/);
      if (usage && request.method === 'POST') {
        const input = await bodyJson(request);
        if (!exactObject(input, []) || Object.keys(input).length) return json(response, 400, { error: 'Request body must be empty JSON object' });
        const event = await catalog.recordUsage(usage[1]);
        return event ? json(response, 201, event) : json(response, 404, { error: 'Skill not found' });
      }
      if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Not found' });
      const asset = staticFiles.get(url.pathname);
      if (!asset || request.method !== 'GET') return json(response, 404, { error: 'Not found' });
      const contents = await readFile(asset[0]);
      response.writeHead(200, {
        'content-type': asset[1],
        'content-length': contents.length,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        'referrer-policy': 'no-referrer'
      });
      response.end(contents);
    } catch (error) {
      json(response, error.status ?? 500, { error: error.status ? error.message : 'Internal server error' });
    }
  });
  return { server, catalog };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = await createSkillServer();
  const port = Number(process.env.PORT ?? 4317);
  server.listen(port, '127.0.0.1', () => console.log(`Skill Manager is running at http://127.0.0.1:${port}`));
}
