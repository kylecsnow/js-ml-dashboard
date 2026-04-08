'use client';

import Image from "next/image";
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import ChatSidebar from '../components/ChatSidebar';
import { Switch } from '@headlessui/react';
import { useCallback, useEffect, useState } from 'react';

// import Table from '@mui/material/Table';
// import TableBody from '@mui/material/TableBody';
// import TableCell from '@mui/material/TableCell';
// import TableContainer from '@mui/material/TableContainer';
// import TableHead from '@mui/material/TableHead';
// import TableRow from '@mui/material/TableRow';
// import Paper from '@mui/material/Paper';
// import { TableVirtuoso, TableComponents } from 'react-virtuoso';

export interface DescriptorGroup {
  id: string;
  name: string;
  min: string;
  max: string;
  units: string;
}

interface SchemaConfig {
  generalInputs: Omit<DescriptorGroup, 'id'>[];
  formulationInputs: Omit<DescriptorGroup, 'id'>[];
  outputs: Omit<DescriptorGroup, 'id'>[];
  numRows: number | '';
  noise: number;
  filename: string;
  minIngredientsPerFormulation: string;
  maxIngredientsPerFormulation: string;
}

interface SavedSchemaEntry {
  id: number;
  name: string;
  config: SchemaConfig;
  created_at: string | null;
}

