import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderAssistantMarkdown } from './renderAssistantMarkdown';

describe('renderAssistantMarkdown', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders markdown and forces links to open in a new tab', () => {
    const html = renderAssistantMarkdown('See [docs](https://example.com/path)');
    expect(html).toContain('href="https://example.com/path"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('strips script tags and javascript URLs', () => {
    const html = renderAssistantMarkdown(
      '<script>alert(1)</script>[click](javascript:alert(1))',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
  });

  it('escapes the original text when markdown parsing fails', async () => {
    const marked = await import('marked');
    vi.spyOn(marked, 'parse').mockImplementation(() => {
      throw new Error('parse failed');
    });
    expect(renderAssistantMarkdown('<b>raw</b>')).toBe('&lt;b&gt;raw&lt;/b&gt;');
  });
});
