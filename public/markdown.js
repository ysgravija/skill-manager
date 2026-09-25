import { Marked } from './vendor/marked.esm.js';
import DOMPurify from './vendor/purify.es.mjs';

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

const markdown = new Marked({
  gfm: true,
  renderer: {
    html(token) {
      return escapeHtml(token.text);
    }
  }
});

export function renderMarkdown(content) {
  const html = markdown.parse(content);
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['img', 'picture', 'audio', 'video', 'source', 'track', 'iframe', 'object', 'embed', 'form', 'style'],
    FORBID_ATTR: ['style'],
    ALLOW_DATA_ATTR: false
  });
}
