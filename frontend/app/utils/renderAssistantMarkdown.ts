import { marked } from 'marked';
import DOMPurify from 'dompurify';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderAssistantMarkdown(text: string): string {
  try {
    const dirty = marked.parse(text || '', { breaks: true });
    return DOMPurify.sanitize(dirty as string);
  } catch {
    return escapeHtml(text);
  }
}
