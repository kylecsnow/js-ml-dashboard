import { describe, expect, it } from 'vitest';
import { DEFAULT_GROUP_NAME, hydrateSchemaConfig } from './schema';
import type { SchemaConfig } from './types';

const createId = (() => {
  let n = 0;
  return () => {
    n += 1;
    return `id-${n}`;
  };
});

describe('hydrateSchemaConfig', () => {
  it('loads grouped schemas and preserves ids when present', () => {
    const config: SchemaConfig = {
      generalInputs: [{ id: 'g1', name: 'Temp', min: '20', max: '80', units: 'C' }],
      formulationGroups: [{
        id: 'grp1',
        name: 'Resins',
        min: '0.5',
        max: '1',
        minIngredients: '1',
        maxIngredients: '2',
        ingredients: [{
          id: 'ing1',
          name: 'UDMA',
          min: '0.5',
          max: '0.9',
          units: '',
          required: true,
        }],
      }],
      outputs: [{ id: 'o1', name: 'Strength', min: '5', max: '90', units: 'MPa' }],
      numRows: 25,
      noise: 0.01,
      filename: 'resin',
      minIngredientsPerFormulation: '1',
      maxIngredientsPerFormulation: '1',
      coefficientValues: { o1: { g1: '0.3', ing1: '-0.2' } },
    };

    const loaded = hydrateSchemaConfig(config, createId());
    expect(loaded.generalInputs[0].id).toBe('g1');
    expect(loaded.formulationGroups[0].ingredients[0].required).toBe(true);
    expect(loaded.coefficientValues).toEqual({ o1: { g1: '0.3', ing1: '-0.2' } });
    expect(loaded.filename).toBe('resin');
  });

  it('migrates legacy formulationInputs into a default group', () => {
    const config: SchemaConfig = {
      generalInputs: [],
      formulationInputs: [{
        name: 'UDMA',
        min: '0.4',
        max: '0.8',
        units: '',
      }],
      outputs: [{ name: 'Tg', min: '40', max: '120', units: 'C' }],
      numRows: 10,
      noise: 0,
      filename: 'legacy',
      minIngredientsPerFormulation: '',
      maxIngredientsPerFormulation: '',
    };

    const loaded = hydrateSchemaConfig(config, createId());
    expect(loaded.formulationGroups).toHaveLength(1);
    expect(loaded.formulationGroups[0].name).toBe(DEFAULT_GROUP_NAME);
    expect(loaded.formulationGroups[0].ingredients[0]).toMatchObject({
      name: 'UDMA',
      required: false,
      units: '',
    });
    expect(loaded.outputs[0].id).toMatch(/^id-/);
  });

  it('prefers formulationGroups over leftover formulationInputs', () => {
    const config: SchemaConfig = {
      generalInputs: [],
      formulationGroups: [{
        name: 'New Groups',
        min: '0',
        max: '1',
        minIngredients: '',
        maxIngredients: '',
        ingredients: [{ name: 'A', min: '0', max: '1', required: false }],
      }],
      formulationInputs: [{ name: 'Legacy', min: '0', max: '1' }],
      outputs: [{ name: 'Y', min: '0', max: '1', units: '' }],
      numRows: 1,
      noise: 0,
      filename: 'mixed',
      minIngredientsPerFormulation: '',
      maxIngredientsPerFormulation: '',
    };

    const loaded = hydrateSchemaConfig(config, createId());
    expect(loaded.formulationGroups[0].name).toBe('New Groups');
    expect(loaded.formulationGroups[0].ingredients[0].name).toBe('A');
  });
});
