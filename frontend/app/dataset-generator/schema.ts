import { buildCoefficientAxes, reconcileCoefficientValues } from './coefficients';
import type {
  CoefficientTableValue,
  DescriptorGroup,
  FormulationDescriptorGroup,
  FormulationGroup,
  FormulationGroupConfig,
  SchemaConfig,
} from './types';

export const DEFAULT_GROUP_NAME = 'Default Group';

export const createEmptyIngredient = (
  createId: () => string = () => crypto.randomUUID(),
): FormulationDescriptorGroup => ({
  id: createId(),
  name: '',
  min: '',
  max: '',
  units: '',
  required: false,
});

export const createEmptyFormulationGroup = (
  createId: () => string = () => crypto.randomUUID(),
): FormulationGroup => ({
  id: createId(),
  name: '',
  min: '',
  max: '',
  minIngredients: '',
  maxIngredients: '',
  ingredients: [createEmptyIngredient(createId)],
});

export interface HydratedSchema {
  generalInputs: DescriptorGroup[];
  formulationGroups: FormulationGroup[];
  outputs: DescriptorGroup[];
  numRows: number | '';
  noise: number;
  filename: string;
  minIngredientsPerFormulation: string;
  maxIngredientsPerFormulation: string;
  coefficientValues: CoefficientTableValue;
}

export function hydrateSchemaConfig(
  config: SchemaConfig,
  createId: () => string = () => crypto.randomUUID(),
): HydratedSchema {
  const loadedGeneralInputs: DescriptorGroup[] = config.generalInputs.map((g) => ({
    ...g,
    id: g.id ?? createId(),
  }));

  // Prefer the grouped structure; fall back to migrating a legacy flat
  // formulationInputs list into a single default group.
  let groupConfigs: FormulationGroupConfig[];
  if (config.formulationGroups) {
    groupConfigs = config.formulationGroups;
  } else if (config.formulationInputs && config.formulationInputs.length > 0) {
    groupConfigs = [{
      name: DEFAULT_GROUP_NAME,
      min: '',
      max: '',
      minIngredients: '',
      maxIngredients: '',
      ingredients: config.formulationInputs,
    }];
  } else {
    groupConfigs = [];
  }

  const loadedFormulationGroups: FormulationGroup[] = groupConfigs.map((g) => ({
    id: g.id ?? createId(),
    name: g.name ?? '',
    min: g.min ?? '',
    max: g.max ?? '',
    minIngredients: g.minIngredients ?? '',
    maxIngredients: g.maxIngredients ?? '',
    ingredients: (g.ingredients ?? []).map((ing) => ({
      ...ing,
      required: ing.required ?? false,
      units: ing.units ?? '',
      id: ing.id ?? createId(),
    })),
  }));

  const loadedOutputs: DescriptorGroup[] = config.outputs.map((g) => ({
    ...g,
    id: g.id ?? createId(),
  }));

  const { inputs: loadedCoefInputs, outputs: loadedCoefOutputs } = buildCoefficientAxes(
    loadedGeneralInputs,
    loadedFormulationGroups,
    loadedOutputs,
  );

  return {
    generalInputs: loadedGeneralInputs,
    formulationGroups: loadedFormulationGroups,
    outputs: loadedOutputs,
    numRows: config.numRows,
    noise: config.noise,
    filename: config.filename,
    minIngredientsPerFormulation: config.minIngredientsPerFormulation,
    maxIngredientsPerFormulation: config.maxIngredientsPerFormulation,
    coefficientValues: reconcileCoefficientValues(
      config.coefficientValues ?? {},
      loadedCoefOutputs.map(({ id }) => id),
      loadedCoefInputs.map(({ id }) => id),
    ),
  };
}

export function buildSchemaConfig(input: {
  generalInputs: DescriptorGroup[];
  formulationGroups: FormulationGroup[];
  outputs: DescriptorGroup[];
  numRows: number | '';
  noise: number;
  filename: string;
  minIngredientsPerFormulation: string;
  maxIngredientsPerFormulation: string;
  coefficientValues: CoefficientTableValue;
}): SchemaConfig {
  const { inputs: coefInputs, outputs: coefOutputs } = buildCoefficientAxes(
    input.generalInputs,
    input.formulationGroups,
    input.outputs,
  );

  return {
    generalInputs: input.generalInputs.map(({ id, name, min, max, units }) => ({
      id,
      name,
      min,
      max,
      units,
    })),
    formulationGroups: input.formulationGroups.map(({
      id, name, min, max, minIngredients, maxIngredients, ingredients,
    }) => ({
      id,
      name,
      min,
      max,
      minIngredients,
      maxIngredients,
      ingredients: ingredients.map(({ id, name, min, max, units, required }) => ({
        id,
        name,
        min,
        max,
        units,
        required,
      })),
    })),
    outputs: input.outputs.map(({ id, name, min, max, units }) => ({
      id,
      name,
      min,
      max,
      units,
    })),
    numRows: input.numRows,
    noise: input.noise,
    filename: input.filename,
    minIngredientsPerFormulation: input.minIngredientsPerFormulation,
    maxIngredientsPerFormulation: input.maxIngredientsPerFormulation,
    coefficientValues: reconcileCoefficientValues(
      input.coefficientValues,
      coefOutputs.map(({ id }) => id),
      coefInputs.map(({ id }) => id),
    ),
  };
}
