'use client';

import Image from "next/image";
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import ChatSidebar from '../components/ChatSidebar';
import { Switch } from '@headlessui/react';
import { useCallback, useEffect, useRef, useState } from 'react';

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

type FormulationGroupConfig = Omit<FormulationGroup, 'id' | 'ingredients'> & {
  ingredients: Omit<FormulationDescriptorGroup, 'id'>[];
};

interface SchemaConfig {
  generalInputs: Omit<DescriptorGroup, 'id'>[];
  // New grouped structure. `formulationInputs` is still read for backwards
  // compatibility with schemas saved before ingredient groups existed.
  formulationGroups?: FormulationGroupConfig[];
  formulationInputs?: Omit<FormulationDescriptorGroup, 'id'>[];
  outputs: Omit<DescriptorGroup, 'id'>[];
  numRows: number | '';
  noise: number;
  filename: string;
  minIngredientsPerFormulation: string;
  maxIngredientsPerFormulation: string;
}

const DEFAULT_GROUP_NAME = 'Default Group';
const DEFAULT_MIN_BOUND = '0';
const DEFAULT_MAX_BOUND = '1';
const DEFAULT_MIN_GROUP_INGREDIENTS = '1';

const resolveMinBound = (value: string) => (value.trim() === '' ? DEFAULT_MIN_BOUND : value);
const resolveMaxBound = (value: string) => (value.trim() === '' ? DEFAULT_MAX_BOUND : value);

/** Resolved per-group min/max present-ingredient counts (matches generate/validate logic). */
const resolveGroupIngredientCounts = (group: FormulationGroup) => {
  const size = group.ingredients.length;
  const min = group.minIngredients.trim() === '' ? 1 : Number(group.minIngredients);
  const max = group.maxIngredients.trim() === '' ? size : Number(group.maxIngredients);
  const requiredCount = group.ingredients.filter(ing => ing.required).length;
  return { min, max, requiredCount };
};

/** Default global min/max when the top-level fields are left blank. */
const defaultGlobalIngredientCounts = (groups: FormulationGroup[]) => {
  let defaultMin = 0;
  let defaultMax = 0;
  for (const group of groups) {
    if (group.ingredients.length === 0) continue;
    const { min, max, requiredCount } = resolveGroupIngredientCounts(group);
    const groupMinContrib = min === 0 && requiredCount === 0 ? 0 : Math.max(min, requiredCount);
    defaultMin += groupMinContrib;
    defaultMax += max;
  }
  if (defaultMin < 1 && defaultMax > 0) {
    defaultMin = 1;
  }
  return { min: defaultMin, max: defaultMax };
};

const createEmptyIngredient = (): FormulationDescriptorGroup => ({
  id: crypto.randomUUID(),
  name: '',
  min: '',
  max: '',
  units: '',
  required: false,
});

const createEmptyFormulationGroup = (): FormulationGroup => ({
  id: crypto.randomUUID(),
  name: '',
  min: '',
  max: '',
  minIngredients: '',
  maxIngredients: '',
  ingredients: [createEmptyIngredient()],
});

interface SavedSchemaEntry {
  id: number;
  name: string;
  config: SchemaConfig;
  created_at: string | null;
}

