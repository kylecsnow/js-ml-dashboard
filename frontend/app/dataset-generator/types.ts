export interface DescriptorGroup {
  id: string;
  name: string;
  min: string;
  max: string;
  units: string;
}

export interface FormulationDescriptorGroup extends DescriptorGroup {
  required: boolean;
}

export interface FormulationGroup {
  id: string;
  name: string;
  min: string;            // group sum lower bound (0..1)
  max: string;            // group sum upper bound (0..1)
  minIngredients: string; // optional per-group min present count
  maxIngredients: string; // optional per-group max present count
  ingredients: FormulationDescriptorGroup[];
}

export type CoefficientTableValue = Record<string, Record<string, string>>;

export interface CoefficientTableAxisItem {
  id: string;
  label: string;
}

export type SavedDescriptorGroup = Omit<DescriptorGroup, 'id'> & { id?: string };

export type SavedFormulationDescriptorGroup = Omit<FormulationDescriptorGroup, 'id'> & { id?: string };

export type FormulationGroupConfig = Omit<FormulationGroup, 'id' | 'ingredients'> & {
  id?: string;
  ingredients: SavedFormulationDescriptorGroup[];
};

export interface SchemaConfig {
  generalInputs: SavedDescriptorGroup[];
  // New grouped structure. `formulationInputs` is still read for backwards
  // compatibility with schemas saved before ingredient groups existed.
  formulationGroups?: FormulationGroupConfig[];
  formulationInputs?: SavedFormulationDescriptorGroup[];
  outputs: SavedDescriptorGroup[];
  numRows: number | '';
  noise: number;
  filename: string;
  minIngredientsPerFormulation: string;
  maxIngredientsPerFormulation: string;
  coefficientValues?: CoefficientTableValue;
}

export interface SavedSchemaEntry {
  id: number;
  name: string;
  config: SchemaConfig;
  created_at: string | null;
}

export interface DatasetGeneratorFormState {
  generalInputs: DescriptorGroup[];
  formulationGroups: FormulationGroup[];
  outputs: DescriptorGroup[];
  numRows: number | '';
  noise: number;
  filename: string;
  minIngredientsPerFormulation: string;
  maxIngredientsPerFormulation: string;
}
