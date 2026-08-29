import { buildCoefficientAxes, buildCoefsPayload } from './coefficients';
import type {
  CoefficientTableValue,
  DescriptorGroup,
  FormulationGroup,
} from './types';

export const DEFAULT_MIN_BOUND = '0';
export const DEFAULT_MAX_BOUND = '1';

export const resolveMinBound = (value: string) =>
  (value.trim() === '' ? DEFAULT_MIN_BOUND : value);
export const resolveMaxBound = (value: string) =>
  (value.trim() === '' ? DEFAULT_MAX_BOUND : value);

/** Resolved per-group min/max present-ingredient counts (matches generate/validate logic). */
export const resolveGroupIngredientCounts = (group: FormulationGroup) => {
  const size = group.ingredients.length;
  const min = group.minIngredients.trim() === '' ? 1 : Number(group.minIngredients);
  const max = group.maxIngredients.trim() === '' ? size : Number(group.maxIngredients);
  const requiredCount = group.ingredients.filter(ing => ing.required).length;
  return { min, max, requiredCount };
};

/** Default global min/max when the top-level fields are left blank. */
export const defaultGlobalIngredientCounts = (groups: FormulationGroup[]) => {
  let defaultMin = 0;
  let defaultMax = 0;
  for (const group of groups) {
    if (group.ingredients.length === 0) continue;
    const { min, max, requiredCount } = resolveGroupIngredientCounts(group);
    const groupMinContrib = min === 0 && requiredCount === 0 ? 0 : Math.max(min, requiredCount);
    defaultMin += groupMinContrib;
    defaultMax += max;
  }
  if (defaultMin < 1 && defaultMax > 0) {
    defaultMin = 1;
  }
  return { min: defaultMin, max: defaultMax };
};

export interface GenerateFormInput {
  filename: string;
  generalInputs: DescriptorGroup[];
  formulationGroups: FormulationGroup[];
  outputs: DescriptorGroup[];
  numRows: number | '';
  noise: number;
  minIngredientsPerFormulation: string;
  maxIngredientsPerFormulation: string;
  coefficientValues: CoefficientTableValue;
  outputFormat: 'compact' | 'wide';
}

export interface GeneratePayload {
  general_inputs: DescriptorGroup[];
  formulation_groups: Array<{
    name: string;
    min: string;
    max: string;
    min_ingredients: number | null;
    max_ingredients: number | null;
    ingredients: FormulationGroup['ingredients'][number][];
  }>;
  outputs: DescriptorGroup[];
  num_rows: number | '';
  noise: number;
  output_format: 'compact' | 'wide';
  min_ingredients_per_formulation: number | null;
  max_ingredients_per_formulation: number | null;
  coefs: number[][] | null;
}

export type GenerateRequestResult =
  | { ok: true; payload: GeneratePayload }
  | { ok: false; error: string };

