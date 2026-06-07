'use client';

import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';

export type CoefficientTableValue = string[][];

interface CoefficientsTableProps {
  inputLabels: string[];
  outputLabels: string[];
  values: CoefficientTableValue;
  onCellChange: (rowIndex: number, columnIndex: number, value: string) => void;
}

const CoefficientsTable = ({
  inputLabels,
  outputLabels,
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
              {inputLabels.map((label, columnIndex) => (
                <TableCell
                  key={`${label}-${columnIndex}`}
                  align="center"
                  component="th"
                  scope="col"
                  sx={{ fontWeight: 'bold', minWidth: 140 }}
                >
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {outputLabels.map((outputLabel, rowIndex) => (
              <TableRow key={`${outputLabel}-${rowIndex}`}>
                <TableCell
                  component="th"
                  scope="row"
                  sx={{ fontWeight: 'bold', minWidth: 140 }}
                >
                  {outputLabel}
                </TableCell>
                {inputLabels.map((inputLabel, columnIndex) => (
                  <TableCell key={`${outputLabel}-${inputLabel}-${columnIndex}`} align="center">
                    <TextField
                      type="number"
                      size="small"
                      value={values[rowIndex]?.[columnIndex] ?? '0'}
                      onChange={(event) => onCellChange(rowIndex, columnIndex, event.target.value)}
                      inputProps={{
                        'aria-label': `${outputLabel} coefficient for ${inputLabel}`,
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
