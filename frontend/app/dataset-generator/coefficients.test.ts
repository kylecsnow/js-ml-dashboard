import { describe, expect, it } from 'vitest';
import {
  buildCoefficientAxes,
  buildCoefsPayload,
  finalizeCoefficientValue,
  labelWithFallback,
  parseCoefficient,
  reconcileCoefficientValues,
  sanitizeCoefficientChange,
} from './coefficients';
import type { DescriptorGroup, FormulationGroup } from './types';

const descriptor = (id: string, name: string): DescriptorGroup => ({
  id,
  name,
  min: '0',
  max: '1',
  units: '',
});

const group = (ingredients: Array<{ id: string; name: string }>): FormulationGroup => ({
  id: 'g1',
  name: 'Resins',
  min: '0',
  max: '1',
  minIngredients: '',
  maxIngredients: '',
  ingredients: ingredients.map((ing) => ({
    ...ing,
    min: '0',
    max: '1',
    units: '',
    required: false,
  })),
});

describe('labelWithFallback', () => {
  it('uses the trimmed name when present', () => {
    expect(labelWithFallback('  Cure Temp  ', 'Input 1')).toBe('Cure Temp');
  });

  it('falls back for blank names', () => {
    expect(labelWithFallback('   ', 'Input 1')).toBe('Input 1');
  });
});

describe('buildCoefficientAxes', () => {
  it('orders general inputs, then formulation ingredients, then outputs', () => {
    const axes = buildCoefficientAxes(
      [descriptor('gen', 'Temperature')],
      [group([{ id: 'udma', name: 'UDMA' }])],
      [descriptor('out', 'Strength')],
    );

    expect(axes.inputs.map((item) => item.label)).toEqual(['Temperature', 'UDMA']);
    expect(axes.outputs.map((item) => item.label)).toEqual(['Strength']);
  });

  it('uses fallback labels for blank names', () => {
    const axes = buildCoefficientAxes(
      [descriptor('gen', '')],
      [group([{ id: 'ing', name: '' }])],
      [descriptor('out', '')],
    );

    expect(axes.inputs.map((item) => item.label)).toEqual(['Input 1', 'Input 2']);
    expect(axes.outputs[0].label).toBe('Output 1');
  });
});

describe('parseCoefficient / buildCoefsPayload', () => {
  it('clamps values to [-1, 1] and treats invalid numbers as 0', () => {
    expect(parseCoefficient('1.5')).toBe(1);
    expect(parseCoefficient('-2')).toBe(-1);
    expect(parseCoefficient('not-a-number')).toBe(0);
    expect(parseCoefficient(undefined)).toBe(0);
  });

  it('returns null when there are no inputs or outputs', () => {
    expect(buildCoefsPayload([], [{ id: 'o', label: 'O' }], {})).toBeNull();
    expect(buildCoefsPayload([{ id: 'i', label: 'I' }], [], {})).toBeNull();
  });

  it('builds a row-per-output matrix', () => {
    const payload = buildCoefsPayload(
      [{ id: 'i1', label: 'I1' }, { id: 'i2', label: 'I2' }],
      [{ id: 'o1', label: 'O1' }],
      { o1: { i1: '0.5', i2: '-0.25' } },
    );
    expect(payload).toEqual([[0.5, -0.25]]);
  });
});

describe('reconcileCoefficientValues', () => {
  it('keeps existing cells and fills missing ones with the factory', () => {
    const values = reconcileCoefficientValues(
      { o1: { i1: '0.4' } },
      ['o1', 'o2'],
      ['i1', 'i2'],
      () => '0.111',
    );

    expect(values).toEqual({
      o1: { i1: '0.4', i2: '0.111' },
      o2: { i1: '0.111', i2: '0.111' },
    });
  });
});

describe('coefficient text input sanitization', () => {
  it('allows in-progress partial values', () => {
    expect(sanitizeCoefficientChange('-')).toBe('-');
    expect(sanitizeCoefficientChange('.')).toBe('.');
    expect(sanitizeCoefficientChange('-.')).toBe('-.');
    expect(sanitizeCoefficientChange('')).toBe('');
  });

  it('rejects non-numeric text and clamps out-of-range numbers', () => {
    expect(sanitizeCoefficientChange('abc')).toBeNull();
    expect(sanitizeCoefficientChange('1.5')).toBe('1');
    expect(sanitizeCoefficientChange('-1.2')).toBe('-1');
    expect(sanitizeCoefficientChange('0.25')).toBe('0.25');
  });

  it('finalizes partial or invalid values to 0', () => {
    expect(finalizeCoefficientValue('')).toBe('0');
    expect(finalizeCoefficientValue('-')).toBe('0');
    expect(finalizeCoefficientValue('2')).toBe('1');
  });
});