export function buildGenerateRequest(input: GenerateFormInput): GenerateRequestResult {
  const {
    filename,
    generalInputs,
    formulationGroups,
    outputs,
    numRows,
    noise,
    minIngredientsPerFormulation,
    maxIngredientsPerFormulation,
    coefficientValues,
    outputFormat,
  } = input;

  if (!filename.trim()) {
    return { ok: false, error: 'Filename is required.' };
  }

  const allIngredients = formulationGroups.flatMap(g => g.ingredients);
  const totalIngredients = allIngredients.length;

  if (generalInputs.length === 0 && totalIngredients === 0) {
    return { ok: false, error: 'At least one General Input OR one Formulation Input is required.' };
  }

  if (outputs.length === 0) {
    return { ok: false, error: 'At least one Output is required.' };
  }

  const namedBoundedGroups = [...generalInputs, ...outputs];
  for (const group of namedBoundedGroups) {
    if (!group.name.trim()) {
      return { ok: false, error: 'Variable names cannot be left blank.' };
    }
    if (!group.min.trim()) {
      return { ok: false, error: 'All lower bounds are required.' };
    }
    if (!group.max.trim()) {
      return { ok: false, error: 'All upper bounds are required.' };
    }
  }

  let forcedGroupMinTotal = 0;
  let sumGroupMax = 0;
  let sumForcedGroupMin = 0;
  let sumGroupMaxCounts = 0;

  for (const group of formulationGroups) {
    if (group.ingredients.length === 0) {
      return { ok: false, error: `Group "${group.name || '(unnamed)'}" must contain at least one ingredient.` };
    }
    if (!group.name.trim()) {
      return { ok: false, error: 'Group names cannot be left blank.' };
    }
    const gMin = parseFloat(resolveMinBound(group.min));
    const gMax = parseFloat(resolveMaxBound(group.max));
    if (gMin < 0 || gMin > 1 || gMax < 0 || gMax > 1) {
      return { ok: false, error: 'Group bounds must all have values between 0 and 1.' };
    }
    if (gMin > gMax) {
      return { ok: false, error: `Group "${group.name}" lower bound cannot exceed its upper bound.` };
    }

    const groupSize = group.ingredients.length;
    const { min: resolvedGroupMin, max: resolvedGroupMax, requiredCount: groupRequiredCount } =
      resolveGroupIngredientCounts(group);
    if (!Number.isInteger(resolvedGroupMin) || !Number.isInteger(resolvedGroupMax)) {
      return { ok: false, error: 'Group min/max ingredients must be integers.' };
    }
    if (resolvedGroupMin < 0) {
      return { ok: false, error: 'Group min ingredients cannot be negative.' };
    }
    if (resolvedGroupMin > resolvedGroupMax) {
      return { ok: false, error: `Group "${group.name}" min ingredients cannot exceed its max ingredients.` };
    }
    if (resolvedGroupMax > groupSize) {
      return { ok: false, error: `Group "${group.name}" max ingredients cannot exceed the number of ingredients in the group.` };
    }

    for (const ing of group.ingredients) {
      if (!ing.name.trim()) {
        return { ok: false, error: 'Variable names cannot be left blank.' };
      }
      const iMin = parseFloat(resolveMinBound(ing.min));
      const iMax = parseFloat(resolveMaxBound(ing.max));
      if (iMin < 0 || iMin > 1 || iMax < 0 || iMax > 1) {
        return { ok: false, error: 'Formulation Input bounds must all have values between 0 and 1.' };
      }
      if (iMin > iMax) {
        return { ok: false, error: `Ingredient "${ing.name}" lower bound cannot exceed its upper bound.` };
      }
      if (ing.required && iMin <= 0) {
        return { ok: false, error: `Required ingredient "${ing.name || '(unnamed)'}" must have a lower bound greater than 0.` };
      }
    }

    const isForced = resolvedGroupMin > 0 || groupRequiredCount > 0;
    sumGroupMax += gMax;
    sumGroupMaxCounts += resolvedGroupMax;
    if (isForced) {
      sumForcedGroupMin += gMin;
      forcedGroupMinTotal += Math.max(resolvedGroupMin, groupRequiredCount);
    }
  }

  if (totalIngredients > 0) {
    if (sumGroupMax < 1 - 1e-9) {
      return {
        ok: false,
        error: 'The sum of all group upper bounds is less than 1.0, so ingredient amounts cannot sum to 100%.',
      };
    }
    if (sumForcedGroupMin > 1 + 1e-9) {
      return {
        ok: false,
        error: 'The sum of lower bounds for always-present groups exceeds 1.0; no feasible formulation exists.',
      };
    }
  }

  let resolvedMinIngredientsPerFormulation: number | null = null;
  let resolvedMaxIngredientsPerFormulation: number | null = null;

  if (totalIngredients > 0) {
    const nIngredients = totalIngredients;
    const { min: defaultGlobalMin, max: defaultGlobalMax } =
      formulationGroups.length > 0
        ? defaultGlobalIngredientCounts(formulationGroups)
        : { min: nIngredients, max: nIngredients };

    resolvedMinIngredientsPerFormulation =
      minIngredientsPerFormulation.trim() === ''
        ? defaultGlobalMin
        : Number(minIngredientsPerFormulation);
    resolvedMaxIngredientsPerFormulation =
      maxIngredientsPerFormulation.trim() === ''
        ? defaultGlobalMax
        : Number(maxIngredientsPerFormulation);

    if (
      !Number.isInteger(resolvedMinIngredientsPerFormulation) ||
      !Number.isInteger(resolvedMaxIngredientsPerFormulation)
    ) {
      return { ok: false, error: 'Min/Max ingredients per formulation must be integers.' };
    }

    if (resolvedMinIngredientsPerFormulation < 1) {
      return { ok: false, error: 'Min ingredients per formulation must be at least 1.' };
    }

    if (resolvedMinIngredientsPerFormulation > resolvedMaxIngredientsPerFormulation) {
      return { ok: false, error: 'Min ingredients per formulation cannot exceed max ingredients per formulation.' };
    }

    if (resolvedMaxIngredientsPerFormulation > nIngredients) {
      return { ok: false, error: 'Max ingredients per formulation cannot exceed the number of formulation inputs.' };
    }

    if (forcedGroupMinTotal > resolvedMaxIngredientsPerFormulation) {
      return {
        ok: false,
        error: 'The minimum number of ingredients forced by groups cannot exceed max ingredients per formulation.',
      };
    }

    if (sumGroupMaxCounts < resolvedMinIngredientsPerFormulation) {
      return {
        ok: false,
        error: 'The total of all group max ingredient counts is less than min ingredients per formulation.',
      };
    }
  }

  const { inputs: coefInputs, outputs: coefOutputs } = buildCoefficientAxes(
    generalInputs,
    formulationGroups,
    outputs,
  );
  const coefs = buildCoefsPayload(coefInputs, coefOutputs, coefficientValues);

  return {
    ok: true,
    payload: {
      general_inputs: generalInputs,
      formulation_groups: formulationGroups.map(g => ({
        name: g.name,
        min: resolveMinBound(g.min),
        max: resolveMaxBound(g.max),
        min_ingredients: g.minIngredients.trim() === '' ? null : Number(g.minIngredients),
        max_ingredients: g.maxIngredients.trim() === '' ? null : Number(g.maxIngredients),
        ingredients: g.ingredients.map(ing => ({
          ...ing,
          min: resolveMinBound(ing.min),
          max: resolveMaxBound(ing.max),
        })),
      })),
      outputs,
      num_rows: numRows,
      noise,
      output_format: outputFormat,
      min_ingredients_per_formulation: resolvedMinIngredientsPerFormulation,
      max_ingredients_per_formulation: resolvedMaxIngredientsPerFormulation,
      coefs,
    },
  };
}
