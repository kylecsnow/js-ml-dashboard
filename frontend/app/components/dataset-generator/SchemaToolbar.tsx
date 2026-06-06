'use client';

import type { RefObject } from 'react';
import type { SavedSchemaEntry } from '../../dataset-generator/page';

interface SchemaToolbarProps {
  savedSchemas: SavedSchemaEntry[];
  dropdownOpen: boolean;
  dropdownRef: RefObject<HTMLDivElement>;
  onToggleDropdown: () => void;
  onOpenSaveModal: () => void;
  onLoadSchema: (schema: SavedSchemaEntry) => void;
  onOpenRenameModal: (schema: SavedSchemaEntry) => void;
  onOpenDeleteModal: (schema: SavedSchemaEntry) => void;
}

const SchemaToolbar = ({
  savedSchemas,
  dropdownOpen,
  dropdownRef,
  onToggleDropdown,
  onOpenSaveModal,
  onLoadSchema,
  onOpenRenameModal,
  onOpenDeleteModal,
}: SchemaToolbarProps) => {
  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        onClick={onOpenSaveModal}
        className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
      >
        Save Schema
      </button>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={onToggleDropdown}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Load Schema {savedSchemas.length > 0 && `(${savedSchemas.length})`}
        </button>
        {dropdownOpen && (
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
                    onClick={() => onLoadSchema(schema)}
                    className="flex-1 text-left text-sm truncate"
                  >
                    {schema.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenRenameModal(schema);
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
                      onOpenDeleteModal(schema);
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
  );
};

export default SchemaToolbar;
