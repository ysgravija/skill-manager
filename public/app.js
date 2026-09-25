import { renderMarkdown } from './markdown.js';

const state = {
  data: null,
  view: 'library',
  search: '',
  source: '',
  status: 'active',
  selectedId: null,
  returnFocus: null
};

const $ = (selector) => document.querySelector(selector);
const content = $('#content');

function setTheme(theme) {
  const choice = theme === 'black' ? 'black' : 'light';
  document.documentElement.dataset.theme = choice;
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === choice));
  });
  try { localStorage.setItem('skill-manager-theme', choice); } catch {}
}

let savedTheme = 'light';
try { savedTheme = localStorage.getItem('skill-manager-theme') || 'light'; } catch {}
setTheme(savedTheme);

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body ? { 'content-type': 'application/json' } : undefined
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Request failed');
  return value;
}

function escape(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function relativeTime(date) {
  if (!date) return 'Never';
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  window.setTimeout(() => element.classList.remove('show'), 2200);
}

function sourceNames() {
  return [...new Set(state.data.skills.flatMap((skill) => skill.locations.map((location) => location.agent)))].sort();
}

function skillSources(skill) {
  return [...new Set(skill.locations.map((location) => location.agent))];
}

function renderFileNodes(nodes, depth = 0) {
  return `<ul class="file-list">${nodes.map((node) => node.type === 'directory'
    ? `<li><details class="file-folder" ${depth === 0 ? 'open' : ''}><summary><span aria-hidden="true">▸</span>${escape(node.name)}</summary>${renderFileNodes(node.children, depth + 1)}</details></li>`
    : `<li><button class="file-item" type="button" data-file-path="${escape(node.path)}" aria-pressed="${node.path === 'SKILL.md'}" title="${escape(node.path)}"><span aria-hidden="true">${node.name.endsWith('.md') ? '◇' : '·'}</span>${escape(node.name)}</button></li>`).join('')}</ul>`;
}

function filePaths(nodes) {
  return new Set(nodes.flatMap((node) => node.type === 'directory' ? [...filePaths(node.children)] : [node.path]));
}

function readableContent(content, filePath) {
  if (filePath !== 'SKILL.md' || !content.startsWith('---\n')) return content;
  const closing = content.indexOf('\n---\n', 4);
  return closing < 0 ? content : content.slice(closing + 5).trimStart();
}

function filteredSkills() {
  const query = state.search.trim().toLowerCase();
  return state.data.skills.filter((skill) => {
    if (state.view === 'favorites' && !skill.favorite) return false;
    if (state.status && skill.status !== state.status) return false;
    if (state.source && !skill.locations.some((location) => location.agent === state.source)) return false;
    const searchable = [
      skill.name,
      skill.description,
      skill.canonicalPath,
      ...skill.locations.map((location) => location.agent)
    ].join(' ').toLowerCase();
    return !query || searchable.includes(query);
  });
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('[data-view]').forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle('active', active);
    if (item.classList.contains('view-tab')) item.setAttribute('aria-current', active ? 'page' : 'false');
  });
  render();
}

function renderStats() {
  const stats = state.data.stats;
  $('#stat-skills').textContent = stats.skills;
  $('#stat-agents').textContent = stats.agents;
  $('#stat-favorites').textContent = stats.favorites;
  $('#stat-uses').textContent = stats.recordedUses;
  $('#matching-count').textContent = state.view === 'activity' ? state.data.activity.length : filteredSkills().length;
}

function renderSourceFilters() {
  const filters = ['', ...sourceNames()];
  $('#source-filters').innerHTML = filters.map((source) => {
    const label = source || 'All sources';
    return `<button class="filter-pill" type="button" data-source="${escape(source)}" aria-pressed="${state.source === source}">${escape(label)}</button>`;
  }).join('');
}

