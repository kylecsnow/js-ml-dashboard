import { describe, expect, it } from 'vitest';
import { renderAssistantMarkdown } from './renderAssistantMarkdown';

describe('renderAssistantMarkdown', () => {
  it('renders markdown and forces links to open in a new tab', () => {
    const html = renderAssistantMarkdown('See [docs](https://example.com/path)');
    expect(html).toContain('href="https://example.com/path"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('strips script tags, event handlers, and javascript URLs from HTML', () => {
    const html = renderAssistantMarkdown(
      '<script>alert(1)</script><p>safe</p><img src=x onerror="alert(1)"><a href="javascript:alert(1)">click</a>',
    );
    expect(html).toContain('safe');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/javascript:/i);
  });
});
