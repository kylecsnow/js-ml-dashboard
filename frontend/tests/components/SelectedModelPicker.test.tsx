import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectedModelPicker from '../../app/components/SelectedModelPicker';

const modelState = vi.hoisted(() => ({
  selectedModel: 'pharma-tablets_RF',
  setSelectedModel: vi.fn(),
}));

vi.mock('../../app/contexts/ModelContext', () => ({
  useModel: () => modelState,
}));

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SelectedModelPicker', () => {
  beforeEach(() => {
    modelState.selectedModel = 'pharma-tablets_RF';
    modelState.setSelectedModel.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ models: ['pharma-tablets_RF', 'other_model'] })),
    );
  });

  it('loads models and selects the current model', async () => {
    render(<SelectedModelPicker />);

    const select = screen.getByLabelText('Selected model:');
    await waitFor(() => {
      expect(select).toHaveValue('pharma-tablets_RF');
      expect(screen.getByRole('option', { name: 'other_model' })).toBeInTheDocument();
    });
  });

  it('updates the selected model', async () => {
    const user = userEvent.setup();
    render(<SelectedModelPicker />);

    const select = screen.getByLabelText('Selected model:');
    await waitFor(() => expect(screen.getByRole('option', { name: 'other_model' })).toBeInTheDocument());
    await user.selectOptions(select, 'other_model');

    expect(modelState.setSelectedModel).toHaveBeenCalledWith('other_model');
  });
});
