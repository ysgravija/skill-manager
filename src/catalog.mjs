import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, realpath, rename, stat } from 'node:fs/promises';
import path from 'node:path';

const text = (value) => typeof value === 'string' ? value.trim() : '';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const ignoredDirectories = new Set(['.git', 'node_modules', '.venv', '__pycache__']);
const previewExtensions = new Set(['.md', '.txt', '.json', '.jsonl', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.sh', '.py', '.yaml', '.yml', '.toml', '.html', '.css', '.xml', '.csv', '.tsv', '.sql']);

async function skillFiles(skillFile) {
  const index = new Map();
  let count = 0;
  async function visit(directory, prefix, depth) {
    if (depth > 8 || count >= 500) return [];
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'ENOENT') return [];
      throw error;
    }
    entries.sort((a, b) => (a.name === 'SKILL.md' ? -1 : b.name === 'SKILL.md' ? 1 : a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
    const nodes = [];
    for (const entry of entries) {
      if (count >= 500) break;
      if (entry.name.startsWith('.') || ignoredDirectories.has(entry.name)) continue;
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const children = await visit(absolutePath, relativePath, depth + 1);
        if (children.length) nodes.push({ name: entry.name, path: relativePath, type: 'directory', children });
      } else if (entry.isFile()) {
        count += 1;
        index.set(relativePath, absolutePath);
        nodes.push({ name: entry.name, path: relativePath, type: 'file' });
      }
    }
    return nodes;
  }
  const tree = await visit(path.dirname(skillFile), '', 0);
  return { tree, index, supportingFileCount: Math.max(0, index.size - 1) };
}

export function parseFrontmatter(content, fallbackName) {
  if (!content.startsWith('---')) return { name: fallbackName, description: '' };
  const end = content.indexOf('\n---', 3);
  if (end < 0) return { name: fallbackName, description: '' };
  const lines = content.slice(3, end).split(/\r?\n/);
  const values = {};
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z][\w-]*):(?:\s*(.*))?$/);
    if (!match) continue;
    let value = match[2] ?? '';
    if (/^[|>][+-]?$/.test(value)) {
      const folded = value.startsWith('>');
      const parts = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        parts.push(lines[index + 1].replace(/^\s+/, ''));
        index += 1;
      }
      value = parts.join(folded ? ' ' : '\n');
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    values[match[1]] = value.trim();
  }
  return { name: text(values.name) || fallbackName, description: text(values.description) };
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'w', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, file);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function defaultRoots(projectDir, dataDir) {
  const home = process.env.HOME;
  const definitions = home ? [
    ['Agents', path.join(home, '.agents/skills')],
    ['Claude', path.join(home, '.claude/skills')],
    ['Codex', path.join(home, '.codex/skills')],
    ['Cursor', path.join(home, '.cursor/skills')]
  ] : [];
  for (const name of ['.agents/skills', '.claude/skills', '.codex/skills', '.cursor/skills']) {
    definitions.push([`Project ${path.basename(path.dirname(name))}`, path.join(projectDir, name)]);
  }
  definitions.push(['Skill Manager', path.join(dataDir, 'skills')]);
  return definitions.map(([agent, root]) => ({ agent, path: root }));
}

export function rootsFromEnvironment(projectDir, dataDir) {
  if (!process.env.SKILL_MANAGER_ROOTS) return defaultRoots(projectDir, dataDir);
  const parsed = JSON.parse(process.env.SKILL_MANAGER_ROOTS);
  if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item.agent !== 'string' || typeof item.path !== 'string')) {
    throw new Error('SKILL_MANAGER_ROOTS must be a JSON array of agent and path objects');
  }
  const managedPath = path.join(dataDir, 'skills');
  if (!parsed.some((root) => path.resolve(root.path) === path.resolve(managedPath))) {
    parsed.push({ agent: 'Skill Manager', path: managedPath });
  }
  return parsed;
}

async function scanRoot(root, accept) {
  const seenDirectories = new Set();
  async function visit(directory) {
    let canonicalDirectory;
    try {
      canonicalDirectory = await realpath(directory);
      const details = await stat(canonicalDirectory);
      if (!details.isDirectory()) return;
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    const alreadyVisited = seenDirectories.has(canonicalDirectory);
    seenDirectories.add(canonicalDirectory);
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EACCES') return;
      throw error;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.name === 'SKILL.md' && (entry.isFile() || entry.isSymbolicLink())) {
        await accept(entryPath, root.agent);
      } else if (!alreadyVisited && (entry.isDirectory() || entry.isSymbolicLink())) {
        await visit(entryPath);
      }
    }
  }
  await visit(root.path);
}

export class SkillCatalog {
  constructor({ projectDir, dataDir, roots }) {
    this.projectDir = projectDir;
    this.dataDir = dataDir;
    this.roots = roots ?? rootsFromEnvironment(projectDir, dataDir);
    const managedPath = path.join(dataDir, 'skills');
    if (!this.roots.some((root) => path.resolve(root.path) === path.resolve(managedPath))) {
      this.roots = [...this.roots, { agent: 'Skill Manager', path: managedPath }];
    }
    this.metadataFile = path.join(dataDir, 'metadata.json');
    this.eventsFile = path.join(dataDir, 'usage-events.json');
    this.metadata = {};
    this.events = [];
    this.skills = new Map();
    this.fileIndexes = new Map();
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await mkdir(path.join(this.dataDir, 'skills'), { recursive: true });
    const [metadata, events] = await Promise.all([
      readJson(this.metadataFile, {}),
      readJson(this.eventsFile, [])
    ]);
    this.metadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
    this.events = Array.isArray(events) ? events : [];
    await this.rescan();
  }

