'use client';

interface RenameSchemaModalProps {
  value: string;
  onChange: (value: string) => void;
  onRename: () => void;
  onCancel: () => void;
}

const RenameSchemaModal = ({ value, onChange, onRename, onCancel }: RenameSchemaModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl">
        <h3 className="text-lg font-bold mb-4">Rename Schema</h3>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onRename(); }}
          placeholder="Enter a new name for this schema"
          className="w-full p-2 border border-gray-600 rounded mb-4"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={onRename}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenameSchemaModal;
