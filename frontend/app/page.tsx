'use client';

import Image from "next/image";
import Link from 'next/link';
// import Sidebar from '../components/Sidebar';
import { useState } from 'react';


interface DescriptorGroup {
  id: string;
  name: string;
  min: string;
  max: string;
  units: string;
}

export default function DatasetGeneratorPage() {

  const [generalInputs, setGeneralInputs] = useState<DescriptorGroup[]>([]);
  const [formulationInputs, setFormulationInputs] = useState<DescriptorGroup[]>([]);
  const [outputs, setOutputs] = useState<DescriptorGroup[]>([]);
  const [numRows, setNumRows] = useState<number | ''>(10);
  const [filename, setFilename] = useState<string>("generated_dataset.csv");
  const [error, setError] = useState<string>("");

  const addDescriptorGroup = (category: 'general input' | 'formulation input' | 'output') => {
    const newGroup = {
      id: crypto.randomUUID(),
      name: '',
      min: '',
      max: '',
      units: ''
    };

    if (category === 'general input') {
      setGeneralInputs([...generalInputs, newGroup]);
    } else if (category === 'formulation input') {
      setFormulationInputs([...formulationInputs, newGroup]);
    } else if (category === 'output') {
      setOutputs([...outputs, newGroup]);
    }
  };

  const removeDescriptorGroup = (category: 'general input' | 'formulation input' | 'output', id: string) => {
    if (category === 'general input') {
      setGeneralInputs(generalInputs.filter(group => group.id !== id));
    } else if (category === 'formulation input') {
      setFormulationInputs(formulationInputs.filter(group => group.id !== id));
    } else if (category === 'output') {
      setOutputs(outputs.filter(group => group.id !== id));
    }
  };

  const updateDescriptorGroup = (category: 'general input' | 'formulation input' | 'output', id: string, field: keyof DescriptorGroup, value: string) => {
    if (category === 'general input') {
      setGeneralInputs(generalInputs.map(group => 
        group.id === id ? { ...group, [field]: value } : group
      ));
    } else if (category === 'formulation input') {
      setFormulationInputs(formulationInputs.map(group => 
        group.id === id ? { ...group, [field]: value } : group
      ));
    } else if (category === 'output') {
      setOutputs(outputs.map(group => 
        group.id === id ? { ...group, [field]: value } : group
      ));
    }
  };

  const preventWheelChange = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };


  async function generateData() {
    // Validate filename
    if (!filename.trim()) {
      setError("Filename is required.");
      return;
    }

    // Validate that at least one input type exists
    if (generalInputs.length === 0 && formulationInputs.length === 0) {
      setError("At least one General Input OR one Formulation Input is required.");
      return;
    }

    // Validate that at least one output exists
    if (outputs.length === 0) {
      setError("At least one Output is required.");
      return;
    }

    // Validate all descriptor groups
    const allGroups = [...generalInputs, ...formulationInputs, ...outputs];
    for (const group of allGroups) {
      if (!group.name.trim()) {
        setError("Variable names cannot be left blank.");
        return;
      }
      if (!group.min.trim()) {
        setError("All lower bounds are required.");
        return;
      }
      if (!group.max.trim()) {
        setError("All upper bounds are required.");
        return;
      }
    }

    // Validate formulation input bounds are between 0 and 1
    for (const group of formulationInputs) {
      const min = parseFloat(group.min);
      const max = parseFloat(group.max);
      if (min < 0 || min > 1 || max < 0 || max > 1) {
        setError("Formulation Input bounds must all have values between 0 and 1.");
        return;
      }
    }

    // Clear any existing error
    setError("");
    

    try {
      const response = await fetch(
        `http://localhost:8000/api/dataset-generator/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            general_inputs: generalInputs,
            formulation_inputs: formulationInputs,
            outputs: outputs,
            num_rows: numRows,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 400) {
          setError(errorData.detail);
        } else if (response.status === 500) {
          setError("An internal server error occurred. Please try again later.");
        } else {
          setError(errorData.detail || "An unexpected error occurred");
        }
        return;
      }

      const data = await response.json();
      const blob = new Blob([data.csv_string], { type: 'text/csv' });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error fetching synthetic demo data:', error);
      setError("An error occurred while generating the dataset. Please try again later.");
    }
  };



  return (
    <div className="min-h-screen p-4 sm:p-8 font-[family-name:var(--font-geist-sans)] flex justify-center">
      <main className="flex flex-col items-center w-full max-w-7xl">
        <div className="w-full">
          <div className="flex justify-center">
            <div className="flex-1 flex flex-col items-center gap-8 max-w-4xl">
              <div className="flex gap-4 items-center flex-col sm:flex-row">
      
              </div>
              <div className="w-full max-w-4xl">
                {error && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                  </div>
                )}
                <div className="mb-6 flex items-center">
                  <label className="block text-sm font-medium mb-1 mr-2">
                    Number of Rows
                  </label>
                  <input
                    type="number"
                    value={numRows}
                    onChange={(e) => setNumRows(Number(e.target.value) || '')}
                    onWheel={preventWheelChange}
                    min="1"
                    className="w-36 p-2 border border-gray-600 rounded mr-2"
                  />
                  <label className="block text-sm font-medium mb-1 mr-2">
                    Filename
                  </label>
                  <input
                    type="text"
                    value={filename}
                    placeholder="generated_dataset.csv"
                    onChange={(e) => setFilename(e.target.value)}
                    min="1"
                    className="w-full p-2 border border-gray-600 rounded mr-2"
                  />
                  <button
                    onClick={generateData}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Generate Data & Download CSV
                  </button>
                </div>
      
                {/* General Inputs Section */}
                <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
                  <h2 className="text-lg font-bold mb-2">General Inputs</h2>
                  <button
                    onClick={() => addDescriptorGroup('general input')}
                    className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Add General Input
                  </button>
                  {generalInputs.map(group => (
                    <div key={group.id} className="mb-6 p-4 border rounded-lg relative">
                      <button
                        onClick={() => removeDescriptorGroup('general input', group.id)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Variable name</label>
                          <input
                            type="text"
                            value={group.name}
                            onChange={(e) => updateDescriptorGroup('general input', group.id, 'name', e.target.value)}
                            className="w-full p-2 border border-gray-600 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Lower bound</label>
                          <input
                            type="number"
                            value={group.min}
                            onChange={(e) => updateDescriptorGroup('general input', group.id, 'min', e.target.value)}
                            onWheel={preventWheelChange}
                            className="w-full p-2 border border-gray-600 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Upper bound</label>
                          <input
                            type="number"
                            value={group.max}
                            onChange={(e) => updateDescriptorGroup('general input', group.id, 'max', e.target.value)}
                            onWheel={preventWheelChange}
                            className="w-full p-2 border border-gray-600 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Units (optional)</label>
                          <input
                            type="text"
                            value={group.units}
                            onChange={(e) => updateDescriptorGroup('general input', group.id, 'units', e.target.value)}
                            className="w-full p-2 border border-gray-600 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
      
                {/* Formulation Inputs Section */}
                <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
                  <h2 className="text-lg font-bold mb-2">Formulation Inputs</h2>
                  <p className="mb-4 text-sm text-gray-600">
                    Note: Lower and upper bounds must be between 0 and 1, representing percentages that will sum to 100%.
                    Ex: 0.25 represents 25%.
                  </p>
                  <button
                    onClick={() => addDescriptorGroup('formulation input')}
                    className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Add Formulation Input
                  </button>
                  {formulationInputs.map(group => (
                    <div key={group.id} className="mb-6 p-4 border rounded-lg relative">
                      <button
                        onClick={() => removeDescriptorGroup('formulation input', group.id)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Variable name</label>
                          <input
                            type="text"
                            value={group.name}
                            onChange={(e) => updateDescriptorGroup('formulation input', group.id, 'name', e.target.value)}
                            className="w-full p-2 border border-gray-600 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Lower bound</label>
                          <input
                            type="number"
                            value={group.min}
                            onChange={(e) => updateDescriptorGroup('formulation input', group.id, 'min', e.target.value)}
                            onWheel={preventWheelChange}
                            className="w-full p-2 border border-gray-600 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Upper bound</label>
                          <input
                            type="number"
                            value={group.max}
                            onChange={(e) => updateDescriptorGroup('formulation input', group.id, 'max', e.target.value)}
                            onWheel={preventWheelChange}
                            className="w-full p-2 border border-gray-600 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
      
                {/* Outputs Section */}
                <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
                  <h2 className="text-lg font-bold mb-2">Outputs</h2>
                  <button
                    onClick={() => addDescriptorGroup('output')}
                    className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Add Output
                  </button>
                  {outputs.map(group => (
                    <div key={group.id} className="mb-6 p-4 border rounded-lg relative">
                      <button
                        onClick={() => removeDescriptorGroup('output', group.id)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Variable name</label>
                          <input
                            type="text"
                            value={group.name}
                            onChange={(e) => updateDescriptorGroup('output', group.id, 'name', e.target.value)}
                            className="w-full p-2 border border-gray-600 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Lower bound</label>
                          <input
                            type="number"
                            value={group.min}
                            onChange={(e) => updateDescriptorGroup('output', group.id, 'min', e.target.value)}
                            onWheel={preventWheelChange}
                            className="w-full p-2 border border-gray-600 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Upper bound</label>
                          <input
                            type="number"
                            value={group.max}
                            onChange={(e) => updateDescriptorGroup('output', group.id, 'max', e.target.value)}
                            onWheel={preventWheelChange}
                            className="w-full p-2 border border-gray-600 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Units (optional)</label>
                          <input
                            type="text"
                            value={group.units}
                            onChange={(e) => updateDescriptorGroup('output', group.id, 'units', e.target.value)}
                            className="w-full p-2 border border-gray-600 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