  async rescan() {
    const found = new Map();
    const fileIndexes = new Map();
    const accept = async (visiblePath, agent) => {
      let canonicalPath;
      try {
        canonicalPath = await realpath(visiblePath);
      } catch (error) {
        if (error.code === 'ENOENT') return;
        throw error;
      }
      let content;
      let details;
      try {
        details = await stat(canonicalPath);
        if (!details.isFile() || details.size > 2 * 1024 * 1024) return;
        content = await readFile(canonicalPath, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'EACCES') return;
        throw error;
      }
      const id = hash(canonicalPath);
      const existing = found.get(id);
      const location = { agent, path: visiblePath };
      if (existing) {
        if (!existing.locations.some((item) => item.agent === agent && item.path === visiblePath)) existing.locations.push(location);
        return;
      }
      const parsed = parseFrontmatter(content, path.basename(path.dirname(canonicalPath)));
      const files = await skillFiles(canonicalPath);
      fileIndexes.set(id, files.index);
      found.set(id, {
        id,
        name: parsed.name,
        description: parsed.description,
        content,
        canonicalPath,
        locations: [location],
        modifiedAt: details.mtime.toISOString(),
        hash: hash(content),
        files: files.tree,
        supportingFileCount: files.supportingFileCount
      });
    };
    for (const root of this.roots) await scanRoot(root, accept);
    for (const skill of found.values()) skill.locations.sort((a, b) => a.agent.localeCompare(b.agent) || a.path.localeCompare(b.path));
    this.skills = found;
    this.fileIndexes = fileIndexes;
    return this.list();
  }

  present(skill, includeContent = false) {
    const metadata = this.metadata[skill.id] ?? { favorite: false, notes: '', status: 'active' };
    const usageCount = this.events.reduce((count, event) => count + (event.skillId === skill.id ? 1 : 0), 0);
    const lastUsedAt = this.events.filter((event) => event.skillId === skill.id).at(-1)?.recordedAt ?? null;
    const value = { ...skill, ...metadata, usageCount, lastUsedAt };
    if (!includeContent) {
      delete value.content;
      delete value.files;
    }
    return value;
  }

  list() {
    const skills = [...this.skills.values()].map((skill) => this.present(skill)).sort((a, b) => a.name.localeCompare(b.name));
    const agents = new Set(skills.flatMap((skill) => skill.locations.map((location) => location.agent)));
    return {
      skills,
      stats: {
        skills: skills.length,
        agents: agents.size,
        favorites: skills.filter((skill) => skill.favorite).length,
        recordedUses: this.events.length
      },
      activity: this.events.slice(-100).reverse().map((event) => ({
        ...event,
        skillName: this.skills.get(event.skillId)?.name ?? 'Missing skill'
      }))
    };
  }

  get(id) {
    const skill = this.skills.get(id);
    return skill ? this.present(skill, true) : null;
  }

  async getFile(id, relativePath) {
    const absolutePath = this.fileIndexes.get(id)?.get(relativePath);
    if (!absolutePath) return null;
    const skillRoot = path.dirname(this.skills.get(id).canonicalPath);
    let canonicalFile;
    try {
      canonicalFile = await realpath(absolutePath);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    if (!canonicalFile.startsWith(`${skillRoot}${path.sep}`)) return null;
    const details = await stat(canonicalFile);
    if (!details.isFile()) return null;
    const previewable = details.size <= 512 * 1024 && previewExtensions.has(path.extname(relativePath).toLowerCase());
    return {
      path: relativePath,
      content: previewable ? await readFile(canonicalFile, 'utf8') : null,
      previewable
    };
  }

  async updateMetadata(id, changes) {
    if (!this.skills.has(id)) return null;
    await this.queueWrite(async () => {
      const next = { ...this.metadata, [id]: { favorite: false, notes: '', status: 'active', ...this.metadata[id], ...changes } };
      await atomicJson(this.metadataFile, next);
      this.metadata = next;
    });
    return this.get(id);
  }

  async recordUsage(id) {
    if (!this.skills.has(id)) return null;
    const event = { id: randomUUID(), skillId: id, recordedAt: new Date().toISOString(), source: 'manual' };
    await this.queueWrite(async () => {
      const next = [...this.events, event];
      await atomicJson(this.eventsFile, next);
      this.events = next;
    });
    return event;
  }

  queueWrite(operation) {
    const next = this.writeQueue.then(operation, operation);
    this.writeQueue = next.catch(() => {});
    return next;
  }

  async create({ name, slug, description, instructions }) {
    const directory = path.join(this.dataDir, 'skills', slug);
    const skillFile = path.join(directory, 'SKILL.md');
    try {
      await stat(directory);
      const error = new Error('A skill with this slug already exists');
      error.code = 'EEXIST';
      throw error;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await mkdir(directory, { recursive: false });
    const quote = (value) => JSON.stringify(value).replace(/\\u2028|\\u2029/g, '');
    const content = `---\nname: ${quote(name)}\ndescription: ${quote(description)}\n---\n\n${instructions.trim()}\n`;
    const handle = await open(skillFile, 'wx', 0o600);
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await this.rescan();
    const canonicalPath = await realpath(skillFile);
    return this.get(hash(canonicalPath));
  }
}