const DatasetGeneratorPage = () => {
  const [generalInputs, setGeneralInputs] = useState<DescriptorGroup[]>([]);
  const [formulationInputs, setFormulationInputs] = useState<DescriptorGroup[]>([]);
  const [outputs, setOutputs] = useState<DescriptorGroup[]>([]);
  const [numRows, setNumRows] = useState<number | ''>(50);
  const [showCoefficientsToggle, setShowCoefficientsToggle] = useState<boolean>(false);
  const [filename, setFilename] = useState<string>("generated_dataset.csv");
  const [noise, setNoise] = useState<number>(0.025);
  const [error, setError] = useState<string>("");
  const [minIngredientsPerFormulation, setMinIngredientsPerFormulation] = useState<string>("");  // TODO: do we really want to allow these to be strings....???
  const [maxIngredientsPerFormulation, setMaxIngredientsPerFormulation] = useState<string>("");  // TODO: do we really want to allow these to be strings....???
  const [chatOpen, setChatOpen] = useState(false);

  const [savedSchemas, setSavedSchemas] = useState<SavedSchemaEntry[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [schemaNameInput, setSchemaNameInput] = useState("");
  const [schemaDropdownOpen, setSchemaDropdownOpen] = useState(false);

  const fetchSchemas = useCallback(async () => {
    try {
      const response = await fetch('./api/schemas');
      if (response.ok) {
        const data = await response.json();
        setSavedSchemas(data.schemas);
      }
    } catch (err) {
      console.error('Failed to fetch saved schemas:', err);
    }
  }, []);

  useEffect(() => {
    fetchSchemas();
  }, [fetchSchemas]);

  const saveSchema = async () => {
    if (!schemaNameInput.trim()) {
      setError("Schema name is required.");
      return;
    }

    const config: SchemaConfig = {
      generalInputs: generalInputs.map(({ name, min, max, units }) => ({ name, min, max, units })),
      formulationInputs: formulationInputs.map(({ name, min, max, units }) => ({ name, min, max, units })),
      outputs: outputs.map(({ name, min, max, units }) => ({ name, min, max, units })),
      numRows,
      noise,
      filename,
      minIngredientsPerFormulation,
      maxIngredientsPerFormulation,
    };

    try {
      const response = await fetch('./api/schemas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: schemaNameInput, config }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to save schema.");
        return;
      }

      setSchemaNameInput("");
      setShowSaveModal(false);
      setError("");
      fetchSchemas();
    } catch (err) {
      console.error('Failed to save schema:', err);
      setError("Failed to save schema.");
    }
  };

  const deleteSchema = async (schemaId: number) => {
    try {
      const response = await fetch(`./api/schemas/${schemaId}`, { method: 'DELETE' });
      if (response.ok) {
        fetchSchemas();
      }
    } catch (err) {
      console.error('Failed to delete schema:', err);
    }
  };

  const loadSchema = (schema: SavedSchemaEntry) => {
    const c = schema.config;
    setGeneralInputs(c.generalInputs.map(g => ({ ...g, id: crypto.randomUUID() })));
    setFormulationInputs(c.formulationInputs.map(g => ({ ...g, id: crypto.randomUUID() })));
    setOutputs(c.outputs.map(g => ({ ...g, id: crypto.randomUUID() })));
    setNumRows(c.numRows);
    setNoise(c.noise);
    setFilename(c.filename);
    setMinIngredientsPerFormulation(c.minIngredientsPerFormulation);
    setMaxIngredientsPerFormulation(c.maxIngredientsPerFormulation);
    setSchemaDropdownOpen(false);
    setError("");
  };

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


  async function generateData(outputFormat: 'compact' | 'wide') {
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


    // Validate user selections for MinIngredientsPerFormulation and MaxIngredientsPerFormulation are allowable
    let resolvedMinIngredientsPerFormulation: number | null = null;
    let resolvedMaxIngredientsPerFormulation: number | null = null;

    if (formulationInputs.length > 0) {
      const nIngredients = formulationInputs.length;

      resolvedMinIngredientsPerFormulation =
        minIngredientsPerFormulation.trim() === ""
          ? nIngredients
          : Number(minIngredientsPerFormulation);
      resolvedMaxIngredientsPerFormulation =
        maxIngredientsPerFormulation.trim() === ""
          ? nIngredients
          : Number(maxIngredientsPerFormulation);

      if (
        !Number.isInteger(resolvedMinIngredientsPerFormulation) ||
        !Number.isInteger(resolvedMaxIngredientsPerFormulation)
      ) {
        setError("Min/Max ingredients per formulation must be integers.");
        return;
      }

      if (resolvedMinIngredientsPerFormulation < 1) {
        setError("Min ingredients per formulation must be at least 1.");
        return;
      }

      if (resolvedMinIngredientsPerFormulation > resolvedMaxIngredientsPerFormulation) {
        setError("Min ingredients per formulation cannot exceed max ingredients per formulation.");
        return;
      }

      if (resolvedMaxIngredientsPerFormulation > nIngredients) {
        setError("Max ingredients per formulation cannot exceed the number of formulation inputs.");
        return;
      }
    }

    // Clear any existing error
    setError("");

    try {
      const response = await fetch(
        // `http://localhost:8000/api/dataset-generator`, {
        `./api/dataset-generator`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            general_inputs: generalInputs,
            formulation_inputs: formulationInputs,
            outputs: outputs,
            num_rows: numRows,
            noise: noise,
            output_format: outputFormat,
            min_ingredients_per_formulation: resolvedMinIngredientsPerFormulation,
            max_ingredients_per_formulation: resolvedMaxIngredientsPerFormulation,
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


      // stuff to make the CSV download compatible with iframes...?
      const blob = new Blob([data.csv_string], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      
      // Create hidden iframe for download
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      try {
        // Write download link to iframe and click it
        const iframeDoc = iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(`<a href="${url}" download="${filename}"></a>`);
          iframeDoc.close();
          const downloadLink = iframeDoc.querySelector('a');
          downloadLink?.click();
        }
      } finally {
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(iframe);
          window.URL.revokeObjectURL(url);
        }, 100);
      }

    } catch (error) {
      console.error('Error fetching synthetic demo data:', error);
      setError("An error occurred while generating the dataset. Please try again later.");
    }
  };


  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div
        className="flex-1 flex flex-col items-center p-8 gap-4 transition-[margin] duration-300 ease-in-out"
        style={{ marginRight: chatOpen ? 420 : 0 }}
      >
        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <Link
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="./"
          >
            <Image
              src="/snowflake.svg"
              alt="My snowflake logomark"
              width={20}
              height={20}
            />
            Home
          </Link>
        </div>

        {/* <div>
          <h3>TODOs:</h3>
          
          
          
          <ol className="list-decimal ml-6">
            <li>Fix sampling for narrow formulation ranges</li>
            <li>Add an "advanced" menu that allows users to specify their coefficients</li>
            <li>Allow users to add noise to the functions generating their data (one for each output)</li>
          </ol>
          <br></br>

          <ol className="list-decimal ml-6">
            <li>(someday) allow users to preview rows of generated data (include interactive table somehow?)</li>
            <li>(someday) For formulation ingredients, add logic for "must include", "can include", or "exclude"</li>
          </ol>
        </div> */}
        {/* <div>
          <label className="mr-2">Show coefficients</label>
          <Switch
            checked={showCoefficientsToggle}
            onChange={setShowCoefficientsToggle}
            className={`${
              showCoefficientsToggle ? 'bg-blue-600' : 'bg-gray-200'
            } relative inline-flex items-center h-6 rounded-full w-11`}
          >
            <span className="sr-only">Cluster variables</span>
            <span
              className={`${
                showCoefficientsToggle ? 'translate-x-6' : 'translate-x-1'
              } inline-block w-4 h-4 transform bg-white rounded-full transition`}
            />
          </Switch>
        </div> */}
        <div className="w-full max-w-4xl">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Save / Load Schema controls */}
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
            >
              Save Schema
            </button>

            <div className="relative">
              <button
                onClick={() => setSchemaDropdownOpen(!schemaDropdownOpen)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Load Schema {savedSchemas.length > 0 && `(${savedSchemas.length})`}
              </button>
              {schemaDropdownOpen && (
                <div className="absolute z-10 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-64 overflow-y-auto">
                  {savedSchemas.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No saved schemas yet.</div>
                  ) : (
                    savedSchemas.map(schema => (
                      <div
                        key={schema.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <button
                          onClick={() => loadSchema(schema)}
                          className="flex-1 text-left text-sm truncate"
                        >
                          {schema.name}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSchema(schema.id);
                          }}
                          className="ml-2 text-red-500 hover:text-red-700 text-sm flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Save Schema modal */}
          {showSaveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl">
                <h3 className="text-lg font-bold mb-4">Save Schema</h3>
                <input
                  type="text"
                  value={schemaNameInput}
                  onChange={(e) => setSchemaNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveSchema(); }}
                  placeholder="Enter a name for this schema"
                  className="w-full p-2 border border-gray-600 rounded mb-4"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowSaveModal(false); setSchemaNameInput(""); }}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSchema}
                    className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                  >
                    Save
                  </button>
                </div>
              </div>
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
              className="w-20 p-2 border border-gray-600 rounded mr-2"
            />
            <label className="block text-sm font-medium mb-1 mr-2">
              Noise
            </label>
            <input
              type="number"
              value={noise}
              onChange={(e) => setNoise(Number(e.target.value) || 0)}
              onWheel={preventWheelChange}
              min="0"
              step="0.01"
              className="w-20 p-2 border border-gray-600 rounded mr-2"
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
              onClick={() => generateData('compact')}
              className="flex flex-col items-center px-5 py-1 bg-green-500 text-white rounded hover:bg-green-600 mr-2"
            >
              <span className="whitespace-nowrap">Export CSV</span>
              <span className="text-xs whitespace-nowrap">(Compact Format)</span>
            </button>
            <button
              onClick={() => generateData('wide')}
              className="flex flex-col items-center px-5 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            >
              <span className="whitespace-nowrap">Export CSV</span>
              <span className="text-xs whitespace-nowrap">(Wide Format)</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Min ingredients per formulation (optional)
                </label>
                <input
                  type="number"
                  value={minIngredientsPerFormulation}
                  onChange={(e) => setMinIngredientsPerFormulation(e.target.value)}
                  onWheel={preventWheelChange}
                  min="1"
                  step="1"
                  placeholder={`Defaults to ${formulationInputs.length || "n_ingredients"}`}
                  className="w-full p-2 border border-gray-600 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Max ingredients per formulation (optional)
                </label>
                <input
                  type="number"
                  value={maxIngredientsPerFormulation}
                  onChange={(e) => setMaxIngredientsPerFormulation(e.target.value)}
                  onWheel={preventWheelChange}
                  min="1"
                  step="1"
                  placeholder={`Defaults to ${formulationInputs.length || "n_ingredients"}`}
                  className="w-full p-2 border border-gray-600 rounded"
                />
              </div>
            </div>
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

      <ChatSidebar
        open={chatOpen}
        onOpenChange={setChatOpen}
        generalInputs={generalInputs}
        formulationInputs={formulationInputs}
        outputs={outputs}
        numRows={numRows}
        noise={noise}
        filename={filename}
        minIngredientsPerFormulation={minIngredientsPerFormulation}
        maxIngredientsPerFormulation={maxIngredientsPerFormulation}
        setGeneralInputs={setGeneralInputs}
        setFormulationInputs={setFormulationInputs}
        setOutputs={setOutputs}
        setNumRows={setNumRows}
        setNoise={setNoise}
        setFilename={setFilename}
        setMinIngredientsPerFormulation={setMinIngredientsPerFormulation}
        setMaxIngredientsPerFormulation={setMaxIngredientsPerFormulation}
      />
    </div>
  );
};


export default DatasetGeneratorPage;
