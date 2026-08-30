import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import ShapWaterfallPlotsPage from '../../app/shap-waterfall-plots/page';

const modelState = vi.hoisted(() => ({
  selectedModel: 'pharma-tablets_RF',
  setSelectedModel: vi.fn(),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div>shap plot</div>,
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('../../app/components/Sidebar', () => ({
  default: () => <nav aria-label="Sidebar" />,
}));

vi.mock('../../app/components/SelectedModelPicker', () => ({
  default: () => <div>Selected model picker</div>,
}));

vi.mock('../../app/contexts/ModelContext', () => ({
  useModel: () => modelState,
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const plotPayload = {
  plot_data: {
    data: [{ x: [1], y: [1], type: 'scatter' }],
    layout: { title: 'SHAP' },
  },
};

describe('ShapWaterfallPlotsPage model switching', () => {
  beforeEach(() => {
    modelState.selectedModel = 'pharma-tablets_RF';
    vi.stubGlobal('fetch', vi.fn());
  });

  it('does not keep a stale error after switching models', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('output-variable-options/pharma-tablets_RF')) {
        return jsonResponse({ output_variable_options: ['HARDNESS'] });
      }
      if (url.includes('output-variable-options/diabetes_RF')) {
        return jsonResponse({ output_variable_options: ['target'] });
      }
      if (url.includes('sample-options/')) {
        return jsonResponse({ sample_options: ['3'] });
      }
      if (url.includes('shap-waterfall-plots/pharma-tablets_RF')) {
        return jsonResponse(plotPayload);
      }
      if (url.includes('shap-waterfall-plots/diabetes_RF')) {
        const body = JSON.parse(String(init?.body));
        if (body.selected_output === 'HARDNESS') {
          return jsonResponse({ detail: 'bad output' }, 500);
        }
        return jsonResponse(plotPayload);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { rerender } = render(<ShapWaterfallPlotsPage />);

    await waitFor(() => {
      expect(screen.getByText('shap plot')).toBeInTheDocument();
    });

    modelState.selectedModel = 'diabetes_RF';
    rerender(<ShapWaterfallPlotsPage />);

    await waitFor(() => {
      expect(screen.getByText('shap plot')).toBeInTheDocument();
      expect(screen.queryByText(/categorical output/i)).not.toBeInTheDocument();
    });

    const staleRequests = fetchMock.mock.calls.filter(([input, init]) => {
      const url = String(input);
      if (!url.includes('shap-waterfall-plots/diabetes_RF')) return false;
      const body = JSON.parse(String(init?.body));
      return body.selected_output === 'HARDNESS';
    });
    expect(staleRequests).toHaveLength(0);
  });
});
