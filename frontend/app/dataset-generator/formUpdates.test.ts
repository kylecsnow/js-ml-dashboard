import { describe, expect, it } from 'vitest';
import {
  applyFormUpdates,
  buildChatFormContext,
  countEq,
  descriptorsChanged,
  groupsChanged,
} from './formUpdates';
import type { DatasetGeneratorFormState, FormulationGroup } from './types';

const emptyState = (): DatasetGeneratorFormState => ({
  generalInputs: [],
  formulationGroups: [],
  outputs: [],
  numRows: 50,
  noise: 0.025,
  filename: 'generated_dataset_name',
  minIngredientsPerFormulation: '',
  maxIngredientsPerFormulation: '',
});

const ids = (() => {
  let n = 0;
  return () => {
    n += 1;
    return `new-${n}`;
  };
});

describe('change detection', () => {
  it('treats numeric strings as equal', () => {
    expect(descriptorsChanged(
      [{ id: '1', name: 'Temp', min: '20.0', max: '80', units: 'C' }],
      [{ name: 'Temp', min: '20', max: '80', units: 'C' }],
    )).toBe(false);
  });

  it('treats null and blank ingredient counts as equal', () => {
    expect(countEq(null, '')).toBe(true);
    expect(countEq(2, '2')).toBe(true);
    expect(countEq(2, '')).toBe(false);
  });

  it('detects formulation group bound changes', () => {
    const current: FormulationGroup[] = [{
      id: 'g',
      name: 'Base',
      min: '0.5',
      max: '1',
      minIngredients: '1',
      maxIngredients: '',
      ingredients: [{
        id: 'i', name: 'UDMA', min: '0.5', max: '0.9', units: '', required: true,
      }],
    }];
    expect(groupsChanged(current, [{
      name: 'Base',
      min: '0.5',
      max: '1',
      min_ingredients: 1,
      max_ingredients: null,
      ingredients: [{ name: 'UDMA', min: '0.5', max: '0.9', required: true }],
    }])).toBe(false);
    expect(groupsChanged(current, [{
      name: 'Base',
      min: '0.2',
      max: '1',
      min_ingredients: 1,
      max_ingredients: null,
      ingredients: [{ name: 'UDMA', min: '0.5', max: '0.9', required: true }],
    }])).toBe(true);
  });
});

describe('applyFormUpdates', () => {
  it('returns an empty summary when nothing changed', () => {
    const current = emptyState();
    current.generalInputs = [{ id: 'g', name: 'Temp', min: '20', max: '80', units: 'C' }];
    const { next, summary } = applyFormUpdates(current, {
      general_inputs: [{ name: 'Temp', min: '20', max: '80', units: 'C' }],
    }, ids());
    expect(summary).toBe('');
    expect(next.generalInputs).toBe(current.generalInputs);
  });

  it('maps LLM formulation groups onto local state and summarizes the change', () => {
    const current = emptyState();
    current.maxIngredientsPerFormulation = '3';
    const { next, summary } = applyFormUpdates(current, {
      formulation_groups: [{
        name: 'Base Resin',
        min: '0.5',
        max: '1',
        min_ingredients: 1,
        max_ingredients: null,
        ingredients: [{ name: 'UDMA', min: '0.5', max: '0.9', required: true }],
      }],
      num_rows: 100,
      min_ingredients_per_formulation: 1,
      max_ingredients_per_formulation: null,
    }, ids());

    expect(summary).toContain('1 formulation group');
    expect(summary).toContain('num_rows');
    expect(summary).toContain('min ingredients/formulation');
    expect(summary).toContain('max ingredients/formulation');
    expect(next.numRows).toBe(100);
    expect(next.minIngredientsPerFormulation).toBe('1');
    expect(next.maxIngredientsPerFormulation).toBe('');
    expect(next.formulationGroups[0]).toMatchObject({
      name: 'Base Resin',
      minIngredients: '1',
      maxIngredients: '',
      ingredients: [{ name: 'UDMA', required: true, units: '' }],
    });
  });
});

describe('buildChatFormContext', () => {
  it('serializes blank ingredient counts as null', () => {
    const ctx = buildChatFormContext({
      ...emptyState(),
      formulationGroups: [{
        id: 'g',
        name: 'Base',
        min: '0.5',
        max: '1',
        minIngredients: '',
        maxIngredients: '2',
        ingredients: [{
          id: 'i', name: 'UDMA', min: '0.5', max: '0.9', units: '', required: false,
        }],
      }],
    });
    expect(ctx.formulation_groups[0].min_ingredients).toBeNull();
    expect(ctx.formulation_groups[0].max_ingredients).toBe('2');
    expect(ctx.min_ingredients_per_formulation).toBeNull();
  });
});
