'use client';

import type { ReactNode, WheelEvent } from 'react';
import type { DescriptorGroup, FormulationGroup } from '../../dataset-generator/page';

// Placeholder defaults shown in the inputs. These mirror the resolved defaults
// applied by the validation/generation logic in the page component.
const PLACEHOLDER_MIN_BOUND = '0';
const PLACEHOLDER_MAX_BOUND = '1';
const PLACEHOLDER_MIN_GROUP_INGREDIENTS = '1';

interface FormulationSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  renderCollapseIcon: (isOpen: boolean) => ReactNode;
  formulationGroups: FormulationGroup[];
  minIngredientsPerFormulation: string;
  maxIngredientsPerFormulation: string;
  defaultIngredientCounts: { min: number; max: number } | null;
  onMinIngredientsChange: (value: string) => void;
  onMaxIngredientsChange: (value: string) => void;
  onAddGroup: () => void;
  onRemoveGroup: (groupId: string) => void;
  onUpdateGroup: (
    groupId: string,
    field: 'name' | 'min' | 'max' | 'minIngredients' | 'maxIngredients',
    value: string,
  ) => void;
  onAddIngredient: (groupId: string) => void;
  onRemoveIngredient: (groupId: string, ingredientId: string) => void;
  onUpdateIngredient: (
    groupId: string,
    ingredientId: string,
    field: keyof DescriptorGroup,
    value: string,
  ) => void;
  onUpdateIngredientRequired: (groupId: string, ingredientId: string, required: boolean) => void;
  preventWheelChange: (e: WheelEvent<HTMLInputElement>) => void;
}

const FormulationSection = ({
  isOpen,
  onToggle,
  renderCollapseIcon,
  formulationGroups,
  minIngredientsPerFormulation,
  maxIngredientsPerFormulation,
  defaultIngredientCounts,
  onMinIngredientsChange,
  onMaxIngredientsChange,
  onAddGroup,
  onRemoveGroup,
  onUpdateGroup,
  onAddIngredient,
  onRemoveIngredient,
  onUpdateIngredient,
  onUpdateIngredientRequired,
  preventWheelChange,
}: FormulationSectionProps) => {
  return (
    <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="mb-2 w-full flex items-center gap-4 text-left"
      >
        {renderCollapseIcon(isOpen)}
        <h2 className="text-lg font-bold">Formulation Inputs</h2>
      </button>
      {isOpen && (
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
                onChange={(e) => onMinIngredientsChange(e.target.value)}
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
                onChange={(e) => onMaxIngredientsChange(e.target.value)}
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
            onClick={onAddGroup}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Group
          </button>
          {formulationGroups.map(group => (
            <div key={group.id} className="mb-6 p-4 border-2 border-gray-300 rounded-lg relative bg-gray-50/40">
              <button
                onClick={() => onRemoveGroup(group.id)}
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
                    onChange={(e) => onUpdateGroup(group.id, 'name', e.target.value)}
                    className="w-full p-2 border border-gray-600 rounded"
                  />
                </div>
                <div className="md:w-28">
                  <label className="block text-sm font-medium mb-1">Group lower</label>
                  <input
                    type="number"
                    value={group.min}
                    onChange={(e) => onUpdateGroup(group.id, 'min', e.target.value)}
                    onWheel={preventWheelChange}
                    placeholder={PLACEHOLDER_MIN_BOUND}
                    className="w-full p-2 border border-gray-600 rounded"
                  />
                </div>
                <div className="md:w-28">
                  <label className="block text-sm font-medium mb-1">Group upper</label>
                  <input
                    type="number"
                    value={group.max}
                    onChange={(e) => onUpdateGroup(group.id, 'max', e.target.value)}
                    onWheel={preventWheelChange}
                    placeholder={PLACEHOLDER_MAX_BOUND}
                    className="w-full p-2 border border-gray-600 rounded"
                  />
                </div>
                <div className="md:w-28">
                  <label className="block text-sm font-medium mb-1">Min # per formulation</label>
                  <input
                    type="number"
                    value={group.minIngredients}
                    onChange={(e) => onUpdateGroup(group.id, 'minIngredients', e.target.value)}
                    onWheel={preventWheelChange}
                    min="0"
                    step="1"
                    placeholder={PLACEHOLDER_MIN_GROUP_INGREDIENTS}
                    className="w-full p-2 border border-gray-600 rounded"
                  />
                </div>
                <div className="md:w-28">
                  <label className="block text-sm font-medium mb-1">Max # per formulation</label>
                  <input
                    type="number"
                    value={group.maxIngredients}
                    onChange={(e) => onUpdateGroup(group.id, 'maxIngredients', e.target.value)}
                    onWheel={preventWheelChange}
                    min="0"
                    step="1"
                    placeholder={`${group.ingredients.length || "n"}`}
                    className="w-full p-2 border border-gray-600 rounded"
                  />
                </div>
              </div>

              <button
                onClick={() => onAddIngredient(group.id)}
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
                    onClick={() => onRemoveIngredient(group.id, ingredient.id)}
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
                        onChange={(e) => onUpdateIngredient(group.id, ingredient.id, 'name', e.target.value)}
                        className="w-full p-2 border border-gray-600 rounded"
                      />
                    </div>
                    <div className="md:w-28">
                      <label className="block text-sm font-medium mb-1">Lower bound</label>
                      <input
                        type="number"
                        value={ingredient.min}
                        onChange={(e) => onUpdateIngredient(group.id, ingredient.id, 'min', e.target.value)}
                        onWheel={preventWheelChange}
                        placeholder={PLACEHOLDER_MIN_BOUND}
                        className="w-full p-2 border border-gray-600 rounded"
                      />
                    </div>
                    <div className="md:w-28">
                      <label className="block text-sm font-medium mb-1">Upper bound</label>
                      <input
                        type="number"
                        value={ingredient.max}
                        onChange={(e) => onUpdateIngredient(group.id, ingredient.id, 'max', e.target.value)}
                        onWheel={preventWheelChange}
                        placeholder={PLACEHOLDER_MAX_BOUND}
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
                          onClick={() => onUpdateIngredientRequired(group.id, ingredient.id, false)}
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
                          onClick={() => onUpdateIngredientRequired(group.id, ingredient.id, true)}
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
  );
};

export default FormulationSection;
