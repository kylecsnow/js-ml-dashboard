'use client';

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
}

const CoefficientsTable = ({
  inputs,
  outputs,
  values,
  onCellChange,
}: CoefficientsTableProps) => {
  return (
    <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
      <div className="mb-4">
        <h2 className="text-lg font-bold">Coefficients</h2>
        {/* <p className="text-sm text-gray-600"> */}
        <p className="text-sm text-red-600">
          Edit the coefficient values below. [TODO: figure out the right "copy" for this part.] The coefficients can range from -1 to 1. 
          Setting coefficients will influence whether each input variable has a positively-correlated or negatively-correlated influence 
          on the corresponding output variable. 
        </p>
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
                      type="number"
                      size="small"
                      value={values[output.id]?.[input.id] ?? '0'}
                      onChange={(event) => onCellChange(output.id, input.id, event.target.value)}
                      inputProps={{
                        'aria-label': `${output.label} coefficient for ${input.label}`,
                        step: 'any',
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
