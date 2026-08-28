import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import DatasetGeneratorPage from './page';
import type { SavedSchemaEntry } from './types';

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('../components/Sidebar', () => ({
  default: () => <nav aria-label="Sidebar" />,
}));

vi.mock('../components/dataset-generator/ChatSidebar', () => ({
  default: () => null,
}));

const schema: SavedSchemaEntry = {
  id: 1,
  name: 'DLP resin',
  created_at: null,
  config: {
    generalInputs: [{
      id: 'temp',
      name: 'Cure Temperature',
      min: '20',
      max: '80',
      units: 'degC',
    }],
    formulationGroups: [{
      id: 'resins',
      name: 'Base Resin',
      min: '0.5',
      max: '1',
      minIngredients: '1',
      maxIngredients: '1',
      ingredients: [{
        id: 'udma',
        name: 'UDMA',
        min: '0.5',
        max: '0.9',
        units: '',
        required: false,
      }],
    }],
    outputs: [{
      id: 'strength',
      name: 'Tensile Strength',
      min: '5',
      max: '90',
      units: 'MPa',
    }],
    numRows: 40,
    noise: 0.02,
    filename: 'dlp_resin',
    minIngredientsPerFormulation: '1',
    maxIngredientsPerFormulation: '1',
    coefficientValues: {
      strength: { temp: '0.1', udma: '0.7' },
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('DatasetGeneratorPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/schemas') && (!init?.method || init.method === 'GET')) {
        return jsonResponse({ schemas: [schema] });
      }
      if (url.includes('/api/dataset-generator')) {
        return jsonResponse({
          csv_string: 'a,b\n1,2',
          components_csv_string: 'c,d\n3,4',
        });
      }
      return jsonResponse({ detail: 'not found' }, 404);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('blocks generate on an empty form without posting', async () => {
    const user = userEvent.setup();
    render(<DatasetGeneratorPage />);

    await user.click(screen.getByRole('button', { name: /Export CSV\s*\(Compact Format\)/i }));

    expect(screen.getByText(/At least one General Input OR one Formulation Input is required/i)).toBeInTheDocument();
    const generateCalls = vi.mocked(fetch).mock.calls.filter(([url]) =>
      String(url).includes('/api/dataset-generator'),
    );
    expect(generateCalls).toHaveLength(0);
  });

  it('loads a saved schema, marks an ingredient required, and posts the generate payload', async () => {
    const user = userEvent.setup();
    render(<DatasetGeneratorPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Load Schema \(1\)/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Load Schema \(1\)/ }));
    await user.click(screen.getByRole('button', { name: 'DLP resin' }));

    expect(screen.getByDisplayValue('Cure Temperature')).toBeInTheDocument();
    expect(screen.getByDisplayValue('UDMA')).toBeInTheDocument();

    const inclusion = screen.getByRole('group', { name: 'Ingredient inclusion' });
    await user.click(within(inclusion).getByRole('button', { name: 'Required' }));

    await user.click(screen.getByRole('button', { name: /Export CSV\s*\(Compact Format\)/i }));

    await waitFor(() => {
      const generateCalls = vi.mocked(fetch).mock.calls.filter(([url]) =>
        String(url).includes('/api/dataset-generator'),
      );
      expect(generateCalls).toHaveLength(1);
    });

    const generateCall = vi.mocked(fetch).mock.calls.find(([url]) =>
      String(url).includes('/api/dataset-generator'),
    );
    expect(generateCall?.[1]?.method).toBe('POST');
    const body = JSON.parse(String(generateCall?.[1]?.body));
    expect(body.output_format).toBe('compact');
    expect(body.formulation_groups[0].ingredients[0]).toMatchObject({
      name: 'UDMA',
      required: true,
      min: '0.5',
      max: '0.9',
    });
    expect(body.general_inputs[0].name).toBe('Cure Temperature');
    expect(body.outputs[0].name).toBe('Tensile Strength');
    expect(body.coefs).toEqual([[0.1, 0.7]]);
  });
});
