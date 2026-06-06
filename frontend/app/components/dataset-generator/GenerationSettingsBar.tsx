'use client';

import type { WheelEvent } from 'react';

interface GenerationSettingsBarProps {
  numRows: number | '';
  noise: number;
  filename: string;
  onNumRowsChange: (value: number | '') => void;
  onNoiseChange: (value: number) => void;
  onFilenameChange: (value: string) => void;
  onExport: (format: 'compact' | 'wide') => void;
  preventWheelChange: (e: WheelEvent<HTMLInputElement>) => void;
}

const GenerationSettingsBar = ({
  numRows,
  noise,
  filename,
  onNumRowsChange,
  onNoiseChange,
  onFilenameChange,
  onExport,
  preventWheelChange,
}: GenerationSettingsBarProps) => {
  return (
    <div className="mb-6 flex items-center">
      <label className="block text-sm font-medium mb-1 mr-2">
        Number of Rows
      </label>
      <input
        type="number"
        value={numRows}
        onChange={(e) => onNumRowsChange(Number(e.target.value) || '')}
        onWheel={preventWheelChange}
        min="1"
        className="w-20 p-2 border border-gray-600 rounded mr-2"
      />
      <label className="block text-sm font-medium mb-1 mr-2">
        Noise
      </label>
      <input
        type="number"
        value={noise}
        onChange={(e) => onNoiseChange(Number(e.target.value) || 0)}
        onWheel={preventWheelChange}
        min="0"
        step="0.01"
        className="w-20 p-2 border border-gray-600 rounded mr-2"
      />
      <label className="block text-sm font-medium mb-1 mr-2">
        Dataset Name
      </label>
      <input
        type="text"
        value={filename}
        placeholder="generated_dataset"
        onChange={(e) => onFilenameChange(e.target.value)}
        min="1"
        className="w-full p-2 border border-gray-600 rounded mr-2"
      />
      <button
        onClick={() => onExport('compact')}
        className="flex flex-col items-center px-5 py-1 bg-green-500 text-white rounded hover:bg-green-600 mr-2"
      >
        <span className="whitespace-nowrap">Export CSV</span>
        <span className="text-xs whitespace-nowrap">(Compact Format)</span>
      </button>
      <button
        onClick={() => onExport('wide')}
        className="flex flex-col items-center px-5 py-1 bg-green-500 text-white rounded hover:bg-green-600"
      >
        <span className="whitespace-nowrap">Export CSV</span>
        <span className="text-xs whitespace-nowrap">(Wide Format)</span>
      </button>
    </div>
  );
};

export default GenerationSettingsBar;
