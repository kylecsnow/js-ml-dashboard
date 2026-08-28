'use client';

import Image from "next/image";
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import ChatSidebar from '../components/dataset-generator/ChatSidebar';
import SchemaToolbar from '../components/dataset-generator/SchemaToolbar';
import SaveSchemaModal from '../components/dataset-generator/SaveSchemaModal';
import RenameSchemaModal from '../components/dataset-generator/RenameSchemaModal';
import DeleteSchemaModal from '../components/dataset-generator/DeleteSchemaModal';
import GenerationSettingsBar from '../components/dataset-generator/GenerationSettingsBar';
import DescriptorSection from '../components/dataset-generator/DescriptorSection';
import FormulationSection from '../components/dataset-generator/FormulationSection';
import CoefficientsTable from '../components/dataset-generator/CoefficientsTable';
import { Switch } from '@headlessui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildCoefficientAxes,
  randomCoefficient,
  reconcileCoefficientValues,
} from './coefficients';
import { buildGenerateRequest, defaultGlobalIngredientCounts } from './generate';
import {
  buildSchemaConfig,
  createEmptyFormulationGroup,
  createEmptyIngredient,
  hydrateSchemaConfig,
} from './schema';
import type {
  CoefficientTableValue,
  DescriptorGroup,
  FormulationGroup,
  SavedSchemaEntry,
} from './types';

export type {
  DescriptorGroup,
  FormulationDescriptorGroup,
  FormulationGroup,
  SavedSchemaEntry,
} from './types';

