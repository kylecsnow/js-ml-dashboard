'use client';

import { useState, type WheelEvent } from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';

export type CoefficientTableValue = Record<string, Record<string, string>>;

export interface CoefficientTableAxisItem {
  id: string;
  label: string;
}

interface CoefficientsTableProps {
  inputs: CoefficientTableAxisItem[];
  outputs: CoefficientTableAxisItem[];
  values: CoefficientTableValue;
  onCellChange: (outputId: string, inputId: string, value: string) => void;
  onRandomize: () => void;
  onSetAllToValue: (value: string) => void;
  preventWheelChange: (e: WheelEvent<HTMLInputElement>) => void;
}

const COEFFICIENT_MIN = -1;
const COEFFICIENT_MAX = 1;
const FLOAT_INPUT_RE = /^-?\d*\.?\d*$/;

const isPartialCoefficient = (value: string) =>
  value === '' || value === '-' || value === '.' || value === '-.';

const sanitizeCoefficientChange = (value: string): string | null => {
  if (!FLOAT_INPUT_RE.test(value)) return null;
  if (isPartialCoefficient(value)) return value;

  const num = Number(value);
  if (Number.isNaN(num)) return null;
  if (num < COEFFICIENT_MIN) return String(COEFFICIENT_MIN);
  if (num > COEFFICIENT_MAX) return String(COEFFICIENT_MAX);
  return value;
};

const finalizeCoefficientValue = (value: string): string => {
  if (isPartialCoefficient(value)) return '0';

  const num = Number(value);
  if (Number.isNaN(num)) return '0';
  if (num < COEFFICIENT_MIN) return String(COEFFICIENT_MIN);
  if (num > COEFFICIENT_MAX) return String(COEFFICIENT_MAX);
  return value;
};

const CoefficientsTable = ({
  inputs,
  outputs,
  values,
  onCellChange,
  onRandomize,
  onSetAllToValue,
  preventWheelChange,
}: CoefficientsTableProps) => {
  const [setAllInputValue, setSetAllInputValue] = useState('');

  const applySetAllValue = () => {
    const value = finalizeCoefficientValue(setAllInputValue);
    onSetAllToValue(value);
    setSetAllInputValue(value);
  };

  return (
    <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Coefficients for data generation</h2>
          <p className="text-sm text-gray-600">
            (Optional) Edit the coefficient values below. The coefficients can range from -1 to 1. The coefficient
            values in this table will influence the direction & magnitude whith which a given input variable will 
            influence the corresponding output variable. Positive values indicate a positively-correlated influence
            of an input variable on the output, while negative values indicate a negatively-correlated influence. 
            Small absolute-value entries will reduce the strength of this effect, but be wary that sufficiently small
            coefficient values may mean that the influnece of that variable may become "washed out" by noise, 
            depending on the noise value used for synthetic data generation.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={onRandomize}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            Randomize values
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applySetAllValue}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-gray-600 whitespace-nowrap"
            >
              Set all to:
            </button>
            <TextField
              type="text"
              inputMode="decimal"
              size="small"
              value={setAllInputValue}
              placeholder="0"
              onChange={(event) => {
                const sanitized = sanitizeCoefficientChange(event.target.value);
                if (sanitized !== null) {
                  setSetAllInputValue(sanitized);
                }
              }}
              onBlur={(event) => {
                const finalized = finalizeCoefficientValue(event.target.value);
                if (finalized !== event.target.value) {
                  setSetAllInputValue(finalized);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  applySetAllValue();
                }
              }}
              slotProps={{
                htmlInput: {
                  'aria-label': 'Value to apply to all coefficients',
                  min: COEFFICIENT_MIN,
                  max: COEFFICIENT_MAX,
                  onWheel: preventWheelChange,
                },
              }}
              sx={{ width: 58 }}
            />
          </div>
        </div>
      </div>

      <TableContainer component={Paper} sx={{ maxWidth: '100%', overflowX: 'auto' }}>
        <Table size="small" aria-label="Editable coefficient table">
          <TableHead>
            <TableRow>
              <TableCell
                component="th"
                scope="col"
                sx={{ fontWeight: 'bold', minWidth: 140 }}
              >
                Output \\ Input
              </TableCell>
              {inputs.map((input) => (
                <TableCell
                  key={input.id}
                  align="center"
                  component="th"
                  scope="col"
                  sx={{ fontWeight: 'bold', minWidth: 140 }}
                >
                  {input.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {outputs.map((output) => (
              <TableRow key={output.id}>
                <TableCell
                  component="th"
                  scope="row"
                  sx={{ fontWeight: 'bold', minWidth: 140 }}
                >
                  {output.label}
                </TableCell>
                {inputs.map((input) => (
                  <TableCell key={`${output.id}-${input.id}`} align="center">
                    <TextField
                      type="text"
                      inputMode="decimal"
                      size="small"
                      value={values[output.id]?.[input.id] ?? '0'}
                      onChange={(event) => {
                        const sanitized = sanitizeCoefficientChange(event.target.value);
                        if (sanitized !== null) {
                          onCellChange(output.id, input.id, sanitized);
                        }
                      }}
                      onBlur={(event) => {
                        const finalized = finalizeCoefficientValue(event.target.value);
                        if (finalized !== event.target.value) {
                          onCellChange(output.id, input.id, finalized);
                        }
                      }}
                      slotProps={{
                        htmlInput: {
                          'aria-label': `${output.label} coefficient for ${input.label}`,
                          min: COEFFICIENT_MIN,
                          max: COEFFICIENT_MAX,
                          onWheel: preventWheelChange,
                        },
                      }}
                      sx={{ width: 112 }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default CoefficientsTable;
