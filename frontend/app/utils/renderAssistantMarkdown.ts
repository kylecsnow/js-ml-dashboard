import { marked } from 'marked';
import DOMPurify from 'dompurify';

let linkHookInstalled = false;

function ensureLinksOpenInNewTabs(): void {
  if (linkHookInstalled) return;
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.nodeName !== 'A') return;
    const anchor = node as Element;
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  });
  linkHookInstalled = true;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unescapeLiteralNewlines(text: string): string {
  if (!text.includes('\\')) {
    return text;
  }
  return text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
}

export function renderAssistantMarkdown(text: string): string {
  try {
    ensureLinksOpenInNewTabs();
    const dirty = marked.parse(unescapeLiteralNewlines(text || ''), { breaks: true });
    return DOMPurify.sanitize(dirty as string);
  } catch {
    return escapeHtml(text);
  }
}