const DatasetGeneratorPage = () => {
  const [generalInputs, setGeneralInputs] = useState<DescriptorGroup[]>([]);
  const [formulationGroups, setFormulationGroups] = useState<FormulationGroup[]>([]);
  const [outputs, setOutputs] = useState<DescriptorGroup[]>([]);
  const [numRows, setNumRows] = useState<number | ''>(50);
  const [showCoefficientsToggle, setShowCoefficientsToggle] = useState<boolean>(false);
  const [coefficientValues, setCoefficientValues] = useState<CoefficientTableValue>(() =>
    reconcileCoefficientValues({}, ['default-output'], ['default-input']),
  );
  const [filename, setFilename] = useState<string>("generated_dataset_name");
  const [noise, setNoise] = useState<number>(0.025);
  const [error, setError] = useState<string>("");
  const [minIngredientsPerFormulation, setMinIngredientsPerFormulation] = useState<string>("");
  const [maxIngredientsPerFormulation, setMaxIngredientsPerFormulation] = useState<string>("");
  const [chatOpen, setChatOpen] = useState(false);
  const [isGeneralInputsOpen, setIsGeneralInputsOpen] = useState(true);
  const [isFormulationInputsOpen, setIsFormulationInputsOpen] = useState(true);
  const [isOutputsOpen, setIsOutputsOpen] = useState(true);

  const [savedSchemas, setSavedSchemas] = useState<SavedSchemaEntry[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [schemaNameInput, setSchemaNameInput] = useState("");
  const [renamingSchemaId, setRenamingSchemaId] = useState<number | null>(null);
  const [renameSchemaInput, setRenameSchemaInput] = useState("");
  const [deletingSchema, setDeletingSchema] = useState<{ id: number; name: string } | null>(null);
  const [schemaDropdownOpen, setSchemaDropdownOpen] = useState(false);
  const schemaDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!schemaDropdownOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const root = schemaDropdownRef.current;
      if (root && !root.contains(e.target as Node)) {
        setSchemaDropdownOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [schemaDropdownOpen]);

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

    const config = buildSchemaConfig({
      generalInputs,
      formulationGroups,
      outputs,
      numRows,
      noise,
      filename,
      minIngredientsPerFormulation,
      maxIngredientsPerFormulation,
      coefficientValues,
    });

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

  const openDeleteModal = (schema: SavedSchemaEntry) => {
    setDeletingSchema({ id: schema.id, name: schema.name });
    setShowDeleteModal(true);
    setSchemaDropdownOpen(false);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingSchema(null);
  };

  const confirmDeleteSchema = async () => {
    if (!deletingSchema) return;

    try {
      const response = await fetch(`./api/schemas/${deletingSchema.id}`, { method: 'DELETE' });
      if (response.ok) {
        closeDeleteModal();
        fetchSchemas();
      }
    } catch (err) {
      console.error('Failed to delete schema:', err);
    }
  };

  const openRenameModal = (schema: SavedSchemaEntry) => {
    setRenamingSchemaId(schema.id);
    setRenameSchemaInput(schema.name);
    setShowRenameModal(true);
    setSchemaDropdownOpen(false);
  };

  const closeRenameModal = () => {
    setShowRenameModal(false);
    setRenamingSchemaId(null);
    setRenameSchemaInput("");
  };

  const renameSchema = async () => {
    if (renamingSchemaId === null) return;

    if (!renameSchemaInput.trim()) {
      setError("Schema name is required.");
      return;
    }

    try {
      const response = await fetch(`./api/schemas/${renamingSchemaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameSchemaInput }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to rename schema.");
        return;
      }

      closeRenameModal();
      setError("");
      fetchSchemas();
    } catch (err) {
      console.error('Failed to rename schema:', err);
      setError("Failed to rename schema.");
    }
  };

  const loadSchema = (schema: SavedSchemaEntry) => {
    const loaded = hydrateSchemaConfig(schema.config);
    setGeneralInputs(loaded.generalInputs);
    setFormulationGroups(loaded.formulationGroups);
    setOutputs(loaded.outputs);
    setNumRows(loaded.numRows);
    setNoise(loaded.noise);
    setFilename(loaded.filename);
    setMinIngredientsPerFormulation(loaded.minIngredientsPerFormulation);
    setMaxIngredientsPerFormulation(loaded.maxIngredientsPerFormulation);
    setCoefficientValues(loaded.coefficientValues);
    setSchemaDropdownOpen(false);
    setError("");
  };

  const addDescriptorGroup = (category: 'general input' | 'output') => {
    const newGroup = {
      id: crypto.randomUUID(),
      name: '',
      min: '',
      max: '',
      units: ''
    };

    if (category === 'general input') {
      setGeneralInputs([...generalInputs, newGroup]);
    } else if (category === 'output') {
      setOutputs([...outputs, newGroup]);
    }
  };

  const removeDescriptorGroup = (category: 'general input' | 'output', id: string) => {
    if (category === 'general input') {
      setGeneralInputs(generalInputs.filter(group => group.id !== id));
    } else if (category === 'output') {
      setOutputs(outputs.filter(group => group.id !== id));
    }
  };

  const updateDescriptorGroup = (category: 'general input' | 'output', id: string, field: keyof DescriptorGroup, value: string) => {
    if (category === 'general input') {
      setGeneralInputs(generalInputs.map(group => 
        group.id === id ? { ...group, [field]: value } : group
      ));
    } else if (category === 'output') {
      setOutputs(outputs.map(group => 
        group.id === id ? { ...group, [field]: value } : group
      ));
    }
  };

  // ---- Formulation group + ingredient helpers ----

  const addFormulationGroup = () => {
    setFormulationGroups([...formulationGroups, createEmptyFormulationGroup()]);
  };

  const removeFormulationGroup = (groupId: string) => {
    setFormulationGroups(formulationGroups.filter(group => group.id !== groupId));
  };

  const updateFormulationGroup = (
    groupId: string,
    field: 'name' | 'min' | 'max' | 'minIngredients' | 'maxIngredients',
    value: string,
  ) => {
    setFormulationGroups(formulationGroups.map(group =>
      group.id === groupId ? { ...group, [field]: value } : group
    ));
  };

  const addIngredientToGroup = (groupId: string) => {
    setFormulationGroups(formulationGroups.map(group =>
      group.id === groupId
        ? { ...group, ingredients: [...group.ingredients, createEmptyIngredient()] }
        : group
    ));
  };

  const removeIngredientFromGroup = (groupId: string, ingredientId: string) => {
    setFormulationGroups(formulationGroups.map(group =>
      group.id === groupId
        ? { ...group, ingredients: group.ingredients.filter(ing => ing.id !== ingredientId) }
        : group
    ));
  };

  const updateIngredientInGroup = (
    groupId: string,
    ingredientId: string,
    field: keyof DescriptorGroup,
    value: string,
  ) => {
    setFormulationGroups(formulationGroups.map(group =>
      group.id === groupId
        ? {
            ...group,
            ingredients: group.ingredients.map(ing =>
              ing.id === ingredientId ? { ...ing, [field]: value } : ing
            ),
          }
        : group
    ));
  };

  const updateIngredientRequired = (groupId: string, ingredientId: string, required: boolean) => {
    setFormulationGroups(formulationGroups.map(group =>
      group.id === groupId
        ? {
            ...group,
            ingredients: group.ingredients.map(ing =>
              ing.id === ingredientId ? { ...ing, required } : ing
            ),
          }
        : group
    ));
  };

  const preventWheelChange = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  const renderCollapseIcon = (isOpen: boolean) => (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-slate-700 shadow-sm">
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d={isOpen ? "M6 14L12 8L18 14" : "M6 10L12 16L18 10"}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );


  async function generateData(outputFormat: 'compact' | 'wide') {
    const result = buildGenerateRequest({
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
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError("");
    const totalIngredients = formulationGroups.flatMap(g => g.ingredients).length;

    try {
      const response = await fetch(
        `./api/dataset-generator`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(result.payload),
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

      const triggerCsvDownload = (csvContent: string, downloadFilename: string) => {
        // stuff to make the CSV download compatible with iframes
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
            iframeDoc.write(`<a href="${url}" download="${downloadFilename}"></a>`);
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
      };

      const getDatasetBaseName = (rawName: string) => rawName.trim() || "generated_dataset_name";

      const datasetBaseName = getDatasetBaseName(filename);
      const hasFormulationInputs = totalIngredients > 0;
      const formulationsFilename = hasFormulationInputs
        ? `${datasetBaseName}_formulations.csv`
        : `${datasetBaseName}.csv`;
      const componentsFilename = `${datasetBaseName}_components.csv`;

      triggerCsvDownload(data.csv_string, formulationsFilename);

      if (hasFormulationInputs && data.components_csv_string) {
        triggerCsvDownload(
          data.components_csv_string,
          componentsFilename
        );
      }

    } catch (error) {
      console.error('Error fetching synthetic demo data:', error);
      setError("An error occurred while generating the dataset. Please try again later.");
    }
  };

  const totalFormulationIngredients = formulationGroups.reduce(
    (count, group) => count + group.ingredients.length,
    0,
  );
  const defaultIngredientCounts =
    totalFormulationIngredients > 0
      ? defaultGlobalIngredientCounts(formulationGroups)
      : null;

  const { inputs: coefficientInputs, outputs: coefficientOutputs } = buildCoefficientAxes(
    generalInputs,
    formulationGroups,
    outputs,
  );
  const visibleCoefficientInputs =
    coefficientInputs.length > 0
      ? coefficientInputs
      : [{ id: 'default-input', label: 'Input 1' }];
  const visibleCoefficientOutputs =
    coefficientOutputs.length > 0
      ? coefficientOutputs
      : [{ id: 'default-output', label: 'Output 1' }];
  const visibleCoefficientInputIds = visibleCoefficientInputs.map(({ id }) => id);
  const visibleCoefficientOutputIds = visibleCoefficientOutputs.map(({ id }) => id);
  const visibleCoefficientInputKey = visibleCoefficientInputIds.join('|');
  const visibleCoefficientOutputKey = visibleCoefficientOutputIds.join('|');

  useEffect(() => {
    setCoefficientValues((currentValues) =>
      reconcileCoefficientValues(
        currentValues,
        visibleCoefficientOutputKey.split('|'),
        visibleCoefficientInputKey.split('|'),
      ),
    );
  }, [visibleCoefficientInputKey, visibleCoefficientOutputKey]);

  const updateCoefficientValue = (
    outputId: string,
    inputId: string,
    value: string,
  ) => {
    setCoefficientValues((currentValues) =>
      ({
        ...currentValues,
        [outputId]: {
          ...currentValues[outputId],
          [inputId]: value,
        },
      }),
    );
  };

  const randomizeCoefficients = () => {
    setCoefficientValues(() =>
      Object.fromEntries(
        visibleCoefficientOutputIds.map((outputId) => [
          outputId,
          Object.fromEntries(
            visibleCoefficientInputIds.map((inputId) => [inputId, randomCoefficient()]),
          ),
        ]),
      ),
    );
  };

  const setAllCoefficientsToValue = (value: string) => {
    setCoefficientValues(() =>
      Object.fromEntries(
        visibleCoefficientOutputIds.map((outputId) => [
          outputId,
          Object.fromEntries(
            visibleCoefficientInputIds.map((inputId) => [inputId, value]),
          ),
        ]),
      ),
    );
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





        {/* <div className="text-red-600">
          <h3>TODOs:</h3>
          
          <ol className="list-decimal ml-6">
          </ol>
          <br></br>

          <ol className="list-decimal ml-6">
            <li>(someday) Add the `quick_dataset_eval.py` capability to this page so a user can interactively test/tweak how much "noise" they actually want to use when generating their dataset!</li>
            <li>(someday) Coefficients Table: Do I want to consider (or put on backlog) making table cells smaller/dynamically resizable? Because sometimes there's a lot of info to fit all in one page...</li>
            <li>(someday) Allow users to add noise to the functions generating their data, on an output-by-output level (i.e. one noise value for each output)</li>
            <li>(someday) allow users to preview rows of generated data (include interactive table somehow?)</li>
          </ol>
        </div> */}




        <div>
          <label className="mr-2">Advanced: Show Coefficients</label>
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
        </div>




        <div className="w-full max-w-4xl">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <SchemaToolbar
            savedSchemas={savedSchemas}
            dropdownOpen={schemaDropdownOpen}
            dropdownRef={schemaDropdownRef}
            onToggleDropdown={() => setSchemaDropdownOpen(!schemaDropdownOpen)}
            onOpenSaveModal={() => setShowSaveModal(true)}
            onLoadSchema={loadSchema}
            onOpenRenameModal={openRenameModal}
            onOpenDeleteModal={openDeleteModal}
          />

          {showSaveModal && (
            <SaveSchemaModal
              value={schemaNameInput}
              onChange={setSchemaNameInput}
              onSave={saveSchema}
              onCancel={() => { setShowSaveModal(false); setSchemaNameInput(""); }}
            />
          )}

          {showRenameModal && (
            <RenameSchemaModal
              value={renameSchemaInput}
              onChange={setRenameSchemaInput}
              onRename={renameSchema}
              onCancel={closeRenameModal}
            />
          )}

          {showDeleteModal && deletingSchema && (
            <DeleteSchemaModal
              schemaName={deletingSchema.name}
              onConfirm={confirmDeleteSchema}
              onCancel={closeDeleteModal}
            />
          )}

        </div>

        <div className="w-full max-w-4xl">
          <GenerationSettingsBar
            numRows={numRows}
            noise={noise}
            filename={filename}
            onNumRowsChange={setNumRows}
            onNoiseChange={setNoise}
            onFilenameChange={setFilename}
            onExport={generateData}
            preventWheelChange={preventWheelChange}
          />
        </div>

        {showCoefficientsToggle && (
          <div className="w-full max-w-7xl">
            <CoefficientsTable
              inputs={visibleCoefficientInputs}
              outputs={visibleCoefficientOutputs}
              values={coefficientValues}
              onCellChange={updateCoefficientValue}
              onRandomize={randomizeCoefficients}
              onSetAllToValue={setAllCoefficientsToValue}
              preventWheelChange={preventWheelChange}
            />
          </div>
        )}

        <div className="w-full max-w-4xl">
          <DescriptorSection
            title="General Inputs"
            addLabel="Add General Input"
            isOpen={isGeneralInputsOpen}
            onToggle={() => setIsGeneralInputsOpen((prev) => !prev)}
            groups={generalInputs}
            onAdd={() => addDescriptorGroup('general input')}
            onRemove={(id) => removeDescriptorGroup('general input', id)}
            onUpdate={(id, field, value) => updateDescriptorGroup('general input', id, field, value)}
            preventWheelChange={preventWheelChange}
            renderCollapseIcon={renderCollapseIcon}
          />

          <FormulationSection
            isOpen={isFormulationInputsOpen}
            onToggle={() => setIsFormulationInputsOpen((prev) => !prev)}
            renderCollapseIcon={renderCollapseIcon}
            formulationGroups={formulationGroups}
            minIngredientsPerFormulation={minIngredientsPerFormulation}
            maxIngredientsPerFormulation={maxIngredientsPerFormulation}
            defaultIngredientCounts={defaultIngredientCounts}
            onMinIngredientsChange={setMinIngredientsPerFormulation}
            onMaxIngredientsChange={setMaxIngredientsPerFormulation}
            onAddGroup={addFormulationGroup}
            onRemoveGroup={removeFormulationGroup}
            onUpdateGroup={updateFormulationGroup}
            onAddIngredient={addIngredientToGroup}
            onRemoveIngredient={removeIngredientFromGroup}
            onUpdateIngredient={updateIngredientInGroup}
            onUpdateIngredientRequired={updateIngredientRequired}
            preventWheelChange={preventWheelChange}
          />

          <DescriptorSection
            title="Outputs"
            addLabel="Add Output"
            isOpen={isOutputsOpen}
            onToggle={() => setIsOutputsOpen((prev) => !prev)}
            groups={outputs}
            onAdd={() => addDescriptorGroup('output')}
            onRemove={(id) => removeDescriptorGroup('output', id)}
            onUpdate={(id, field, value) => updateDescriptorGroup('output', id, field, value)}
            preventWheelChange={preventWheelChange}
            renderCollapseIcon={renderCollapseIcon}
          />
        </div>
      </div>

      <ChatSidebar
        open={chatOpen}
        onOpenChange={setChatOpen}
        generalInputs={generalInputs}
        formulationGroups={formulationGroups}
        outputs={outputs}
        numRows={numRows}
        noise={noise}
        filename={filename}
        minIngredientsPerFormulation={minIngredientsPerFormulation}
        maxIngredientsPerFormulation={maxIngredientsPerFormulation}
        setGeneralInputs={setGeneralInputs}
        setFormulationGroups={setFormulationGroups}
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