const DatasetGeneratorPage = () => {
  const [generalInputs, setGeneralInputs] = useState<DescriptorGroup[]>([]);
  const [formulationGroups, setFormulationGroups] = useState<FormulationGroup[]>([]);
  const [outputs, setOutputs] = useState<DescriptorGroup[]>([]);
  const [numRows, setNumRows] = useState<number | ''>(50);
  const [showCoefficientsToggle, setShowCoefficientsToggle] = useState<boolean>(false);
  const [filename, setFilename] = useState<string>("generated_dataset");
  const [noise, setNoise] = useState<number>(0.025);
  const [error, setError] = useState<string>("");
  const [minIngredientsPerFormulation, setMinIngredientsPerFormulation] = useState<string>("");  // TODO: do we really want to allow these to be strings....???
  const [maxIngredientsPerFormulation, setMaxIngredientsPerFormulation] = useState<string>("");  // TODO: do we really want to allow these to be strings....???
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

    const config: SchemaConfig = {
      generalInputs: generalInputs.map(({ name, min, max, units }) => ({ name, min, max, units })),
      formulationGroups: formulationGroups.map(({ name, min, max, minIngredients, maxIngredients, ingredients }) => ({
        name,
        min,
        max,
        minIngredients,
        maxIngredients,
        ingredients: ingredients.map(({ name, min, max, units, required }) => ({ name, min, max, units, required })),
      })),
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
    const c = schema.config;
    setGeneralInputs(c.generalInputs.map(g => ({ ...g, id: crypto.randomUUID() })));

    // Prefer the grouped structure; fall back to migrating a legacy flat
    // formulationInputs list into a single default group.
    let groupConfigs: FormulationGroupConfig[];
    if (c.formulationGroups) {
      groupConfigs = c.formulationGroups;
    } else if (c.formulationInputs && c.formulationInputs.length > 0) {
      groupConfigs = [{
        name: DEFAULT_GROUP_NAME,
        min: '',
        max: '',
        minIngredients: '',
        maxIngredients: '',
        ingredients: c.formulationInputs,
      }];
    } else {
      groupConfigs = [];
    }
    setFormulationGroups(groupConfigs.map(g => ({
      id: crypto.randomUUID(),
      name: g.name ?? '',
      min: g.min ?? '',
      max: g.max ?? '',
      minIngredients: g.minIngredients ?? '',
      maxIngredients: g.maxIngredients ?? '',
      ingredients: (g.ingredients ?? []).map(ing => ({
        ...ing,
        required: ing.required ?? false,
        units: ing.units ?? '',
        id: crypto.randomUUID(),
      })),
    })));
    setOutputs(c.outputs.map(g => ({ ...g, id: crypto.randomUUID() })));
    setNumRows(c.numRows);
    setNoise(c.noise);
    setFilename(c.filename);
    setMinIngredientsPerFormulation(c.minIngredientsPerFormulation);
    setMaxIngredientsPerFormulation(c.maxIngredientsPerFormulation);
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
    // Validate filename
    if (!filename.trim()) {
      setError("Filename is required.");
      return;
    }

    // Flatten ingredients across all groups for cross-cutting checks.
    const allIngredients = formulationGroups.flatMap(g => g.ingredients);
    const totalIngredients = allIngredients.length;

    // Validate that at least one input type exists
    if (generalInputs.length === 0 && totalIngredients === 0) {
      setError("At least one General Input OR one Formulation Input is required.");
      return;
    }

    // Validate that at least one output exists
    if (outputs.length === 0) {
      setError("At least one Output is required.");
      return;
    }

    // Validate general inputs and outputs (name + bounds required)
    const namedBoundedGroups = [...generalInputs, ...outputs];
    for (const group of namedBoundedGroups) {
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

    // Validate formulation groups + their ingredients, accumulating feasibility totals.
    let forcedGroupMinTotal = 0; // sum of min present ingredients forced by always-present groups
    let sumGroupMax = 0;
    let sumForcedGroupMin = 0;
    let sumGroupMaxCounts = 0;

    for (const group of formulationGroups) {
      if (group.ingredients.length === 0) {
        setError(`Group "${group.name || '(unnamed)'}" must contain at least one ingredient.`);
        return;
      }
      if (!group.name.trim()) {
        setError("Group names cannot be left blank.");
        return;
      }
      const gMin = parseFloat(resolveMinBound(group.min));
      const gMax = parseFloat(resolveMaxBound(group.max));
      if (gMin < 0 || gMin > 1 || gMax < 0 || gMax > 1) {
        setError("Group bounds must all have values between 0 and 1.");
        return;
      }
      if (gMin > gMax) {
        setError(`Group "${group.name}" lower bound cannot exceed its upper bound.`);
        return;
      }

      const groupSize = group.ingredients.length;
      const { min: resolvedGroupMin, max: resolvedGroupMax, requiredCount: groupRequiredCount } =
        resolveGroupIngredientCounts(group);
      if (!Number.isInteger(resolvedGroupMin) || !Number.isInteger(resolvedGroupMax)) {
        setError("Group min/max ingredients must be integers.");
        return;
      }
      if (resolvedGroupMin < 0) {
        setError("Group min ingredients cannot be negative.");
        return;
      }
      if (resolvedGroupMin > resolvedGroupMax) {
        setError(`Group "${group.name}" min ingredients cannot exceed its max ingredients.`);
        return;
      }
      if (resolvedGroupMax > groupSize) {
        setError(`Group "${group.name}" max ingredients cannot exceed the number of ingredients in the group.`);
        return;
      }

      for (const ing of group.ingredients) {
        if (!ing.name.trim()) {
          setError("Variable names cannot be left blank.");
          return;
        }
        const iMin = parseFloat(resolveMinBound(ing.min));
        const iMax = parseFloat(resolveMaxBound(ing.max));
        if (iMin < 0 || iMin > 1 || iMax < 0 || iMax > 1) {
          setError("Formulation Input bounds must all have values between 0 and 1.");
          return;
        }
        if (iMin > iMax) {
          setError(`Ingredient "${ing.name}" lower bound cannot exceed its upper bound.`);
          return;
        }
        if (ing.required && iMin <= 0) {
          setError(`Required ingredient "${ing.name || '(unnamed)'}" must have a lower bound greater than 0.`);
          return;
        }
      }

      const isForced = resolvedGroupMin > 0 || groupRequiredCount > 0;
      sumGroupMax += gMax;
      sumGroupMaxCounts += resolvedGroupMax;
      if (isForced) {
        sumForcedGroupMin += gMin;
        forcedGroupMinTotal += Math.max(resolvedGroupMin, groupRequiredCount);
      }
    }

    if (totalIngredients > 0) {
      if (sumGroupMax < 1 - 1e-9) {
        setError("The sum of all group upper bounds is less than 1.0, so ingredient amounts cannot sum to 100%.");
        return;
      }
      if (sumForcedGroupMin > 1 + 1e-9) {
        setError("The sum of lower bounds for always-present groups exceeds 1.0; no feasible formulation exists.");
        return;
      }
    }

    // Resolve + validate the GLOBAL min/max ingredients per formulation.
    let resolvedMinIngredientsPerFormulation: number | null = null;
    let resolvedMaxIngredientsPerFormulation: number | null = null;

    if (totalIngredients > 0) {
      const nIngredients = totalIngredients;
      const { min: defaultGlobalMin, max: defaultGlobalMax } =
        formulationGroups.length > 0
          ? defaultGlobalIngredientCounts(formulationGroups)
          : { min: nIngredients, max: nIngredients };

      resolvedMinIngredientsPerFormulation =
        minIngredientsPerFormulation.trim() === ""
          ? defaultGlobalMin
          : Number(minIngredientsPerFormulation);
      resolvedMaxIngredientsPerFormulation =
        maxIngredientsPerFormulation.trim() === ""
          ? defaultGlobalMax
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

      if (forcedGroupMinTotal > resolvedMaxIngredientsPerFormulation) {
        setError("The minimum number of ingredients forced by groups cannot exceed max ingredients per formulation.");
        return;
      }

      if (sumGroupMaxCounts < resolvedMinIngredientsPerFormulation) {
        setError("The total of all group max ingredient counts is less than min ingredients per formulation.");
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
            formulation_groups: formulationGroups.map(g => ({
              name: g.name,
              min: resolveMinBound(g.min),
              max: resolveMaxBound(g.max),
              min_ingredients: g.minIngredients.trim() === "" ? null : Number(g.minIngredients),
              max_ingredients: g.maxIngredients.trim() === "" ? null : Number(g.maxIngredients),
              ingredients: g.ingredients.map(ing => ({
                ...ing,
                min: resolveMinBound(ing.min),
                max: resolveMaxBound(ing.max),
              })),
            })),
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

      const getDatasetBaseName = (rawName: string) => rawName.trim() || "generated_dataset";

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

            <div className="relative" ref={schemaDropdownRef}>
              <button
                onClick={() => setSchemaDropdownOpen(!schemaDropdownOpen)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Load Schema {savedSchemas.length > 0 && `(${savedSchemas.length})`}
              </button>
              {schemaDropdownOpen && (
                <div className="absolute z-10 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-64 overflow-y-auto">
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
                            openRenameModal(schema);
                          }}
                          className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm flex-shrink-0"
                          title="Rename schema"
                          aria-label={`Rename ${schema.name}`}
                        >
                          ✎
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(schema);
                          }}
                          className="ml-2 text-red-500 hover:text-red-700 text-sm flex-shrink-0"
                          title="Delete schema"
                          aria-label={`Delete ${schema.name}`}
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


          {/* Rename Schema modal */}
          {showRenameModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl">
                <h3 className="text-lg font-bold mb-4">Rename Schema</h3>
                <input
                  type="text"
                  value={renameSchemaInput}
                  onChange={(e) => setRenameSchemaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') renameSchema(); }}
                  placeholder="Enter a new name for this schema"
                  className="w-full p-2 border border-gray-600 rounded mb-4"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeRenameModal}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={renameSchema}
                    className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                  >
                    Rename
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* Delete Schema modal */}
          {showDeleteModal && deletingSchema && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl">
                <h3 className="text-lg font-bold mb-4">Delete Schema</h3>
                <div className="mb-6 text-sm text-gray-700 dark:text-gray-300">
                  <p>Are you sure you want to delete the following schema?</p>
                  <p className="mt-2 font-semibold">{deletingSchema.name}</p>
                  <p className="mt-2">This cannot be undone.</p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeDeleteModal}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteSchema}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Yes, Delete
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
              Dataset Name
            </label>
            <input
              type="text"
              value={filename}
              placeholder="generated_dataset"
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
            <button
              type="button"
              onClick={() => setIsGeneralInputsOpen((prev) => !prev)}
              className="mb-2 w-full flex items-center gap-4 text-left"
            >
              {renderCollapseIcon(isGeneralInputsOpen)}
              <h2 className="text-lg font-bold">General Inputs</h2>
            </button>
            {isGeneralInputsOpen && (
              <>
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
                    <div className="flex flex-col md:flex-row md:items-end gap-4">
                      <div className="md:flex-1 md:min-w-">
                        <label className="block text-sm font-medium mb-1">Variable name</label>
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => updateDescriptorGroup('general input', group.id, 'name', e.target.value)}
                          className="w-full p-2 border border-gray-600 rounded"
                        />
                      </div>
                      <div className="md:w-32">
                        <label className="block text-sm font-medium mb-1">Lower bound</label>
                        <input
                          type="number"
                          value={group.min}
                          onChange={(e) => updateDescriptorGroup('general input', group.id, 'min', e.target.value)}
                          onWheel={preventWheelChange}
                          className="w-full p-2 border border-gray-600 rounded"
                        />
                      </div>
                      <div className="md:w-32">
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
              </>
            )}
          </div>


          {/* Formulation Inputs Section */}
          <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
            <button
              type="button"
              onClick={() => setIsFormulationInputsOpen((prev) => !prev)}
              className="mb-2 w-full flex items-center gap-4 text-left"
            >
              {renderCollapseIcon(isFormulationInputsOpen)}
              <h2 className="text-lg font-bold">Formulation Inputs</h2>
            </button>
            {isFormulationInputsOpen && (
              <>
                <p className="mb-4 text-sm text-gray-600">
                  Lower and upper bounds (for both ingredients and groups) must be between 0 and 1, representing fractions 
                  that sum to 1 (i.e. 100%) across the whole formulation. Ex: 0.25 represents 25%. 
                  A group&apos;s bounds constrain the SUM of all its ingredients and apply only when at least one of its
                  ingredients is present. By default, ingredients are optionally included in any given formulation from the generator:
                  a positive lower bound applies only when thatingredient is included. Mark an ingredient as required to
                  force it into every formulation within its min/max bounds. Each group can also limit how many of its ingredients appear per formulation.
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
                      placeholder={
                        defaultIngredientCounts != null
                          ? `Defaults to ${defaultIngredientCounts.min}`
                          : 'Defaults to n_ingredients'
                      }
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
                      placeholder={
                        defaultIngredientCounts != null
                          ? `Defaults to ${defaultIngredientCounts.max}`
                          : 'Defaults to n_ingredients'
                      }
                      className="w-full p-2 border border-gray-600 rounded"
                    />
                  </div>
                </div>
                <button
                  onClick={addFormulationGroup}
                  className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add Group
                </button>
                {formulationGroups.map(group => (
                  <div key={group.id} className="mb-6 p-4 border-2 border-gray-300 rounded-lg relative bg-gray-50/40">
                    <button
                      onClick={() => removeFormulationGroup(group.id)}
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      title="Remove group"
                      aria-label="Remove group"
                    >
                      ✕
                    </button>

                    {/* Group-level fields */}
                    <div className="flex flex-col md:flex-row md:items-end gap-4 mb-4 pr-6">
                      <div className="md:flex-1 md:min-w-0">
                        <label className="block text-sm font-medium mb-1"><b>Group name</b></label>
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => updateFormulationGroup(group.id, 'name', e.target.value)}
                          className="w-full p-2 border border-gray-600 rounded"
                        />
                      </div>
                      <div className="md:w-28">
                        <label className="block text-sm font-medium mb-1">Group lower</label>
                        <input
                          type="number"
                          value={group.min}
                          onChange={(e) => updateFormulationGroup(group.id, 'min', e.target.value)}
                          onWheel={preventWheelChange}
                          placeholder={DEFAULT_MIN_BOUND}
                          className="w-full p-2 border border-gray-600 rounded"
                        />
                      </div>
                      <div className="md:w-28">
                        <label className="block text-sm font-medium mb-1">Group upper</label>
                        <input
                          type="number"
                          value={group.max}
                          onChange={(e) => updateFormulationGroup(group.id, 'max', e.target.value)}
                          onWheel={preventWheelChange}
                          placeholder={DEFAULT_MAX_BOUND}
                          className="w-full p-2 border border-gray-600 rounded"
                        />
                      </div>
                      <div className="md:w-28">
                        <label className="block text-sm font-medium mb-1">Min # per formulation</label>
                        <input
                          type="number"
                          value={group.minIngredients}
                          onChange={(e) => updateFormulationGroup(group.id, 'minIngredients', e.target.value)}
                          onWheel={preventWheelChange}
                          min="0"
                          step="1"
                          placeholder={DEFAULT_MIN_GROUP_INGREDIENTS}
                          className="w-full p-2 border border-gray-600 rounded"
                        />
                      </div>
                      <div className="md:w-28">
                        <label className="block text-sm font-medium mb-1">Max # per formulation</label>
                        <input
                          type="number"
                          value={group.maxIngredients}
                          onChange={(e) => updateFormulationGroup(group.id, 'maxIngredients', e.target.value)}
                          onWheel={preventWheelChange}
                          min="0"
                          step="1"
                          placeholder={`${group.ingredients.length || "n"}`}
                          className="w-full p-2 border border-gray-600 rounded"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => addIngredientToGroup(group.id)}
                      className="mb-3 px-3 py-1.5 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600"
                    >
                      Add Ingredient
                    </button>

                    {group.ingredients.length === 0 && (
                      <p className="text-sm text-gray-500 mb-2">No ingredients in this group yet.</p>
                    )}

                    {group.ingredients.map(ingredient => (
                      <div key={ingredient.id} className="mb-4 p-3 border rounded-lg relative bg-white">
                        <button
                          onClick={() => removeIngredientFromGroup(group.id, ingredient.id)}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                          title="Remove ingredient"
                          aria-label="Remove ingredient"
                        >
                          ✕
                        </button>
                        <div className="flex flex-col md:flex-row md:items-end gap-4 pr-6">
                          <div className="md:flex-1 md:min-w-0">
                            <label className="block text-sm font-medium mb-1">Variable name</label>
                            <input
                              type="text"
                              value={ingredient.name}
                              onChange={(e) => updateIngredientInGroup(group.id, ingredient.id, 'name', e.target.value)}
                              className="w-full p-2 border border-gray-600 rounded"
                            />
                          </div>
                          <div className="md:w-28">
                            <label className="block text-sm font-medium mb-1">Lower bound</label>
                            <input
                              type="number"
                              value={ingredient.min}
                              onChange={(e) => updateIngredientInGroup(group.id, ingredient.id, 'min', e.target.value)}
                              onWheel={preventWheelChange}
                              placeholder={DEFAULT_MIN_BOUND}
                              className="w-full p-2 border border-gray-600 rounded"
                            />
                          </div>
                          <div className="md:w-28">
                            <label className="block text-sm font-medium mb-1">Upper bound</label>
                            <input
                              type="number"
                              value={ingredient.max}
                              onChange={(e) => updateIngredientInGroup(group.id, ingredient.id, 'max', e.target.value)}
                              onWheel={preventWheelChange}
                              placeholder={DEFAULT_MAX_BOUND}
                              className="w-full p-2 border border-gray-600 rounded"
                            />
                          </div>
                          <div className="md:w-[186px]">
                            <label className="block text-sm font-medium mb-1">Inclusion</label>
                            <div
                              className="inline-flex w-full rounded-lg border border-gray-600 p-0.5"
                              role="group"
                              aria-label="Ingredient inclusion"
                            >
                              <button
                                type="button"
                                onClick={() => updateIngredientRequired(group.id, ingredient.id, false)}
                                aria-pressed={!ingredient.required}
                                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                  !ingredient.required
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : 'bg-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                              >
                                Optional
                              </button>
                              <button
                                type="button"
                                onClick={() => updateIngredientRequired(group.id, ingredient.id, true)}
                                aria-pressed={ingredient.required}
                                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                  ingredient.required
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : 'bg-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                              >
                                Required
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>


          {/* Outputs Section */}
          <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
            <button
              type="button"
              onClick={() => setIsOutputsOpen((prev) => !prev)}
              className="mb-2 w-full flex items-center gap-4 text-left"
            >
              {renderCollapseIcon(isOutputsOpen)}
              <h2 className="text-lg font-bold">Outputs</h2>
            </button>
            {isOutputsOpen && (
              <>
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
                    <div className="flex flex-col md:flex-row md:items-end gap-4">
                      <div className="md:flex-1 md:min-w-0">
                        <label className="block text-sm font-medium mb-1">Variable name</label>
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => updateDescriptorGroup('output', group.id, 'name', e.target.value)}
                          className="w-full p-2 border border-gray-600 rounded"
                        />
                      </div>
                      <div className="md:w-32">
                        <label className="block text-sm font-medium mb-1">Lower bound</label>
                        <input
                          type="number"
                          value={group.min}
                          onChange={(e) => updateDescriptorGroup('output', group.id, 'min', e.target.value)}
                          onWheel={preventWheelChange}
                          className="w-full p-2 border border-gray-600 rounded"
                        />
                      </div>
                      <div className="md:w-32">
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
              </>
            )}
          </div>
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