function renderSkills() {
  const skills = filteredSkills();
  if (!skills.length) {
    const favoriteView = state.view === 'favorites';
    content.innerHTML = `<div class="empty-state"><h2>${favoriteView ? 'No favorite skills yet' : 'No skills match these filters'}</h2><p>${favoriteView ? 'Use the star button to add a skill here.' : 'Change the search, source, or status filter.'}</p></div>`;
    return;
  }

  content.innerHTML = `
    <div class="table-scroll">
      <table class="skill-table">
        <thead>
          <tr>
            <th scope="col">Skill</th>
            <th scope="col">Source</th>
            <th scope="col">Status</th>
            <th scope="col" class="numeric">Recorded uses</th>
            <th scope="col">Last recorded</th>
            <th scope="col">Location</th>
            <th scope="col"><span class="sr-only">Favorite</span></th>
          </tr>
        </thead>
        <tbody>
          ${skills.map((skill) => `
            <tr class="skill-row" data-row-id="${escape(skill.id)}" tabindex="0">
              <td class="skill-cell">
                <button class="skill-link" type="button" data-open-skill="${escape(skill.id)}">${escape(skill.name)}</button>
                <span class="skill-description">${skill.supportingFileCount ? `<span class="file-count">${skill.supportingFileCount} supporting ${skill.supportingFileCount === 1 ? 'file' : 'files'}</span>` : ''}${escape(skill.description || '')}</span>
              </td>
              <td><div class="source-list">${skillSources(skill).map((source) => `<span class="source-pill">${escape(source)}</span>`).join('')}</div></td>
              <td><span class="status-pill ${escape(skill.status)}"><span aria-hidden="true"></span>${escape(skill.status)}</span></td>
              <td class="numeric usage-count">${skill.usageCount}</td>
              <td class="time-cell">${skill.lastUsedAt ? relativeTime(skill.lastUsedAt) : 'Never'}</td>
              <td><span class="path-cell" title="${escape(skill.canonicalPath)}">${escape(skill.canonicalPath)}</span></td>
              <td class="favorite-cell"><button class="favorite-button ${skill.favorite ? 'on' : ''}" type="button" data-favorite="${escape(skill.id)}" aria-label="${skill.favorite ? 'Remove from' : 'Add to'} favorites" aria-pressed="${skill.favorite}">${skill.favorite ? '★' : '☆'}</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderActivity() {
  const events = state.data.activity;
  if (!events.length) {
    content.innerHTML = '<div class="empty-state"><h2>No recorded activity</h2><p>Open a skill and choose "Log use" to add a manual record.</p></div>';
    return;
  }

  content.innerHTML = `
    <div class="activity-list">
      ${events.map((event) => `
        <article class="activity-item">
          <span class="activity-dot" aria-hidden="true"></span>
          <div><strong>${escape(event.skillName)}</strong><span>Use recorded manually</span></div>
          <time datetime="${escape(event.recordedAt)}">${relativeTime(event.recordedAt)}</time>
        </article>
      `).join('')}
    </div>`;
}

function render() {
  if (!state.data) return;
  $('#library-toolbar').hidden = state.view === 'activity';
  renderSourceFilters();
  renderStats();
  if (state.view === 'activity') renderActivity();
  else renderSkills();
}

async function refresh() {
  state.data = await api('/api/skills');
  if (state.source && !sourceNames().includes(state.source)) state.source = '';
  render();
}

function updateDrawerUsage(skill) {
  const count = $('#detail-usage-count');
  const last = $('#detail-last-used');
  if (count) count.textContent = skill.usageCount;
  if (last) last.textContent = skill.lastUsedAt ? relativeTime(skill.lastUsedAt) : 'Never';
}

async function openDrawer(id) {
  state.selectedId = id;
  state.returnFocus = document.activeElement;
  const skill = await api(`/api/skills/${id}`);
  let favorite = skill.favorite;

  $('#drawer-content').innerHTML = `
    <div class="reader-shell">
      <header class="reader-header">
        <div class="reader-heading">
          <p class="eyebrow">Skill library <span aria-hidden="true">/</span> ${escape(skillSources(skill).join(', '))}</p>
          <h2 class="detail-title">${escape(skill.name)}</h2>
          <p class="detail-description">${escape(skill.description || 'No description provided')}</p>
        </div>
        <div class="reader-actions">
          <button class="button secondary" id="detail-favorite" type="button" aria-pressed="${skill.favorite}">${skill.favorite ? '★ Favorited' : '☆ Add favorite'}</button>
          <button class="button primary" id="log-use" type="button">Log use</button>
        </div>
      </header>
      <div class="reader-body">
        <aside class="reader-sidebar" aria-label="Skill navigation and details">
          <div class="sidebar-heading">Files <span>${skill.supportingFileCount + 1}</span></div>
          <nav class="file-tree" id="file-tree" aria-label="Skill files">${renderFileNodes(skill.files)}</nav>
          <details class="reader-info">
            <summary>Details <span aria-hidden="true">⌄</span></summary>
            <div class="reader-info-content">
              <section class="detail-section detail-metrics" aria-label="Manual usage">
                <div><span>Recorded uses</span><strong id="detail-usage-count">${skill.usageCount}</strong></div>
                <div><span>Last recorded</span><strong id="detail-last-used">${skill.lastUsedAt ? relativeTime(skill.lastUsedAt) : 'Never'}</strong></div>
              </section>
              <section class="detail-section">
                <h3 id="status-label">Library status</h3>
                <select id="detail-status" aria-labelledby="status-label">
                  <option value="active" ${skill.status === 'active' ? 'selected' : ''}>Active</option>
                  <option value="archived" ${skill.status === 'archived' ? 'selected' : ''}>Archived</option>
                </select>
                <p class="helper">Archiving only changes this manager view.</p>
              </section>
              <section class="detail-section">
                <h3>Locations</h3>
                <div class="path">${escape(skill.canonicalPath)}</div>
                ${skill.locations.map((location) => `<div class="location"><b>${escape(location.agent)}</b><div class="path">${escape(location.path)}</div></div>`).join('')}
              </section>
              <section class="detail-section">
                <h3 id="notes-label">Private notes</h3>
                <textarea class="notes" id="detail-notes" aria-labelledby="notes-label" rows="5" maxlength="10000" placeholder="Add a reminder about this skill...">${escape(skill.notes)}</textarea>
                <div class="notes-actions"><span class="helper" id="notes-status">Saved locally.</span><button class="button secondary" id="save-notes" type="button">Save</button></div>
              </section>
            </div>
          </details>
        </aside>
        <div class="reader-document" id="reader-document">
          <div class="document-toolbar">
            <div class="document-location"><span class="document-kicker">Reading</span><strong id="file-preview-title">SKILL.md</strong></div>
            <div class="document-view" id="document-view" role="group" aria-label="Document view">
              <button type="button" data-document-mode="preview" aria-pressed="true">Preview</button>
              <button type="button" data-document-mode="source" aria-pressed="false">Source</button>
            </div>
          </div>
          <article class="markdown-body" id="file-preview-content"></article>
        </div>
      </div>
    </div>`;

  $('#drawer-backdrop').hidden = false;
  $('.app-shell').inert = true;
  $('#drawer').inert = false;
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#drawer-close').focus();

  const availableFiles = filePaths(skill.files);
  let selectedFile = 'SKILL.md';
  let selectedContent = skill.content;
  let documentMode = 'preview';
  function showDocument() {
    const isMarkdown = selectedFile.toLowerCase().endsWith('.md');
    const preview = isMarkdown && documentMode === 'preview';
    $('#document-view').hidden = !isMarkdown;
    $('#document-view').querySelectorAll('[data-document-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.documentMode === documentMode));
    });
    const body = $('#file-preview-content');
    body.classList.toggle('markdown-body', preview);
    body.classList.toggle('source-body', !preview);
    if (preview) body.innerHTML = renderMarkdown(readableContent(selectedContent, selectedFile));
    else body.textContent = selectedContent;
  }
  showDocument();

  async function selectFile(filePath) {
    if (!availableFiles.has(filePath)) return;
    selectedFile = filePath;
    documentMode = 'preview';
    $('#file-preview-title').textContent = filePath;
    $('#file-preview-content').textContent = 'Loading file…';
    $('#file-tree').querySelectorAll('[data-file-path]').forEach((item) => {
      item.setAttribute('aria-pressed', String(item.dataset.filePath === filePath));
    });
    try {
      const file = await api(`/api/skills/${id}/files?path=${encodeURIComponent(filePath)}`);
      if (state.selectedId !== id || selectedFile !== filePath) return;
      selectedContent = file.previewable ? file.content : 'Preview unavailable for this file.';
      showDocument();
      $('#reader-document').scrollTop = 0;
    } catch (error) {
      if (state.selectedId === id && selectedFile === filePath) $('#file-preview-content').textContent = error.message;
    }
  }

  $('#file-tree').onclick = (event) => {
    const button = event.target.closest('[data-file-path]');
    if (button) selectFile(button.dataset.filePath);
  };
  $('#document-view').onclick = (event) => {
    const button = event.target.closest('[data-document-mode]');
    if (!button) return;
    documentMode = button.dataset.documentMode;
    showDocument();
  };
  $('#file-preview-content').onclick = (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (href.startsWith('#')) return;
    const target = new URL(href, `https://skill.local/${selectedFile}`);
    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
      event.preventDefault();
      return;
    }
    if (target.hostname === 'skill.local') {
      event.preventDefault();
      const filePath = decodeURIComponent(target.pathname.slice(1));
      if (availableFiles.has(filePath)) selectFile(filePath);
      else toast('That file is not in this skill folder');
    } else {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  };

  $('#log-use').onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api(`/api/skills/${id}/usage`, { method: 'POST', body: '{}' });
      await refresh();
      const updated = state.data.skills.find((item) => item.id === id);
      if (updated) updateDrawerUsage(updated);
      toast('Use recorded manually');
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  };

  $('#detail-favorite').onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      favorite = !favorite;
      await api(`/api/skills/${id}`, { method: 'PATCH', body: JSON.stringify({ favorite }) });
      button.textContent = favorite ? '★ Favorited' : '☆ Add favorite';
      button.setAttribute('aria-pressed', String(favorite));
      await refresh();
    } catch (error) {
      favorite = !favorite;
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  };

  $('#detail-status').onchange = async (event) => {
    const select = event.currentTarget;
    select.disabled = true;
    try {
      await api(`/api/skills/${id}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
      await refresh();
      toast('Status saved');
    } catch (error) {
      toast(error.message);
      select.value = skill.status;
    } finally {
      select.disabled = false;
    }
  };

  $('#save-notes').onclick = async (event) => {
    const button = event.currentTarget;
    const notes = $('#detail-notes').value;
    button.disabled = true;
    $('#notes-status').textContent = 'Saving...';
    try {
      await api(`/api/skills/${id}`, { method: 'PATCH', body: JSON.stringify({ notes }) });
      await refresh();
      $('#notes-status').textContent = 'Saved locally.';
      toast('Notes saved');
    } catch (error) {
      $('#notes-status').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}

function closeDrawer() {
  const focusTarget = state.returnFocus;
  state.selectedId = null;
  state.returnFocus = null;
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#drawer').inert = true;
  $('.app-shell').inert = false;
  window.setTimeout(() => {
    if (state.selectedId) return;
    $('#drawer-backdrop').hidden = true;
    $('#drawer-content').replaceChildren();
    if (focusTarget instanceof HTMLElement && focusTarget.isConnected) focusTarget.focus();
  }, 180);
}

document.addEventListener('click', async (event) => {
  try {
    const themeControl = event.target.closest('[data-theme-choice]');
    if (themeControl) {
      setTheme(themeControl.dataset.themeChoice);
      return;
    }
    const viewControl = event.target.closest('[data-view]');
    if (viewControl) {
      setView(viewControl.dataset.view);
      return;
    }
    const sourceControl = event.target.closest('[data-source]');
    if (sourceControl) {
      state.source = sourceControl.dataset.source;
      render();
      return;
    }
    const favoriteControl = event.target.closest('[data-favorite]');
    if (favoriteControl) {
      const skill = state.data.skills.find((item) => item.id === favoriteControl.dataset.favorite);
      await api(`/api/skills/${skill.id}`, { method: 'PATCH', body: JSON.stringify({ favorite: !skill.favorite }) });
      await refresh();
      return;
    }
    const openControl = event.target.closest('[data-open-skill]');
    if (openControl) {
      await openDrawer(openControl.dataset.openSkill);
      return;
    }
    const row = event.target.closest('[data-row-id]');
    if (row && !event.target.closest('button, a, input, select, textarea')) await openDrawer(row.dataset.rowId);
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.selectedId) {
    closeDrawer();
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-row-id]')) {
    event.preventDefault();
    openDrawer(event.target.dataset.rowId).catch((error) => toast(error.message));
  }
});

$('#search').oninput = (event) => {
  state.search = event.target.value;
  render();
};
$('#status-filter').onchange = (event) => {
  state.status = event.target.value;
  render();
};
$('#drawer-close').onclick = closeDrawer;
$('#drawer-backdrop').onclick = closeDrawer;
$('#create-button').onclick = () => $('#create-dialog').showModal();
$('#modal-close').onclick = $('#modal-cancel').onclick = () => $('#create-dialog').close();

$('#rescan-button').onclick = async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.innerHTML = '<span aria-hidden="true">↻</span> Scanning';
  try {
    await api('/api/rescan', { method: 'POST', body: '{}' });
    await refresh();
    toast('Library rescanned');
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">↻</span> Rescan library';
  }
};

$('#create-form').onsubmit = async (event) => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const submit = formElement.querySelector('[type=submit]');
  submit.disabled = true;
  $('#form-error').textContent = '';
  try {
    const form = new FormData(formElement);
    const skill = await api('/api/skills', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) });
    formElement.reset();
    $('#create-dialog').close();
    state.search = '';
    state.source = '';
    state.status = '';
    $('#search').value = '';
    $('#status-filter').value = '';
    await refresh();
    setView('library');
    toast('Skill created');
    await openDrawer(skill.id);
  } catch (error) {
    $('#form-error').textContent = error.message;
  } finally {
    submit.disabled = false;
  }
};

refresh().catch((error) => {
  content.innerHTML = `<div class="empty-state"><h2>Could not load the library</h2><p>${escape(error.message)}</p></div>`;
});
