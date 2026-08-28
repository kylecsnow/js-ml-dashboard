import type {
  DatasetGeneratorFormState,
  DescriptorGroup,
  FormulationGroup,
} from './types';

export interface LLMFormulationGroup {
  name: string;
  min: string;
  max: string;
  min_ingredients?: number | string | null;
  max_ingredients?: number | string | null;
  ingredients: { name: string; min: string; max: string; required?: boolean }[];
}

export interface LLMFormUpdates {
  general_inputs?: { name: string; min: string; max: string; units?: string }[];
  formulation_groups?: LLMFormulationGroup[];
  outputs?: { name: string; min: string; max: string; units?: string }[];
  num_rows?: number;
  noise?: number;
  filename?: string;
  min_ingredients_per_formulation?: number | null;
  max_ingredients_per_formulation?: number | null;
}

export function buildChatFormContext(state: DatasetGeneratorFormState) {
  return {
    general_inputs: state.generalInputs.map(g => ({
      name: g.name, min: g.min, max: g.max, units: g.units,
    })),
    formulation_groups: state.formulationGroups.map(group => ({
      name: group.name,
      min: group.min,
      max: group.max,
      min_ingredients: group.minIngredients || null,
      max_ingredients: group.maxIngredients || null,
      ingredients: group.ingredients.map(i => ({
        name: i.name,
        min: i.min,
        max: i.max,
        required: i.required,
      })),
    })),
    outputs: state.outputs.map(g => ({
      name: g.name, min: g.min, max: g.max, units: g.units,
    })),
    num_rows: state.numRows,
    noise: state.noise,
    filename: state.filename,
    min_ingredients_per_formulation: state.minIngredientsPerFormulation || null,
    max_ingredients_per_formulation: state.maxIngredientsPerFormulation || null,
  };
}

export function numEq(a: string | number, b: string | number): boolean {
  const na = Number(a);
  const nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) return na === nb;
  return String(a) === String(b);
}

export function descriptorsChanged(
  current: DescriptorGroup[],
  incoming: { name: string; min: string; max: string; units?: string; required?: boolean }[],
): boolean {
  if (current.length !== incoming.length) return true;
  return incoming.some((g, i) =>
    g.name !== current[i].name ||
    !numEq(g.min, current[i].min) ||
    !numEq(g.max, current[i].max) ||
    (g.units ?? '') !== (current[i] as { units?: string }).units ||
    (g.required ?? false) !== ((current[i] as { required?: boolean }).required ?? false)
  );
}

export function countEq(incoming: number | string | null | undefined, current: string): boolean {
  const inc = incoming == null || incoming === '' ? '' : String(Number(incoming));
  const cur = current.trim() === '' ? '' : String(Number(current));
  return inc === cur;
}

export function groupsChanged(current: FormulationGroup[], incoming: LLMFormulationGroup[]): boolean {
  if (current.length !== incoming.length) return true;
  return incoming.some((g, i) => {
    const c = current[i];
    if (
      g.name !== c.name ||
      !numEq(g.min, c.min) ||
      !numEq(g.max, c.max) ||
      !countEq(g.min_ingredients, c.minIngredients) ||
      !countEq(g.max_ingredients, c.maxIngredients)
    ) {
      return true;
    }
    return descriptorsChanged(c.ingredients, g.ingredients);
  });
}

export interface AppliedFormUpdates {
  next: DatasetGeneratorFormState;
  summary: string;
}

export function applyFormUpdates(
  current: DatasetGeneratorFormState,
  updates: LLMFormUpdates,
  createId: () => string = () => crypto.randomUUID(),
): AppliedFormUpdates {
  const next: DatasetGeneratorFormState = { ...current };
  const parts: string[] = [];

  if (updates.general_inputs !== undefined && descriptorsChanged(current.generalInputs, updates.general_inputs)) {
    const items = updates.general_inputs.map(g => ({
      id: createId(),
      name: g.name,
      min: String(g.min),
      max: String(g.max),
      units: g.units ?? '',
    }));
    next.generalInputs = items;
    parts.push(`${items.length} general input${items.length !== 1 ? 's' : ''}`);
  }

  if (updates.formulation_groups !== undefined && groupsChanged(current.formulationGroups, updates.formulation_groups)) {
    const groups: FormulationGroup[] = updates.formulation_groups.map(g => ({
      id: createId(),
      name: g.name,
      min: String(g.min),
      max: String(g.max),
      minIngredients: g.min_ingredients == null ? '' : String(g.min_ingredients),
      maxIngredients: g.max_ingredients == null ? '' : String(g.max_ingredients),
      ingredients: (g.ingredients ?? []).map(i => ({
        id: createId(),
        name: i.name,
        min: String(i.min),
        max: String(i.max),
        units: '',
        required: i.required ?? false,
      })),
    }));
    next.formulationGroups = groups;
    const ingredientCount = groups.reduce((n, grp) => n + grp.ingredients.length, 0);
    parts.push(
      `${groups.length} formulation group${groups.length !== 1 ? 's' : ''} ` +
      `(${ingredientCount} ingredient${ingredientCount !== 1 ? 's' : ''})`
    );
  }

  if (updates.outputs !== undefined && descriptorsChanged(current.outputs, updates.outputs)) {
    const items = updates.outputs.map(g => ({
      id: createId(),
      name: g.name,
      min: String(g.min),
      max: String(g.max),
      units: g.units ?? '',
    }));
    next.outputs = items;
    parts.push(`${items.length} output${items.length !== 1 ? 's' : ''}`);
  }

  if (updates.num_rows !== undefined && updates.num_rows !== current.numRows) {
    next.numRows = updates.num_rows;
    parts.push('num_rows');
  }
  if (updates.noise !== undefined && updates.noise !== current.noise) {
    next.noise = updates.noise;
    parts.push('noise');
  }
  if (updates.filename !== undefined && updates.filename !== current.filename) {
    next.filename = updates.filename;
    parts.push('filename');
  }
  const newMin = updates.min_ingredients_per_formulation != null
    ? String(updates.min_ingredients_per_formulation)
    : '';
  if (updates.min_ingredients_per_formulation !== undefined && newMin !== current.minIngredientsPerFormulation) {
    next.minIngredientsPerFormulation = newMin;
    parts.push('min ingredients/formulation');
  }
  const newMax = updates.max_ingredients_per_formulation != null
    ? String(updates.max_ingredients_per_formulation)
    : '';
  if (updates.max_ingredients_per_formulation !== undefined && newMax !== current.maxIngredientsPerFormulation) {
    next.maxIngredientsPerFormulation = newMax;
    parts.push('max ingredients/formulation');
  }

  return { next, summary: parts.length > 0 ? parts.join('\n') : '' };
}
