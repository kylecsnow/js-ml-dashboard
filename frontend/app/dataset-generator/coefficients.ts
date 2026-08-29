import type {
  CoefficientTableAxisItem,
  CoefficientTableValue,
  DescriptorGroup,
  FormulationGroup,
} from './types';

export const COEFFICIENT_DECIMALS = 3;
export const COEFFICIENT_MIN = -1;
export const COEFFICIENT_MAX = 1;

const FLOAT_INPUT_RE = /^-?\d*\.?\d*$/;

export const randomCoefficient = () =>
  (Math.random() * 2 - 1).toFixed(COEFFICIENT_DECIMALS);

export const labelWithFallback = (value: string, fallback: string) =>
  value.trim() || fallback;

export const buildCoefficientAxes = (
  generalInputs: DescriptorGroup[],
  formulationGroups: FormulationGroup[],
  outputs: DescriptorGroup[],
): { inputs: CoefficientTableAxisItem[]; outputs: CoefficientTableAxisItem[] } => ({
  inputs: [
    ...generalInputs.map(({ id, name }, index) => ({
      id,
      label: labelWithFallback(name, `Input ${index + 1}`),
    })),
    ...formulationGroups.flatMap(({ ingredients }) =>
      ingredients.map(({ id, name }, index) => ({
        id,
        label: labelWithFallback(name, `Input ${generalInputs.length + index + 1}`),
      })),
    ),
  ],
  outputs: outputs.map(({ id, name }, index) => ({
    id,
    label: labelWithFallback(name, `Output ${index + 1}`),
  })),
});

export const reconcileCoefficientValues = (
  previousValues: CoefficientTableValue,
  outputIds: string[],
  inputIds: string[],
  createCoefficient: () => string = randomCoefficient,
): CoefficientTableValue =>
  Object.fromEntries(
    outputIds.map((outputId) => [
      outputId,
      Object.fromEntries(
        inputIds.map((inputId) => [
          inputId,
          previousValues[outputId]?.[inputId] ?? createCoefficient(),
        ]),
      ),
    ]),
  );

export const parseCoefficient = (value: string | undefined): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(1, Math.max(-1, num));
};

export const buildCoefsPayload = (
  inputs: CoefficientTableAxisItem[],
  outputs: CoefficientTableAxisItem[],
  values: CoefficientTableValue,
): number[][] | null => {
  if (inputs.length === 0 || outputs.length === 0) return null;
  return outputs.map((output) =>
    inputs.map((input) => parseCoefficient(values[output.id]?.[input.id])),
  );
};

export const isPartialCoefficient = (value: string) =>
  value === '' || value === '-' || value === '.' || value === '-.';

export const sanitizeCoefficientChange = (value: string): string | null => {
  if (!FLOAT_INPUT_RE.test(value)) return null;
  if (isPartialCoefficient(value)) return value;

  const num = Number(value);
  if (Number.isNaN(num)) return null;
  if (num < COEFFICIENT_MIN) return String(COEFFICIENT_MIN);
  if (num > COEFFICIENT_MAX) return String(COEFFICIENT_MAX);
  return value;
};

export const finalizeCoefficientValue = (value: string): string => {
  if (isPartialCoefficient(value)) return '0';

  const num = Number(value);
  if (Number.isNaN(num)) return '0';
  if (num < COEFFICIENT_MIN) return String(COEFFICIENT_MIN);
  if (num > COEFFICIENT_MAX) return String(COEFFICIENT_MAX);
  return value;
};
