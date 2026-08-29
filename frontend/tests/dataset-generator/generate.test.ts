import { describe, expect, it } from 'vitest';
import {
  buildGenerateRequest,
  defaultGlobalIngredientCounts,
  resolveGroupIngredientCounts,
  resolveMaxBound,
  resolveMinBound,
} from '../../app/dataset-generator/generate';
import type {
  CoefficientTableValue,
  DescriptorGroup,
  FormulationGroup,
} from '../../app/dataset-generator/types';
import type { GenerateFormInput } from '../../app/dataset-generator/generate';

const general = (overrides: Partial<DescriptorGroup> = {}): DescriptorGroup => ({
  id: 'gen-1',
  name: 'Cure Temperature',
  min: '20',
  max: '200',
  units: 'degC',
  ...overrides,
});

const output = (overrides: Partial<DescriptorGroup> = {}): DescriptorGroup => ({
  id: 'out-1',
  name: 'Tensile Strength',
  min: '5',
  max: '90',
  units: 'MPa',
  ...overrides,
});

const ingredient = (
  overrides: Partial<FormulationGroup['ingredients'][number]> = {},
): FormulationGroup['ingredients'][number] => ({
  id: 'ing-1',
  name: 'UDMA',
  min: '0.5',
  max: '0.9',
  units: '',
  required: true,
  ...overrides,
});

const formulationGroup = (overrides: Partial<FormulationGroup> = {}): FormulationGroup => ({
  id: 'grp-1',
  name: 'Base Resin',
  min: '0.5',
  max: '1',
  minIngredients: '',
  maxIngredients: '',
  ingredients: [ingredient()],
  ...overrides,
});

const coefficients: CoefficientTableValue = {
  'out-1': { 'gen-1': '0.2', 'ing-1': '0.8' },
};

const validInput = (overrides: Partial<GenerateFormInput> = {}): GenerateFormInput => ({
  filename: 'resin_dataset',
  generalInputs: [general()],
  formulationGroups: [formulationGroup()],
  outputs: [output()],
  numRows: 50,
  noise: 0.025,
  minIngredientsPerFormulation: '',
  maxIngredientsPerFormulation: '',
  coefficientValues: coefficients,
  outputFormat: 'compact',
  ...overrides,
});

describe('bound defaults', () => {
  it('fills blank min/max with 0 and 1', () => {
    expect(resolveMinBound('')).toBe('0');
    expect(resolveMinBound('  ')).toBe('0');
    expect(resolveMaxBound('')).toBe('1');
    expect(resolveMinBound('0.25')).toBe('0.25');
  });
});

describe('ingredient count resolution', () => {
  it('defaults per-group min to 1 and max to group size', () => {
    const resolved = resolveGroupIngredientCounts(formulationGroup({
      ingredients: [ingredient(), ingredient({ id: 'ing-2', name: 'IBOA', required: false })],
    }));
    expect(resolved).toEqual({ min: 1, max: 2, requiredCount: 1 });
  });

  it('counts required ingredients separately from explicit min/max', () => {
    const resolved = resolveGroupIngredientCounts(formulationGroup({
      minIngredients: '0',
      maxIngredients: '1',
      ingredients: [ingredient({ required: true }), ingredient({ id: 'ing-2', name: 'IBOA', required: false })],
    }));
    expect(resolved.requiredCount).toBe(1);
    expect(resolved.min).toBe(0);
    expect(resolved.max).toBe(1);
  });

  it('defaults global min to 1 when groups would otherwise allow zero ingredients', () => {
    const counts = defaultGlobalIngredientCounts([
      formulationGroup({
        minIngredients: '0',
        ingredients: [ingredient({ required: false, min: '0' })],
      }),
    ]);
    expect(counts.min).toBe(1);
    expect(counts.max).toBe(1);
  });
});

describe('buildGenerateRequest', () => {
  it('builds a payload with resolved bounds, counts, and coefficients', () => {
    const result = buildGenerateRequest(validInput({
      formulationGroups: [formulationGroup({ min: '', max: '' })],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.output_format).toBe('compact');
    expect(result.payload.formulation_groups[0].min).toBe('0');
    expect(result.payload.formulation_groups[0].max).toBe('1');
    expect(result.payload.formulation_groups[0].min_ingredients).toBeNull();
    expect(result.payload.formulation_groups[0].ingredients[0].min).toBe('0.5');
    expect(result.payload.min_ingredients_per_formulation).toBe(1);
    expect(result.payload.max_ingredients_per_formulation).toBe(1);
    expect(result.payload.coefs).toEqual([[0.2, 0.8]]);
  });

  it('rejects a blank filename', () => {
    const result = buildGenerateRequest(validInput({ filename: '  ' }));
    expect(result).toEqual({ ok: false, error: 'Filename is required.' });
  });

  it('requires at least one input and one output', () => {
    const noInputs = buildGenerateRequest(validInput({ generalInputs: [], formulationGroups: [] }));
    expect(noInputs.ok).toBe(false);
    if (noInputs.ok) return;
    expect(noInputs.error).toBe('At least one General Input OR one Formulation Input is required.');

    const noOutputs = buildGenerateRequest(validInput({ outputs: [] }));
    expect(noOutputs.ok).toBe(false);
    if (noOutputs.ok) return;
    expect(noOutputs.error).toBe('At least one Output is required.');
  });

  it('rejects a required ingredient whose lower bound is 0', () => {
    const result = buildGenerateRequest(validInput({
      formulationGroups: [formulationGroup({
        ingredients: [ingredient({ required: true, min: '0' })],
      })],
    }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('must have a lower bound greater than 0');
  });

  it('rejects group upper bounds that cannot sum to 1', () => {
    const result = buildGenerateRequest(validInput({
      formulationGroups: [
        formulationGroup({
          name: 'Base',
          min: '0.1',
          max: '0.4',
          ingredients: [ingredient({ id: 'a', name: 'A', required: false, min: '0.1', max: '0.4' })],
        }),
        formulationGroup({
          id: 'grp-2',
          name: 'Additives',
          min: '0.1',
          max: '0.4',
          ingredients: [ingredient({ id: 'b', name: 'B', required: false, min: '0.1', max: '0.4' })],
        }),
      ],
    }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('sum of all group upper bounds is less than 1.0');
  });

  it('rejects always-present groups whose lower bounds exceed 1', () => {
    const result = buildGenerateRequest(validInput({
      formulationGroups: [
        formulationGroup({
          name: 'Base',
          min: '0.6',
          max: '0.9',
          ingredients: [ingredient({ required: true, min: '0.6', max: '0.9' })],
        }),
        formulationGroup({
          id: 'grp-2',
          name: 'Filler',
          min: '0.6',
          max: '0.9',
          ingredients: [ingredient({ id: 'ing-2', name: 'Filler A', required: true, min: '0.6', max: '0.9' })],
        }),
      ],
    }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('sum of lower bounds for always-present groups exceeds 1.0');
  });
});
