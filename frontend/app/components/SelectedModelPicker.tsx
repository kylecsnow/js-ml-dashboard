'use client';

import { useEffect, useState } from 'react';
import { useModel } from '../contexts/ModelContext';

export default function SelectedModelPicker() {
  const [models, setModels] = useState<string[]>([]);
  const { selectedModel, setSelectedModel } = useModel();

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('./api/models');
        const data = await response.json();
        setModels(data.models ?? []);
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    }

    fetchModels();
  }, []);

  const options = selectedModel && !models.includes(selectedModel)
    ? [selectedModel, ...models]
    : models;

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="selected-model" className="text-lg font-semibold">
        Selected model:
      </label>
      <select
        id="selected-model"
        value={selectedModel}
        onChange={(e) => setSelectedModel(e.target.value)}
        className="px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {!selectedModel && <option value="">No model selected</option>}
        {options.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
  );
}
